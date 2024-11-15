import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import inflection from 'inflection';
import assert from 'node:assert/strict';
import * as R from 'remeda';
import type { Component, Edge, Node, UniqueConstraint } from '../../../node.js';
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

  readonly #candidates: ReadonlyArray<UniqueConstraint>;
  readonly #components: ReadonlyArray<Component>;

  readonly #publicCandidates: ReadonlyArray<UniqueConstraint>;
  readonly #publicComponents: ReadonlyArray<Component>;

  public constructor(
    public readonly node: Node,
    forcedEdge?: Edge,
  ) {
    let candidates: UniqueConstraint[];
    if (forcedEdge) {
      node.ensureEdge(forcedEdge);
      assert(
        node.isPartiallyIdentifiableWithEdge(forcedEdge),
        `The "${node}" node is not partially identifiable with the "${forcedEdge}" edge`,
      );

      candidates = Array.from(node.uniqueConstraintSet).filter(
        ({ componentSet }) =>
          componentSet.has(forcedEdge) && componentSet.size > 1,
      );
    } else {
      candidates = Array.from(node.uniqueConstraintSet);
    }

    const publicCandidates = candidates.filter(({ componentSet }) =>
      componentSet.values().every((component) => component.isPublic()),
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
      description: [
        `${
          forcedEdge ? `Given ${utils.indefinite(forcedEdge.name)}, i` : `I`
        }dentifies exactly one "${node}" with one of the following combination of components' value:`,
        publicCandidates
          .map(({ componentSet }) =>
            Array.from(componentSet, (component) =>
              component === forcedEdge ? `(${component.name})` : component.name,
            ).join(' / '),
          )
          .map((line) => `- ${line}`)
          .join('\n'),
      ].join('\n'),
    });

    this.#forcedEdge = forcedEdge;

    this.#candidates = candidates;
    this.#components = Array.from(
      new Set(
        candidates
          .flatMap(({ componentSet }) => Array.from(componentSet))
          .filter((component) => component !== this.#forcedEdge),
      ),
    );

    this.#publicCandidates = publicCandidates;
    this.#publicComponents = Array.from(
      new Set(
        publicCandidates
          .flatMap(({ componentSet }) => Array.from(componentSet))
          .filter((component) => component !== this.#forcedEdge),
      ),
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
          this.#candidates.every(({ componentSet }) =>
            componentSet.has(component),
          ),
        ),
        public: this.#publicCandidates.some(({ componentSet }) =>
          componentSet.has(component),
        ),
        publicType: utils.nonOptionalInputTypeDecorator(
          type,
          this.#publicCandidates.every(({ componentSet }) =>
            componentSet.has(component),
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

    for (const uniqueConstraint of this.#candidates) {
      const result: NonNullable<NodeUniqueFilterInputValue> =
        Object.create(null);

      const components = this.#forcedEdge
        ? Array.from(uniqueConstraint.componentSet).filter(
            (component) => this.#forcedEdge !== component,
          )
        : Array.from(uniqueConstraint.componentSet);

      if (
        components.every((component) => {
          const componentValue = parsedValue[component.name];
          if (componentValue !== undefined) {
            Object.assign(result, {
              [component.name]: componentValue,
            });

            return true;
          }

          return false;
        }) &&
        (this.#forcedEdge ||
          components.some((component) => parsedValue[component.name] !== null))
      ) {
        return result;
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
      R.pipe(
        this.#components,
        R.filter((component) => maybeValue[component.name] !== undefined),
        R.mapToObj((component) => {
          const componentValue = maybeValue[component.name];

          return [
            component.name,
            componentValue === null
              ? null
              : component instanceof Leaf
                ? componentValue
                : component.head.uniqueFilterInputType.pickValue(
                    componentValue,
                    utils.addPath(path, component.name),
                  ),
          ];
        }),
      ),
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
  ): Array<T> {
    return R.uniqueWith(values, (a, b) => this.areValuesEqual(a, b));
  }
}
