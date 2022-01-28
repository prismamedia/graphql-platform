import type { ConnectorInterface } from '../../connector-interface.js';
import type { Node } from '../../node.js';
import type { BooleanFilter } from './filter/boolean.js';
import { NotOperation } from './filter/boolean/operation/not.js';
import { BooleanValue } from './filter/boolean/value.js';

export * from './filter/boolean.js';

export interface NodeFilterAST {
  kind: 'NodeFilter';
  node: Node['name'];
  filter: BooleanFilter['ast'];
}

export class NodeFilter<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> {
  public readonly filter: BooleanFilter;

  public constructor(
    public readonly node: Node<TRequestContext, TConnector>,
    filter: BooleanFilter,
  ) {
    this.filter = filter.reduced;
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
}

export const areFiltersEqual = (
  a: NodeFilter | undefined,
  b: NodeFilter | undefined,
): boolean =>
  a?.normalized && b?.normalized
    ? a.normalized.equals(b.normalized)
    : !a?.normalized && !b?.normalized;
