import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import * as R from 'remeda';
import type { JsonObject } from 'type-fest';
import type { Node, NodeValue } from '../../node.js';
import { NodeChange, NodeUpdate } from '../change.js';
import type { UniqueConstraint } from '../definition.js';
import { NodeFilter, OrOperation } from './filter.js';
import {
  isComponentSelection,
  isReverseEdgeSelection,
  mergeSelectionExpressions,
  type ComponentSelection,
  type ReverseEdgeSelection,
  type SelectionExpression,
} from './selection/expression.js';
import type { NodeSelectedValue } from './selection/value.js';

export * from './selection/expression-interface.js';
export * from './selection/expression.js';
export * from './selection/value.js';

export class NodeSelection<TValue extends NodeSelectedValue = any> {
  public readonly expressions: ReadonlyArray<SelectionExpression>;

  public constructor(
    public readonly node: Node,
    public readonly expressionsByKey: ReadonlyMap<
      SelectionExpression['key'],
      SelectionExpression
    >,
  ) {
    assert(expressionsByKey.size);

    this.expressions = Object.freeze(Array.from(expressionsByKey.values()));
  }

  /**
   * Returns the selected components' selections
   */
  @Memoize()
  public get components(): ReadonlyArray<ComponentSelection> {
    return Object.freeze(this.expressions.filter(isComponentSelection));
  }

  /**
   * Returns the selected reverse-edges' selections
   */
  @Memoize()
  public get reverseEdges(): ReadonlyArray<ReverseEdgeSelection> {
    return Object.freeze(this.expressions.filter(isReverseEdgeSelection));
  }

  /**
   * Returns the selected unique-constraints
   */
  @Memoize()
  public get uniqueConstraints(): ReadonlyArray<UniqueConstraint> {
    return Object.freeze(
      Array.from(this.node.uniqueConstraintSet)
        .filter((uniqueConstraint) =>
          this.isSupersetOf(uniqueConstraint.selection),
        )
        .sort(
          (a, b) =>
            Math.min(
              ...Array.from(a.componentSet, (component) =>
                this.components.findIndex(
                  (selection) => selection.component === component,
                ),
              ),
            ) -
            Math.min(
              ...Array.from(b.componentSet, (component) =>
                this.components.findIndex(
                  (selection) => selection.component === component,
                ),
              ),
            ),
        ),
    );
  }

  /**
   * Returns the selected identifiers
   */
  @Memoize()
  public get identifiers(): ReadonlyArray<UniqueConstraint> {
    return Object.freeze(
      this.uniqueConstraints.filter((uniqueConstraint) =>
        uniqueConstraint.isIdentifier(),
      ),
    );
  }

  public isAffectedByNodeUpdate(update: NodeUpdate): boolean {
    assert.equal(update.node, this.node);

    return this.expressions.some((expression) =>
      expression.isAffectedByNodeUpdate(update),
    );
  }

  public getAffectedGraphByNodeChange(
    change: NodeChange,
    visitedRootNodes?: NodeValue[],
  ): NodeFilter {
    return new NodeFilter(
      this.node,
      OrOperation.create(
        this.expressions.map((expression) =>
          expression.getAffectedGraphByNodeChange(change, visitedRootNodes),
        ),
      ),
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

  public isSubsetOf(selection: NodeSelection): boolean {
    assert(this.isAkinTo(selection));

    return selection.isSupersetOf(this);
  }

  @Memoize()
  public isPure(): boolean {
    return this.isSubsetOf(this.node.selection);
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

  public toGraphQLSelectionSetNode(): graphql.SelectionSetNode {
    return {
      kind: graphql.Kind.SELECTION_SET,
      selections: Array.from(this.expressions, (expression) =>
        expression.toGraphQLFieldNode(),
      ),
    };
  }

  public parseValue(
    maybeValue: unknown,
    path: utils.Path = utils.addPath(undefined, this.node.toString()),
  ): TValue {
    utils.assertPlainObject(maybeValue, path);

    return utils.aggregateGraphError<SelectionExpression, TValue>(
      this.expressions,
      (document, expression) =>
        Object.assign(document, {
          [expression.key]: expression.parseValue(
            maybeValue[expression.key],
            utils.addPath(path, expression.key),
          ),
        }),
      Object.create(null),
      { path },
    );
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

  public uniqValues(values: ReadonlyArray<TValue>): TValue[] {
    return R.uniqWith(values, (a, b) => this.areValuesEqual(a, b));
  }

  public serialize(
    maybeValue: unknown,
    path: utils.Path = utils.addPath(undefined, this.node.toString()),
  ): JsonObject {
    utils.assertPlainObject(maybeValue, path);

    return utils.aggregateGraphError<SelectionExpression, JsonObject>(
      this.expressions,
      (document, expression) =>
        Object.assign(document, {
          [expression.key]: expression.serialize(
            maybeValue[expression.key],
            utils.addPath(path, expression.key),
          ),
        }),
      Object.create(null),
      { path },
    );
  }

  public stringify(
    maybeValue: unknown,
    path: utils.Path = utils.addPath(undefined, this.node.toString()),
  ): string {
    utils.assertPlainObject(maybeValue, path);

    return `{${utils
      .aggregateGraphError<SelectionExpression, string[]>(
        this.expressions,
        (stringifiedExpressions, expression) => {
          stringifiedExpressions.push(
            `"${expression.key}":${expression.stringify(
              maybeValue[expression.key],
              utils.addPath(path, expression.key),
            )}`,
          );

          return stringifiedExpressions;
        },
        [],
        { path },
      )
      .join(',')}}`;
  }
}
