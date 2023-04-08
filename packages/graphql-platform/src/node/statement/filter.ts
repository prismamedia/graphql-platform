import type { Node, NodeValue } from '../../node.js';
import type { DependencyTree } from '../result-set.js';
import type { BooleanFilter } from './filter/boolean.js';
import { NotOperation } from './filter/boolean/operation/not.js';
import { BooleanValue } from './filter/boolean/value.js';

export * from './filter/boolean.js';

export interface NodeFilterAST {
  kind: 'NodeFilter';
  node: Node['name'];
  filter: BooleanFilter['ast'];
}

export class NodeFilter {
  public readonly filter: BooleanFilter;

  /**
   * List of the components & reverse-edges whom changes may change the result-set
   */
  public readonly dependencies: DependencyTree | undefined;

  public constructor(public readonly node: Node, filter: BooleanFilter) {
    this.filter = filter.reduced;

    this.dependencies = this.filter.dependencies;
  }

  public get complement(): NodeFilter {
    return new NodeFilter(this.node, new NotOperation(this.filter));
  }

  public equals(nodeFilter: unknown): boolean {
    return (
      nodeFilter instanceof NodeFilter &&
      nodeFilter.node === this.node &&
      nodeFilter.filter.equals(this.filter)
    );
  }

  public isTrue(): boolean {
    return this.filter instanceof BooleanValue && this.filter.isTrue();
  }

  public isFalse(): boolean {
    return this.filter instanceof BooleanValue && this.filter.isFalse();
  }

  public get ast(): NodeFilterAST {
    return {
      kind: 'NodeFilter',
      node: this.node.name,
      filter: this.filter.ast,
    };
  }

  public get normalized(): NodeFilter | undefined {
    return this.isTrue() ? undefined : this;
  }

  /**
   * Execute this filter against a partial value, returns undefined if not applicable
   */
  public execute<TPartial extends boolean = true>(
    nodeValue: Partial<NodeValue>,
    partial?: TPartial,
  ): TPartial extends false ? boolean : boolean | undefined {
    const result = this.filter.execute(nodeValue);

    if (result === undefined && partial === false) {
      throw new Error('The filter is not applicable to this value');
    }

    return result as any;
  }
}

export const areFiltersEqual = (
  a: NodeFilter | undefined,
  b: NodeFilter | undefined,
): boolean =>
  a?.normalized && b?.normalized
    ? a.normalized.equals(b.normalized)
    : a?.normalized === b?.normalized;
