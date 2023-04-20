import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import inflection from 'inflection';
import _ from 'lodash';
import assert from 'node:assert/strict';
import type { Component, Edge, Node } from '../../../node.js';
import { Leaf, type LeafValue } from '../../definition/component/leaf.js';

export class NodeUniqueFilterNotFoundError extends utils.UnexpectedValueError {
  public constructor(
    node: Node,
    value: unknown,
    options?: utils.GraphErrorOptions,
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
    if (forcedEdge) {
      assert.equal(forcedEdge.tail, node);
      assert(
        Array.from(node.uniqueConstraintsByName.values()).some(
          (uniqueConstraint) => uniqueConstraint.componentSet.has(forcedEdge),
        ),
      );
    }

    super({
      name: forcedEdge
        ? `${node.name}UniqueFilterWithout${inflection.capitalize(
            forcedEdge.name,
          )}Input`
        : `${node.name}UniqueFilterInput`,
      description: [
        `${
          forcedEdge ? `Given a known "${forcedEdge.name}", i` : `I`
        }dentifies exactly one "${
          node.name
        }" with one of the following combination of components' value:`,
        Array.from(node.uniqueConstraintsByName.values())
          .filter((uniqueConstraint) => uniqueConstraint.isPublic())
          .map(({ componentsByName }) =>
            Array.from(componentsByName.values())
              .map((component) =>
                component === forcedEdge
                  ? `(${component.name})`
                  : component.name,
              )
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
      Array.from(this.node.uniqueConstraintsByName.values())
        .flatMap(({ componentsByName }) =>
          Array.from(componentsByName.values()),
        )
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
          Array.from(this.node.uniqueConstraintsByName.values()).every(
            ({ componentSet }) => componentSet.has(component),
          ),
        ),
        publicType: utils.nonOptionalInputTypeDecorator(
          type,
          Array.from(this.node.uniqueConstraintsByName.values())
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

    for (const uniqueConstraint of this.node.uniqueConstraintsByName.values()) {
      const uniqueFilterInputValue: NonNullable<NodeUniqueFilterInputValue> =
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

  public areValuesEqual(
    a: NodeUniqueFilterInputValue,
    b: NodeUniqueFilterInputValue,
  ): boolean {
    return a == null || b == null
      ? a === b
      : Object.entries(a).length === Object.entries(b).length &&
          Object.entries(a).every(([componentName, componentValue]) => {
            const component = this.node.getComponentByName(componentName);

            return component instanceof Leaf
              ? component.areValuesEqual(
                  componentValue as any,
                  b[componentName] as any,
                )
              : component.head.uniqueFilterInputType.areValuesEqual(
                  componentValue as any,
                  b[componentName] as any,
                );
          });
  }

  public uniqValues<T extends NodeUniqueFilterInputValue>(
    values: ReadonlyArray<T>,
  ): T[] {
    return _.uniqWith(values, (a, b) => this.areValuesEqual(a, b));
  }
}
