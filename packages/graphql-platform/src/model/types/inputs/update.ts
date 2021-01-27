import {
  addPath,
  assertInputObject,
  indefinite,
  isPublic,
  isPublicEntry,
  normalizeObject,
  Path,
  Public,
  sortMapByOrderedKeys,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'assert';
import { DepGraph, DepGraphCycleError } from 'dependency-graph';
import { assertValidName, GraphQLInputObjectType } from 'graphql';
import { camelize } from 'inflection';
import {
  catchDefinitionError,
  catchRuntimeError,
  ComponentDefinitionError,
  ModelDefinitionError,
} from '../../../errors';
import { Model, Reference } from '../../../model';
import { OperationContext } from '../../operations/context';
import { NodeRecord, NodeSelection, NodeValue } from '../node';
import {
  ComponentInputField,
  ComponentUpdate,
  EdgeInputField,
  InputField,
  InputFieldValue,
  ReverseEdgeInputField,
  ReverseEdgeInputFieldValue,
  VirtualInputField,
} from './update/fields';

export * from './update/fields';

export type UpdateInputValue = {
  [fieldName: string]: InputFieldValue;
};

export type NodeUpdate = {
  [componentName: string]: ComponentUpdate;
};

export type PendingNodeUpdate = {
  [componentName: string]: Promise<ComponentUpdate>;
};

export class UpdateInput {
  public readonly name: string;
  public readonly description: string;

  readonly #dependsOnCurrent =
    this.model.config.mutations?.update?.dependsOnCurrentNodeValue;

  readonly #virtualFields = this.model.config.mutations?.update?.virtualFields;
  readonly #parser = this.model.config.mutations?.update?.preUpdate;

  public constructor(public readonly model: Model) {
    this.name = assertValidName(`${model.name}UpdateInput`);
    this.description = `Provides the data to update ${indefinite(model.name, {
      quote: true,
    })}`;
  }

  public toString(): string {
    return this.name;
  }

  @Memoize()
  public get componentFieldMap(): ReadonlyMap<string, ComponentInputField> {
    const fieldMap = new Map<string, ComponentInputField>();
    const dependencyGraph = new DepGraph({ circular: false });

    for (const component of this.model.componentMap.values()) {
      const field = component.updateInput;
      if (field) {
        fieldMap.set(field.name, field);
        dependencyGraph.addNode(field.name);
      }
    }

    // Let's define the dependencies
    for (const field of fieldMap.values()) {
      for (const dependency of field.dependsOnUpdate) {
        catchDefinitionError(
          () => dependencyGraph.addDependency(field.name, dependency),
          (error) =>
            new ComponentDefinitionError(
              field.component,
              `the unknown "${dependency}" component used in the "update" input's dependencies`,
              error,
            ),
        );
      }
    }

    return catchDefinitionError(
      () => sortMapByOrderedKeys(fieldMap, dependencyGraph.overallOrder()),
      (error) =>
        new ModelDefinitionError(
          this.model,
          `the circular dependency in the "update" input's dependencies: ${(
            error as DepGraphCycleError
          ).cyclePath.join(' -> ')}`,
          error,
        ),
    );
  }

  @Memoize()
  public get publicComponentFieldMap(): ReadonlyMap<
    string,
    Public<ComponentInputField>
  > {
    return new Map([...this.componentFieldMap].filter(isPublicEntry));
  }

  @Memoize()
  public get reverseEdgeFieldMap(): ReadonlyMap<string, ReverseEdgeInputField> {
    const fieldMap = new Map<string, ReverseEdgeInputField>();

    for (const reverseEdge of this.model.referrerMap.values()) {
      const field = reverseEdge.updateInput;
      if (field) {
        fieldMap.set(field.name, field);
      }
    }

    return fieldMap;
  }

  @Memoize()
  public get virtualFieldMap(): ReadonlyMap<string, VirtualInputField> {
    const fieldMap = new Map<string, VirtualInputField>();

    if (this.#virtualFields) {
      for (const [name, config] of Object.entries(this.#virtualFields)) {
        fieldMap.set(name, new VirtualInputField(name, config));
      }
    }

    return fieldMap;
  }

  @Memoize()
  public get fieldMap(): ReadonlyMap<string, InputField> {
    return new Map<string, InputField>([
      ...this.componentFieldMap,
      ...this.reverseEdgeFieldMap,
      ...this.virtualFieldMap,
    ]);
  }

  @Memoize()
  public get type(): GraphQLInputObjectType | undefined {
    const publicFields = [...this.fieldMap.values()].filter(isPublic);

    assert(publicFields.length > 0, ``);

    return new GraphQLInputObjectType({
      name: this.name,
      description: this.description,
      fields: () =>
        Object.fromEntries(
          publicFields.map((field) => [
            field.name,
            field.graphqlInputFieldConfig,
          ]),
        ),
    });
  }

  @Memoize((edge: Reference) => edge)
  public getFieldWithoutEdgeMap(
    edge: Reference,
  ): ReadonlyMap<string, InputField> {
    return new Map(
      [...this.fieldMap].filter(
        ([, field]) =>
          !(field instanceof EdgeInputField && field.edge === edge),
      ),
    );
  }

  @Memoize((edge: Reference) => edge)
  public getPublicFieldWithoutEdgeMap(
    edge: Reference,
  ): ReadonlyMap<string, Public<InputField>> {
    return new Map(
      [...this.publicFieldMap].filter(
        ([, field]) =>
          !(field instanceof EdgeInputField && field.edge === edge),
      ),
    );
  }

  @Memoize((edge: Reference) => edge)
  public hasTypeWithoutEdge(edge: Reference): boolean {
    return this.public && this.getPublicFieldWithoutEdgeMap(edge).size > 0;
  }

  @Memoize((edge: Reference) => edge)
  public getTypeWithoutEdge(edge: Reference): GraphQLInputObjectType {
    assert(this.public, `"${this.name}" is private`);

    assert(
      this.getPublicFieldWithoutEdgeMap(edge).size > 0,
      `"${this.name}" expects at least one public field`,
    );

    return new GraphQLInputObjectType({
      name: [
        this.model.name,
        'Without',
        camelize(edge.name, false),
        'EdgeUpdateInput',
      ].join(''),
      description: `Given a known "${
        edge.name
      }" edge, provides the data to update ${indefinite(this.model.name, {
        quote: true,
      })}`,
      fields: () =>
        Object.fromEntries(
          Array.from(
            this.getPublicFieldWithoutEdgeMap(edge).values(),
            (field) => [field.name, field.graphqlInputFieldConfig],
          ),
        ),
    });
  }

  public assertValueWithoutEdge(
    edge: Reference,
    maybeValue: unknown,
    path: Path,
  ): Readonly<UpdateInputValue> {
    return Object.freeze(
      assertInputObject(
        maybeValue,
        this.getFieldWithoutEdgeMap(edge).values(),
        path,
      ) ?? {},
    );
  }

  public assertValue(
    maybeValue: unknown,
    path: Path,
  ): Readonly<UpdateInputValue> {
    const update = assertInputObject(maybeValue, this.fieldMap.values(), path);
    if (!update) {
      throw new UnexpectedValueError(maybeValue, 'at least one update', path);
    }

    return Object.freeze(update);
  }

  public dependsOnCurrentNodeSelection(
    data: Readonly<UpdateInputValue>,
    operationContext: OperationContext,
    path: Path,
  ): NodeSelection | undefined {
    const rawNodeSelection =
      typeof this.#dependsOnCurrent === 'function'
        ? this.#dependsOnCurrent({
            model: this.model,
            data,
            path,
            operationContext,
          })
        : this.#dependsOnCurrent;

    return rawNodeSelection
      ? this.model.nodeType.select(rawNodeSelection, path)
      : undefined;
  }

  protected getCurrentNodeValue(
    currentNodeValue: Readonly<NodeValue> | undefined,
    data: Readonly<UpdateInputValue>,
    operationContext: OperationContext,
    path: Path,
  ): Readonly<NodeValue> {
    const currentNodeSelection = this.dependsOnCurrentNodeSelection(
      data,
      operationContext,
      path,
    );

    return Object.freeze(
      currentNodeSelection
        ? this.model.nodeType.assertValue(
            currentNodeValue,
            path,
            currentNodeSelection,
          )
        : {},
    );
  }

  public async parseValue(
    currentNodeValue: Readonly<NodeValue> | undefined,
    data: Readonly<UpdateInputValue>,
    operationContext: OperationContext,
    path: Path,
  ): Promise<NodeUpdate> {
    // Contains a reference of the "settling" field.parseValues' promise
    const pendingUpdate: PendingNodeUpdate = {};

    const update: NodeUpdate = Object.fromEntries(
      await Promise.all(
        Array.from(this.componentFieldMap.values(), async (field) => {
          const fieldPath = addPath(path, field.name);
          const fieldUpdate = await (pendingUpdate[field.name] =
            catchRuntimeError(
              () =>
                field.parseValue(
                  data[field.name],
                  currentNodeValue,
                  pendingUpdate,
                  data,
                  operationContext,
                  addPath(path, field.name),
                ),
              fieldPath,
            ));

          return [field.name, fieldUpdate];
        }),
      ),
    );

    const parsedUpdate = this.#parser
      ? await catchRuntimeError(
          () =>
            this.#parser!({
              update: Object.freeze(update),
              currentNodeValue: this.getCurrentNodeValue(
                currentNodeValue,
                data,
                operationContext,
                path,
              ),
              model: this.model,
              data,
              api: operationContext.createBoundAPI(path),
              path,
              operationContext,
            }),
          path,
        )
      : update;

    const normalizedUpdate = normalizeObject(parsedUpdate);
    if (!normalizedUpdate) {
      throw new UnexpectedValueError(
        normalizedUpdate,
        `at least one component to be update`,
        path,
      );
    }

    return normalizedUpdate;
  }

  public async handleReverseEdges(
    record: Readonly<NodeRecord>,
    data: Readonly<UpdateInputValue>,
    operationContext: OperationContext,
    path: Path,
  ): Promise<void> {
    await Promise.all(
      Array.from(this.reverseEdgeFieldMap.values(), async (field) => {
        const fieldValue: ReverseEdgeInputFieldValue | undefined =
          data[field.name];

        if (fieldValue) {
          const fieldPath = addPath(path, field.name);

          await catchRuntimeError(
            () => field.handle(fieldValue, record, operationContext, fieldPath),
            fieldPath,
          );
        }
      }),
    );
  }
}
