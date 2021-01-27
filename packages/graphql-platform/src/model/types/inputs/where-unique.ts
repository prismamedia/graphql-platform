import {
  addPath,
  assertLeafValue,
  assertPlainObject,
  GraphQLNonNullDecorator,
  isLeafValue,
  Path,
  PlainObject,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'assert';
import {
  assertValidName,
  GraphQLInputObjectType,
  GraphQLInputType,
} from 'graphql';
import { camelize } from 'inflection';
import {
  Component,
  Leaf,
  LeafValue,
  Model,
  Reference,
  UniqueConstraint,
} from '../../../model';
import { ReadonlyUniqueConstraintMap } from '../../unique-constraint';
import { UniqueValueNotFoundError } from './where-unique/errors';

export * from './where-unique/errors';

export type WhereUniqueInputValue = {
  [componentName: string]: null | LeafValue | WhereUniqueInputValue;
};

export class WhereUniqueInput {
  public readonly public: boolean;
  public readonly name: string;

  public constructor(public readonly model: Model) {
    this.public = model.public;
    this.name = assertValidName(`${model.name}WhereUniqueInput`);
  }

  public toString(): string {
    return this.name;
  }

  @Memoize()
  public get publicUniqueConstraintMap(): ReadonlyMap<
    UniqueConstraint['name'],
    UniqueConstraint
  > {
    return new Map(
      [...this.model.uniqueConstraintMap].filter(
        ([, uniqueConstraint]) => uniqueConstraint.public,
      ),
    );
  }

  @Memoize((edge: Reference) => edge)
  public getUniqueConstraintWithEdgeMap(
    edge: Reference,
  ): ReadonlyMap<UniqueConstraint['name'], UniqueConstraint> {
    return new Map(
      [...this.model.uniqueConstraintMap].filter(([, uniqueConstraint]) =>
        uniqueConstraint.componentSet.has(edge),
      ),
    );
  }

  @Memoize((edge: Reference) => edge)
  public hasUniqueConstraintWithEdge(edge: Reference): boolean {
    return this.getUniqueConstraintWithEdgeMap(edge).size > 0;
  }

  @Memoize((edge: Reference) => edge)
  public getPublicUniqueConstraintWithEdgeMap(
    edge: Reference,
  ): ReadonlyUniqueConstraintMap {
    return new Map(
      [...this.publicUniqueConstraintMap].filter(([, { componentSet }]) =>
        componentSet.has(edge),
      ),
    );
  }

  @Memoize((edge: Reference) => edge)
  public hasPublicUniqueConstraintWithEdge(edge: Reference): boolean {
    return this.getPublicUniqueConstraintWithEdgeMap(edge).size > 0;
  }

  @Memoize((edge: Reference) => edge)
  public getTypeWithoutEdge(edge: Reference): GraphQLInputType {
    assert(this.public, `"${this.name}" is private`);

    const publicUniqueConstraints = [
      ...this.getPublicUniqueConstraintWithEdgeMap(edge).values(),
    ].filter(
      ({ componentSet }) => componentSet.has(edge) && componentSet.size > 1,
    );

    assert(
      publicUniqueConstraints.length > 0,
      `"${this.model}" does not contain any public unique constraint containing the "${edge.name}" edge`,
    );

    const componentSet = new Set(
      (<Component[]>[]).concat(
        ...publicUniqueConstraints.map(({ componentSet }) => [...componentSet]),
      ),
    );

    componentSet.delete(edge);

    return new GraphQLInputObjectType({
      name: [
        this.model.name,
        'Without',
        camelize(edge.name, false),
        'EdgeWhereUniqueInput',
      ].join(''),
      description: `Given a known "${
        edge.name
      }" edge, identifies exactly one "${
        this.model.nodeType.name
      }" node given a unique combination of values:\n${publicUniqueConstraints
        .map(({ componentSet }) =>
          [...componentSet]
            .filter((component) => component !== edge)
            .map(({ name }) => name)
            .join(', '),
        )
        .join('\n')}`,
      fields: () =>
        Object.fromEntries(
          [...componentSet].map((component) => [
            component.name,
            {
              type: GraphQLNonNullDecorator(
                component instanceof Leaf
                  ? component.type
                  : component.head.whereUniqueInputType.type,
                !component.nullable &&
                  publicUniqueConstraints.every((uniqueConstraint) =>
                    uniqueConstraint.componentSet.has(component),
                  ),
              ),
            },
          ]),
        ),
    });
  }

  public assertValueWithoutEdge(
    edge: Reference,
    maybeValue: unknown,
    path?: Path,
  ): PlainObject {
    assertPlainObject(maybeValue, path);

    for (const uniqueConstraint of this.getUniqueConstraintWithEdgeMap(
      edge,
    ).values()) {
      const value: PlainObject = {};

      if (
        [...uniqueConstraint.componentSet].every((component) => {
          if (component === edge) {
            return true;
          }

          const componentValue = maybeValue[component.name];
          const componentPath = addPath(path, component.name);

          if (componentValue !== undefined) {
            if (componentValue === null) {
              if (component.nullable) {
                value[component.name] = null;

                return true;
              }
            } else {
              if (component instanceof Leaf) {
                if (isLeafValue(component.type, componentValue)) {
                  value[component.name] = assertLeafValue(
                    component.type,
                    componentValue,
                    componentPath,
                  );

                  return true;
                }
              } else {
                try {
                  value[component.name] =
                    component.head.whereUniqueInputType.assertValue(
                      componentValue,
                      componentPath,
                      this.getUniqueConstraintSet(component),
                    );

                  return true;
                } catch (error) {
                  if (!(error instanceof UniqueValueNotFoundError)) {
                    throw error;
                  }
                }
              }
            }
          }

          return false;
        })
      ) {
        return value;
      }
    }

    throw new UniqueValueNotFoundError(this.model, maybeValue, path);
  }

  @Memoize()
  public get type(): GraphQLInputObjectType {
    assert(this.public, `"${this.name}" is private`);

    const publicUniqueConstraints = [
      ...this.model.uniqueConstraintMap.values(),
    ].filter(isPublic);

    const componentSet = new Set(
      (<Component[]>[]).concat(
        ...publicUniqueConstraints.map(({ componentSet }) => [...componentSet]),
      ),
    );

    return new GraphQLInputObjectType({
      name: this.name,
      description: `Identifies exactly one "${
        this.model.nodeType.name
      }" node given a unique combination of values:\n${publicUniqueConstraints
        .map(({ componentSet }) =>
          [...componentSet].map(({ name }) => name).join(', '),
        )
        .join('\n')}`,
      fields: () =>
        Object.fromEntries(
          [...componentSet].map((component) => [
            component.name,
            {
              type: GraphQLNonNullDecorator(
                component instanceof Leaf
                  ? component.type
                  : component.head.whereUniqueInputType.type,
                !component.nullable &&
                  publicUniqueConstraints.every((uniqueConstraint) =>
                    uniqueConstraint.componentSet.has(component),
                  ),
              ),
            },
          ]),
        ),
    });
  }

  @Memoize((edge: Reference) => edge)
  protected getUniqueConstraintSet(
    edge: Reference,
  ): ReadonlySet<UniqueConstraint> {
    return new Set([
      edge.headReference,
      ...edge.head.uniqueConstraintMap.values(),
    ]);
  }

  public assertValue(
    maybeValue: unknown,
    path?: Path,
    uniqueConstraints: Iterable<UniqueConstraint> = this.model.uniqueConstraintMap.values(),
  ): WhereUniqueInputValue {
    assertPlainObject(maybeValue, path);

    for (const uniqueConstraint of uniqueConstraints) {
      const value: WhereUniqueInputValue = {};

      if (
        [...uniqueConstraint.componentSet].every((component) => {
          const componentValue = maybeValue[component.name];
          const componentPath = addPath(path, component.name);

          if (componentValue !== undefined) {
            if (componentValue === null) {
              if (component.nullable) {
                value[component.name] = null;

                return true;
              }
            } else {
              if (component instanceof Leaf) {
                if (isLeafValue(component.type, componentValue)) {
                  value[component.name] = assertLeafValue(
                    component.type,
                    componentValue,
                    componentPath,
                  );

                  return true;
                }
              } else {
                try {
                  value[component.name] =
                    component.head.whereUniqueInputType.assertValue(
                      componentValue,
                      componentPath,
                      this.getUniqueConstraintSet(component),
                    );

                  return true;
                } catch (error) {
                  if (!(error instanceof UniqueValueNotFoundError)) {
                    throw error;
                  }
                }
              }
            }
          }

          return false;
        }) &&
        [...uniqueConstraint.componentSet].some(
          (component) => value[component.name] !== null,
        )
      ) {
        return value;
      }
    }

    throw new UniqueValueNotFoundError(this.model, maybeValue, path);
  }
}
