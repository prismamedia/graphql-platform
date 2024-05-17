import * as utils from '@prismamedia/graphql-platform-utils';
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

const averageFormattedKey = 'average_formatted';

export const defaultNamedProgressBarFormat =
  `[{bar}] {name} | {value}/{total} ({${averageFormattedKey}}) | {percentage}% | ETA: {eta_formatted} | Elapsed: {duration_formatted}` satisfies ProgressBarOptions['format'];

export const defaultProgressBarFormat =
  `[{bar}] {value}/{total} ({${averageFormattedKey}}) | {percentage}% | ETA: {eta_formatted} | Elapsed: {duration_formatted}` satisfies ProgressBarOptions['format'];

function incrementProgressBar(progress: ProgressBar, increment: number): void {
  const elapsedTimeInMs = progress.startTime
    ? new Date().getTime() - progress.startTime
    : 0;

  progress.increment(increment, {
    ...(elapsedTimeInMs > 0 && {
      [averageFormattedKey]: `${(
        (progress.value + increment) /
        (elapsedTimeInMs / 1000)
      ).toLocaleString('en-US', {
        maximumSignificantDigits: 3,
        useGrouping: false,
      })}/s`,
    }),
  });
}

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
) => Promisable<any>;

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
   * Optional, let the cursor continue on error, if a number is provided it defines the maximum number of errors allowed before an AggregateError is thrown
   *
   * @default false
   */
  continueOnError?: boolean | number;

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
) => Promisable<any>;

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
  }

  public [Symbol.asyncIterator](): AsyncIterator<TValue> {
    let values: NodeSelectedValue[] = [];
    let next: NodeFilterInputValue = undefined;

    return {
      next: async () => {
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

        const value = values.shift();

        return value
          ? { done: false, value: this.selection.pickValue(value as any) }
          : { done: true, value: undefined };
      },
      return: async () => {
        values = [];

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
      continueOnError,
      progressBar: progressBarOptions,
      retry: retryOptions,
      buffer: bufferOptions,
      ...queueOptions
    }: ScrollSubscriptionStreamForEachOptions = {},
  ): Promise<void> {
    using tasks = Object.assign(
      new PQueue({
        ...queueOptions,
        concurrency: queueOptions.concurrency ?? 1,
        throwOnTimeout: queueOptions.throwOnTimeout ?? true,
      }),
      { [Symbol.dispose]: () => tasks.clear() },
    );

    assert(
      continueOnError == null ||
        ['boolean', 'number'].includes(typeof continueOnError),
      'The "continueOnError" has to be a boolean or a positive integer',
    );

    const buffer = bufferOptions ?? tasks.concurrency;
    assert(
      typeof buffer === 'number' && buffer >= 0,
      `The buffer has to be greater than or equal to 0, got ${inspect(buffer)}`,
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
          {
            name: progressBarOptions.name,
            [averageFormattedKey]: '-/s',
          },
        );
      } else {
        progressBar =
          progressBarOptions instanceof ProgressBar
            ? progressBarOptions
            : new ProgressBar({ format: defaultProgressBarFormat });

        progressBar.start(await this.size(), currentIndex, {
          [averageFormattedKey]: '-/s',
        });
      }
    }

    const errors: unknown[] = [];
    const maxErrorCount = continueOnError
      ? continueOnError === true
        ? Infinity
        : continueOnError
      : 0;

    await new Promise<void>(async (resolve, reject) => {
      tasks.on('error', reject);

      try {
        for await (const value of this) {
          await tasks.onSizeLessThan(buffer + 1);

          const boundTask = task.bind(undefined, value, ++currentIndex, this);

          const retryTaskWrapper = normalizedRetryOptions
            ? () => PRetry(boundTask, normalizedRetryOptions)
            : boundTask;

          const continueOnErrorTaskWrapper =
            maxErrorCount > 0
              ? async () => {
                  try {
                    await retryTaskWrapper();
                  } catch (error) {
                    if (errors.push(error) >= maxErrorCount) {
                      throw errors.length > 1
                        ? new AggregateError(errors)
                        : errors[0];
                    }
                  }
                }
              : retryTaskWrapper;

          const progressBarTaskWrapper = progressBar
            ? async () => {
                await continueOnErrorTaskWrapper();

                incrementProgressBar(progressBar, 1);
              }
            : continueOnErrorTaskWrapper;

          tasks.add(progressBarTaskWrapper);
        }

        await tasks.onIdle();

        progressBar?.stop();

        resolve();
      } catch (error) {
        reject(error);
      }
    });

    if (errors.length) {
      throw errors.length > 1 ? new AggregateError(errors) : errors[0];
    }
  }

  public async byBatch(
    task: ScrollSubscriptionStreamByBatchTask<TValue, TRequestContext>,
    {
      batchSize,
      continueOnError,
      progressBar: progressBarOptions,
      retry: retryOptions,
      buffer: bufferOptions,
      ...queueOptions
    }: ScrollSubscriptionStreamByBatchOptions = {},
  ): Promise<void> {
    using tasks = Object.assign(
      new PQueue({
        ...queueOptions,
        concurrency: queueOptions.concurrency ?? 1,
        throwOnTimeout: queueOptions.throwOnTimeout ?? true,
      }),
      { [Symbol.dispose]: () => tasks.clear() },
    );

    assert(
      continueOnError == null ||
        ['boolean', 'number'].includes(typeof continueOnError),
      'The "continueOnError" has to be a boolean or a positive integer',
    );

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

    const errors: unknown[] = [];
    const maxErrorCount = continueOnError
      ? continueOnError === true
        ? Infinity
        : continueOnError
      : 0;

    let batch: TValue[] = [];

    const processBatch = () => {
      if (batch.length) {
        const values = Object.freeze(batch);
        batch = [];

        const boundTask = task.bind(undefined, values, this);

        const retryTaskWrapper = normalizedRetryOptions
          ? () => PRetry(boundTask, normalizedRetryOptions)
          : boundTask;

        const continueOnErrorTaskWrapper =
          maxErrorCount > 0
            ? async () => {
                try {
                  await retryTaskWrapper();
                } catch (error) {
                  if (errors.push(error) >= maxErrorCount) {
                    throw errors.length > 1
                      ? new AggregateError(errors)
                      : errors[0];
                  }
                }
              }
            : retryTaskWrapper;

        const progressBarTaskWrapper = progressBar
          ? async () => {
              await continueOnErrorTaskWrapper();

              incrementProgressBar(progressBar, values.length);
            }
          : continueOnErrorTaskWrapper;

        tasks.add(progressBarTaskWrapper);
      }
    };

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

    if (errors.length) {
      throw errors.length > 1 ? new AggregateError(errors) : errors[0];
    }
  }
}
