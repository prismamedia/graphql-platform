import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import PQueue, { Options as QueueOptions } from 'p-queue';
import type { Except, Promisable } from 'type-fest';
import type { Node } from '../node.js';
import { Leaf, type UniqueConstraint } from './definition.js';
import {
  OrderingDirection,
  type NodeSelectedValue,
  type NodeSelection,
} from './statement.js';
import type {
  NodeFilterInputValue,
  OrderByInputValue,
  RawNodeSelection,
} from './type.js';

export type NodeCursorForEachOptions = Except<
  QueueOptions<any, any>,
  'autoStart' | 'queueClass'
> & {
  /**
   * Optional, the number of tasks waiting to be processed
   *
   * Default: the queue's concurrency, so we're able to fill all the workers at any time
   */
  buffer?: number;
};

const pickAfterFilterInputValue = (
  uniqueConstraint: UniqueConstraint,
  direction: OrderingDirection,
  value: NodeSelectedValue,
): NonNullable<NodeFilterInputValue> =>
  Array.from(uniqueConstraint.componentsByName.values()).reduce(
    (filter, component) => {
      assert(component instanceof Leaf);

      return Object.assign(filter, {
        [`${component.name}_${
          direction === OrderingDirection.ASCENDING ? 'gt' : 'lt'
        }`]: value[component.name],
      });
    },
    Object.create(null),
  );

export type NodeCursorOptions<TValue extends NodeSelectedValue = any> = {
  where?: NodeFilterInputValue;
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
  protected readonly where: NodeFilterInputValue;
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

    this.where = node.filterInputType.parseValue(options?.where);

    this.direction = options?.direction || OrderingDirection.ASCENDING;

    // unique-constraint
    {
      let uniqueConstraint: UniqueConstraint;

      if (options?.uniqueConstraint) {
        uniqueConstraint = node.getUniqueConstraintByName(
          options.uniqueConstraint,
        );

        assert(
          uniqueConstraint.isScrollable(),
          `The "${uniqueConstraint}" unique-constraint is not scrollable`,
        );
      } else {
        uniqueConstraint = Array.from(
          node.uniqueConstraintsByName.values(),
        ).find((uniqueConstraint) => uniqueConstraint.isScrollable())!;
      }

      this.uniqueConstraint = uniqueConstraint;
    }

    this.selection = options?.selection
      ? node.outputType.select(options?.selection)
      : node.selection;

    this.internalSelection = this.selection.mergeWith(
      this.uniqueConstraint.selection,
    );

    this.orderByInputValue = Array.from(
      this.uniqueConstraint.componentsByName.values(),
      (component) => {
        assert(component instanceof Leaf);

        return component.getOrderingInput(this.direction).value;
      },
    );

    this.chunkSize = Math.max(1, options?.chunkSize || 100);
  }

  public async count(): Promise<number> {
    return this.node
      .getQueryByKey('count')
      .execute({ where: this.where }, this.context);
  }

  public async *[Symbol.asyncIterator](): AsyncIterator<TValue> {
    let after: NodeFilterInputValue;
    let values: NodeSelectedValue[];

    do {
      values = await this.node.getQueryByKey('find-many').execute(
        {
          where: { AND: [after, this.where] },
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

  public async forEach(
    task: (value: TValue) => Promisable<void>,
    { buffer: rawBuffer, ...queueOptions }: NodeCursorForEachOptions = {},
  ): Promise<void> {
    const queue = new PQueue({
      ...queueOptions,
      concurrency: queueOptions?.concurrency ?? 1,
      throwOnTimeout: queueOptions?.throwOnTimeout ?? true,
    });

    const buffer = rawBuffer ?? queue.concurrency;
    assert(
      typeof buffer === 'number' && buffer >= 1,
      `The buffer has to be greater than or equal to 1, got ${inspect(buffer)}`,
    );

    await new Promise<void>(async (resolve, reject) => {
      queue.on('error', reject);

      try {
        for await (const value of this) {
          await queue.onSizeLessThan(buffer);

          queue.add(() => task(value));
        }

        await queue.onIdle();

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }
}
