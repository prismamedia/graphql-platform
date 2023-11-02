import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize, doNotCache } from '@prismamedia/memoize';
import {
  MultiBar as MultiProgressBar,
  SingleBar as ProgressBar,
  Presets as ProgressBarPresets,
  type Options as ProgressBarOptions,
} from 'cli-progress';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import PQueue, { Options as PQueueOptions } from 'p-queue';
import PRetry, { Options as PRetryOptions } from 'p-retry';
import type { Except, Promisable } from 'type-fest';
import type { ContextBoundNodeAPI, Node, OperationContext } from '../node.js';
import { Leaf, type UniqueConstraint } from './definition.js';
import {
  NodeFilter,
  NodeOrdering,
  OrderingDirection,
  type NodeSelectedValue,
  type NodeSelection,
} from './statement.js';
import type { NodeFilterInputValue, RawNodeSelection } from './type.js';

export const defaultNamedProgressBarFormat =
  `[{bar}] {name} | {value}/{total} | {percentage}% | ETA: {eta_formatted} | Elapsed: {duration_formatted}` satisfies ProgressBarOptions['format'];

export const defaultProgressBarFormat =
  `[{bar}] {value}/{total} | {percentage}% | ETA: {eta_formatted} | Elapsed: {duration_formatted}` satisfies ProgressBarOptions['format'];

export {
  MultiProgressBar,
  ProgressBar,
  ProgressBarPresets,
  type ProgressBarOptions,
};

const pickAfterFilterInputValue = (
  uniqueConstraint: UniqueConstraint,
  direction: OrderingDirection,
  value: NodeSelectedValue,
): NonNullable<NodeFilterInputValue> =>
  Object.fromEntries(
    Array.from(uniqueConstraint.componentSet, (component) => [
      `${component.name}_${
        direction === OrderingDirection.ASCENDING ? 'gt' : 'lt'
      }`,
      value[component.name],
    ]),
  );

export type NodeCursorForEachTask<
  TValue extends NodeSelectedValue = any,
  TRequestContext extends object = any,
> = (
  value: TValue,
  index: number,
  cursor: NodeCursor<TValue, TRequestContext>,
) => Promisable<void>;

export type NodeCursorForEachOptions = Except<
  PQueueOptions<any, any>,
  'autoStart' | 'queueClass'
> & {
  /**
   * Optional, the number of tasks waiting to be processed
   *
   * Default: the queue's concurrency, so we're able to fill all the workers at any time
   */
  buffer?: number;

  /**
   * Optional, define a retry strategy
   *
   * Default: false / no retry
   *
   * @see https://github.com/sindresorhus/p-retry/blob/main/readme.md
   */
  retry?: PRetryOptions | number | boolean;

  /**
   * Optional, either:
   * - provide a progress-bar which will be updated with the current progress
   * - provide a multi-progress-bar on which will be appended a new one which will be updated with the current progress
   *
   * Default: none
   */
  progressBar?:
    | boolean
    | ProgressBar
    | { container: MultiProgressBar; name: string };
};

export type NodeCursorByBatchTask<
  TValue extends NodeSelectedValue = any,
  TRequestContext extends object = any,
> = (
  values: ReadonlyArray<TValue>,
  cursor: NodeCursor<TValue, TRequestContext>,
) => Promisable<void>;

export type NodeCursorByBatchOptions = NodeCursorForEachOptions & {
  /**
   * Optional, the maximum size of the batch
   *
   * Default: 100
   */
  batchSize?: number;
};

export type NodeCursorConfig<TValue extends NodeSelectedValue = any> = {
  where?: NodeFilterInputValue | NodeFilter;
  selection: RawNodeSelection<TValue>;
  direction?: OrderingDirection;
  uniqueConstraint?: UniqueConstraint['name'];
  chunkSize?: number;
};

export class NodeCursor<
  TValue extends NodeSelectedValue = any,
  TRequestContext extends object = any,
> implements AsyncIterable<TValue>
{
  public readonly uniqueConstraint: UniqueConstraint;
  public readonly filter?: NodeFilter;
  public readonly ordering: NodeOrdering;
  public readonly selection: NodeSelection<TValue>;

  readonly #api: ContextBoundNodeAPI;
  readonly #direction: OrderingDirection;
  readonly #internalSelection: NodeSelection;
  readonly #chunkSize: number;

  public constructor(
    public readonly node: Node<TRequestContext>,
    context:
      | utils.Thunkable<TRequestContext>
      | OperationContext<TRequestContext>,
    config: Readonly<NodeCursorConfig<TValue>>,
  ) {
    // unique-constraint
    {
      let uniqueConstraint: UniqueConstraint | undefined;

      if (config?.uniqueConstraint) {
        uniqueConstraint = node.getUniqueConstraintByName(
          config.uniqueConstraint,
        );

        assert(
          uniqueConstraint.isScrollable(),
          `The "${uniqueConstraint}" unique-constraint is not scrollable`,
        );
      } else {
        uniqueConstraint = Array.from(node.uniqueConstraintSet).find(
          (uniqueConstraint) => uniqueConstraint.isScrollable(),
        );

        assert(uniqueConstraint, `The "${node}" node is not scrollable`);
      }

      this.uniqueConstraint = uniqueConstraint;
    }

    // filter
    {
      const filter =
        config?.where instanceof NodeFilter
          ? config.where
          : node.filterInputType.parseAndFilter(config?.where);
      assert(!filter.isFalse());

      this.filter = filter.normalized;
    }

    this.selection = node.outputType.select(config.selection);

    this.#internalSelection = this.selection.mergeWith(
      this.uniqueConstraint.selection,
    );

    this.#api = node.createContextBoundAPI(context);

    this.#direction = config?.direction || OrderingDirection.ASCENDING;

    this.ordering = new NodeOrdering(
      node,
      Array.from(this.uniqueConstraint.componentSet, (component) => {
        assert(component instanceof Leaf && component.isSortable());

        return component.getOrderingInput(this.#direction).sort();
      }),
    );

    this.#chunkSize = Math.max(1, config?.chunkSize || 100);
  }

  @Memoize((force: boolean = false) => force && doNotCache)
  public async size(force: boolean = false): Promise<number> {
    return this.#api.count({ where: this.filter?.inputValue });
  }

  public async *[Symbol.asyncIterator](): AsyncIterator<TValue> {
    let after: NodeFilterInputValue;
    let values: NodeSelectedValue[];

    do {
      values = await this.#api.findMany({
        where: { AND: [after, this.filter?.inputValue] },
        orderBy: this.ordering.inputValue,
        first: this.#chunkSize,
        selection: this.#internalSelection,
      });

      if (values.length) {
        for (const value of values) {
          yield this.selection.parseValue(value);
        }

        after = pickAfterFilterInputValue(
          this.uniqueConstraint,
          this.#direction,
          values.at(-1)!,
        );
      }
    } while (values.length === this.#chunkSize);
  }

  public async forEach(
    task: NodeCursorForEachTask<TValue, TRequestContext>,
    {
      progressBar: progressBarOptions,
      retry: retryOptions,
      buffer: bufferOptions,
      ...queueOptions
    }: NodeCursorForEachOptions = {},
  ): Promise<void> {
    const tasks = new PQueue({
      ...queueOptions,
      concurrency: queueOptions?.concurrency ?? 1,
      throwOnTimeout: queueOptions?.throwOnTimeout ?? true,
    });

    const buffer = bufferOptions ?? tasks.concurrency;
    assert(
      typeof buffer === 'number' && buffer >= 1,
      `The buffer has to be greater than or equal to 1, got ${inspect(buffer)}`,
    );

    const normalizedRetryOptions: PRetryOptions | false = retryOptions
      ? retryOptions === true
        ? {}
        : typeof retryOptions === 'number'
        ? { retries: retryOptions }
        : retryOptions
      : false;

    let currentIndex: number = 0;

    let progressBar: ProgressBar | undefined;
    if (progressBarOptions) {
      if (
        typeof progressBarOptions === 'object' &&
        'container' in progressBarOptions &&
        'name' in progressBarOptions
      ) {
        assert(
          progressBarOptions.container instanceof MultiProgressBar,
          `The "container" has to be a multi-progress-bar instance`,
        );
        assert.equal(
          typeof progressBarOptions.name,
          'string',
          `The "name" has to be a string`,
        );

        progressBar = progressBarOptions.container.create(
          await this.size(),
          currentIndex,
          { name: progressBarOptions.name },
        );
      } else {
        progressBar =
          progressBarOptions instanceof ProgressBar
            ? progressBarOptions
            : new ProgressBar({ format: defaultProgressBarFormat });

        progressBar.start(await this.size(), currentIndex);
      }
    }

    try {
      await new Promise<void>(async (resolve, reject) => {
        tasks.on('error', reject);

        try {
          for await (const value of this) {
            await tasks.onSizeLessThan(buffer);

            const taskIndex = currentIndex++;
            const wrappedTask = async () => {
              await task(value, taskIndex, this);

              progressBar?.increment();
            };

            tasks.add(
              normalizedRetryOptions
                ? () => PRetry(wrappedTask, normalizedRetryOptions)
                : wrappedTask,
            );
          }

          await tasks.onIdle();

          progressBar?.stop();

          resolve();
        } catch (error) {
          reject(error);
        }
      });
    } finally {
      tasks.clear();
    }
  }

  public async byBatch(
    task: NodeCursorByBatchTask<TValue, TRequestContext>,
    {
      batchSize,
      progressBar: progressBarOptions,
      retry: retryOptions,
      buffer: bufferOptions,
      ...queueOptions
    }: NodeCursorByBatchOptions = {},
  ): Promise<void> {
    const tasks = new PQueue({
      ...queueOptions,
      concurrency: queueOptions?.concurrency ?? 1,
      throwOnTimeout: queueOptions?.throwOnTimeout ?? true,
    });

    const buffer = bufferOptions ?? tasks.concurrency;
    assert(
      typeof buffer === 'number' && buffer >= 0,
      `The buffer has to be greater than or equal to 0, got ${inspect(buffer)}`,
    );

    const normalizedBatchSize = Math.max(1, batchSize || this.#chunkSize);

    const normalizedRetryOptions: PRetryOptions | false = retryOptions
      ? retryOptions === true
        ? {}
        : typeof retryOptions === 'number'
        ? { retries: retryOptions }
        : retryOptions
      : false;

    let currentIndex: number = 0;

    let progressBar: ProgressBar | undefined;
    if (progressBarOptions) {
      if (
        typeof progressBarOptions === 'object' &&
        'container' in progressBarOptions &&
        'name' in progressBarOptions
      ) {
        assert(
          progressBarOptions.container instanceof MultiProgressBar,
          `The "container" has to be a multi-progress-bar instance`,
        );
        assert.equal(
          typeof progressBarOptions.name,
          'string',
          `The "name" has to be a string`,
        );

        progressBar = progressBarOptions.container.create(
          await this.size(),
          currentIndex,
          { name: progressBarOptions.name },
        );
      } else {
        progressBar =
          progressBarOptions instanceof ProgressBar
            ? progressBarOptions
            : new ProgressBar({ format: defaultProgressBarFormat });

        progressBar.start(await this.size(), currentIndex);
      }
    }

    let batch: TValue[] = [];

    const processBatch = () => {
      if (batch.length) {
        const values = Object.freeze(batch);
        batch = [];

        const wrappedTask = async () => {
          await task(values, this);

          progressBar?.increment(values.length);
        };

        tasks.add(
          normalizedRetryOptions
            ? () => PRetry(wrappedTask, normalizedRetryOptions)
            : wrappedTask,
        );
      }
    };

    try {
      await new Promise<void>(async (resolve, reject) => {
        tasks.on('error', reject);

        try {
          for await (const value of this) {
            await tasks.onSizeLessThan(buffer + 1);

            if (batch.push(value) >= normalizedBatchSize) {
              processBatch();
            }
          }

          processBatch();

          await tasks.onIdle();

          progressBar?.stop();

          resolve();
        } catch (error) {
          reject(error);
        }
      });
    } finally {
      tasks.clear();
    }
  }

  @Memoize((force: boolean = false) => force && doNotCache)
  public async toArray(force: boolean = false): Promise<TValue[]> {
    const values: TValue[] = [];

    for await (const value of this) {
      values.push(value);
    }

    return values;
  }
}
