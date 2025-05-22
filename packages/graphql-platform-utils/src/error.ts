import { MGetter, MMethod } from '@prismamedia/memoize';
import { GraphQLError, type GraphQLErrorExtensions } from 'graphql';
import { EOL } from 'node:os';
import { inspect } from 'node:util';
import * as R from 'remeda';
import type { Merge } from 'type-fest';
import type { Nillable } from './nil.js';
import {
  isPathEqualOrDescendantOf,
  pathToArray,
  printPath,
  type Path,
} from './path.js';
import { isPlainObject } from './plain-object.js';
import type { Stringifiable } from './stringifiable.js';

export const castToError = (error: unknown): Error =>
  error instanceof Error
    ? error
    : isPlainObject(error)
      ? Object.assign(new Error(error['message']), error)
      : new Error(error as any);

export function setGraphErrorAncestor<TError = unknown>(
  error: TError,
  ancestor?: Path,
): TError {
  if (isGraphError(error) && ancestor) {
    error.setAncestor(ancestor);
  }

  return error;
}

export interface GraphErrorExtensions extends GraphQLErrorExtensions {
  readonly code?: string;
}

export interface GraphErrorOptions extends ErrorOptions {
  readonly path?: Path;
  readonly code?: string;
}

export class GraphError extends Error {
  public readonly path?: Path;
  public readonly code?: string;
  readonly #message: string;
  #ancestor?: Path;

  public constructor(
    message: string,
    { path, code, ...options }: GraphErrorOptions = {},
  ) {
    super(undefined, {
      ...options,
      ...(options?.cause
        ? { cause: setGraphErrorAncestor(options.cause, path) }
        : undefined),
    });

    this.name = new.target.name;
    path && (this.path = path);
    code && (this.code = code);

    // Prevent these properties from being enumerable
    Object.defineProperties(
      this,
      R.fromKeys(['path', 'code'], R.constant({ enumerable: false })),
    );

    this.#message = message;
  }

  public setAncestor(ancestor: Path): void {
    if (this.path && isPathEqualOrDescendantOf(this.path, ancestor)) {
      this.#ancestor = ancestor;
    }
  }

  public override get message(): string {
    return [
      this.path && this.path !== this.#ancestor
        ? printPath(this.path, this.#ancestor)
        : undefined,
      this.#message,
    ]
      .filter(Boolean)
      .join(' - ');
  }

  /**
   * @see https://www.graphql-js.org/docs/graphql-errors/#customizing-errors-with-extensions
   */
  @MGetter
  public get extensions(): GraphErrorExtensions | undefined {
    return this.code ? { code: this.code } : undefined;
  }

  @MMethod()
  public toGraphQLError(): Merge<GraphQLError, { originalError: GraphError }> {
    const extensions = this.extensions;

    return new GraphQLError(this.#message, {
      originalError: this,
      ...(this.path && { path: pathToArray(this.path) }),
      ...(extensions && Object.values(extensions).length && { extensions }),
    }) as any;
  }
}

export class UnexpectedValueError extends GraphError {
  public constructor(
    expectation: string,
    unexpectedValue: any,
    options?: GraphErrorOptions,
  ) {
    super(`Expects ${expectation}, got: ${inspect(unexpectedValue)}`, options);
  }
}

export class UnexpectedUndefinedError extends UnexpectedValueError {
  public constructor(subject: Stringifiable, options?: GraphErrorOptions) {
    super(`a non-undefined "${String(subject)}"`, undefined, options);
  }
}

export class UnexpectedNullError extends UnexpectedValueError {
  public constructor(subject: Stringifiable, options?: GraphErrorOptions) {
    super(`a non-null "${String(subject)}"`, null, options);
  }
}

export class UnreachableValueError extends UnexpectedValueError {
  public constructor(unreachableValue: never, options?: GraphErrorOptions) {
    super(`not to be reached`, unreachableValue, options);
  }
}

export interface AggregateGraphErrorOptions {
  readonly path?: Path;
  readonly message?: Nillable<string>;
}

export class AggregateGraphError extends AggregateError {
  public readonly path?: Path;
  readonly #message: string;
  #ancestor?: Path;

  public constructor(
    errors: Iterable<any>,
    { path, message }: AggregateGraphErrorOptions = {},
  ) {
    super(
      path
        ? Array.from(errors, (error) => setGraphErrorAncestor(error, path))
        : errors,
    );

    this.name = new.target.name;
    this.path = path ?? undefined;

    // Prevent this property from being enumerable
    Object.defineProperty(this, 'path', { enumerable: false });

    this.#message = [message, `${this.errors.length} errors:`]
      .filter(Boolean)
      .join(' - ');
  }

  public setAncestor(ancestor: Path): void {
    if (this.path && isPathEqualOrDescendantOf(this.path, ancestor)) {
      this.#ancestor = ancestor;
    }
  }

  public override get message(): string {
    return [
      // First line
      [
        this.path && this.path !== this.#ancestor
          ? printPath(this.path, this.#ancestor)
          : undefined,
        this.#message,
      ]
        .filter(Boolean)
        .join(' - '),
      // Indented errors' message
      ...this.errors.flatMap((error) =>
        error instanceof Error && error.message
          ? error.message
              .split(EOL)
              .map((line, index) => (index === 0 ? `└ ${line}` : `  ${line}`))
          : [],
      ),
    ].join(EOL);
  }

  /**
   * @see https://www.graphql-js.org/docs/graphql-errors/#customizing-errors-with-extensions
   */
  @MGetter
  public get extensions(): GraphQLErrorExtensions | undefined {
    return undefined;
  }

  @MMethod()
  public toGraphQLError(): GraphQLError {
    const extensions = this.extensions;

    return new GraphQLError(this.#message, {
      originalError: this,
      ...(this.path && { path: pathToArray(this.path) }),
      ...(extensions && Object.values(extensions).length && { extensions }),
    });
  }
}

export const aggregateGraphError = <TInput, TOuput>(
  inputs: Iterable<TInput>,
  reducer: (
    previousValue: TOuput,
    currentValue: TInput,
    currentIndex: number,
    array: TInput[],
  ) => TOuput,
  initialValue: TOuput,
  options?: AggregateGraphErrorOptions,
): TOuput => {
  const errors: any[] = [];

  const output = Array.from(inputs).reduce(
    (previousValue, currentValue, currentIndex, array) => {
      try {
        return reducer(previousValue, currentValue, currentIndex, array);
      } catch (error) {
        errors.push(error);

        return previousValue;
      }
    },
    initialValue,
  );

  if (errors.length) {
    throw errors.length > 1
      ? new AggregateGraphError(errors, options)
      : errors[0];
  }

  return output;
};

export const isGraphError = (
  error: unknown,
): error is GraphError | AggregateGraphError =>
  error instanceof GraphError || error instanceof AggregateGraphError;

export const isGraphErrorWithPathEqualOrDescendantOf = (
  error: unknown,
  maybeAncestor: Path,
) =>
  isGraphError(error) &&
  error.path &&
  isPathEqualOrDescendantOf(error.path, maybeAncestor);
