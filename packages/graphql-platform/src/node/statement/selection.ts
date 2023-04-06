import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import _ from 'lodash';
import assert from 'node:assert/strict';
import type { JsonObject } from 'type-fest';
import type { Node } from '../../node.js';
import {
  mergeSelectionExpressions,
  type SelectionExpression,
} from './selection/expression.js';
import type { NodeSelectedValue } from './selection/value.js';

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
    this.expressions = Object.freeze(Array.from(expressionsByKey.values()));
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

  /**
   * Returns true if the provided selection is a subset of the current one
   */
  public includes(selection: NodeSelection): boolean {
    assert(this.isAkinTo(selection));

    return selection.expressions.every((expression) =>
      this.expressionsByKey.get(expression.key)?.includes(expression),
    );
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

  public toGraphQLSelectionSet(): graphql.SelectionSetNode {
    return {
      kind: graphql.Kind.SELECTION_SET,
      selections: Array.from(this.expressions, (expression) =>
        expression.toGraphQLField(),
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
    return _.uniqWith(values, (a, b) => this.areValuesEqual(a, b));
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
