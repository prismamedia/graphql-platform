import {
  addPath,
  assertInputObject,
  didYouMean,
  getNormalizedObject,
  GraphQLNonNullDecorator,
  isPublicEntry,
  isRequiredInputEntry,
  Path,
  Public,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'assert';
import { DepGraph, DepGraphCycleError } from 'dependency-graph';
import { GraphQLInputObjectType, GraphQLNonNull } from 'graphql';
import { Maybe } from 'graphql/jsutils/Maybe';
import { camelize } from 'inflection';
import { pick } from 'lodash';
import { IConnector, TCreateValue } from '../../connector';
import {
  Edge,
  INodeValue,
  Leaf,
  mergeSelections,
  TLeafValue,
} from '../../node';
import {
  ISelectionsAwareOperationArgs,
  TOperationFieldArgs,
  TWithParsedSelectionsOperationArgs,
} from '../abstract-operation';
import { OperationContext } from '../context';
import { AbstractMutation, IMutationConfig } from './abstract-mutation';
import {
  CreateEdgeInputField,
  CreateLeafInputField,
  CreateReverseEdgeInputField,
  isCreateComponentInputEntry,
  isCreateComponentInputField,
  TCreateComponentInputField,
  TCreateEdgeInputFieldValue,
  TCreateInputField,
} from './create/fields';

export * from './create/fields';

export type TCreateDataInputValue =
  | { [componentName: string]: Maybe<TLeafValue | TCreateEdgeInputFieldValue> }
  | undefined;

export interface ICreateOperationArgs extends ISelectionsAwareOperationArgs {
  data?: TCreateDataInputValue;
}

export type TCreateOperationResult = INodeValue;

export interface ICreateOperationConfig extends IMutationConfig {}

export class CreateOperation extends AbstractMutation<
  ICreateOperationArgs,
  TCreateOperationResult,
  ICreateOperationConfig
> {
  public readonly name = `create${this.node.name}`;
  public readonly description = `Creates one "${this.node.name}" node then returns it`;

  @Memoize()
  public get fieldMap(): ReadonlyMap<string, TCreateInputField> {
    const fields: TCreateInputField[] = [];
    const dependencyGraph = new DepGraph({ circular: false });

    for (const component of this.node.componentMap.values()) {
      const field =
        component instanceof Leaf
          ? new CreateLeafInputField(this, component)
          : new CreateEdgeInputField(this, component);

      fields.push(field);
      dependencyGraph.addNode(field.name);
    }

    for (const reverseEdge of this.node.reverseEdgeMap.values()) {
      if (
        (!reverseEdge.edge.immutable &&
          (reverseEdge.to.getOperation('update').enabled ||
            reverseEdge.to.getOperation('updateIfExists').enabled)) ||
        reverseEdge.to.getOperation('create').enabled
      ) {
        const field = new CreateReverseEdgeInputField(this, reverseEdge);

        fields.push(field);
        dependencyGraph.addNode(field.name);
      }
    }

    for (const field of fields) {
      if (isCreateComponentInputField(field)) {
        for (const dependencyName of field.dependsOn) {
          const dependency = fields.find(
            (field) => field.name === dependencyName,
          );

          if (!dependency) {
            throw new Error(
              `The field "${
                field.id
              }" cannot depend on the unknown field "${dependencyName}", did you mean: ${didYouMean(
                dependencyName,
                fields.map((field) => field.name),
              )}`,
            );
          }

          assert(
            isCreateComponentInputField(dependency),
            `The field "${field.id}" cannot depend on the field "${dependencyName}"`,
          );

          dependencyGraph.addDependency(field.name, dependency.name);

          try {
            // Will throw an error if a circular dependency is found
            dependencyGraph.overallOrder();
          } catch (error) {
            if ('cyclePath' in error) {
              throw new Error(
                `The field "${
                  field.id
                }" cannot depend on "${dependencyName}", a circular dependency has been found: ${(error as DepGraphCycleError).cyclePath.join(
                  ' -> ',
                )}`,
              );
            } else {
              throw error;
            }
          }
        }
      }
    }

    const sortedFieldNames = dependencyGraph.overallOrder();

    return new Map(
      fields
        .sort(
          ({ name: a }, { name: b }) =>
            sortedFieldNames.indexOf(a) - sortedFieldNames.indexOf(b),
        )
        .map((field) => [field.name, field]),
    );
  }

  @Memoize()
  public get componentFieldMap(): ReadonlyMap<
    string,
    TCreateComponentInputField
  > {
    return new Map([...this.fieldMap].filter(isCreateComponentInputEntry));
  }

  @Memoize()
  public get publicFieldMap(): ReadonlyMap<string, Public<TCreateInputField>> {
    return new Map([...this.fieldMap].filter(isPublicEntry));
  }

  @Memoize()
  public get requiredFieldMap() {
    return new Map([...this.publicFieldMap].filter(isRequiredInputEntry));
  }

  @Memoize((edge?: Edge) => edge)
  public getDataWithoutEdgeType(
    edge?: Edge,
  ): GraphQLInputObjectType | undefined {
    assert(this.public, `"${this.name}" is private`);

    const publicFieldWithoutEdgeMap = edge
      ? new Map(
          [...this.publicFieldMap].filter(
            ([, field]) =>
              !(field instanceof CreateEdgeInputField && field.edge === edge),
          ),
        )
      : this.publicFieldMap;

    return publicFieldWithoutEdgeMap.size > 0
      ? new GraphQLInputObjectType({
          name: [
            this.node.name,
            ...(edge ? ['Without', camelize(edge.name, false)] : []),
            'CreateInput',
          ].join(''),
          description: `Data provided to create a(n) "${this.node.name}" node`,
          fields: () =>
            Object.fromEntries(
              Array.from(publicFieldWithoutEdgeMap.values(), (field) => [
                field.name,
                field.graphqlInputFieldConfig,
              ]),
            ),
        })
      : undefined;
  }

  public get dataType(): GraphQLInputObjectType | undefined {
    return this.getDataWithoutEdgeType();
  }

  public async parseData(
    data: ICreateOperationArgs['data'],
    operationContext: OperationContext,
    path: Path,
  ): Promise<TCreateValue | undefined> {
    const coercedData = assertInputObject(
      data,
      this.componentFieldMap.values(),
      path,
    );

    const parsingValueMap: Record<string, Promise<any>> = {};

    // for (const field of this.componentFieldMap.values()) {
    //   parsingValueMap[field.name] = field.parseValue({
    //     operationContext,
    //     parsingValueMap,
    //     path: addPath(path, field.name),
    //     value: data?.[field.name],
    //   });
    // }

    return getNormalizedObject(
      Object.fromEntries(
        await Promise.all(
          Object.entries(parsingValueMap).map(async ([name, parsingValue]) => [
            name,
            await parsingValue,
          ]),
        ),
      ),
    );
  }

  protected async doExecute(
    args: TWithParsedSelectionsOperationArgs<ICreateOperationArgs>,
    operationContext: OperationContext<any, IConnector>,
    path: Path,
  ): Promise<TCreateOperationResult> {
    const argsPath = addPath(path, 'args');

    const dataArgsPath = addPath(argsPath, 'data');
    const coercedData = assertInputObject(
      args.data,
      this.fieldMap.values(),
      dataArgsPath,
    );

    const [data, selections] = await Promise.all([
      this.parseData(
        pick(coercedData, ...this.componentFieldMap.keys()),
        operationContext,
        dataArgsPath,
      ),
      this.node.getContextualizedSelections(
        // In case some "created" listeners are registered, we ensure we'll be able to provide them the whole node
        this.node.listenerCount('created')
          ? mergeSelections(...args.selections, ...this.node.selections)
          : args.selections,
        operationContext.context,
        addPath(argsPath, 'selections'),
      ),
    ]);

    const [nodeValue] = await operationContext.connector.create(
      this.node,
      {
        data: [data],
        selections,
      },
      operationContext,
    );

    if (this.node.listenerCount('created')) {
      operationContext.postSuccessEvents.push(
        this.node.emit.bind(this.node, 'created', {
          node: this.node,
          // We provide the whole node to the listeners
          value: this.node.assertNodeValue(
            nodeValue,
            this.node.selections,
            path,
          ),
          context: operationContext.context,
        }),
      );
    }

    return this.node.assertNodeValue(nodeValue, args.selections, path);
  }

  protected get graphqlFieldConfigArgs(): TOperationFieldArgs<ICreateOperationArgs> {
    return {
      ...(this.dataType && {
        data: {
          type: GraphQLNonNullDecorator(
            this.dataType,
            this.requiredFieldMap.size > 0,
          ),
        },
      }),
    };
  }

  protected get graphqlFieldConfigType() {
    return GraphQLNonNull(this.node.type);
  }
}
