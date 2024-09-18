import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import * as R from 'remeda';
import type { Node, NodeValue } from '../../node.js';
import { NodeChange, NodeUpdate } from '../change.js';
import type {
  Component,
  ReverseEdge,
  UniqueConstraint,
} from '../definition.js';
import type { OperationContext } from '../operation.js';
import { FalseValue, NodeFilter, OrOperation } from './filter.js';
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

    this.expressions = Object.freeze(Array.from(expressionsByKey.values()));
  }

  /**
   * Returns the selected components
   */
  @Memoize()
  public get components(): ReadonlyArray<Component> {
    return Object.freeze(
      Array.from(
        new Set(
          this.expressions.flatMap((expression) =>
            isComponentSelection(expression)
              ? [expression.component]
              : expression instanceof VirtualSelection && expression.dependency
                ? expression.dependency.components
                : [],
          ),
        ),
      ),
    );
  }

  /**
   * Returns the selected reverse-edges
   */
  @Memoize()
  public get reverseEdges(): ReadonlyArray<ReverseEdge> {
    return Object.freeze(
      Array.from(
        new Set(
          this.expressions.flatMap((expression) =>
            isReverseEdgeSelection(expression)
              ? [expression.reverseEdge]
              : expression instanceof VirtualSelection && expression.dependency
                ? expression.dependency.reverseEdges
                : [],
          ),
        ),
      ),
    );
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

  @Memoize()
  public get hasVirtualSelection(): boolean {
    return this.expressions.some(
      (expression) =>
        expression instanceof VirtualSelection ||
        expression.hasVirtualSelection,
    );
  }

  /**
   * Is the provided node-update affecting this selection?
   */
  public isAffectedByNodeUpdate(update: NodeUpdate): boolean {
    assert.equal(update.node, this.node);

    return this.expressions.some((expression) =>
      expression.isAffectedByNodeUpdate(update),
    );
  }

  public getAffectedGraphByNodeChange(
    change: NodeChange,
    visitedRootNodes?: NodeValue[],
  ): NodeFilter | null {
    const filter = OrOperation.create(
      R.pipe(
        this.expressions,
        R.map((expression) =>
          expression.getAffectedGraphByNodeChange(change, visitedRootNodes),
        ),
        R.filter(R.isNonNull),
      ),
    );

    return !filter.equals(FalseValue)
      ? new NodeFilter(this.node, filter)
      : null;
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

  @Memoize()
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

  @Memoize()
  public get ast(): graphql.SelectionSetNode {
    return {
      kind: graphql.Kind.SELECTION_SET,
      selections: this.expressions.map(({ ast }) => ast),
    };
  }

  @Memoize()
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
      : source;
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
}
