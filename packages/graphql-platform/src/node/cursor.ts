import assert from 'node:assert/strict';
import type { Node } from '../node.js';
import { Leaf, type UniqueConstraint } from './definition.js';
import {
  NodeSelectedValue,
  NodeSelection,
  OrderingDirection,
} from './statement.js';
import type {
  NodeFilterInputValue,
  OrderByInputValue,
  RawNodeSelection,
} from './type.js';

function pickAfterFilterInputValue(
  uniqueConstraint: UniqueConstraint,
  direction: OrderingDirection,
  value: NodeSelectedValue,
): NonNullable<NodeFilterInputValue> {
  return uniqueConstraint.components.reduce((filter, component) => {
    assert(component instanceof Leaf);

    return Object.assign(filter, {
      [`${component.name}_${
        direction === OrderingDirection.ASCENDING ? 'gt' : 'lt'
      }`]: value[component.name],
    });
  }, Object.create(null));
}

export type NodeCursorOptions<TValue extends NodeSelectedValue = any> = {
  filter?: NodeFilterInputValue;
  selection?: RawNodeSelection<TValue>;
  direction?: OrderingDirection;
  uniqueConstraint?: UniqueConstraint['name'];
  chunkSize?: number;
};

export class NodeCursor<
  TValue extends NodeSelectedValue = any,
  TRequestContext extends object = any,
> implements AsyncIterable<TValue>
{
  protected readonly filter: NodeFilterInputValue;
  protected readonly direction: OrderingDirection;
  protected readonly uniqueConstraint: UniqueConstraint;
  protected readonly selection: NodeSelection<TValue>;
  protected readonly internalSelection: NodeSelection;
  protected readonly orderByInputValue: OrderByInputValue;
  protected readonly chunkSize: number;

  public constructor(
    protected readonly node: Node<TRequestContext>,
    protected readonly context: TRequestContext,
    options?: NodeCursorOptions<TValue>,
  ) {
    assert(node.isScrollable(), `The "${node}" node is not scrollable`);

    this.filter = node.filterInputType.parseValue(options?.filter);

    this.direction = options?.direction || OrderingDirection.ASCENDING;

    // unique-constraint
    {
      let uniqueConstraint: UniqueConstraint;

      if (options?.uniqueConstraint) {
        uniqueConstraint = node.getUniqueConstraintByName(
          options.uniqueConstraint,
        );

        assert(
          uniqueConstraint.isSortable(),
          `The "${uniqueConstraint}" unique-constraint is not sortable`,
        );
      } else {
        uniqueConstraint = node.uniqueConstraints.find((uniqueConstraint) =>
          uniqueConstraint.isSortable(),
        )!;
      }

      this.uniqueConstraint = uniqueConstraint;
    }

    this.selection = (
      options?.selection
        ? node.outputType.select(options?.selection)
        : node.selection
    ) as NodeSelection<TValue>;

    this.internalSelection = this.selection.mergeWith(
      this.uniqueConstraint.selection,
    );

    this.orderByInputValue = this.uniqueConstraint.components.map(
      (component) => {
        assert(component instanceof Leaf);

        return component.getOrderingInput(this.direction).value;
      },
    );

    this.chunkSize = options?.chunkSize || 100;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<TValue> {
    let after: NodeFilterInputValue = undefined;
    let values: NodeSelectedValue[];
    do {
      values = await this.node.getQueryByKey('find-many').execute(
        {
          where: { AND: [after, this.filter] },
          orderBy: this.orderByInputValue,
          first: this.chunkSize,
          selection: this.internalSelection,
        },
        this.context,
      );

      if (values.length) {
        for (const value of values) {
          yield this.selection.parseValue(value);
        }

        after = pickAfterFilterInputValue(
          this.uniqueConstraint,
          this.direction,
          values.at(-1)!,
        );
      }
    } while (values.length === this.chunkSize);
  }
}
