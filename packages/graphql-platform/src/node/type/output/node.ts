import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import type { Except } from 'type-fest';
import type { BrokerInterface } from '../../../broker-interface.js';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type { Node } from '../../../node.js';
import type { Component } from '../../definition.js';
import { Leaf } from '../../definition/component/leaf.js';
import { UniqueReverseEdge } from '../../definition/reverse-edge/unique.js';
import type { OperationContext } from '../../operation/context.js';
import {
  mergeSelectionExpressions,
  NodeSelectedValue,
  NodeSelection,
  SelectionExpression,
} from '../../statement/selection.js';
import {
  EdgeHeadOutputType,
  LeafOutputType,
  MultipleReverseEdgeCountOutputType,
  MultipleReverseEdgeHeadOutputType,
  NodeFieldOutputType,
  ThunkableNillableVirtualFieldOutputConfig,
  ThunkableNillableVirtualFieldOutputConfigsByName,
  UniqueReverseEdgeHeadOutputType,
  VirtualFieldOutputType,
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

export type RawNodeSelection<TValue extends NodeSelectedValue = any> =
  | NodeSelection<TValue>
  | GraphQLSelectionAST
  | graphql.GraphQLResolveInfo
  | GraphQLFragment
  | Component['name'][];

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
  virtualFields?: ThunkableNillableVirtualFieldOutputConfigsByName<
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
  readonly #config?: NodeOutputTypeConfig<any, any, any, any>;
  readonly #configPath: utils.Path;

  public constructor(public readonly node: Node) {
    // config
    {
      this.#config = node.config.output || undefined;
      this.#configPath = utils.addPath(node.configPath, 'output');

      utils.assertNillablePlainObject(this.#config, this.#configPath);
    }
  }

  public toString(): string {
    return this.node.name;
  }

  @Memoize()
  public get fieldsByName(): ReadonlyMap<
    NodeFieldOutputType['name'],
    NodeFieldOutputType
  > {
    const fields: NodeFieldOutputType[] = [];

    for (const component of this.node.componentSet) {
      if (component instanceof Leaf) {
        fields.push(new LeafOutputType(component));
      } else {
        fields.push(new EdgeHeadOutputType(component));
      }
    }

    for (const reverseEdge of this.node.reverseEdgeSet) {
      if (reverseEdge instanceof UniqueReverseEdge) {
        fields.push(new UniqueReverseEdgeHeadOutputType(reverseEdge));
      } else {
        fields.push(
          new MultipleReverseEdgeHeadOutputType(reverseEdge),
          new MultipleReverseEdgeCountOutputType(reverseEdge),
        );
      }
    }

    // virtual-fields
    {
      const virtualFieldConfigsByName = utils.resolveThunkable(
        this.#config?.virtualFields,
        this.node,
      );
      const virtualFieldConfigsByNamePath = utils.addPath(
        this.#configPath,
        'virtualFields',
      );

      utils.assertNillablePlainObject(
        virtualFieldConfigsByName,
        virtualFieldConfigsByNamePath,
      );

      if (virtualFieldConfigsByName) {
        utils.aggregateGraphError<
          [utils.Name, ThunkableNillableVirtualFieldOutputConfig],
          void
        >(
          Object.entries(virtualFieldConfigsByName),
          (_, [virtualFieldName, thunkableNillableVirtualFieldConfig]) => {
            const virtualFieldConfig = utils.resolveThunkable(
              thunkableNillableVirtualFieldConfig,
              this.node,
            );

            const virtualFieldConfigPath = utils.addPath(
              virtualFieldConfigsByNamePath,
              virtualFieldName,
            );

            utils.assertNillablePlainObject(
              virtualFieldConfig,
              virtualFieldConfigPath,
            );

            if (virtualFieldConfig) {
              const virtualField = new VirtualFieldOutputType(
                this,
                virtualFieldName,
                virtualFieldConfig,
                virtualFieldConfigPath,
              );

              if (fields.some((field) => field.name === virtualField.name)) {
                throw new utils.GraphError(
                  `At least 1 field already have this name`,
                  { path: virtualFieldConfigPath },
                );
              }

              fields.push(virtualField);
            }
          },
          undefined,
          { path: virtualFieldConfigsByNamePath },
        );
      }
    }

    return new Map(fields.map((field) => [field.name, field]));
  }

  @Memoize()
  public getGraphQLObjectType(): graphql.GraphQLObjectType {
    assert(this.node.isPublic(), `The "${this.node}" node is private`);

    return new graphql.GraphQLObjectType({
      ...this.#config?.graphql,
      name: this.node.name,
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

  @Memoize()
  public validate(): void {
    utils.aggregateGraphError<NodeFieldOutputType, void>(
      this.fieldsByName.values(),
      (_, field) => field.validate(),
      undefined,
      { path: this.#configPath },
    );

    if (this.node.isPublic()) {
      this.getGraphQLObjectType();
    }
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
    componentNames: Component['name'][],
    _operationContext?: OperationContext,
    path?: utils.Path,
  ): NodeSelection {
    if (!Array.isArray(componentNames)) {
      throw new utils.UnexpectedValueError(
        `an array of component's name`,
        componentNames,
        { path },
      );
    }

    return new NodeSelection(
      this.node,
      mergeSelectionExpressions(
        componentNames.map(
          (componentName, index) =>
            this.node.getComponentByName(
              componentName,
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

    const fragmentDefinition = fragmentDefinitions.find(
      (definitionNode) =>
        definitionNode.typeCondition.name.value === this.node.name,
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

    if (ast.typeCondition.name.value !== this.node.name) {
      throw new utils.UnexpectedValueError(
        `a GraphQL ${graphql.Kind.FRAGMENT_DEFINITION} on "${this.node}"`,
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

    if (ast.typeCondition && ast.typeCondition.name.value !== this.node.name) {
      throw new utils.UnexpectedValueError(
        `a GraphQL ${graphql.Kind.INLINE_FRAGMENT} on "${this.node}"`,
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
              const fieldName = ast.name.value;

              // Handle the "__typename" meta field
              if (fieldName === graphql.TypeNameMetaFieldDef.name) {
                return [];
              }

              const fieldAlias = ast.alias?.value || undefined;
              const fieldKey = fieldAlias ?? fieldName;
              const field = this.getFieldByName(fieldName, path);

              return field instanceof VirtualFieldOutputType
                ? field.dependsOn?.expressions ?? []
                : field.selectGraphQLFieldNode(
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
      fieldNodes,
      fragments,
      path,
      returnType,
      variableValues,
    }: graphql.GraphQLResolveInfo,
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
    if (utils.isGraphQLResolveInfo(rawSelection)) {
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
          ([fieldName, fieldValue]) => {
            const field = this.getFieldByName(fieldName, path);

            return field instanceof VirtualFieldOutputType
              ? field.dependsOn?.expressions ?? []
              : field.selectShape(
                  fieldValue,
                  operationContext,
                  utils.addPath(path, fieldName),
                );
          },
        ),
        path,
      ),
    );
  }
}
