import {
  addPath,
  assertPlainObject,
  isGraphQLResolveInfo,
  isIterable,
  isNonEmptyArray,
  isPlainObject,
  Path,
  UnexpectedValueError,
  UnreachableValueError,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  GraphQLResolveInfo,
  InlineFragmentNode,
  parse,
  SelectionSetNode,
} from 'graphql';
import { ReadonlyDeep } from 'type-fest';
import { NodeType } from '../node';
import {
  EdgeFieldSelection,
  FieldSelection,
  isLeafAwareFieldSelection,
  isReferenceAwareFieldSelection,
  VirtualField,
} from './fields';
import { NodeValue } from './values';

export class NodeSelection {
  public constructor(
    public readonly node: NodeType,
    public readonly fields: ReadonlyArray<FieldSelection>,
  ) {
    if (!isNonEmptyArray(fields)) {
      throw new UnexpectedValueError(
        fields,
        `A node "selection" has to contain some "fields"`,
      );
    }

    Object.freeze(fields);
    Object.freeze(this);
  }

  @Memoize()
  public get immutable(): boolean {
    return this.fields.every(
      (selection) =>
        (isLeafAwareFieldSelection(selection) &&
          selection.field.leaf.immutable) ||
        (isReferenceAwareFieldSelection(selection) &&
          selection.field.reference.immutable &&
          (!(selection instanceof EdgeFieldSelection) ||
            selection.head.immutable)),
    );
  }

  public mergeWith(...nodeSelections: NodeSelection[]): NodeSelection {
    return nodeSelections.length === 0
      ? this
      : new NodeSelection(
          this.node,
          mergeFieldSelections(
            ...this.fields.concat(
              ...nodeSelections.map(({ fields }) => fields),
            ),
          ),
        );
  }

  public toSelectionSetNode(): SelectionSetNode {
    return Object.freeze<SelectionSetNode>({
      kind: 'SelectionSet',
      selections: Object.freeze<FieldNode>(
        this.fields.map((field) => field.toFieldNode()),
      ),
    });
  }

  public isValue(maybeValue: unknown): maybeValue is NodeValue {
    return (
      isPlainObject(maybeValue) &&
      this.fields.every((fieldSelection) =>
        fieldSelection.field.isValue(
          maybeValue[fieldSelection.key],
          fieldSelection,
        ),
      )
    );
  }

  public assertValue(maybeValue: unknown, path: Path): NodeValue {
    assertPlainObject(maybeValue, path);

    return Object.fromEntries(
      this.fields.map((fieldSelection) => [
        fieldSelection.key,
        fieldSelection.field.assertValue(
          maybeValue[fieldSelection.key],
          addPath(path, fieldSelection.key),
          fieldSelection,
        ),
      ]),
    );
  }
}

export function mergeFieldSelections(
  ...fieldSelections: FieldSelection[]
): FieldSelection[] {
  const fieldSelectionSetByKey = new Map<string, Set<FieldSelection>>();

  fieldSelections.forEach((fieldSelection) => {
    let fieldSelectionSet = fieldSelectionSetByKey.get(fieldSelection.key);

    if (!fieldSelectionSet) {
      fieldSelectionSetByKey.set(
        fieldSelection.key,
        (fieldSelectionSet = new Set()),
      );
    }

    fieldSelectionSet.add(fieldSelection);
  });

  return Array.from(fieldSelectionSetByKey.values(), (fieldSelectionSet) => {
    const [first, ...rest] = [...fieldSelectionSet];

    return first.mergeWith(...(rest as any[]));
  });
}

export function mergeNodeSelections(
  ...[firstNodeSelection, ...otherNodeSelections]: NodeSelection[]
): NodeSelection {
  if (!(firstNodeSelection instanceof NodeSelection)) {
    throw new UnexpectedValueError(firstNodeSelection, 'node selection');
  }

  return firstNodeSelection.mergeWith(...otherNodeSelections);
}

export type ASTContext = Partial<
  Pick<GraphQLResolveInfo, 'fragments' | 'variableValues'>
>;

export type ASTSelectionSet =
  | DocumentNode
  | FragmentDefinitionNode
  | InlineFragmentNode
  | SelectionSetNode;

export function parseASTSelectionSet(
  node: NodeType,
  ast: Readonly<ASTSelectionSet>,
  path?: Path,
  context?: ASTContext,
): NodeSelection {
  assertPlainObject(ast, path, `a valid GraphQL AST`);

  switch (ast.kind) {
    case 'Document': {
      const fragmentDefinitionNodes = ast.definitions.filter(
        (definitionNode): definitionNode is FragmentDefinitionNode =>
          definitionNode.kind === 'FragmentDefinition',
      );

      const definitionNode = fragmentDefinitionNodes.find(
        (definitionNode) =>
          definitionNode.typeCondition.name.value === node.name,
      );

      if (!definitionNode) {
        throw new UnexpectedValueError(
          ast,
          `a FragmentDefinition on "${node.name}"`,
          path,
        );
      }

      return parseASTSelectionSet(node, definitionNode, path, {
        ...context,
        fragments: {
          ...context?.fragments,
          ...Object.fromEntries(
            fragmentDefinitionNodes.map((definition) => [
              definition.name.value,
              definition,
            ]),
          ),
        },
      });
    }

    case 'FragmentDefinition': {
      if (ast.typeCondition.name.value !== node.name) {
        throw new UnexpectedValueError(
          ast.typeCondition.name.value,
          `the FragmentDefinition's typeCondition matches the node's type "${node.name}"`,
          path,
        );
      }

      return parseASTSelectionSet(node, ast.selectionSet, path, context);
    }

    case 'InlineFragment': {
      if (ast.typeCondition && ast.typeCondition.name.value !== node.name) {
        throw new UnexpectedValueError(
          ast.typeCondition.name.value,
          `the InlineFragment's typeCondition matches the node's type "${node.name}"`,
          path,
        );
      }

      return parseASTSelectionSet(node, ast.selectionSet, path, context);
    }

    case 'SelectionSet': {
      const fieldSelections = (<FieldSelection[]>[]).concat(
        ...ast.selections.map<ReadonlyArray<FieldSelection>>((ast) => {
          switch (ast.kind) {
            case 'Field': {
              const field = node.getField(ast.name.value, path);

              if (field instanceof VirtualField) {
                return field.dependsOn ?? [];
              } else {
                return [
                  field.select(
                    ast,
                    addPath(path, ast.alias?.value || ast.name.value),
                    context,
                  ),
                ];
              }
            }

            case 'FragmentSpread': {
              const fragmentDefinition = context?.fragments?.[ast.name.value];

              if (!fragmentDefinition) {
                throw new UnexpectedValueError(
                  fragmentDefinition,
                  `the FragmentDefinition named "${ast.name.value}"`,
                  path,
                );
              }

              return parseASTSelectionSet(
                node,
                fragmentDefinition,
                path,
                context,
              ).fields;
            }

            case 'InlineFragment': {
              return parseASTSelectionSet(node, ast, path, context).fields;
            }

            default:
              throw new UnreachableValueError(
                ast,
                `a Field, a FragmentSpread or an InlineFragment`,
                path,
              );
          }
        }),
      );

      return new NodeSelection(node, mergeFieldSelections(...fieldSelections));
    }

    default:
      throw new UnreachableValueError(
        ast,
        `a Document, a FragmentDefinition, an InlineFragment or a SelectionSet`,
        path,
      );
  }
}

export function parseResolveInfo(
  node: NodeType,
  resolveInfo: ReadonlyDeep<GraphQLResolveInfo>,
  path?: Path,
): NodeSelection {
  if (!isGraphQLResolveInfo(resolveInfo)) {
    throw new UnexpectedValueError(
      resolveInfo,
      `a valid GraphQLResolveInfo`,
      path,
    );
  }

  const context: ASTContext = {
    fragments: resolveInfo.fragments,
    variableValues: resolveInfo.variableValues,
  };

  const fieldSelections = (<FieldSelection[]>[]).concat(
    ...resolveInfo.fieldNodes.map((fieldNode) => {
      if (!fieldNode.selectionSet) {
        throw new UnexpectedValueError(fieldNode, `a selectionSet`, path);
      }

      return parseASTSelectionSet(
        node,
        fieldNode.selectionSet,
        resolveInfo.path,
        context,
      ).fields;
    }),
  );

  return new NodeSelection(node, mergeFieldSelections(...fieldSelections));
}

/**
 * A stringified fragment under one of these 4 forms:
 * - { _id id category { id } }
 * - ... { _id id category { id } }
 * - ... on Article { _id id category { id } }
 * - fragment MyFragment on Article { _id id category { id } }
 */
export type Fragment = string;

export function parseFragment(
  node: NodeType,
  fragment: Fragment,
  path?: Path,
  context?: ASTContext,
): NodeSelection {
  if (typeof fragment !== 'string') {
    throw new UnexpectedValueError(fragment, `a stringified fragment`, path);
  }

  const trimmedFragment = fragment.trim();

  let document: DocumentNode;

  try {
    document = parse(
      trimmedFragment.startsWith('fragment ')
        ? // A regular fragment
          trimmedFragment
        : // An anonymous or inline fragment
          trimmedFragment.replace(
            /(^|\.\.\.[^\{]*){/,
            `fragment MyFragment on ${node.name} {`,
          ),
    );
  } catch (error) {
    throw new UnexpectedValueError(error, `a stringified fragment`, path);
  }

  return parseASTSelectionSet(node, document, path, context);
}

export type ComponentNames = Iterable<string>;

export function parseComponentNames(
  node: NodeType,
  componentNames: ComponentNames,
  path?: Path,
): NodeSelection {
  if (
    !isIterable(componentNames) ||
    [...componentNames].some(
      (componentName) => typeof componentName !== 'string',
    )
  ) {
    throw new UnexpectedValueError(
      componentNames,
      `an iterable of string`,
      path,
    );
  }

  return new NodeSelection(
    node,
    mergeFieldSelections(
      ...Array.from(
        componentNames,
        (componentName) => node.model.getComponent(componentName).selection,
      ),
    ),
  );
}
