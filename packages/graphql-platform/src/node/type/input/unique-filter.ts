import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import inflection from 'inflection';
import assert from 'node:assert';
import * as R from 'remeda';
import type { Component, ComponentValue, Edge, Node } from '../../../node.js';
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
  readonly #forcedEdge?: Edge;

  readonly #candidates: ReadonlyArray<ReadonlySet<Component>>;
  readonly #publicCandidates: ReadonlyArray<ReadonlySet<Component>>;

  readonly #components: ReadonlyArray<Component>;

  public constructor(
    public readonly node: Node,
    forcedEdge?: Edge,
  ) {
    let candidates: ReadonlyArray<ReadonlySet<Component>>;
    let publicCandidates: ReadonlyArray<ReadonlySet<Component>>;

    if (forcedEdge) {
      node.ensureEdge(forcedEdge);
      assert(
        node.isPartiallyIdentifiableByEdge(forcedEdge),
        `The "${node}" node is not partially identifiable by its "${forcedEdge.name}" edge`,
      );

      candidates = node.uniqueConstraintSet
        .values()
        .filter(
          ({ componentSet }) =>
            componentSet.has(forcedEdge) && componentSet.size > 1,
        )
        .map(
          ({ componentSet }) =>
            new Set(
              componentSet
                .values()
                .filter((component) => component !== forcedEdge),
            ),
        )
        .toArray();
    } else {
      candidates = Array.from(
        node.uniqueConstraintSet,
        ({ componentSet }) => componentSet,
      );
    }

    publicCandidates = candidates.filter((components) =>
      components.values().every((component) => component.isPublic()),
    );

    super({
      name: [
        node.name,
        'UniqueFilter',
        forcedEdge
          ? `Without${inflection.camelize(forcedEdge.name)}`
          : undefined,
        'Input',
      ]
        .filter(Boolean)
        .join(''),
      description: `${forcedEdge ? `Given ${utils.indefinite(forcedEdge.name)}, i` : `I`}dentifies exactly one "${node}" by ${publicCandidates
        .map((components) =>
          Array.from(components, ({ name }) => name).join('-'),
        )
        .reduce<string>(
          (output, combination, index, array) =>
            output
              ? index < array.length - 1
                ? `${output}, "${combination}"`
                : `${output} or "${combination}"`
              : `"${combination}"`,
          '',
        )}`,
    });

    this.#forcedEdge = forcedEdge;

    this.#candidates = candidates;
    this.#publicCandidates = publicCandidates;

    this.#components = Array.from(
      new Set(candidates.values().flatMap((componentSet) => componentSet)),
    );
  }

  @Memoize()
  public override get fields(): ReadonlyArray<utils.Input> {
    return this.#components.map((component) => {
      const type = utils.nonNullableInputTypeDecorator(
        component instanceof Leaf
          ? component.type
          : component.head.uniqueFilterInputType,
        !component.isNullable(),
      );

      return new utils.Input({
        name: component.name,
        description: component.description,
        deprecated: component.deprecationReason,
        type: utils.nonOptionalInputTypeDecorator(
          type,
          this.#candidates.every((components) => components.has(component)),
        ),
        public: this.#publicCandidates.some((components) =>
          components.has(component),
        ),
        publicType: utils.nonOptionalInputTypeDecorator(
          type,
          this.#publicCandidates.every((components) =>
            components.has(component),
          ),
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

    for (const components of this.#candidates) {
      const valuesByComponent = new Map<Component, ComponentValue>();

      if (
        components.values().every((component) => {
          const componentValue = parsedValue[component.name];
          if (componentValue !== undefined) {
            valuesByComponent.set(component, componentValue);

            return true;
          }

          return false;
        }) &&
        (this.#forcedEdge ||
          valuesByComponent
            .values()
            .some((componentValue) => componentValue !== null))
      ) {
        return valuesByComponent.entries().reduce(
          (uniqueConstraintValue, [component, componentValue]) =>
            Object.assign(uniqueConstraintValue, {
              [component.name]: componentValue,
            }),
          Object.create(null),
        );
      }
    }

    throw new NodeUniqueFilterNotFoundError(this.node, maybeValue, {
      path,
    });
  }

  public isValid(
    maybeValue: unknown,
    path?: utils.Path,
  ): maybeValue is utils.NonNillable<NodeUniqueFilterInputValue> {
    if (maybeValue == null) {
      return false;
    }

    try {
      this.parseValue(maybeValue, path);

      return true;
    } catch (error) {
      if (error instanceof NodeUniqueFilterNotFoundError) {
        return false;
      }

      throw error;
    }
  }

  /**
   * Ensuring there is a unique-filter's value in the provided "value", allowing extra properties
   */
  public pickValue(
    maybeValue: unknown,
    path?: utils.Path,
  ): NonNullable<NodeUniqueFilterInputValue> {
    utils.assertPlainObject(maybeValue, path);

    return this.parseValue(
      this.#components.reduce((uniqueConstraintValue, component) => {
        const componentValue = maybeValue[component.name];
        if (componentValue !== undefined) {
          uniqueConstraintValue[component.name] =
            componentValue === null
              ? null
              : component instanceof Leaf
                ? componentValue
                : component.head.uniqueFilterInputType.pickValue(
                    componentValue,
                    utils.addPath(path, component.name),
                  );
        }

        return uniqueConstraintValue;
      }, Object.create(null)),
      path,
    ) as NonNullable<NodeUniqueFilterInputValue>;
  }

  public hasValid(
    maybeValue: unknown,
    path?: utils.Path,
  ): maybeValue is utils.NonNillable<NodeUniqueFilterInputValue> {
    if (maybeValue == null) {
      return false;
    }

    try {
      this.pickValue(maybeValue, path);

      return true;
    } catch (error) {
      if (error instanceof NodeUniqueFilterNotFoundError) {
        return false;
      }

      throw error;
    }
  }

  public uniqValues<T extends NodeUniqueFilterInputValue>(
    values: ReadonlyArray<T>,
  ): Array<T> {
    return R.uniqueWith(values, (a, b) => this.areValuesEqual(a, b));
  }
}
