import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter, MMethod } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert';
import type { JsonObject } from 'type-fest';
import type { Node } from '../../node.js';
import { DependencyGraph } from '../change/dependency.js';
import type {
  Component,
  ReverseEdge,
  UniqueConstraint,
} from '../definition.js';
import type { OperationContext } from '../operation.js';
import {
  VirtualSelection,
  isComponentSelection,
  isReverseEdgeSelection,
  mergeSelectionExpressions,
  type SelectionExpression,
} from './selection/expression.js';

export * from './selection/expression-interface.js';
export * from './selection/expression.js';

export type NodeSelectedSource = {
  [key: SelectionExpression['key']]: ReturnType<
    SelectionExpression['parseSource']
  >;
};

export type NodeSelectedValue = {
  [key: SelectionExpression['key']]: Awaited<
    ReturnType<SelectionExpression['resolveValue']>
  >;
};

export class NodeSelection<
  TSource extends NodeSelectedSource = any,
  TValue extends NodeSelectedValue = TSource,
> {
  public readonly expressions: ReadonlyArray<SelectionExpression>;

  public constructor(
    public readonly node: Node,
    public readonly expressionsByKey: ReadonlyMap<
      SelectionExpression['key'],
      SelectionExpression
    >,
  ) {
    assert(expressionsByKey.size, `The "${node}"'s selection is empty`);

    this.expressions = Array.from(expressionsByKey.values());
  }

  /**
   * Returns the selected components
   */
  @MGetter
  public get components(): ReadonlyArray<Component> {
    return Array.from(
      new Set(
        this.expressions.flatMap((expression) =>
          isComponentSelection(expression)
            ? [expression.component]
            : expression instanceof VirtualSelection &&
                expression.sourceSelection
              ? expression.sourceSelection.components
              : [],
        ),
      ),
    );
  }

  /**
   * Returns the selected reverse-edges
   */
  @MGetter
  public get reverseEdges(): ReadonlyArray<ReverseEdge> {
    return Array.from(
      new Set(
        this.expressions.flatMap((expression) =>
          isReverseEdgeSelection(expression)
            ? [expression.reverseEdge]
            : expression instanceof VirtualSelection &&
                expression.sourceSelection
              ? expression.sourceSelection.reverseEdges
              : [],
        ),
      ),
    );
  }

  /**
   * Returns the selected unique-constraints
   */
  @MGetter
  public get uniqueConstraints(): ReadonlyArray<UniqueConstraint> {
    return Array.from(this.node.uniqueConstraintSet)
      .filter((uniqueConstraint) =>
        this.isSupersetOf(uniqueConstraint.selection),
      )
      .sort(
        (a, b) =>
          Math.min(
            ...Array.from(a.componentSet, (aComponent) =>
              this.components.findIndex(
                (thisComponent) => thisComponent === aComponent,
              ),
            ),
          ) -
          Math.min(
            ...Array.from(b.componentSet, (bComponent) =>
              this.components.findIndex(
                (thisComponent) => thisComponent === bComponent,
              ),
            ),
          ),
      );
  }

  /**
   * Returns the selected identifiers
   */
  @MGetter
  public get identifiers(): ReadonlyArray<UniqueConstraint> {
    return this.uniqueConstraints.filter((uniqueConstraint) =>
      uniqueConstraint.isIdentifier(),
    );
  }

  /**
   * Returns the selected virtual-selections
   */
  @MGetter
  public get virtualSelections(): ReadonlyArray<VirtualSelection> {
    return this.expressions.filter(
      (expression): expression is VirtualSelection =>
        expression instanceof VirtualSelection,
    );
  }

  @MGetter
  public get hasVirtualSelection(): boolean {
    return this.expressions.some(
      (expression) =>
        expression instanceof VirtualSelection ||
        expression.hasVirtualSelection,
    );
  }

  @MGetter
  public get dependencyGraph(): DependencyGraph {
    return new DependencyGraph(
      this.node,
      ...this.expressions.map(({ dependency }) => dependency),
    );
  }

  public isAkinTo(maybeSelection: unknown): maybeSelection is NodeSelection {
    return (
      maybeSelection instanceof NodeSelection &&
      maybeSelection.node === this.node
    );
  }

  public equals(maybeSelection: unknown): boolean {
    return (
      this.isAkinTo(maybeSelection) &&
      maybeSelection.expressionsByKey.size === this.expressionsByKey.size &&
      maybeSelection.expressions.every((expression) =>
        expression.equals(this.expressionsByKey.get(expression.key)),
      )
    );
  }

  public isSupersetOf(selection: NodeSelection): boolean {
    assert(this.isAkinTo(selection));

    return selection.expressions.every((expression) =>
      this.expressionsByKey.get(expression.key)?.isSupersetOf(expression),
    );
  }

  @MMethod()
  public isPure(): boolean {
    return this.node.selection.isSupersetOf(this);
  }

  public mergeWith(
    selection: NodeSelection,
    path?: utils.Path,
  ): NodeSelection | this {
    assert(this.isAkinTo(selection));

    return new NodeSelection(
      this.node,
      mergeSelectionExpressions(
        [...this.expressions, ...selection.expressions],
        path,
      ),
    );
  }

  @MGetter
  public get ast(): graphql.SelectionSetNode {
    return {
      kind: graphql.Kind.SELECTION_SET,
      selections: this.expressions.map(({ ast }) => ast),
    };
  }

  @MMethod()
  public toString(): string {
    return graphql.print(this.ast);
  }

  public parseSource(
    rawSource: unknown,
    path: utils.Path = utils.addPath(undefined, this.node.toString()),
  ): TSource {
    utils.assertPlainObject(rawSource, path);

    return utils.aggregateGraphError<SelectionExpression, TSource>(
      this.expressions,
      (document: any, expression) => {
        document[expression.key] = expression.parseSource(
          rawSource[expression.key],
          utils.addPath(path, expression.key),
        );

        return document;
      },
      Object.create(null),
      { path },
    );
  }

  public async resolveValue(
    source: TSource,
    context: OperationContext,
    path: utils.Path = utils.addPath(undefined, this.node.toString()),
  ): Promise<TValue> {
    return this.hasVirtualSelection
      ? Object.assign(
          Object.create(null),
          Object.fromEntries(
            await Promise.all(
              this.expressions.map(async (expression) => [
                expression.key,
                expression instanceof VirtualSelection ||
                expression.hasVirtualSelection
                  ? await expression.resolveValue(
                      source[expression.key],
                      context,
                      utils.addPath(path, expression.key),
                    )
                  : source[expression.key],
              ]),
            ),
          ),
        )
      : (source as unknown as TValue);
  }

  public pickValue(
    superSetOfValue: TValue,
    path: utils.Path = utils.addPath(undefined, this.node.toString()),
  ): TValue {
    return this.expressions.reduce<TValue>((document: any, expression) => {
      if (superSetOfValue[expression.key] === undefined) {
        throw new utils.UnexpectedUndefinedError(expression.key, { path });
      }

      document[expression.key] = expression.pickValue(
        superSetOfValue[expression.key],
        utils.addPath(path, expression.key),
      );

      return document;
    }, Object.create(null));
  }

  public areValuesEqual(a: TValue, b: TValue): boolean {
    const aKeySet = new Set(Object.keys(a));
    const bKeySet = new Set(Object.keys(b));

    return (
      aKeySet.size === this.expressions.length &&
      bKeySet.size === this.expressions.length &&
      this.expressions.every(
        (expression) =>
          aKeySet.delete(expression.key) &&
          bKeySet.delete(expression.key) &&
          expression.areValuesEqual(
            a[expression.key] as any,
            b[expression.key] as any,
          ),
      ) &&
      aKeySet.size === 0 &&
      bKeySet.size === 0
    );
  }

  public serialize(
    value: unknown,
    path: utils.Path = utils.addPath(undefined, this.node.toString()),
  ): JsonObject {
    utils.assertPlainObject(value, path);

    return utils.aggregateGraphError<SelectionExpression, TSource>(
      this.expressions,
      (document: any, expression) => {
        document[expression.key] = expression.serialize(
          value[expression.key],
          utils.addPath(path, expression.key),
        );

        return document;
      },
      Object.create(null),
      { path },
    );
  }

  public unserialize(
    value: unknown,
    path: utils.Path = utils.addPath(undefined, this.node.toString()),
  ): TValue {
    utils.assertPlainObject(value, path);

    return utils.aggregateGraphError<SelectionExpression, TValue>(
      this.expressions,
      (document: any, expression) => {
        document[expression.key] = expression.unserialize(
          value[expression.key],
          utils.addPath(path, expression.key),
        );

        return document;
      },
      Object.create(null),
      { path },
    );
  }
}
