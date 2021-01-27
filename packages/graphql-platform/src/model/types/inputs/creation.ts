import {
  addPath,
  assertInputObject,
  indefinite,
  isPrivateEntry,
  isPublic,
  normalizeObject,
  Path,
  Private,
  sortMapByOrderedKeys,
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
import { ComponentValue, Model, Reference } from '../../../model';
import { OperationContext } from '../../operations/context';
import { NodeRecord } from '../node';
import {
  ComponentInputField,
  EdgeInputField,
  InputField,
  InputFieldValue,
  ReverseEdgeInputField,
  ReverseEdgeInputFieldValue,
  VirtualInputField,
} from './creation/fields';

export * from './creation/fields';

export type CreationInputValue =
  | {
      [fieldName: string]: InputFieldValue;
    }
  // In case none of the fields is required
  | undefined;

export type NodeCreation = {
  [componentName: string]: ComponentValue;
};

export type PendingNodeCreation = {
  [componentName: string]: Promise<ComponentValue>;
};

export class CreationInput {
  public readonly name: string;
  public readonly description: string;

  readonly #virtualFields = this.model.config.mutations?.create?.virtualFields;
  readonly #parser = this.model.config.mutations?.create?.preCreate;

  public constructor(public readonly model: Model) {
    this.name = assertValidName(`${model.name}CreateInput`);
    this.description = `Provides the data to create ${indefinite(model.name, {
      quote: true,
    })}`;
  }

  public toString(): string {
    return this.name;
  }

  @Memoize()
  protected get componentFieldMap(): ReadonlyMap<string, ComponentInputField> {
    const fieldMap = new Map<string, ComponentInputField>();
    const dependencyGraph = new DepGraph({ circular: false });

    for (const component of this.model.componentMap.values()) {
      const field = component.createInput;
      if (field) {
        fieldMap.set(field.name, field);
        dependencyGraph.addNode(field.name);
      }
    }

    // Let's define the dependencies
    for (const field of fieldMap.values()) {
      for (const dependency of field.dependsOnCreation) {
        catchDefinitionError(
          () => dependencyGraph.addDependency(field.name, dependency),
          (error) =>
            new ComponentDefinitionError(
              field.component,
              `the unknown "${dependency}" component used in the "create" input's dependencies`,
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
          `the circular dependency in the "create" input's dependencies: ${(
            error as DepGraphCycleError
          ).cyclePath.join(' -> ')}`,
          error,
        ),
    );
  }

  @Memoize()
  protected get reverseEdgeFieldMap(): ReadonlyMap<
    string,
    ReverseEdgeInputField
  > {
    const fieldMap = new Map<string, ReverseEdgeInputField>();

    for (const reverseEdge of this.model.referrerMap.values()) {
      if (reverseEdge.createInput) {
        const field = reverseEdge.createInput;

        fieldMap.set(field.name, field);
      }
    }

    return fieldMap;
  }

  @Memoize()
  protected get virtualFieldMap(): ReadonlyMap<string, VirtualInputField> {
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
  protected get requiredFieldMap(): ReadonlyMap<string, InputField> {
    return new Map([...this.fieldMap].filter(([, field]) => field.required));
  }

  @Memoize()
  protected get privateRequiredFieldMap(): ReadonlyMap<
    string,
    Private<InputField>
  > {
    return new Map([...this.requiredFieldMap].filter(isPrivateEntry));
  }

  @Memoize()
  public get public(): boolean {
    return this.privateRequiredFieldMap.size === 0;
  }

  @Memoize()
  public get type(): GraphQLInputObjectType | undefined {
    assert(
      this.privateRequiredFieldMap.size === 0,
      `"${this.name}" expects none of its required fields to be private: ${[
        ...this.privateRequiredFieldMap.keys(),
      ].join(', ')}`,
    );

    const publicFields = [...this.fieldMap.values()].filter(isPublic);

    return publicFields.length > 0
      ? new GraphQLInputObjectType({
          name: this.name,
          description: this.description,
          fields: () =>
            Object.fromEntries(
              publicFields.map((field) => [
                field.name,
                field.graphqlInputFieldConfig,
              ]),
            ),
        })
      : undefined;
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
        'EdgeCreateInput',
      ].join(''),
      description: `Given a known "${
        edge.name
      }" edge, provides the data to create ${indefinite(this.model.name, {
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
  ): Readonly<CreationInputValue> {
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
  ): Readonly<CreationInputValue> {
    return Object.freeze(
      assertInputObject(maybeValue, this.fieldMap.values(), path) ?? {},
    );
  }

  public async parseValue(
    data: Readonly<CreationInputValue>,
    operationContext: OperationContext,
    path: Path,
  ): Promise<NodeCreation | undefined> {
    // Contains a reference of the "settling" field.parseValues' promise
    const pendingCreation: PendingNodeCreation = {};

    const creation: NodeCreation = Object.fromEntries(
      await Promise.all(
        Array.from(this.componentFieldMap.values(), async (field) => {
          const fieldPath = addPath(path, field.name);
          const fieldValue = await (pendingCreation[field.name] =
            catchRuntimeError(
              () =>
                field.parseValue(
                  data[field.name],
                  pendingCreation,
                  data,
                  operationContext,
                  fieldPath,
                ),
              fieldPath,
            ));

          return [field.name, fieldValue];
        }),
      ),
    );

    const parsedCreation = this.#parser
      ? await catchRuntimeError(
          () =>
            this.#parser!({
              creation: Object.freeze(creation),
              model: this.model,
              data,
              api: operationContext.createBoundAPI(path),
              path,
              operationContext,
            }),
          path,
        )
      : creation;

    return normalizeObject(parsedCreation);
  }

  public async handleReverseEdges(
    record: Readonly<NodeRecord>,
    data: Readonly<CreationInputValue>,
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
