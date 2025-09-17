import { MGetter, MMethod } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert';
import type { Node } from '../../node.js';
import { NodeCreation, NodeDeletion, type NodeChange } from '../change.js';
import { NodeDependencyTree } from '../dependency.js';
import type { NodeFilterInputValue } from '../type.js';
import type { BooleanFilter } from './filter/boolean.js';
import {
  AndOperation,
  NotOperation,
  OrOperation,
} from './filter/boolean/operation.js';
import { FalseValue, TrueValue } from './filter/boolean/value.js';
import type { NodeSelectedValue, NodeSelection } from './selection.js';

export * from './filter/boolean.js';

export class NodeFilter {
  /**
   * Used to sort filters, the lower the better/simpler
   */
  public readonly score: number;

  public constructor(
    public readonly node: Node,
    public readonly filter: BooleanFilter,
  ) {
    this.score = filter.score;
  }

  @MGetter
  public get complement(): NodeFilter {
    return new NodeFilter(this.node, NotOperation.create(this.filter));
  }

  public and(
    ...others: ReadonlyArray<NodeFilter | NodeFilterInputValue>
  ): NodeFilter | this {
    return others.length
      ? new NodeFilter(
          this.node,
          AndOperation.create([
            this.filter,
            ...others.map((rawOther) => {
              const other =
                rawOther instanceof NodeFilter
                  ? rawOther
                  : this.node.filterInputType.parseAndFilter(rawOther);

              assert.strictEqual(other.node, this.node);

              return other.filter;
            }),
          ]),
        )
      : this;
  }

  public or(
    ...others: ReadonlyArray<NodeFilter | NodeFilterInputValue>
  ): NodeFilter | this {
    return others.length
      ? new NodeFilter(
          this.node,
          OrOperation.create([
            this.filter,
            ...others.map((rawOther) => {
              const other =
                rawOther instanceof NodeFilter
                  ? rawOther
                  : this.node.filterInputType.parseAndFilter(rawOther);

              assert.strictEqual(other.node, this.node);

              return other.filter;
            }),
          ]),
        )
      : this;
  }

  public equals(filter: unknown): boolean {
    return (
      filter instanceof NodeFilter &&
      filter.node === this.node &&
      filter.filter.equals(this.filter)
    );
  }

  @MMethod()
  public isTrue(): boolean {
    return this.filter.equals(TrueValue);
  }

  @MMethod()
  public isFalse(): boolean {
    return this.filter.equals(FalseValue);
  }

  @MGetter
  public get normalized(): this | undefined {
    return this.isTrue() ? undefined : this;
  }

  public isExecutableWithin(selection: NodeSelection): boolean {
    assert.strictEqual(selection.node, this.node);

    return this.filter.isExecutableWithin(selection);
  }

  /**
   * Execute this filter against a partial value, returns undefined if not applicable
   */
  public execute<TPartial extends boolean>(
    value: NodeSelectedValue,
    partial: TPartial,
  ): TPartial extends false ? boolean : boolean | undefined {
    const result = this.filter.execute(value);

    if (partial === false) {
      assert.notStrictEqual(
        result,
        undefined,
        'The filter is not applicable to this value',
      );
    }

    return result as any;
  }

  public isChangeFilteredOut(change: NodeChange): boolean {
    assert.strictEqual(change.node, this.node);

    return change instanceof NodeCreation
      ? this.execute(change.newValue, true) === false
      : change instanceof NodeDeletion
        ? this.execute(change.oldValue, true) === false
        : this.execute(change.newValue, true) === false &&
          this.execute(change.oldValue, true) === false;
  }

  public isEdgeHeadChangeFilteredOut(change: NodeChange): boolean {
    return this.filter.isEdgeHeadChangeFilteredOut(change);
  }

  @MGetter
  public get dependencyTree(): NodeDependencyTree {
    return new NodeDependencyTree(this.node, {
      dependencies: this.filter.dependencies,
    });
  }

  @MMethod()
  public isUnique(): boolean {
    return this.node.uniqueFilterInputType.isValid(this.inputValue);
  }

  @MGetter
  public get ast(): graphql.ConstObjectValueNode | graphql.NullValueNode {
    return this.filter.ast;
  }

  @MMethod()
  public toString(): string {
    return graphql.print(this.ast);
  }

  @MGetter
  public get inputValue(): Exclude<NodeFilterInputValue, undefined> {
    return this.filter.inputValue;
  }
}

export const areFiltersEqual = (
  a: NodeFilter | undefined,
  b: NodeFilter | undefined,
): boolean =>
  a?.normalized && b?.normalized
    ? a.normalized.equals(b.normalized)
    : a?.normalized === b?.normalized;
