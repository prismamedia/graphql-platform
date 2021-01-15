import {
  addPath,
  getNormalizedObject,
  isGraphQLResolveInfo,
  isPlainObject,
  Path,
  PlainObject,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import {
  DocumentNode,
  FragmentDefinitionNode,
  GraphQLResolveInfo,
  InlineFragmentNode,
  parse,
  SelectionSetNode,
} from 'graphql';
import { isEqual } from 'lodash';
import { Node } from '../node';
import { Edge } from './component';
import { CustomField, IEdgeSelection, TFieldSelection } from './fields';
import { ReverseEdge } from './reverse-edge';
import { UniqueConstraint } from './unique-constraint';

export function getSelectionKey(selection: TFieldSelection): string {
  return ('alias' in selection && selection.alias) || selection.name;
}

export function getSelectedEdge(
  node: Node,
  selection: TFieldSelection<'Edge' | 'EdgeExistence'>,
): Edge {
  return node.getEdge(
    selection.kind === 'Edge' ? selection.name : selection.edge,
  );
}

export function getSelectedReverseEdge(
  node: Node,
  selection: TFieldSelection<
    | 'ReverseEdge'
    | 'ReverseEdgeCount'
    | 'UniqueReverseEdge'
    | 'UniqueReverseEdgeExistence'
  >,
): ReverseEdge {
  return node.getReverseEdge(
    selection.kind === 'ReverseEdge' || selection.kind === 'UniqueReverseEdge'
      ? selection.name
      : selection.reverseEdge,
  );
}

export function getSelectedNode(
  node: Node,
  selection: TFieldSelection<
    | 'Edge'
    | 'EdgeExistence'
    | 'ReverseEdge'
    | 'ReverseEdgeCount'
    | 'UniqueReverseEdge'
    | 'UniqueReverseEdgeExistence'
  >,
): Node {
  return selection.kind === 'Edge' || selection.kind === 'EdgeExistence'
    ? getSelectedEdge(node, selection).to
    : getSelectedReverseEdge(node, selection).to;
}

export function getNormalizedSelectionArgs(
  selection: TFieldSelection,
): PlainObject | undefined {
  return 'args' in selection && selection.args
    ? getNormalizedObject(selection.args as any)
    : undefined;
}

export function mergeSelections(
  ...selections: TFieldSelection[]
): TFieldSelection[] {
  let mergedSelections: TFieldSelection[] = [];

  for (const selection of selections) {
    const currentSelectionIndex = mergedSelections.findIndex(
      (currentSelection) =>
        currentSelection.kind === selection.kind &&
        currentSelection.name === selection.name,
    );

    if (currentSelectionIndex === -1) {
      mergedSelections.push(selection);
    } else {
      const currentSelection = mergedSelections[currentSelectionIndex];

      if (
        getSelectionKey(currentSelection) === getSelectionKey(selection) &&
        !isEqual(
          getNormalizedSelectionArgs(currentSelection),
          getNormalizedSelectionArgs(selection),
        )
      ) {
        throw new Error(
          `The 2 selections keyed "${getSelectionKey(
            currentSelection,
          )}" have different arguments: ${JSON.stringify(
            getNormalizedSelectionArgs(currentSelection),
          )} / ${JSON.stringify(getNormalizedSelectionArgs(selection))}`,
        );
      }

      if ('selections' in currentSelection && 'selections' in selection) {
        mergedSelections[currentSelectionIndex] = {
          ...currentSelection,
          selections: mergeSelections(
            ...currentSelection.selections,
            ...selection.selections,
          ),
        };
      }
    }
  }

  return mergedSelections;
}

function isSelectionSetInReference(
  selections: ReadonlyArray<TFieldSelection>,
  reference: UniqueConstraint,
): boolean {
  const referencedNode = reference.node;

  return selections.every((selection) => {
    switch (selection.kind) {
      case 'Leaf':
        return reference.componentSet.has(
          referencedNode.getLeaf(selection.name),
        );

      case 'Edge':
        const edge = referencedNode.getEdge(selection.name);

        return (
          reference.componentSet.has(edge) &&
          isReferenceSelection(selection, edge)
        );

      case 'Custom':
        return true;

      default:
        return false;
    }
  });
}

/**
 * Returns true if the edge selection contains only values in the reference
 */
export function isReferenceSelection(
  edgeSelection: IEdgeSelection,
  edge: Edge,
): boolean {
  return isSelectionSetInReference(edgeSelection.selections, edge.reference);
}

export type TASTContext = Partial<
  Pick<GraphQLResolveInfo, 'fragments' | 'variableValues'>
>;

export type TASTSelectionSet =
  | DocumentNode
  | FragmentDefinitionNode
  | InlineFragmentNode
  | SelectionSetNode;

export function parseASTSelections(
  node: Node,
  ast: TASTSelectionSet,
  path?: Path,
  context?: TASTContext,
): TFieldSelection[] {
  if (!isPlainObject(ast)) {
    throw new UnexpectedValueError(ast, `a valid GraphQL AST`, path);
  }

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

      return parseASTSelections(node, definitionNode, path, {
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

      return parseASTSelections(node, ast.selectionSet, path, context);
    }

    case 'InlineFragment': {
      if (ast.typeCondition && ast.typeCondition.name.value !== node.name) {
        throw new UnexpectedValueError(
          ast.typeCondition.name.value,
          `the InlineFragment's typeCondition matches the node's type "${node.name}"`,
          path,
        );
      }

      return parseASTSelections(node, ast.selectionSet, path, context);
    }

    case 'SelectionSet': {
      let selections: TFieldSelection[] = [];

      for (const selection of ast.selections) {
        switch (selection.kind) {
          case 'Field': {
            const field = node.getField(selection.name.value, path);

            if (field instanceof CustomField && field.dependsOn?.length) {
              selections = mergeSelections(...selections, ...field.dependsOn);
            }

            selections = mergeSelections(
              ...selections,
              field.parseFieldNode(
                selection,
                addPath(path, selection.alias?.value || selection.name.value),
                context,
              ),
            );
            break;
          }

          case 'FragmentSpread': {
            const fragmentDefinition =
              context?.fragments?.[selection.name.value];

            if (!fragmentDefinition) {
              throw new UnexpectedValueError(
                fragmentDefinition,
                `the FragmentDefinition named "${selection.name.value}"`,
                path,
              );
            }

            selections = mergeSelections(
              ...selections,
              ...parseASTSelections(node, fragmentDefinition, path, context),
            );
            break;
          }

          case 'InlineFragment': {
            selections = mergeSelections(
              ...selections,
              ...parseASTSelections(node, selection, path, context),
            );
            break;
          }

          default:
            throw new UnexpectedValueError(
              selection,
              `a Field, a FragmentSpread or an InlineFragment`,
              path,
            );
        }
      }

      return selections;
    }

    default:
      throw new UnexpectedValueError(
        ast,
        `a Document, a FragmentDefinition, an InlineFragment or a SelectionSet`,
        path,
      );
  }
}

export function parseResolverSelections(
  node: Node,
  info: Readonly<GraphQLResolveInfo>,
  path?: Path,
): TFieldSelection[] {
  if (!isGraphQLResolveInfo(info)) {
    throw new UnexpectedValueError(info, `a valid GraphQLResolveInfo`, path);
  }

  let selections: TFieldSelection[] = [];

  for (const fieldNode of info.fieldNodes) {
    if (!fieldNode.selectionSet) {
      throw new UnexpectedValueError(fieldNode, `a selectionSet`, path);
    }

    selections = mergeSelections(
      ...selections,
      ...parseASTSelections(node, fieldNode.selectionSet, info.path, {
        fragments: info.fragments,
        variableValues: info.variableValues,
      }),
    );
  }

  return selections;
}

/**
 * A stringified fragment/selectionSet under one of these 4 forms:
 * - { _id id category { id } }
 * - ... { _id id category { id } }
 * - ... on Article { _id id category { id } }
 * - fragment MyFragment on Article { _id id category { id } }
 */
export type TFragment = string;

export function parseFragmentSelections(
  node: Node,
  fragment: Readonly<TFragment>,
  path: Path = addPath(undefined, node.name),
): TFieldSelection[] {
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
      { noLocation: true },
    );
  } catch (error) {
    throw new UnexpectedValueError(error, `a stringified fragment`, path);
  }

  return parseASTSelections(node, document, path);
}

export type TSelections =
  | TASTSelectionSet
  | GraphQLResolveInfo
  | TFragment
  | ReadonlyArray<TFieldSelection>;

export function isSelection(
  maybeSelection: unknown,
): maybeSelection is TFieldSelection {
  return (
    isPlainObject(maybeSelection) &&
    'kind' in maybeSelection &&
    typeof maybeSelection.kind === 'string' &&
    'name' in maybeSelection &&
    typeof maybeSelection.name === 'string'
  );
}

export function areSelections(
  maybeSelections: unknown,
): maybeSelections is ReadonlyArray<TFieldSelection> {
  return (
    Array.isArray(maybeSelections) &&
    maybeSelections.every((selection) => isSelection(selection))
  );
}

export function parseSelections(
  node: Node,
  selections: TSelections,
  path?: Path,
): ReadonlyArray<TFieldSelection> {
  return areSelections(selections)
    ? selections
    : typeof selections === 'string'
    ? parseFragmentSelections(node, selections, path)
    : isGraphQLResolveInfo(selections)
    ? parseResolverSelections(node, selections, path)
    : parseASTSelections(node, selections, path);
}
