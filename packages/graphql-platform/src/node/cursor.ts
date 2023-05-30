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

export const defaultNamedProgressBarFormat =
  `[{bar}] {name} | {value}/{total} | {percentage}% | ETA: {eta_formatted} | Elapsed: {duration_formatted}` satisfies ProgressBarOptions['format'];

export const defaultProgressBarFormat =
  `[{bar}] {value}/{total} | {percentage}% | ETA: {eta_formatted} | Elapsed: {duration_formatted}` satisfies ProgressBarOptions['format'];

export {
  ProgressBar,
  MultiProgressBar,
  type ProgressBarOptions,
  ProgressBarPresets,
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

export type NodeCursorForEachTask<
  TValue extends NodeSelectedValue = any,
  TRequestContext extends object = any,
> = (
  value: TValue,
  index: number,
  cursor: NodeCursor<TValue, TRequestContext>,
) => Promisable<void>;

export type NodeCursorForEachOptions =
  | Except<PQueueOptions<any, any>, 'autoStart' | 'queueClass'> & {
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
      retry?: PRetryOptions | PRetryOptions['retries'] | boolean;

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
  readonly #context: utils.Thunkable<TRequestContext>;

  protected readonly where: NodeFilterInputValue;
  protected readonly direction: OrderingDirection;
  protected readonly uniqueConstraint: UniqueConstraint;
  protected readonly selection: NodeSelection<TValue>;
  protected readonly internalSelection: NodeSelection;
  protected readonly orderByInputValue: OrderByInputValue;
  protected readonly chunkSize: number;

  public constructor(
    public readonly node: Node<TRequestContext>,
    context: utils.Thunkable<TRequestContext>,
    options?: NodeCursorOptions<TValue>,
  ) {
    assert(node.isScrollable(), `The "${node}" node is not scrollable`);

    assert(context, `Expects a valid context`);
    this.#context = context;

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

  protected get context(): TRequestContext {
    return utils.resolveThunkable(this.#context);
  }

  @Memoize((force: boolean = false) => force && doNotCache)
  public async size(force: boolean = false): Promise<number> {
    return this.node
      .getQueryByKey('count')
      .execute(this.context, { where: this.where });
  }

  public async *[Symbol.asyncIterator](): AsyncIterator<TValue> {
    let after: NodeFilterInputValue;
    let values: NodeSelectedValue[];

    do {
      values = await this.node
        .getQueryByKey('find-many')
        .execute(this.context, {
          where: { AND: [after, this.where] },
          orderBy: this.orderByInputValue,
          first: this.chunkSize,
          selection: this.internalSelection,
        });

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
    task: NodeCursorForEachTask<TValue, TRequestContext>,
    {
      progressBar: progressBarOptions,
      retry: retryOptions,
      buffer: bufferOptions,
      ...queueOptions
    }: NodeCursorForEachOptions = {},
  ): Promise<void> {
    const queue = new PQueue({
      ...queueOptions,
      concurrency: queueOptions?.concurrency ?? 1,
      throwOnTimeout: queueOptions?.throwOnTimeout ?? true,
    });

    const buffer = bufferOptions ?? queue.concurrency;
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

    await new Promise<void>(async (resolve, reject) => {
      queue.on('error', reject);

      try {
        for await (const value of this) {
          await queue.onSizeLessThan(buffer);

          const wrappedTask = async () => {
            await task(value, currentIndex++, this);

            progressBar?.increment();
          };

          queue.add(
            normalizedRetryOptions
              ? () => PRetry(wrappedTask, normalizedRetryOptions)
              : wrappedTask,
          );
        }

        await queue.onIdle();

        progressBar?.stop();

        resolve();
      } catch (error) {
        reject(error);
      }
    });
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
