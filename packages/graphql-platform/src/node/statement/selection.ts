import {
  addPath,
  aggregateError,
  isPlainObject,
  UnexpectedValueError,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import type { Node } from '../../node.js';
import {
  mergeSelectionExpressions,
  type SelectionExpression,
} from './selection/expression.js';
import type { NodeSelectedValue } from './selection/value.js';

export * from './selection/expression.js';
export * from './selection/value.js';

export class NodeSelection<
  TValue extends NodeSelectedValue = NodeSelectedValue,
> {
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

  public isAkinTo(nodeSelection: unknown): nodeSelection is NodeSelection {
    return (
      nodeSelection instanceof NodeSelection && nodeSelection.node === this.node
    );
  }

  public equals(nodeSelection: unknown): boolean {
    return (
      this.isAkinTo(nodeSelection) &&
      nodeSelection.expressionsByKey.size === this.expressionsByKey.size &&
      nodeSelection.expressions.every((expression) =>
        expression.equals(this.expressionsByKey.get(expression.key)),
      )
    );
  }

  /**
   * Returns true if the provided selection is a subset of the current one
   */
  public includes(nodeSelection: NodeSelection): boolean {
    return (
      this.isAkinTo(nodeSelection) &&
      nodeSelection.expressions.every((expression) =>
        this.expressionsByKey.get(expression.key)?.includes(expression),
      )
    );
  }

  public mergeWith(
    nodeSelection:
      | NodeSelection
      | undefined
      | ReadonlyArray<NodeSelection | undefined>,
    path?: Path,
  ): NodeSelection | this {
    if (!nodeSelection) {
      return this;
    }

    if (Array.isArray(nodeSelection)) {
      return aggregateError<NodeSelection | undefined, NodeSelection>(
        nodeSelection,
        (mergedNodeSelection, nodeSelection, index) =>
          mergedNodeSelection.mergeWith(nodeSelection, addPath(path, index)),
        this,
        { path },
      );
    }

    if (!this.isAkinTo(nodeSelection)) {
      throw new UnexpectedValueError(
        `${this.node.indefinite}'s selection`,
        nodeSelection,
        { path },
      );
    }

    return new NodeSelection(
      this.node,
      mergeSelectionExpressions(
        [...this.expressions, ...nodeSelection.expressions],
        path,
      ),
    );
  }

  public parseValue(maybeValue: unknown, path?: Path): TValue {
    if (!isPlainObject(maybeValue)) {
      throw new UnexpectedValueError('a plain-object', maybeValue, { path });
    }

    return aggregateError<SelectionExpression, TValue>(
      this.expressionsByKey.values(),
      (nodeValue, fieldSelection) =>
        Object.assign(nodeValue, {
          [fieldSelection.key]: fieldSelection.parseValue(
            maybeValue[fieldSelection.key],
            addPath(path, fieldSelection.key),
          ),
        }),
      Object.create(null),
      { path },
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
}
