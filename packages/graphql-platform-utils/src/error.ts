import { GraphQLError } from 'graphql';
import { EOL } from 'node:os';
import { inspect } from 'node:util';
import * as R from 'remeda';
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
  ancestor: Path,
): TError {
  if (isGraphError(error)) {
    error.setAncestor(ancestor);
  }

  return error;
}

export interface GraphErrorOptions extends ErrorOptions {
  readonly path?: Path;
  readonly code?: string;

  /**
   * Either the cause's message is printed or not in the generated GraphQLError
   *
   * Default: false
   */
  readonly causeIsPrivate?: boolean;
}

export class GraphError extends Error {
  public readonly path?: Path;
  public readonly code?: string;
  readonly #message: string;
  readonly #causeIsPrivate: boolean;
  #ancestor?: Path;

  public constructor(
    message: string,
    { path, code, causeIsPrivate, ...options }: GraphErrorOptions = {},
  ) {
    super(undefined, {
      ...options,
      ...(options?.cause
        ? {
            cause: path
              ? setGraphErrorAncestor(options.cause, path)
              : options.cause,
          }
        : undefined),
    });

    this.name = new.target.name;

    Object.defineProperty(this, 'path', {
      value: path || undefined,
      enumerable: false,
    });

    Object.defineProperty(this, 'code', {
      value: code || undefined,
      enumerable: false,
    });

    this.#message = message;
    this.#causeIsPrivate = causeIsPrivate === true;
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

  public toGraphQLError(): GraphQLError {
    return new GraphQLError(
      `${this.#message}${
        this.cause instanceof Error && !this.#causeIsPrivate
          ? ` - ${this.cause.message}`
          : ``
      }`,
      {
        ...(this.cause instanceof Error && { originalError: this.cause }),
        ...(this.path && { path: pathToArray(this.path) }),
        ...(this.code && { extensions: { code: this.code } }),
      },
    );
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
  readonly #message?: string;
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

    Object.defineProperty(this, 'path', {
      value: path || undefined,
      enumerable: false,
    });

    this.#message = message || undefined;
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
        `${this.errors.length} errors:`,
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

  const deduplicatedErrors = R.uniqueBy(errors, (error) =>
    error instanceof Error ? error.message : String(error),
  );

  if (deduplicatedErrors.length > 1) {
    throw new AggregateGraphError(deduplicatedErrors, options);
  } else if (deduplicatedErrors.length) {
    throw deduplicatedErrors[0];
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
