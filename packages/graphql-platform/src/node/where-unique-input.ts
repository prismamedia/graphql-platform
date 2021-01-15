import {
  addPath,
  assertLeafValue,
  GraphQLNonNullDecorator,
  isPlainObject,
  Path,
  UnexpectedNullValueError,
  UnexpectedUndefinedValueError,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'assert';
import { GraphQLInputObjectType } from 'graphql';
import { ValueOf } from 'type-fest';
import { Node } from '../node';
import { Leaf, TComponent, TLeafValue } from './component';
import { UniqueConstraint } from './unique-constraint';

export type TWhereUniqueInputValue = {
  [componentName: string]: null | TLeafValue | TWhereUniqueInputValue;
};

export type TParsedWhereUniqueInputValue = TWhereUniqueInputValue;

export class WhereUniqueInput {
  public readonly public: boolean;
  public readonly name: string;

  public constructor(public readonly node: Node) {
    this.public = node.public;
    this.name = `${node.name}WhereUniqueInput`;
  }

  @Memoize()
  public get type(): GraphQLInputObjectType {
    assert(this.public, `"${this.name}" is private`);

    const componentSet = new Set<TComponent>(
      (<TComponent[]>[]).concat(
        ...[...this.node.publicUniqueConstraintSet].map(({ componentSet }) => [
          ...componentSet,
        ]),
      ),
    );

    return new GraphQLInputObjectType({
      name: this.name,
      description: `Identifies exactly one "${
        this.node.name
      }" node given a unique combination of values:\n${[
        ...this.node.publicUniqueConstraintSet,
      ]
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
                [
                  ...this.node.publicUniqueConstraintSet,
                ].every((uniqueConstraint) =>
                  uniqueConstraint.componentSet.has(component),
                ),
              ),
            },
          ]),
        ),
    });
  }

  protected parseComponentValue(
    component: TComponent,
    value: unknown,
    path: Path,
  ): ValueOf<TWhereUniqueInputValue> {
    if (value === undefined) {
      throw new UnexpectedUndefinedValueError(undefined, path);
    } else if (value === null) {
      if (!component.nullable) {
        throw new UnexpectedNullValueError(undefined, path);
      }

      return null;
    }

    return component instanceof Leaf
      ? assertLeafValue(component.type, path)
      : component.to.whereUniqueInput.parseValue(
          value as any,
          path,
          component.preferredUniqueConstraintSet,
        );
  }

  public parseValue(
    value: TWhereUniqueInputValue,
    path: Path = addPath(undefined, this.name),
    uniqueConstraints: Iterable<UniqueConstraint> = this.node.uniqueConstraintMap.values(),
  ): TParsedWhereUniqueInputValue {
    if (!isPlainObject(value)) {
      throw new UnexpectedValueError(value, `an object`, path);
    }

    for (const uniqueConstraint of uniqueConstraints) {
      try {
        return Object.fromEntries(
          Array.from(uniqueConstraint.componentSet, (component) => [
            component.name,
            this.parseComponentValue(
              component,
              value[component.name],
              addPath(path, component.name),
            ),
          ]),
        );
      } catch (error) {
        if (error instanceof UnexpectedValueError) {
          // Let's try the next "unique constraint"
          continue;
        } else {
          throw error;
        }
      }
    }

    throw new UnexpectedValueError(
      value,
      `an unique combination of value`,
      path,
    );
  }
}
