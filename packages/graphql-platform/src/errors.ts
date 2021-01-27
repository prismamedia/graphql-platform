import { MaybePathAwareError, Path } from '@prismamedia/graphql-platform-utils';
import { Promisable } from 'type-fest';
import { Model } from './model';
import { Component } from './model/components';
import { AbstractComponent } from './model/components/abstract';
import { Referrer } from './model/referrer';
import { UniqueConstraint } from './model/unique-constraint';

export class DefinitionError extends Error {
  public constructor(
    messageOrCause: string | Error,
    cause: Error | undefined = messageOrCause instanceof Error
      ? messageOrCause
      : undefined,
    prefix: string = "An error has been found in the GraphQL Platform's definition - ",
  ) {
    super(
      `${prefix}${
        messageOrCause instanceof Error
          ? messageOrCause.message
          : messageOrCause
      }`,
    );

    Object.defineProperty(this, 'name', {
      value: new.target.name,
      enumerable: false,
      configurable: true,
    });

    Object.setPrototypeOf(this, new.target.prototype);

    if (cause) {
      this.stack = [
        this.stack!.split('\n')[0],
        ...cause.stack!.split('\n').slice(1),
      ].join('\n');
    }
  }
}

export class ModelDefinitionError extends DefinitionError {
  public constructor(
    modelOrName: Model | string,
    messageOrCause: string | Error,
    cause: Error | undefined = messageOrCause instanceof Error
      ? messageOrCause
      : undefined,
  ) {
    super(
      messageOrCause,
      cause,
      `An error has been found in the "${modelOrName}" model's definition - `,
    );
  }
}

export class ComponentDefinitionError extends DefinitionError {
  public constructor(
    componentOrId: AbstractComponent | Component | string,
    messageOrCause: string | Error,
    cause: Error | undefined = messageOrCause instanceof Error
      ? messageOrCause
      : undefined,
  ) {
    super(
      messageOrCause,
      cause,
      `An error has been found in the "${componentOrId}" component's definition - `,
    );
  }
}

export class UniqueConstraintDefinitionError extends DefinitionError {
  public constructor(
    uniqueConstraintOrId: UniqueConstraint | string,
    messageOrCause: string | Error,
    cause: Error | undefined = messageOrCause instanceof Error
      ? messageOrCause
      : undefined,
  ) {
    super(
      messageOrCause,
      cause,
      `An error has been found in the "${uniqueConstraintOrId}" unique constraint's definition - `,
    );
  }
}

export class ReferrerDefinitionError extends DefinitionError {
  public constructor(
    referrerOrId: Referrer | string,
    messageOrCause: string | Error,
    cause: Error | undefined = messageOrCause instanceof Error
      ? messageOrCause
      : undefined,
  ) {
    super(
      messageOrCause,
      cause,
      `An error has been found in the "${referrerOrId}" referrer's definition - `,
    );
  }
}

export function catchDefinitionError<T>(
  definition: () => T,
  onError: (error: Error) => DefinitionError = (error) =>
    new DefinitionError(error),
): T {
  try {
    return definition();
  } catch (error) {
    throw error instanceof DefinitionError ? error : onError(error);
  }
}

export class RuntimeError extends MaybePathAwareError {
  public constructor(
    path: Path,
    messageOrCause: string | Error,
    cause: Error | undefined = messageOrCause instanceof Error
      ? messageOrCause
      : undefined,
  ) {
    super(
      messageOrCause instanceof Error ? messageOrCause.message : messageOrCause,
      path,
    );

    if (cause) {
      this.stack = [
        this.stack!.split('\n')[0],
        ...cause.stack!.split('\n').slice(1),
      ].join('\n');
    }
  }
}

export async function catchRuntimeError<T>(
  task: () => Promisable<T>,
  path: Path,
  onError: (error: Error) => RuntimeError = (error) =>
    new RuntimeError(path, error),
): Promise<T> {
  try {
    return await task();
  } catch (error) {
    throw error instanceof MaybePathAwareError ? error : onError(error);
  }
}
