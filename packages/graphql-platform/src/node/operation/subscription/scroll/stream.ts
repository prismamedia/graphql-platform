import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import {
  MultiBar as MultiProgressBar,
  SingleBar as ProgressBar,
  type Options as ProgressBarOptions,
} from 'cli-progress';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import PQueue, { Options as PQueueOptions } from 'p-queue';
import PRetry, { Options as PRetryOptions } from 'p-retry';
import type { Except, Promisable } from 'type-fest';
import type { Node } from '../../../../node.js';
import type {
  ContextBoundNodeAPI,
  OperationContext,
} from '../../../operation.js';
import {
  LeafOrdering,
  NodeFilter,
  NodeSelection,
  OrderingDirection,
  type NodeSelectedValue,
} from '../../../statement.js';
import { LeafFilterInputType, NodeFilterInputValue } from '../../../type.js';

export const defaultNamedProgressBarFormat =
  `[{bar}] {name} | {value}/{total} | {percentage}% | ETA: {eta_formatted} | Elapsed: {duration_formatted}` satisfies ProgressBarOptions['format'];

export const defaultProgressBarFormat =
  `[{bar}] {value}/{total} | {percentage}% | ETA: {eta_formatted} | Elapsed: {duration_formatted}` satisfies ProgressBarOptions['format'];

export {
  MultiBar as MultiProgressBar,
  SingleBar as ProgressBar,
  Presets as ProgressBarPresets,
  type Options as ProgressBarOptions,
} from 'cli-progress';

export type ScrollSubscriptionStreamForEachTask<
  TValue extends NodeSelectedValue = any,
  TRequestContext extends object = any,
> = (
  value: TValue,
  index: number,
  stream: ScrollSubscriptionStream<TValue, TRequestContext>,
) => Promisable<void>;

export type ScrollSubscriptionStreamForEachOptions = Except<
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
   * Optional, change the default behavior when an error is encountered, which is to stop the stream and throw that error
   *
   * Anything but throwing an error will let the process continue
   */
  onError?: (error: Error) => void;

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

export type ScrollSubscriptionStreamByBatchTask<
  TValue extends NodeSelectedValue = any,
  TRequestContext extends object = any,
> = (
  values: ReadonlyArray<TValue>,
  stream: ScrollSubscriptionStream<TValue, TRequestContext>,
) => Promisable<void>;

export type ScrollSubscriptionStreamByBatchOptions =
  ScrollSubscriptionStreamForEachOptions & {
    /**
     * Optional, the maximum size of the batch
     *
     * Default: 100
     */
    batchSize?: number;
  };

export type ScrollSubscriptionStreamConfig<
  TValue extends NodeSelectedValue = any,
> = {
  filter?: NodeFilter;
  ordering: LeafOrdering;
  selection: NodeSelection<TValue>;
  chunkSize: number;
};

/**
 * A scroll makes a collection consumable by chunks
 *
 * @example <caption>Query</caption>
 * articles(
 *   where: {
 *     OR: [
 *       { status: PUBLISHED },
 *       { category: { slug: "my-selected-category" }},
 *       { category: { articleCount_gt: 0 }},
 *       { tags_some: { tag: { slug: "my-selected-tag" } }},
 *       { tagCount_gte: 5 }
 *     ]
 *   }
 * ) {
 *   id
 *   title
 *   category { title }
 *   tagCount(where: { tag: { deprecated_not: true } })
 *   tags(where: { tag: { deprecated_not: true } }, orderBy: [order_ASC], first: 10) { tag { title } }
 * }
 */
export class ScrollSubscriptionStream<
  TValue extends NodeSelectedValue = any,
  TRequestContext extends object = any,
> implements AsyncIterable<TValue>
{
  public readonly filter?: NodeFilter;
  public readonly ordering: LeafOrdering;
  public readonly selection: NodeSelection<TValue>;

  readonly #nextFilterInputType: LeafFilterInputType;
  readonly #internalSelection: NodeSelection;
  readonly #chunkSize: number;

  readonly #api: ContextBoundNodeAPI;
  readonly #ac: AbortController;

  public constructor(
    public readonly node: Node<TRequestContext>,
    context:
      | OperationContext<TRequestContext>
      | utils.Thunkable<TRequestContext>,
    config: Readonly<ScrollSubscriptionStreamConfig<TValue>>,
  ) {
    assert(config.filter === undefined || config.filter instanceof NodeFilter);
    this.filter = config.filter?.normalized;

    assert(
      config.ordering instanceof LeafOrdering &&
        config.ordering.leaf.isUnique() &&
        !config.ordering.leaf.isNullable(),
    );
    this.ordering = config.ordering;

    assert(config.selection instanceof NodeSelection);
    this.selection = config.selection;

    {
      const nextFilterInputType = node.filterInputType.fields.find(
        (field): field is LeafFilterInputType =>
          field instanceof LeafFilterInputType &&
          field.leaf === this.ordering.leaf &&
          field.id ===
            (this.ordering.direction === OrderingDirection.ASCENDING
              ? 'gt'
              : 'lt'),
      );

      assert(nextFilterInputType);
      this.#nextFilterInputType = nextFilterInputType;
    }

    this.#internalSelection = this.selection.mergeWith(
      node.outputType.selectComponents([this.ordering.leaf.name]),
    );

    this.#chunkSize = Math.max(1, config.chunkSize);

    this.#api = node.createContextBoundAPI(context);
    this.#ac = new AbortController();
  }

  @Memoize()
  public async initialize(): Promise<void> {
    this.#ac.signal.throwIfAborted();

    // Nothing to do
  }

  @Memoize()
  public async dispose(): Promise<void> {
    this.#ac.abort();

    // Nothing to do
  }

  public [Symbol.asyncIterator](): AsyncIterator<TValue> {
    this.#ac.signal.throwIfAborted();

    let values: NodeSelectedValue[] = [];
    let next: NodeFilterInputValue = undefined;

    return {
      next: async () => {
        await this.initialize();

        if (values.length === 0 && next !== null) {
          values = await this.#api.findMany({
            where: { AND: [this.filter?.inputValue, next] },
            orderBy: [this.ordering.inputValue],
            first: this.#chunkSize,
            selection: this.#internalSelection,
          });

          next =
            values.length === this.#chunkSize
              ? {
                  [this.#nextFilterInputType.name]:
                    values.at(-1)![this.ordering.leaf.name],
                }
              : null;
        }

        const value = this.#ac.signal.aborted ? undefined : values.shift();

        return value
          ? { done: false, value: this.selection.pickValue(value as any) }
          : { done: true, value: undefined };
      },
      return: async () => {
        await this.dispose();

        return { done: true, value: undefined };
      },
    };
  }

  public async size(): Promise<number> {
    return this.#api.count({ where: this.filter?.inputValue });
  }

  public async toArray(): Promise<TValue[]> {
    const values: TValue[] = [];

    for await (const value of this) {
      values.push(value);
    }

    return values;
  }

  public async forEach(
    task: ScrollSubscriptionStreamForEachTask<TValue, TRequestContext>,
    {
      progressBar: progressBarOptions,
      retry: retryOptions,
      buffer: bufferOptions,
      onError,
      ...queueOptions
    }: ScrollSubscriptionStreamForEachOptions = {},
  ): Promise<void> {
    this.#ac.signal.throwIfAborted();

    const tasks = new PQueue({
      ...queueOptions,
      concurrency: queueOptions.concurrency ?? 1,
      throwOnTimeout: queueOptions.throwOnTimeout ?? true,
    });

    const buffer = bufferOptions ?? tasks.concurrency;
    assert(
      typeof buffer === 'number' && buffer >= 0,
      `The buffer has to be greater than or equal to 0, got ${inspect(buffer)}`,
    );

    assert(
      onError == null || typeof onError === 'function',
      'The "onError" has to be a function',
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
        tasks.on(
          'error',
          onError
            ? (error) => {
                try {
                  onError(utils.castToError(error));
                } catch (error) {
                  reject(error);
                }
              }
            : reject,
        );

        try {
          for await (const value of this) {
            await tasks.onSizeLessThan(buffer + 1);

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
      await this.dispose();
      tasks.clear();
    }
  }

  public async byBatch(
    task: ScrollSubscriptionStreamByBatchTask<TValue, TRequestContext>,
    {
      batchSize,
      progressBar: progressBarOptions,
      retry: retryOptions,
      buffer: bufferOptions,
      onError,
      ...queueOptions
    }: ScrollSubscriptionStreamByBatchOptions = {},
  ): Promise<void> {
    this.#ac.signal.throwIfAborted();

    const tasks = new PQueue({
      ...queueOptions,
      concurrency: queueOptions.concurrency ?? 1,
      throwOnTimeout: queueOptions.throwOnTimeout ?? true,
    });

    const buffer = bufferOptions ?? tasks.concurrency;
    assert(
      typeof buffer === 'number' && buffer >= 0,
      `The buffer has to be greater than or equal to 0, got ${inspect(buffer)}`,
    );

    assert(
      onError == null || typeof onError === 'function',
      'The "onError" has to be a function',
    );

    const normalizedBatchSize = Math.max(1, batchSize || this.#chunkSize);

    const normalizedRetryOptions: PRetryOptions | false = retryOptions
      ? retryOptions === true
        ? {}
        : typeof retryOptions === 'number'
        ? { retries: retryOptions }
        : retryOptions
      : false;

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
          0,
          { name: progressBarOptions.name },
        );
      } else {
        progressBar =
          progressBarOptions instanceof ProgressBar
            ? progressBarOptions
            : new ProgressBar({ format: defaultProgressBarFormat });

        progressBar.start(await this.size(), 0);
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
        tasks.on(
          'error',
          onError
            ? (error) => {
                try {
                  onError(utils.castToError(error));
                } catch (error) {
                  reject(error);
                }
              }
            : reject,
        );

        try {
          for await (const value of this) {
            await tasks.onSizeLessThan(buffer + 1);

            if (batch.push(value) === normalizedBatchSize) {
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
      await this.dispose();
      tasks.clear();
    }
  }
}
