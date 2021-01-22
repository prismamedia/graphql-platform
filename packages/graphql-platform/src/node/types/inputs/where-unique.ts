import {
  addPath,
  assertLeafValue,
  GraphQLNonNullDecorator,
  isLeafValue,
  isPlainObject,
  isPublic,
  Path,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'assert';
import { GraphQLInputObjectType } from 'graphql';
import { Node } from '../../../node';
import { Edge, Leaf, TComponent, TLeafValue } from '../../components';
import { UniqueConstraint } from '../../unique-constraint';

export type TWhereUniqueNodeValue = {
  [componentName: string]: null | TLeafValue | TWhereUniqueNodeValue;
};

export class WhereUniqueNodeInput {
  public readonly public: boolean;
  public readonly name: string;

  public constructor(public readonly node: Node) {
    this.public = node.public;
    this.name = `${node}WhereUniqueInput`;
  }

  public toString(): string {
    return this.name;
  }

  @Memoize()
  public get type(): GraphQLInputObjectType {
    assert(this.public, `"${this.name}" is private`);

    const publicUniqueConstraints = [
      ...this.node.uniqueConstraintMap.values(),
    ].filter(isPublic);

    assert(
      publicUniqueConstraints.length,
      `"${this.name}" expects at least one public unique constraint (= with all its components being public)`,
    );

    const componentSet = new Set(
      (<TComponent[]>[]).concat(
        ...publicUniqueConstraints.map(({ componentSet }) => [...componentSet]),
      ),
    );

    return new GraphQLInputObjectType({
      name: this.name,
      description: `Identifies exactly one "${this}" node given a unique combination of values:\n${publicUniqueConstraints
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
                  : component.to.whereUniqueInput.type,
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

  @Memoize((edge: Edge) => edge)
  protected getUniqueConstraintSet(edge: Edge): ReadonlySet<UniqueConstraint> {
    return new Set([edge.reference, ...edge.to.uniqueConstraintMap.values()]);
  }

  protected parseValue(
    maybeUniqueValue: unknown,
    path?: Path,
    uniqueConstraints: Iterable<UniqueConstraint> = this.node.uniqueConstraintMap.values(),
  ): TWhereUniqueNodeValue | undefined {
    if (!isPlainObject(maybeUniqueValue)) {
      throw new UnexpectedValueError(maybeUniqueValue, `an object`, path);
    }

    for (const uniqueConstraint of uniqueConstraints) {
      const uniqueValue: TWhereUniqueNodeValue = {};

      if (
        [...uniqueConstraint.componentSet].every((component) => {
          const componentValue = maybeUniqueValue[component.name];
          const componentPath = addPath(path, component.name);

          if (componentValue !== undefined) {
            if (componentValue === null) {
              if (component.nullable) {
                uniqueValue[component.name] = null;

                return true;
              }
            } else if (component instanceof Leaf) {
              if (isLeafValue(component.type, componentValue)) {
                uniqueValue[component.name] = assertLeafValue(
                  component.type,
                  componentValue,
                  componentPath,
                );

                return true;
              }
            } else {
              const uniqueEdgeValue = component.to.whereUniqueInput.parseValue(
                componentValue,
                componentPath,
                this.getUniqueConstraintSet(component),
              );

              if (uniqueEdgeValue) {
                uniqueValue[component.name] = uniqueEdgeValue;

                return true;
              }
            }
          }

          return false;
        }) &&
        [...uniqueConstraint.componentSet].some(
          (component) => uniqueValue[component.name] !== null,
        )
      ) {
        return uniqueValue;
      }
    }
  }

  public assertValue(
    maybeUniqueValue: unknown,
    path?: Path,
    uniqueConstraints: Iterable<UniqueConstraint> = this.node.uniqueConstraintMap.values(),
  ): TWhereUniqueNodeValue {
    const uniqueValue = this.parseValue(
      maybeUniqueValue,
      path,
      uniqueConstraints,
    );

    if (!uniqueValue) {
      throw new UnexpectedValueError(
        maybeUniqueValue,
        `an unique combination of value`,
        path,
      );
    }

    return uniqueValue;
  }
}
