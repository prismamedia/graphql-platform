import * as utils from '@prismamedia/graphql-platform-utils';
import {
  MultiBar as MultiProgressBar,
  SingleBar as ProgressBar,
  type Options as ProgressBarOptions,
} from 'cli-progress';
import assert from 'node:assert';
import type { Abortable } from 'node:events';
import { inspect } from 'node:util';
import PQueue, { type Options as PQueueOptions } from 'p-queue';
import PRetry, { type Options as PRetryOptions } from 'p-retry';
import * as R from 'remeda';
import type { Except, Promisable } from 'type-fest';
import type { Node } from '../../../../node.js';
import type {
  ContextBoundNodeAPI,
  OperationContext,
} from '../../../operation.js';
import {
  NodeFilter,
  NodeSelection,
  type NodeSelectedValue,
} from '../../../statement.js';
import type { NodeFilterInputValue } from '../../../type/input/filter.js';
import type { ScrollSubscriptionArgs } from '../scroll.js';
import { ScrollCursor } from './cursor.js';

const averageFormattedKey = 'average_formatted';

export const defaultNamedProgressBarFormat =
  `[{bar}] {name} | {value}/{total} ({${averageFormattedKey}}) | {percentage}% | ETA: {eta_formatted} | Elapsed: {duration_formatted}` satisfies ProgressBarOptions['format'];

export const defaultProgressBarFormat =
  `[{bar}] {value}/{total} ({${averageFormattedKey}}) | {percentage}% | ETA: {eta_formatted} | Elapsed: {duration_formatted}` satisfies ProgressBarOptions['format'];

function incrementProgressBar(progress: ProgressBar, increment: number): void {
  const elapsedTimeInMs = progress.startTime
    ? Date.now() - progress.startTime
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
  this: ScrollSubscriptionStream<TValue, TRequestContext>,
  value: TValue,
  index: number,
  signal: AbortSignal,
) => Promisable<any>;

export type ScrollSubscriptionStreamForEachOptions = Except<
  PQueueOptions<any, any>,
  'autoStart' | 'queueClass'
> &
  Abortable & {
    /**
     * Optional, the maximum number of tasks waiting to be processed, to avoid too much back-pressure
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
    retry?: Except<PRetryOptions, 'signal'> | number | boolean;

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
  this: ScrollSubscriptionStream<TValue, TRequestContext>,
  values: ReadonlyArray<TValue>,
  signal: AbortSignal,
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
  cursor: ScrollCursor;
  selection: NodeSelection<TValue>;
  forSubscription?: ScrollSubscriptionArgs['forSubscription'];
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
  public readonly cursor: ScrollCursor;
  public readonly selection: NodeSelection<TValue>;
  readonly #forSubscription?: ScrollSubscriptionArgs['forSubscription'];

  readonly #internalSelection: NodeSelection;
  readonly #api: ContextBoundNodeAPI;

  public constructor(
    public readonly node: Node<TRequestContext>,
    context: OperationContext<TRequestContext>,
    config: Readonly<ScrollSubscriptionStreamConfig<TValue>>,
  ) {
    assert(config.filter === undefined || config.filter instanceof NodeFilter);
    this.filter = config.filter?.normalized;

    assert(config.cursor instanceof ScrollCursor);
    this.cursor = config.cursor;

    assert(config.selection instanceof NodeSelection);
    this.selection = config.selection;

    this.#forSubscription = config.forSubscription;

    this.#internalSelection = this.selection.mergeWith(
      node.outputType.selectComponents([this.cursor.ordering.leaf]),
    );

    this.#api = node.createContextBoundAPI(context);
  }

  public async *[Symbol.asyncIterator](): AsyncIterator<TValue> {
    let next: NodeFilterInputValue;
    while (next !== null) {
      const values = await this.#api.findMany({
        where: { AND: [this.filter?.inputValue, next] },
        orderBy: [this.cursor.ordering.inputValue],
        first: this.cursor.size,
        selection: this.#internalSelection,
        forSubscription: this.#forSubscription,
      });

      next =
        values.length === this.cursor.size
          ? {
              [this.cursor.nextFilterInput.name]:
                values.at(-1)![this.cursor.ordering.leaf.name],
            }
          : null;

      let value: NodeSelectedValue | undefined;
      while ((value = values.shift())) {
        yield this.selection.pickValue(value as any);
      }
    }
  }

  public async size(): Promise<number> {
    return this.#api.count({ where: this.filter?.inputValue });
  }

  public async forEach(
    task: ScrollSubscriptionStreamForEachTask<TValue, TRequestContext>,
    {
      continueOnError,
      progressBar: progressBarOptions,
      retry: retryOptions,
      buffer: bufferOptions,
      signal: externalSignal,
      ...queueOptions
    }: ScrollSubscriptionStreamForEachOptions = {},
  ): Promise<void> {
    assert(
      continueOnError == null ||
        ['boolean', 'number'].includes(typeof continueOnError),
      'The "continueOnError" has to be a boolean or a positive integer',
    );

    using tasks = Object.assign(
      new PQueue({
        ...queueOptions,
        concurrency: queueOptions.concurrency ?? 1,
        throwOnTimeout: queueOptions.throwOnTimeout ?? true,
      }),
      { [Symbol.dispose]: () => tasks.clear() },
    );

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

    let currentIndex: number = -1;

    let progressBar: ProgressBar | undefined;
    if (progressBarOptions) {
      const total = await this.size();
      const etaBuffer: ProgressBarOptions['etaBuffer'] = R.clamp(
        Math.round(total / 100),
        { min: 10, max: 1000 },
      );

      if (
        typeof progressBarOptions === 'object' &&
        'container' in progressBarOptions &&
        'name' in progressBarOptions
      ) {
        assert(
          progressBarOptions.container instanceof MultiProgressBar,
          `The "container" has to be a multi-progress-bar instance`,
        );
        assert.strictEqual(
          typeof progressBarOptions.name,
          'string',
          `The "name" has to be a string`,
        );

        progressBar = progressBarOptions.container.create(total, 0, {
          name: progressBarOptions.name,
          etaBuffer,
          [averageFormattedKey]: '-/s',
        });
      } else {
        progressBar =
          progressBarOptions instanceof ProgressBar
            ? progressBarOptions
            : new ProgressBar({ etaBuffer, format: defaultProgressBarFormat });

        progressBar.start(total, 0, {
          [averageFormattedKey]: '-/s',
        });
      }
    }

    const errors: unknown[] = [];
    const maxErrorAllowedCount = continueOnError
      ? continueOnError === true
        ? Infinity
        : continueOnError
      : 0;

    const errorController = new AbortController();
    const errorSignal = errorController.signal;

    const combinedSignal = externalSignal
      ? AbortSignal.any([externalSignal, errorSignal])
      : errorSignal;

    await new Promise<void>(async (resolve, reject) => {
      combinedSignal.addEventListener(
        'abort',
        () => reject(combinedSignal.reason),
        { once: true },
      );

      try {
        for await (const value of this) {
          combinedSignal.throwIfAborted();

          const boundTask = task.bind(
            this,
            value,
            ++currentIndex,
            combinedSignal,
          );

          const retryWrapper = normalizedRetryOptions
            ? PRetry.bind(undefined, boundTask, {
                ...normalizedRetryOptions,
                signal: combinedSignal,
              })
            : boundTask;

          const continueOnErrorWrapper =
            maxErrorAllowedCount > 0
              ? () =>
                  utils.PromiseTry(retryWrapper).catch((error) => {
                    if (errors.push(error) > maxErrorAllowedCount) {
                      throw new AggregateError(errors);
                    }
                  })
              : retryWrapper;

          const progressBarWrapper = progressBar
            ? () =>
                utils
                  .PromiseTry(continueOnErrorWrapper)
                  .then(() => incrementProgressBar(progressBar, 1))
            : continueOnErrorWrapper;

          tasks.add(
            () =>
              combinedSignal.aborted ||
              utils
                .PromiseTry(progressBarWrapper)
                .catch((error) => errorController.abort(error)),
          );

          await tasks.onSizeLessThan(buffer);
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
      batchSize = this.cursor.size,
      buffer: bufferOptions,
      continueOnError,
      progressBar: progressBarOptions,
      retry: retryOptions,
      signal: externalSignal,
      ...queueOptions
    }: ScrollSubscriptionStreamByBatchOptions = {},
  ): Promise<void> {
    assert(
      continueOnError == null ||
        ['boolean', 'number'].includes(typeof continueOnError),
      'The "continueOnError" has to be a boolean or a positive integer',
    );

    assert(
      typeof batchSize === 'number' && batchSize >= 1,
      `The batch-size has to be greater than or equal to 1, got ${inspect(batchSize)}`,
    );

    using tasks = Object.assign(
      new PQueue({
        ...queueOptions,
        concurrency: queueOptions.concurrency ?? 1,
        throwOnTimeout: queueOptions.throwOnTimeout ?? true,
      }),
      { [Symbol.dispose]: () => tasks.clear() },
    );

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
        assert.strictEqual(
          typeof progressBarOptions.name,
          'string',
          `The "name" has to be a string`,
        );

        progressBar = progressBarOptions.container.create(
          await this.size(),
          0,
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

        progressBar.start(await this.size(), 0, {
          [averageFormattedKey]: '-/s',
        });
      }
    }

    const errors: unknown[] = [];
    const maxErrorAllowedCount = continueOnError
      ? continueOnError === true
        ? Infinity
        : continueOnError
      : 0;

    const errorController = new AbortController();
    const errorSignal = errorController.signal;

    const combinedSignal = externalSignal
      ? AbortSignal.any([externalSignal, errorSignal])
      : errorSignal;

    let batch: TValue[] = [];

    const enqueueBatch = () => {
      const values = batch;
      batch = [];

      const boundTask = task.bind(this, values, combinedSignal);

      const retryWrapper = normalizedRetryOptions
        ? PRetry.bind(undefined, boundTask, {
            ...normalizedRetryOptions,
            signal: combinedSignal,
          })
        : boundTask;

      const continueOnErrorWrapper =
        maxErrorAllowedCount > 0
          ? () =>
              utils.PromiseTry(retryWrapper).catch((error) => {
                if (errors.push(error) > maxErrorAllowedCount) {
                  throw new AggregateError(errors);
                }
              })
          : retryWrapper;

      const progressBarWrapper = progressBar
        ? () =>
            utils
              .PromiseTry(continueOnErrorWrapper)
              .then(() => incrementProgressBar(progressBar, values.length))
        : continueOnErrorWrapper;

      return tasks.add(
        () =>
          combinedSignal.aborted ||
          utils
            .PromiseTry(progressBarWrapper)
            .catch((error) => errorController.abort(error)),
      );
    };

    await new Promise<void>(async (resolve, reject) => {
      combinedSignal.addEventListener(
        'abort',
        () => reject(combinedSignal.reason),
        { once: true },
      );

      try {
        for await (const value of this) {
          combinedSignal.throwIfAborted();

          if (batch.push(value) >= batchSize) {
            enqueueBatch();
            await tasks.onSizeLessThan(buffer);
          }
        }

        if (batch.length) {
          enqueueBatch();
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
}
