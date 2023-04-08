import type { Node } from '../node.js';
import { ResultSetMutability } from './result-set/mutability.js';
import type {
  NodeSelectedValue,
  NodeSelection,
} from './statement/selection.js';
import type {
  NodeFilterInputValue,
  OrderByInputValue,
  RawNodeSelection,
} from './type.js';

export * from './result-set/mutability.js';

export type ResultSetConfig<TValue extends NodeSelectedValue = any> = {
  where?: NodeFilterInputValue;
  orderBy?: OrderByInputValue;
  selection: RawNodeSelection<TValue>;
};

/**
 * A result-set is the set of results returned by a query
 *
 * @see https://en.wikipedia.org/wiki/Result_set
 */
export class ResultSet<TValue extends NodeSelectedValue = any> {
  readonly #where: NodeFilterInputValue;
  readonly #orderBy?: OrderByInputValue;
  readonly #selection: NodeSelection<TValue>;

  public readonly mutability?: ResultSetMutability;

  public constructor(
    public readonly node: Node,
    config: Readonly<ResultSetConfig<TValue>>,
  ) {
    this.#where = this.node.filterInputType.parseValue(config.where);
    this.#orderBy = config.orderBy || undefined;
    this.#selection = this.node.outputType.select(config.selection);

    this.mutability = new ResultSetMutability(node, {
      filter: node.filterInputType.filter(this.#where).normalized,
      ordering: node.orderingInputType.sort(this.#orderBy).normalized,
      selection: this.#selection,
    });
  }
}
