import {
  Input,
  nonNullableInputTypeDecorator,
  nonOptionalInputTypeDecorator,
  ObjectInputType,
  UnexpectedValueError,
  type NestableErrorOptions,
  type Nillable,
  type NonNillable,
  type NonOptional,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import inflection from 'inflection';
import assert from 'node:assert/strict';
import type { Component, Edge, LeafValue, Node } from '../../../node.js';

export class NodeUniqueFilterNotFoundError extends UnexpectedValueError {
  public constructor(
    node: Node,
    value: unknown,
    options?: NestableErrorOptions,
  ) {
    super(`${node.indefinite}'s unique-filter`, value, options);
  }
}

export type NodeUniqueFilterInputValue = Nillable<{
  [componentName: string]: LeafValue | NonOptional<NodeUniqueFilterInputValue>;
}>;

export class NodeUniqueFilterInputType extends ObjectInputType {
  public constructor(
    public readonly node: Node,
    public readonly forcedEdge?: Edge,
  ) {
    forcedEdge && assert.equal(forcedEdge.tail, node);

    super({
      name: forcedEdge
        ? `${node.name}UniqueFilterWithout${inflection.capitalize(
            forcedEdge.name,
          )}Input`
        : `${node.name}UniqueFilterInput`,
      description: [
        `Identifies exactly one "${node.name}" given one of the following combination of components' value:`,
        [...node.uniqueConstraintsByName.values()]
          .filter((uniqueConstraint) => uniqueConstraint.isPublic())
          .map(({ componentsByName }) =>
            [...componentsByName.values()]
              .filter((component) => component !== forcedEdge)
              .map((component) => component.name)
              .join(' / '),
          )
          .filter(Boolean)
          .map((line) => `- ${line}`)
          .join('\n'),
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }

  @Memoize()
  public override get fields(): ReadonlyArray<Input> {
    const componentSet = new Set<Component>(
      Array.from(this.node.uniqueConstraintsByName.values())
        .flatMap(({ componentsByName }) => [...componentsByName.values()])
        .filter((component) => component !== this.forcedEdge),
    );

    return Object.freeze(
      Array.from(componentSet, (component) => {
        const type = nonNullableInputTypeDecorator(
          component.kind === 'Leaf'
            ? component.type
            : component.head.uniqueFilterInputType,
          !component.isNullable(),
        );

        return new Input({
          name: component.name,
          description: component.description,
          public: component.isPublic(),
          deprecated: component.deprecationReason,
          type: nonOptionalInputTypeDecorator(
            type,
            [...this.node.uniqueConstraintsByName.values()].every(
              ({ componentsByName }) => componentsByName.has(component.name),
            ),
          ),
          publicType: nonOptionalInputTypeDecorator(
            type,
            [...this.node.uniqueConstraintsByName.values()]
              .filter((uniqueConstraint) => uniqueConstraint.isPublic())
              .every(({ componentsByName }) =>
                componentsByName.has(component.name),
              ),
          ),
        });
      }),
    );
  }

  public override parseValue(
    maybeValue: unknown,
    path?: Path,
  ): NodeUniqueFilterInputValue {
    const parsedValue = super.parseValue(maybeValue, path);
    if (!parsedValue) {
      return parsedValue;
    }

    for (const uniqueConstraint of this.node.uniqueConstraintsByName.values()) {
      const uniqueFilterInputValue: NonNillable<NodeUniqueFilterInputValue> =
        Object.create(null);

      if (
        Array.from(uniqueConstraint.componentsByName.keys()).every(
          (componentName) => {
            const componentValue = parsedValue[componentName];
            if (componentValue !== undefined) {
              Object.assign(uniqueFilterInputValue, {
                [componentName]: componentValue,
              });

              return true;
            }

            return false;
          },
        ) &&
        Array.from(uniqueConstraint.componentsByName.keys()).some(
          (componentName) => parsedValue[componentName] !== null,
        )
      ) {
        return uniqueFilterInputValue;
      }
    }

    throw new NodeUniqueFilterNotFoundError(this.node, maybeValue, {
      path,
    });
  }
}
