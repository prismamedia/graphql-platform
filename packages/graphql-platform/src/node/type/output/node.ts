import type { Name } from '@prismamedia/graphql-platform-utils';
import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter, MMethod } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert';
import type { Except } from 'type-fest';
import type { BrokerInterface } from '../../../broker-interface.js';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type { Node } from '../../../node.js';
import { Leaf, UniqueReverseEdge, type Component } from '../../definition.js';
import type { OperationContext } from '../../operation/context.js';
import {
  NodeSelection,
  mergeSelectionExpressions,
  type NodeSelectedSource,
  type NodeSelectedValue,
  type SelectionExpression,
} from '../../statement/selection.js';
import {
  EdgeHeadOutputType,
  LeafOutputType,
  MultipleReverseEdgeCountOutputType,
  MultipleReverseEdgeHeadOutputType,
  UniqueReverseEdgeHeadOutputType,
  VirtualOutputType,
  isMultipleReverseEdgeOutputType,
  type ComponentOutputType,
  type MultipleReverseEdgeOutputType,
  type NodeFieldOutputType,
  type ReverseEdgeOutputType,
  type ThunkableVirtualOutputConfig,
  type ThunkableVirtualOutputConfigsByName,
} from './node/field.js';

export * from './node/field.js';

export type GraphQLSelectionAST =
  | graphql.DocumentNode
  | graphql.FragmentDefinitionNode
  | graphql.InlineFragmentNode
  | graphql.SelectionSetNode;

export type GraphQLSelectionContext = Partial<
  Pick<graphql.GraphQLResolveInfo, 'fragments' | 'variableValues'>
>;

/**
 * A stringified fragment under one of these 4 forms:
 * * { _id id category { id } }
 * * ... { _id id category { id } }
 * * ... on Article { _id id category { id } }
 * * fragment MyFragment on Article { _id id category { id } }
 */
export type GraphQLFragment = string;

export type PartialGraphQLResolveInfo = Pick<
  graphql.GraphQLResolveInfo,
  'fieldNodes' | 'returnType' | 'path' | 'fragments' | 'variableValues'
>;

export const isPartialGraphQLResolveInfo = (
  maybePartialGraphQLResolveInfo: unknown,
): maybePartialGraphQLResolveInfo is PartialGraphQLResolveInfo =>
  utils.isPlainObject(maybePartialGraphQLResolveInfo) &&
  Array.isArray(maybePartialGraphQLResolveInfo['fieldNodes']) &&
  maybePartialGraphQLResolveInfo['fieldNodes'].length > 0 &&
  graphql.isOutputType(maybePartialGraphQLResolveInfo['returnType']) &&
  utils.isPath(maybePartialGraphQLResolveInfo['path']);

export type RawNodeSelection<
  TSource extends NodeSelectedSource = any,
  TValue extends NodeSelectedValue = TSource,
> =
  | NodeSelection<TSource, TValue>
  | ReadonlyArray<Component | Component['name']>
  | GraphQLFragment
  | GraphQLSelectionAST
  | PartialGraphQLResolveInfo;

export interface NodeOutputTypeConfig<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TBroker extends BrokerInterface,
  TContainer extends object,
> {
  /**
   * Optional, add some "virtual" fields whose value is computed from the components' value
   *
   * They are called "virtual" because they are not persisted
   */
  virtualFields?: ThunkableVirtualOutputConfigsByName<
    TRequestContext,
    TConnector,
    TBroker,
    TContainer
  >;

  /**
   * Optional, fine-tune the GraphQL output type
   */
  graphql?: Except<
    graphql.GraphQLObjectTypeConfig<
      Readonly<NodeSelectedValue>,
      TRequestContext
    >,
    'name' | 'description' | 'fields'
  >;
}

export class NodeOutputType {
  public readonly name: Name;

  readonly #config?: NodeOutputTypeConfig<any, any, any, any>;
  readonly #configPath: utils.Path;

  public constructor(public readonly node: Node) {
    // config
    {
      this.#config = node.config.output || undefined;
      this.#configPath = utils.addPath(node.configPath, 'output');

      utils.assertNillablePlainObject(this.#config, this.#configPath);
    }

    this.name = node.name;
  }

  public toString(): string {
    return this.name;
  }

  @MGetter
  public get componentFieldsByName(): ReadonlyMap<
    ComponentOutputType['name'],
    ComponentOutputType
  > {
    return new Map(
      Array.from(this.node.componentSet, (component) => {
        const field =
          component instanceof Leaf
            ? new LeafOutputType(this, component)
            : new EdgeHeadOutputType(this, component);

        return [field.name, field];
      }),
    );
  }

  @MGetter
  public get leafFieldsByName(): ReadonlyMap<
    LeafOutputType['name'],
    LeafOutputType
  > {
    return new Map(
      this.componentFieldsByName
        .entries()
        .filter(
          (entry): entry is [string, LeafOutputType] =>
            entry[1] instanceof LeafOutputType,
        ),
    );
  }

  @MGetter
  public get edgeFieldsByName(): ReadonlyMap<
    EdgeHeadOutputType['name'],
    EdgeHeadOutputType
  > {
    return new Map(
      this.componentFieldsByName
        .entries()
        .filter(
          (entry): entry is [string, EdgeHeadOutputType] =>
            entry[1] instanceof EdgeHeadOutputType,
        ),
    );
  }

  @MGetter
  public get reverseEdgeFieldsByName(): ReadonlyMap<
    ReverseEdgeOutputType['name'],
    ReverseEdgeOutputType
  > {
    return new Map(
      this.node.reverseEdgeSet.values().flatMap((reverseEdge) => {
        const fields: ReverseEdgeOutputType[] = [];

        if (reverseEdge instanceof UniqueReverseEdge) {
          fields.push(new UniqueReverseEdgeHeadOutputType(this, reverseEdge));
        } else {
          fields.push(
            new MultipleReverseEdgeHeadOutputType(this, reverseEdge),
            new MultipleReverseEdgeCountOutputType(this, reverseEdge),
          );
        }

        return fields.map((field) => [field.name, field]);
      }),
    );
  }

  @MGetter
  public get uniqueReverseEdgeFieldsByName(): ReadonlyMap<
    UniqueReverseEdgeHeadOutputType['name'],
    UniqueReverseEdgeHeadOutputType
  > {
    return new Map(
      this.reverseEdgeFieldsByName
        .entries()
        .filter(
          (entry): entry is [string, UniqueReverseEdgeHeadOutputType] =>
            entry[1] instanceof UniqueReverseEdgeHeadOutputType,
        ),
    );
  }

  @MGetter
  public get multipleReverseEdgeFieldsByName(): ReadonlyMap<
    MultipleReverseEdgeOutputType['name'],
    MultipleReverseEdgeOutputType
  > {
    return new Map(
      this.reverseEdgeFieldsByName
        .entries()
        .filter((entry): entry is [string, MultipleReverseEdgeOutputType] =>
          isMultipleReverseEdgeOutputType(entry[1]),
        ),
    );
  }

  @MGetter
  public get virtualFieldsByName(): ReadonlyMap<
    VirtualOutputType['name'],
    VirtualOutputType
  > {
    const fields: VirtualOutputType[] = [];

    const currentFieldNameSet = new Set([
      ...this.componentFieldsByName.keys(),
      ...this.reverseEdgeFieldsByName.keys(),
    ]);

    // virtual-fields
    this.node.features.forEach(({ config, configPath }) => {
      const outputConfig = config.output;
      const outputConfigPath = utils.addPath(configPath, 'output');

      utils.assertNillablePlainObject(outputConfig, outputConfigPath);

      if (!outputConfig?.virtualFields) {
        return;
      }

      const virtualFieldConfigsByName = utils.resolveThunkable(
        outputConfig.virtualFields,
        this.node,
      );
      const virtualFieldConfigsByNamePath = utils.addPath(
        outputConfigPath,
        'virtualFields',
      );

      utils.assertPlainObject(
        virtualFieldConfigsByName,
        virtualFieldConfigsByNamePath,
      );

      utils.aggregateGraphError<
        [utils.Name, ThunkableVirtualOutputConfig],
        void
      >(
        Object.entries(virtualFieldConfigsByName),
        (_, [virtualFieldName, thunkableVirtualFieldConfig]) => {
          const virtualFieldConfig = thunkableVirtualFieldConfig;
          const virtualFieldConfigPath = utils.addPath(
            virtualFieldConfigsByNamePath,
            virtualFieldName,
          );

          const virtualField = new VirtualOutputType(
            this,
            virtualFieldName,
            virtualFieldConfig,
            virtualFieldConfigPath,
          );

          if (currentFieldNameSet.has(virtualField.name)) {
            throw new utils.GraphError(
              `At least 1 field already have this name`,
              { path: virtualFieldConfigPath },
            );
          } else {
            currentFieldNameSet.add(virtualField.name);
          }

          fields.push(virtualField);
        },
        undefined,
        { path: virtualFieldConfigsByNamePath },
      );
    });

    return new Map(fields.map((field) => [field.name, field]));
  }

  @MGetter
  public get fieldsByName(): ReadonlyMap<
    NodeFieldOutputType['name'],
    NodeFieldOutputType
  > {
    return new Map<NodeFieldOutputType['name'], NodeFieldOutputType>([
      ...this.componentFieldsByName,
      ...this.reverseEdgeFieldsByName,
      ...this.virtualFieldsByName,
    ]);
  }

  @MMethod()
  public getGraphQLObjectType(): graphql.GraphQLObjectType {
    assert(this.node.isPublic(), `The "${this.node}" node is private`);

    return new graphql.GraphQLObjectType({
      ...this.#config?.graphql,
      name: this.name,
      description: this.node.description,
      fields: () =>
        Object.fromEntries(
          utils.aggregateGraphError<
            NodeFieldOutputType,
            [string, graphql.GraphQLFieldConfig<any, any>][]
          >(
            this.fieldsByName.values(),
            (entries, field) =>
              field.isPublic()
                ? [...entries, [field.name, field.getGraphQLFieldConfig()]]
                : entries,
            [],
            { path: this.#configPath },
          ),
        ),
    });
  }

  @MMethod()
  public validate(): void {
    utils.aggregateGraphError<NodeFieldOutputType, void>(
      this.fieldsByName.values(),
      (_, field) => field.validate(),
      undefined,
      { path: this.#configPath },
    );

    this.node.isPublic() && this.getGraphQLObjectType();
  }

  public getFieldByName(name: string, path?: utils.Path): NodeFieldOutputType {
    const field = this.fieldsByName.get(name);
    if (!field) {
      throw new utils.UnexpectedValueError(
        `${this.node.indefinite}'s field among "${[
          ...this.fieldsByName.keys(),
        ].join(', ')}"`,
        name,
        { path },
      );
    }

    return field;
  }

  public selectComponents(
    componentOrNames: ReadonlyArray<Component | Component['name']>,
    _operationContext?: OperationContext,
    path?: utils.Path,
  ): NodeSelection {
    if (!Array.isArray(componentOrNames)) {
      throw new utils.UnexpectedValueError(
        `an array of component`,
        componentOrNames,
        { path },
      );
    }

    return new NodeSelection(
      this.node,
      mergeSelectionExpressions(
        componentOrNames.map(
          (componentOrName, index) =>
            this.node.ensureComponent(
              componentOrName,
              utils.addPath(path, index),
            ).selection,
        ),
        path,
      ),
    );
  }

  public selectGraphQLFragment(
    fragment: GraphQLFragment,
    operationContext?: OperationContext,
    selectionContext?: GraphQLSelectionContext,
    path?: utils.Path,
  ): NodeSelection {
    if (typeof fragment !== 'string') {
      throw new utils.UnexpectedValueError(`a GraphQL fragment`, fragment, {
        path,
      });
    }

    const trimmedFragment = fragment.trim();

    let document: graphql.DocumentNode;
    try {
      document = graphql.parse(
        trimmedFragment.startsWith('fragment ')
          ? // A regular fragment
            trimmedFragment
          : // An anonymous or inline fragment
            trimmedFragment.replace(
              /(^|\.\.\.[^\{]*){/,
              `fragment MyFragment on ${this.node} {`,
            ),
      );
    } catch (cause) {
      throw new utils.UnexpectedValueError(
        `a valid GraphQL fragment`,
        fragment,
        { cause, path },
      );
    }

    return this.selectGraphQLDocumentNode(
      document,
      operationContext,
      selectionContext,
      path,
    );
  }

  @MGetter
  protected get typeNames(): ReadonlySet<graphql.GraphQLObjectType['name']> {
    return new Set([this.name, this.node.deletionOutputType.name]);
  }

  public selectGraphQLDocumentNode(
    ast: graphql.DocumentNode,
    operationContext?: OperationContext,
    selectionContext?: GraphQLSelectionContext,
    path?: utils.Path,
  ): NodeSelection {
    utils.assertGraphQLASTNode(ast, graphql.Kind.DOCUMENT, path);

    const fragmentDefinitions = ast.definitions.filter(
      (definitionNode): definitionNode is graphql.FragmentDefinitionNode =>
        definitionNode.kind === graphql.Kind.FRAGMENT_DEFINITION,
    );

    const fragmentDefinition = fragmentDefinitions.find((definitionNode) =>
      this.typeNames.has(definitionNode.typeCondition.name.value),
    );

    if (!fragmentDefinition) {
      throw new utils.UnexpectedValueError(
        `a GraphQL ${graphql.Kind.FRAGMENT_DEFINITION} on "${this.node}"`,
        ast,
        { path },
      );
    }

    return this.selectGraphQLFragmentDefinitionNode(
      fragmentDefinition,
      operationContext,
      {
        ...selectionContext,
        fragments: {
          ...selectionContext?.fragments,
          ...Object.fromEntries(
            fragmentDefinitions.map((definition) => [
              definition.name.value,
              definition,
            ]),
          ),
        },
      },
      path,
    );
  }

  public selectGraphQLFragmentDefinitionNode(
    ast: graphql.FragmentDefinitionNode,
    operationContext?: OperationContext,
    selectionContext?: GraphQLSelectionContext,
    path?: utils.Path,
  ): NodeSelection {
    utils.assertGraphQLASTNode(ast, graphql.Kind.FRAGMENT_DEFINITION, path);

    if (!this.typeNames.has(ast.typeCondition.name.value)) {
      throw new utils.UnexpectedValueError(
        `a GraphQL ${graphql.Kind.FRAGMENT_DEFINITION} on "${this}"`,
        ast,
        { path },
      );
    }

    return this.selectGraphQLSelectionSetNode(
      ast.selectionSet,
      operationContext,
      selectionContext,
      path,
    );
  }

  public selectGraphQLInlineFragmentNode(
    ast: graphql.InlineFragmentNode,
    operationContext?: OperationContext,
    selectionContext?: GraphQLSelectionContext,
    path?: utils.Path,
  ): NodeSelection {
    utils.assertGraphQLASTNode(ast, graphql.Kind.INLINE_FRAGMENT, path);

    if (
      ast.typeCondition &&
      !this.typeNames.has(ast.typeCondition.name.value)
    ) {
      throw new utils.UnexpectedValueError(
        `a GraphQL ${graphql.Kind.INLINE_FRAGMENT} on "${this}"`,
        ast,
        { path },
      );
    }

    return this.selectGraphQLSelectionSetNode(
      ast.selectionSet,
      operationContext,
      selectionContext,
      path,
    );
  }

  public selectGraphQLSelectionSetNode(
    ast: graphql.SelectionSetNode,
    operationContext?: OperationContext,
    selectionContext?: GraphQLSelectionContext,
    path?: utils.Path,
  ): NodeSelection {
    utils.assertGraphQLASTNode(ast, graphql.Kind.SELECTION_SET, path);

    return new NodeSelection(
      this.node,
      mergeSelectionExpressions(
        ast.selections.flatMap<SelectionExpression>((ast) => {
          /**
           * "[...] the field or fragment must not be queried if either the @skip condition is true or the @include condition is false [...]"
           *
           * @see http://spec.graphql.org/draft/#note-f3059
           */
          if (
            ast.directives?.some((directive) =>
              directive.name.value === 'skip'
                ? directive.arguments?.find(
                    (argument) =>
                      argument.name.value === 'if' &&
                      graphql.valueFromASTUntyped(
                        argument.value,
                        selectionContext?.variableValues,
                      ) === true,
                  )
                : directive.name.value === 'include'
                  ? directive.arguments?.find(
                      (argument) =>
                        argument.name.value === 'if' &&
                        graphql.valueFromASTUntyped(
                          argument.value,
                          selectionContext?.variableValues,
                        ) === false,
                    )
                  : false,
            )
          ) {
            return [];
          }

          switch (ast.kind) {
            case graphql.Kind.FIELD: {
              const fieldAlias = ast.alias?.value;
              const fieldName = ast.name.value;
              const fieldKey = fieldAlias ?? fieldName;

              // Handle the "__typename" meta field
              if (fieldName === graphql.TypeNameMetaFieldDef.name) {
                return [];
              }

              return this.getFieldByName(
                fieldName,
                path,
              ).selectGraphQLFieldNode(
                ast,
                operationContext,
                selectionContext,
                utils.addPath(path, fieldKey),
              );
            }

            case graphql.Kind.FRAGMENT_SPREAD: {
              const fragmentName = ast.name.value;
              const fragmentDefinition =
                selectionContext?.fragments?.[fragmentName];

              if (!fragmentDefinition) {
                throw new utils.UnexpectedValueError(
                  `the GraphQL fragment definition named "${fragmentName}"`,
                  selectionContext?.fragments,
                  { path },
                );
              }

              return this.selectGraphQLFragmentDefinitionNode(
                fragmentDefinition,
                operationContext,
                selectionContext,
                path,
              ).expressions;
            }

            case graphql.Kind.INLINE_FRAGMENT: {
              return this.selectGraphQLInlineFragmentNode(
                ast,
                operationContext,
                selectionContext,
                path,
              ).expressions;
            }

            default:
              throw new utils.UnreachableValueError(ast, { path });
          }
        }),
        path,
      ),
    );
  }

  public selectGraphQLResolveInfo(
    {
      returnType,
      fieldNodes,
      path,
      fragments,
      variableValues,
    }: PartialGraphQLResolveInfo,
    operationContext?: OperationContext,
  ): NodeSelection {
    const namedReturnType = graphql.getNamedType(returnType);
    if (namedReturnType !== this.getGraphQLObjectType()) {
      throw new utils.UnexpectedValueError(
        `a resolver returning ${this.node.indefinite}`,
        String(namedReturnType),
        { path },
      );
    }

    return this.selectGraphQLSelectionSetNode(
      fieldNodes[0].selectionSet!,
      operationContext,
      { fragments, variableValues },
      path,
    );
  }

  public select(
    rawSelection: RawNodeSelection,
    operationContext?: OperationContext,
    selectionContext?: GraphQLSelectionContext,
    path?: utils.Path,
  ): NodeSelection {
    if (rawSelection == null) {
      throw new utils.UnexpectedValueError(
        `${this.node.indefinite}'s selection`,
        rawSelection,
        { path },
      );
    }

    if (rawSelection instanceof NodeSelection) {
      return rawSelection;
    }

    // Components
    if (Array.isArray(rawSelection)) {
      return this.selectComponents(rawSelection, operationContext, path);
    }

    // GraphQL fragment
    if (typeof rawSelection === 'string') {
      return this.selectGraphQLFragment(
        rawSelection,
        operationContext,
        selectionContext,
        path,
      );
    }

    // GraphQL AST
    if (utils.isPlainObject(rawSelection) && 'kind' in rawSelection) {
      switch (rawSelection.kind) {
        case graphql.Kind.DOCUMENT:
          return this.selectGraphQLDocumentNode(
            rawSelection,
            operationContext,
            selectionContext,
            path,
          );

        case graphql.Kind.FRAGMENT_DEFINITION:
          return this.selectGraphQLFragmentDefinitionNode(
            rawSelection,
            operationContext,
            selectionContext,
            path,
          );

        case graphql.Kind.INLINE_FRAGMENT:
          return this.selectGraphQLInlineFragmentNode(
            rawSelection,
            operationContext,
            selectionContext,
            path,
          );

        case graphql.Kind.SELECTION_SET:
          return this.selectGraphQLSelectionSetNode(
            rawSelection,
            operationContext,
            selectionContext,
            path,
          );

        default:
          throw new utils.UnreachableValueError(rawSelection, { path });
      }
    }

    // GraphQL resolve info
    if (isPartialGraphQLResolveInfo(rawSelection)) {
      return this.selectGraphQLResolveInfo(rawSelection, operationContext);
    }

    throw new utils.UnexpectedValueError(
      `a supported "${this.node}"'s selection`,
      rawSelection,
      { path },
    );
  }

  public selectShape(
    shape: unknown,
    operationContext?: OperationContext,
    path?: utils.Path,
  ): NodeSelection {
    utils.assertPlainObject(shape, path);

    return new NodeSelection(
      this.node,
      mergeSelectionExpressions(
        Object.entries(shape).flatMap<SelectionExpression>(
          ([fieldName, fieldValue]) =>
            this.getFieldByName(fieldName, path).selectShape(
              fieldValue,
              operationContext,
              utils.addPath(path, fieldName),
            ),
        ),
        path,
      ),
    );
  }
}
