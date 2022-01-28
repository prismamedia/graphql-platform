import {
  addPath,
  aggregateConfigError,
  aggregateError,
  assertGraphQLASTNode,
  assertNillablePlainObjectConfig,
  castToError,
  ConfigError,
  isGraphQLResolveInfo,
  isPlainObject,
  UnexpectedValueError,
  UnreachableValueError,
  type Name,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type { Node } from '../../../node.js';
import type { Component } from '../../definition.js';
import type { OperationContext } from '../../operation/context.js';
import {
  ComponentSelection,
  mergeSelectionExpressions,
  NodeSelectedValue,
  NodeSelection,
  SelectionExpression,
} from '../../statement/selection.js';
import { resolveMaybeNodeAwareConfig } from '../maybe-node-aware-config.js';
import {
  EdgeHeadOutputType,
  LeafOutputType,
  NodeFieldOutputType,
  ReverseEdgeMultipleCountOutputType,
  ReverseEdgeMultipleHeadOutputType,
  ReverseEdgeUniqueHeadOutputType,
  VirtualFieldOutputType,
  VirtualFieldOutputTypeConfig,
  VirtualFieldOutputTypeConfigMap,
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

export type RawNodeSelection =
  | NodeSelection
  | GraphQLSelectionAST
  | graphql.GraphQLResolveInfo
  | GraphQLFragment
  | Component['name'][];

export interface NodeOutputTypeConfig<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> {
  /**
   * Optional, add some "virtual" fields whose value is computed from the other fields' value
   *
   * They are called "virtual" because their value is not stored
   */
  virtualFields?: VirtualFieldOutputTypeConfigMap<TRequestContext, TConnector>;

  /**
   * Optional, fine-tune the node's GraphQL output type
   */
  graphql?: Omit<
    graphql.GraphQLObjectTypeConfig<
      Readonly<NodeSelectedValue>,
      TRequestContext
    >,
    'name' | 'description' | 'fields'
  >;
}

export class NodeOutputType {
  readonly #config?: NodeOutputTypeConfig<any, any>;
  readonly #configPath: Path;

  public constructor(public readonly node: Node) {
    // config
    {
      this.#config = node.config.output || undefined;
      this.#configPath = addPath(node.configPath, 'output');

      assertNillablePlainObjectConfig(this.#config, this.#configPath);
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

    for (const component of this.node.componentsByName.values()) {
      if (component.kind === 'Leaf') {
        fields.push(new LeafOutputType(component));
      } else {
        fields.push(new EdgeHeadOutputType(component));
      }
    }

    for (const reverseEdge of this.node.reverseEdgesByName.values()) {
      if (reverseEdge.kind === 'Unique') {
        fields.push(new ReverseEdgeUniqueHeadOutputType(reverseEdge));
      } else {
        fields.push(
          new ReverseEdgeMultipleHeadOutputType(reverseEdge),
          new ReverseEdgeMultipleCountOutputType(reverseEdge),
        );
      }
    }

    if (this.#config?.virtualFields) {
      const virtualFieldsConfigPath = addPath(
        this.#configPath,
        'virtualFields',
      );

      const virtualFieldsConfig = resolveMaybeNodeAwareConfig(
        this.node,
        this.#config.virtualFields,
      );

      assertNillablePlainObjectConfig(
        virtualFieldsConfig,
        virtualFieldsConfigPath,
      );

      if (virtualFieldsConfig) {
        aggregateConfigError<
          [Name, VirtualFieldOutputTypeConfig<any, any>],
          void
        >(
          Object.entries(virtualFieldsConfig),
          (_, [virtualFieldName, virtualFieldConfig]) => {
            const virtualFieldConfigPath = addPath(
              virtualFieldsConfigPath,
              virtualFieldName,
            );

            const virtualField = new VirtualFieldOutputType(
              this,
              virtualFieldName,
              virtualFieldConfig,
              virtualFieldConfigPath,
            );

            if (fields.some((field) => field.name === virtualField.name)) {
              throw new ConfigError(`At least 1 field already have this name`, {
                path: virtualFieldConfigPath,
              });
            }

            fields.push(virtualField);
          },
          undefined,
          { path: virtualFieldsConfigPath },
        );
      }
    }

    return new Map(fields.map((field) => [field.name, field]));
  }

  @Memoize()
  public getGraphQLObjectType(): graphql.GraphQLObjectType {
    assert(this.node.isPublic(), `The "${this.node.name}" node is private`);

    return new graphql.GraphQLObjectType({
      ...this.#config?.graphql,
      name: this.node.name,
      description: this.node.description,
      fields: () =>
        Object.fromEntries(
          aggregateConfigError<
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
    aggregateConfigError<NodeFieldOutputType, void>(
      this.fieldsByName.values(),
      (_, field) => field.validate(),
      undefined,
      { path: this.#configPath },
    );

    if (this.node.isPublic()) {
      this.getGraphQLObjectType();
    }
  }

  public getField(name: string, path?: Path): NodeFieldOutputType {
    const field = this.fieldsByName.get(name);
    if (!field) {
      throw new UnexpectedValueError(`${this.node.indefinite}'s field`, name, {
        path,
      });
    }

    return field;
  }

  public selectComponents(
    componentNames: Component['name'][],
    operationContext?: OperationContext,
    path?: Path,
  ): NodeSelection {
    if (!Array.isArray(componentNames)) {
      throw new UnexpectedValueError(
        `an array of component's name`,
        componentNames,
        { path },
      );
    }

    return new NodeSelection(
      this.node,
      mergeSelectionExpressions(
        aggregateError<Component['name'], ComponentSelection[]>(
          componentNames,
          (expressions, componentName, index) => {
            const component = this.node.getComponent(
              componentName,
              addPath(path, index),
            );

            if (component.kind === 'Edge') {
              operationContext?.getNodeAuthorization(
                component.head,
                addPath(path, component.name),
              );
            }

            return [...expressions, component.selection];
          },
          [],
          { path },
        ),
        path,
      ),
    );
  }

  public selectGraphQLFragment(
    fragment: GraphQLFragment,
    operationContext?: OperationContext,
    selectionContext?: GraphQLSelectionContext,
    path?: Path,
  ): NodeSelection {
    if (typeof fragment !== 'string') {
      throw new UnexpectedValueError(`a GraphQL fragment`, fragment, {
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
              `fragment MyFragment on ${this.node.name} {`,
            ),
      );
    } catch (error) {
      throw new UnexpectedValueError(`a valid GraphQL fragment`, fragment, {
        path,
        cause: castToError(error),
      });
    }

    return this.selectGraphQLDocument(
      document,
      operationContext,
      selectionContext,
      path,
    );
  }

  public selectGraphQLDocument(
    ast: graphql.DocumentNode,
    operationContext?: OperationContext,
    selectionContext?: GraphQLSelectionContext,
    path?: Path,
  ): NodeSelection {
    assertGraphQLASTNode(ast, graphql.Kind.DOCUMENT, path);

    const fragmentDefinitions = ast.definitions.filter(
      (definitionNode): definitionNode is graphql.FragmentDefinitionNode =>
        definitionNode.kind === graphql.Kind.FRAGMENT_DEFINITION,
    );

    const fragmentDefinition = fragmentDefinitions.find(
      (definitionNode) =>
        definitionNode.typeCondition.name.value === this.node.name,
    );

    if (!fragmentDefinition) {
      throw new UnexpectedValueError(
        `a GraphQL ${graphql.Kind.FRAGMENT_DEFINITION} on "${this.node.name}"`,
        ast,
        { path },
      );
    }

    return this.selectGraphQLFragmentDefinition(
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

  public selectGraphQLFragmentDefinition(
    ast: graphql.FragmentDefinitionNode,
    operationContext?: OperationContext,
    selectionContext?: GraphQLSelectionContext,
    path?: Path,
  ): NodeSelection {
    assertGraphQLASTNode(ast, graphql.Kind.FRAGMENT_DEFINITION, path);

    if (ast.typeCondition.name.value !== this.node.name) {
      throw new UnexpectedValueError(
        `a GraphQL ${graphql.Kind.FRAGMENT_DEFINITION} on "${this.node.name}"`,
        ast,
        { path },
      );
    }

    return this.selectGraphQLSelectionSet(
      ast.selectionSet,
      operationContext,
      selectionContext,
      path,
    );
  }

  public selectGraphQLInlineFragment(
    ast: graphql.InlineFragmentNode,
    operationContext?: OperationContext,
    selectionContext?: GraphQLSelectionContext,
    path?: Path,
  ): NodeSelection {
    assertGraphQLASTNode(ast, graphql.Kind.INLINE_FRAGMENT, path);

    if (ast.typeCondition && ast.typeCondition.name.value !== this.node.name) {
      throw new UnexpectedValueError(
        `a GraphQL ${graphql.Kind.INLINE_FRAGMENT} on "${this.node.name}"`,
        ast,
        { path },
      );
    }

    return this.selectGraphQLSelectionSet(
      ast.selectionSet,
      operationContext,
      selectionContext,
      path,
    );
  }

  public selectGraphQLSelectionSet(
    ast: graphql.SelectionSetNode,
    operationContext?: OperationContext,
    selectionContext?: GraphQLSelectionContext,
    path?: Path,
  ): NodeSelection {
    assertGraphQLASTNode(ast, graphql.Kind.SELECTION_SET, path);

    return new NodeSelection(
      this.node,
      mergeSelectionExpressions(
        aggregateError<graphql.SelectionNode, SelectionExpression[]>(
          ast.selections,
          (expressions, ast, index) => {
            const selectionPath = addPath(path, index);

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
              return expressions;
            }

            switch (ast.kind) {
              case graphql.Kind.FIELD: {
                const field = this.getField(ast.name.value, path);

                return field instanceof VirtualFieldOutputType
                  ? field.dependsOn
                    ? [
                        ...expressions,
                        ...field.dependsOn.expressionsByKey.values(),
                      ]
                    : expressions
                  : [
                      ...expressions,
                      field.selectGraphQLField(
                        ast,
                        operationContext,
                        selectionContext,
                        addPath(path, ast.alias?.value || ast.name.value),
                      ),
                    ];
              }

              case graphql.Kind.FRAGMENT_SPREAD: {
                const fragmentDefinition =
                  selectionContext?.fragments?.[ast.name.value];

                if (!fragmentDefinition) {
                  throw new UnexpectedValueError(
                    `the GraphQL fragment definition named "${ast.name.value}"`,
                    selectionContext?.fragments,
                    { path: selectionPath },
                  );
                }

                return [
                  ...expressions,
                  ...this.selectGraphQLFragmentDefinition(
                    fragmentDefinition,
                    operationContext,
                    selectionContext,
                    selectionPath,
                  ).expressionsByKey.values(),
                ];
              }

              case graphql.Kind.INLINE_FRAGMENT: {
                return [
                  ...expressions,
                  ...this.selectGraphQLInlineFragment(
                    ast,
                    operationContext,
                    selectionContext,
                    selectionPath,
                  ).expressionsByKey.values(),
                ];
              }

              default:
                throw new UnreachableValueError(ast, { path: selectionPath });
            }
          },
          [],
          { path },
        ),
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
      throw new UnexpectedValueError(
        `a resolver returning ${this.node.indefinite}`,
        String(namedReturnType),
        { path },
      );
    }

    return this.selectGraphQLSelectionSet(
      fieldNodes[0].selectionSet!,
      operationContext,
      { fragments, variableValues },
      path,
    );
  }

  public select(
    selection: RawNodeSelection,
    operationContext?: OperationContext,
    selectionContext?: GraphQLSelectionContext,
    path?: Path,
  ): NodeSelection {
    if (selection == null) {
      throw new UnexpectedValueError(
        `${this.node.indefinite}'s selection`,
        selection,
        { path },
      );
    }

    if (selection instanceof NodeSelection) {
      return selection;
    }

    // Components
    if (Array.isArray(selection)) {
      return this.selectComponents(selection, operationContext, path);
    }

    // GraphQL fragment
    if (typeof selection === 'string') {
      return this.selectGraphQLFragment(
        selection,
        operationContext,
        selectionContext,
        path,
      );
    }

    // GraphQL AST
    if (isPlainObject(selection) && 'kind' in selection) {
      switch (selection.kind) {
        case graphql.Kind.DOCUMENT:
          return this.selectGraphQLDocument(
            selection,
            operationContext,
            selectionContext,
            path,
          );

        case graphql.Kind.FRAGMENT_DEFINITION:
          return this.selectGraphQLFragmentDefinition(
            selection,
            operationContext,
            selectionContext,
            path,
          );

        case graphql.Kind.INLINE_FRAGMENT:
          return this.selectGraphQLInlineFragment(
            selection,
            operationContext,
            selectionContext,
            path,
          );

        case graphql.Kind.SELECTION_SET:
          return this.selectGraphQLSelectionSet(
            selection,
            operationContext,
            selectionContext,
            path,
          );

        default:
          throw new UnreachableValueError(selection, { path });
      }
    }

    // GraphQL resolve info
    if (isGraphQLResolveInfo(selection)) {
      return this.selectGraphQLResolveInfo(selection, operationContext);
    }

    throw new UnexpectedValueError(
      `a supported "${this.node.name}"'s selection`,
      selection,
      { path },
    );
  }

  public selectShape(
    shape: unknown,
    operationContext?: OperationContext,
    path?: Path,
  ): NodeSelection {
    if (!isPlainObject(shape)) {
      throw new UnexpectedValueError('a plain-object', shape, { path });
    }

    return new NodeSelection(
      this.node,
      mergeSelectionExpressions(
        aggregateError<[string, unknown], SelectionExpression[]>(
          Object.entries(shape),
          (expressions, [fieldName, fieldValue]) => {
            const field = this.getField(fieldName, path);

            return field instanceof VirtualFieldOutputType
              ? field.dependsOn
                ? [...expressions, ...field.dependsOn.expressionsByKey.values()]
                : expressions
              : [
                  ...expressions,
                  field.selectShape(
                    fieldValue,
                    operationContext,
                    addPath(path, fieldName),
                  ),
                ];
          },
          [],
          { path },
        ),
        path,
      ),
    );
  }
}
