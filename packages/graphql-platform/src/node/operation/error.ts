import * as utils from '@prismamedia/graphql-platform-utils';
import { inspect } from 'node:util';
import type { Promisable } from 'type-fest';
import type { Node } from '../../node.js';
import type { NodeUniqueFilterInputValue } from '../type/input/unique-filter.js';

export class InvalidRequestContextError extends utils.NestableError {
  public constructor(options?: utils.NestableErrorOptions) {
    super(`Invalid request`, options);
  }
}

export class UnauthorizedError extends utils.NestableError {
  public constructor(
    node: Node,
    mutationType: utils.MutationType | undefined,
    options?: utils.NestableErrorOptions,
  ) {
    super(
      `Unauthorized access to "${node}"${
        mutationType ? `'s ${mutationType}` : ''
      }`,
      options,
    );
  }
}

export class NotFoundError extends utils.NestableError {
  public constructor(
    node: Node,
    where: utils.NonNillable<NodeUniqueFilterInputValue>,
    options?: utils.NestableErrorOptions,
  ) {
    super(
      `No "${node}" has been found given the following filter: ${inspect(
        where,
      )}`,
      options,
    );
  }
}

export enum LifecycleHookKind {
  PRE_CREATE,
  POST_CREATE,
  PRE_UPDATE,
  POST_UPDATE,
  PRE_DELETE,
  POST_DELETE,
}

export class LifecycleHookError extends utils.NestableError {
  public constructor(
    node: Node,
    kind: LifecycleHookKind,
    options?: utils.NestableErrorOptions,
  ) {
    super(
      `${node}'s "${LifecycleHookKind[kind]}" lifecycle hook error:`,
      options,
    );
  }
}

export async function catchLifecycleHookError<T>(
  call: () => Promisable<T>,
  node: Node,
  kind: LifecycleHookKind,
  path: utils.Path,
): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw new LifecycleHookError(node, kind, {
      path,
      cause: utils.castToError(error),
    });
  }
}

export class ConnectorError extends utils.NestableError {
  public constructor(options?: utils.NestableErrorOptions) {
    super('Connector error', options);
  }
}

export async function catchConnectorError<T>(
  call: () => Promise<T>,
  path: utils.Path,
): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw new ConnectorError({ path, cause: utils.castToError(error) });
  }
}

export class InternalError extends utils.NestableError {
  public constructor(options?: utils.NestableErrorOptions) {
    super('Internal error', options);
  }
}
