import { EOL } from 'node:os';
import { inspect } from 'node:util';
import { Nillable } from './nil.js';
import { isPath, printPath, type Path } from './path.js';
import { isPlainObject } from './plain-object.js';

export const castToError = (error: unknown): Error =>
  error instanceof Error
    ? error
    : isPlainObject(error)
    ? Object.assign(new Error(error.message), error)
    : new Error(error as any);

export interface NestableErrorOptions {
  cause?: unknown;
  path?: Path;
}

export class NestableError extends Error {
  public readonly cause?: Error;
  public readonly path?: Path;
  readonly #message?: string;

  public constructor(
    message: Nillable<string>,
    { cause, path, ...options }: NestableErrorOptions = {},
  ) {
    super(undefined);

    this.cause = cause ? castToError(cause) : undefined;
    Object.defineProperty(this, 'cause', { enumerable: false });

    this.path = isPath(path) ? path : undefined;
    Object.defineProperty(this, 'path', { enumerable: false });

    this.#message = message || undefined;

    Object.defineProperty(this, 'name', {
      value: new.target.name,
      configurable: false,
      enumerable: false,
    });

    Object.setPrototypeOf(this, new.target.prototype);
  }

  public getContextualizedMessage(ancestor?: Path): string {
    const lines: string[] = [
      // Head
      [
        this.path
          ? this.path !== ancestor
            ? `"${printPath(this.path, ancestor)}"`
            : undefined
          : undefined,
        this.#message,
      ]
        .filter(Boolean)
        .join(' - '),
    ];

    if (this.cause) {
      lines.push(
        ...(this.cause instanceof NestableError
          ? this.cause.getContextualizedMessage(this.path)
          : this.cause instanceof Error
          ? this.cause.message
          : String(this.cause)
        )
          .split(EOL)
          .map((line, index) => `${index === 0 ? '└ Cause:' : ' '} ${line}`),
      );
    }

    return lines.filter(Boolean).join(EOL);
  }

  public get message(): string {
    return this.getContextualizedMessage();
  }
}

export class UnexpectedValueError extends NestableError {
  public constructor(
    expectation: string,
    value: unknown,
    options?: NestableErrorOptions,
  ) {
    super(`Expects ${expectation}, got: ${inspect(value)}`, options);
  }
}

export class UnreachableValueError extends UnexpectedValueError {
  public constructor(value: never, options?: NestableErrorOptions) {
    super(`not to be reached`, value, options);
  }
}

export interface NestableAggregateErrorOptions extends NestableErrorOptions {
  message?: Nillable<string>;
}

export class NestableAggregateError extends AggregateError {
  public readonly cause?: Error;
  public readonly path?: Path;
  readonly #message?: string;

  public constructor(
    errors: Iterable<unknown>,
    { cause, path, message, ...options }: NestableAggregateErrorOptions = {},
  ) {
    super(
      Array.from(errors, (error) => castToError(error)),
      undefined,
    );

    this.cause = cause ? castToError(cause) : undefined;
    Object.defineProperty(this, 'cause', { enumerable: false });

    this.path = path != null && isPath(path) ? path : undefined;
    Object.defineProperty(this, 'path', { enumerable: false });

    this.#message = message || undefined;

    Object.defineProperty(this, 'name', {
      value: new.target.name,
      configurable: false,
      enumerable: false,
    });

    Object.setPrototypeOf(this, new.target.prototype);
  }

  public getContextualizedMessage(ancestor?: Path): string {
    const lines: string[] = [
      // Head
      `${[
        this.path
          ? this.path !== ancestor
            ? `"${printPath(this.path, ancestor)}"`
            : undefined
          : undefined,
        `${this.errors.length} errors`,
        this.#message,
      ]
        .filter(Boolean)
        .join(' - ')}:`,

      // Errors
      ...this.errors.flatMap<string>((error: Error) =>
        (isNestableError(error)
          ? error.getContextualizedMessage(this.path)
          : error.message
        )
          .split(EOL)
          .map((line, index) => `${index === 0 ? '└' : ' '} ${line}`),
      ),
    ];

    if (this.cause) {
      lines.push(
        ...(this.cause instanceof Error
          ? this.cause.message
          : String(this.cause)
        )
          .split(EOL)
          .map((line, index) => `${index === 0 ? '└ Cause:' : ' '} ${line}`),
      );
    }

    return lines.filter(Boolean).join(EOL);
  }

  public get message(): string {
    return this.getContextualizedMessage();
  }
}

export const isNestableError = (
  maybeNestableError: unknown,
): maybeNestableError is NestableError | NestableAggregateError =>
  maybeNestableError instanceof NestableError ||
  maybeNestableError instanceof NestableAggregateError;

export function aggregateError<TInputElement, TOutput>(
  inputs: Iterable<TInputElement>,
  reducer: (
    previousValue: TOutput,
    currentInput: TInputElement,
    currentIndex: number,
    inputs: TInputElement[],
  ) => TOutput,
  initialValue: TOutput,
  options?: NestableAggregateErrorOptions,
): TOutput {
  const errors: Error[] = [];

  const output = Array.from(inputs).reduce(
    (previousValue, currentInput, currentIndex, inputs) => {
      try {
        return reducer(previousValue, currentInput, currentIndex, inputs);
      } catch (error) {
        errors.push(castToError(error));

        return previousValue;
      }
    },
    initialValue,
  );

  if (errors.length > 0) {
    throw errors.length === 1
      ? errors[0]
      : new NestableAggregateError(errors, options);
  }

  return output;
}

export interface ConfigErrorOptions extends NestableErrorOptions {
  path: Path;
}

export class ConfigError extends NestableError {
  public override readonly path: Path;

  public constructor(
    message: Nillable<string>,
    { path, ...options }: ConfigErrorOptions,
  ) {
    super(message, options);

    this.path = path;
  }
}

export class UnexpectedConfigError extends ConfigError {
  public constructor(
    expectation: string,
    value: unknown,
    options: ConfigErrorOptions,
  ) {
    super(`Expects ${expectation}, got: ${inspect(value)}`, options);
  }
}

export class UnreachableConfigError extends UnexpectedConfigError {
  public constructor(value: never, options: ConfigErrorOptions) {
    super(`not to be reached`, value, options);
  }
}

export interface AggregateConfigErrorOptions extends ConfigErrorOptions {
  message?: Nillable<string>;
}

export class AggregateConfigError extends NestableAggregateError {
  public override readonly path: Path;

  public constructor(
    public override readonly errors: Array<AggregateConfigError | ConfigError>,
    { path, ...options }: AggregateConfigErrorOptions,
  ) {
    super(errors, options);

    this.path = path;
  }
}

export const isConfigError = (
  maybeConfigError: unknown,
): maybeConfigError is ConfigError | AggregateConfigError =>
  maybeConfigError instanceof ConfigError ||
  maybeConfigError instanceof AggregateConfigError;

export function aggregateConfigError<TInputElement, TOutput>(
  inputs: Iterable<TInputElement>,
  reducer: (
    previousValue: TOutput,
    currentInput: TInputElement,
    currentIndex: number,
    inputs: TInputElement[],
  ) => TOutput,
  initialValue: TOutput,
  options: AggregateConfigErrorOptions,
): TOutput {
  const errors: Array<AggregateConfigError | ConfigError> = [];

  const output = Array.from(inputs).reduce(
    (previousValue, currentInput, currentIndex, inputs) => {
      try {
        return reducer(previousValue, currentInput, currentIndex, inputs);
      } catch (error) {
        if (isConfigError(error)) {
          if (
            !errors.some(
              (previousError) => String(previousError) == String(error),
            )
          ) {
            errors.push(error);
          }

          return previousValue;
        } else {
          throw error;
        }
      }
    },
    initialValue,
  );

  if (errors.length > 0) {
    throw errors.length === 1
      ? errors[0]
      : new AggregateConfigError(errors, options);
  }

  return output;
}
