import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import inflection from 'inflection';
import assert from 'node:assert/strict';
import type { Component, Edge, Node } from '../../../node.js';
import { Leaf, type LeafValue } from '../../definition/component/leaf.js';

export class NodeUniqueFilterNotFoundError extends utils.UnexpectedValueError {
  public constructor(
    node: Node,
    value: unknown,
    options?: utils.NestableErrorOptions,
  ) {
    super(`${node.indefinite}'s unique-filter`, value, options);
  }
}

export type NodeUniqueFilterInputValue = utils.Nillable<{
  [componentName: string]:
    | LeafValue
    | utils.NonOptional<NodeUniqueFilterInputValue>;
}>;

export class NodeUniqueFilterInputType extends utils.ObjectInputType {
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
        node.uniqueConstraints
          .filter((uniqueConstraint) => uniqueConstraint.isPublic())
          .map(({ components }) =>
            components
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
  public override get fields(): ReadonlyArray<utils.Input> {
    const componentSet = new Set<Component>(
      this.node.uniqueConstraints
        .flatMap(({ components }) => components)
        .filter((component) => component !== this.forcedEdge),
    );

    return Array.from(componentSet, (component) => {
      const type = utils.nonNullableInputTypeDecorator(
        component instanceof Leaf
          ? component.type
          : component.head.uniqueFilterInputType,
        !component.isNullable(),
      );

      return new utils.Input({
        name: component.name,
        description: component.description,
        public: component.isPublic(),
        deprecated: component.deprecationReason,
        type: utils.nonOptionalInputTypeDecorator(
          type,
          this.node.uniqueConstraints.every(({ componentSet }) =>
            componentSet.has(component),
          ),
        ),
        publicType: utils.nonOptionalInputTypeDecorator(
          type,
          this.node.uniqueConstraints
            .filter((uniqueConstraint) => uniqueConstraint.isPublic())
            .every(({ componentSet }) => componentSet.has(component)),
        ),
      });
    });
  }

  public override parseValue(
    maybeValue: unknown,
    path?: utils.Path,
  ): NodeUniqueFilterInputValue {
    const parsedValue = super.parseValue(maybeValue, path);
    if (!parsedValue) {
      return parsedValue;
    }

    for (const uniqueConstraint of this.node.uniqueConstraints) {
      const uniqueFilterInputValue: utils.NonNillable<NodeUniqueFilterInputValue> =
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
