import * as utils from '@prismamedia/graphql-platform-utils';
import { inspect } from 'node:util';
import type { Except, Promisable } from 'type-fest';
import type { Node } from '../../node.js';
import type { NodeUniqueFilterInputValue } from '../type/input/unique-filter.js';
import { AbstractOperationError } from './abstract-error.js';

export class InvalidRequestContextError extends AbstractOperationError {
  public readonly code = 'INVALID_REQUEST_CONTEXT';

  public constructor(options?: utils.GraphErrorOptions) {
    super(`Invalid request-context`, options);
  }
}

export class UnauthenticatedError extends AbstractOperationError {
  public readonly code = 'UNAUTHENTICATED';

  public constructor(options?: utils.GraphErrorOptions) {
    super(`Unauthenticated`, options);
  }
}

export class UnauthorizedError extends AbstractOperationError {
  public readonly code = 'UNAUTHORIZED';

  public constructor(
    node: Node,
    mutationType?: utils.MutationType,
    options?: utils.GraphErrorOptions,
  ) {
    super(
      `Unauthorized access to "${node}"${
        mutationType ? `'s ${mutationType}` : ''
      }`,
      options,
    );
  }
}

export class InvalidArgumentsError extends AbstractOperationError {
  public readonly code = 'INVALID_ARGUMENTS';

  public constructor(options?: utils.GraphErrorOptions) {
    super(`Invalid argument(s)`, options);
  }
}

export class InvalidSelectionError extends AbstractOperationError {
  public readonly code = 'INVALID_SELECTION';

  public constructor(options?: utils.GraphErrorOptions) {
    super(`Invalid selection`, options);
  }
}

export class NotFoundError extends AbstractOperationError {
  public readonly code = 'NOT_FOUND';

  public constructor(
    node: Node,
    where: NonNullable<NodeUniqueFilterInputValue>,
    options?: utils.GraphErrorOptions,
  ) {
    super(
      `No "${node}" has been found given the following filter: ${inspect(
        where,
      )}`,
      options,
    );
  }
}

export abstract class AbstractConnectorError extends AbstractOperationError {}

export enum ConnectorWorkflowKind {
  PRE_MUTATION,
  POST_SUCCESSFUL_MUTATION,
  POST_FAILED_MUTATION,
  POST_MUTATION,
}

export interface ConnectorWorkflowErrorOptions
  extends utils.GraphErrorOptions {}

export class ConnectorWorkflowError extends AbstractConnectorError {
  public readonly code = 'CONNECTOR_WORKFLOW_ERROR';

  public constructor(
    kind: ConnectorWorkflowKind,
    options?: ConnectorWorkflowErrorOptions,
  ) {
    super(`Failed at "${ConnectorWorkflowKind[kind]}"`, options);
  }
}

export async function catchConnectorWorkflowError(
  workflow: () => Promisable<void>,
  kind: ConnectorWorkflowKind,
  options?: Except<ConnectorWorkflowErrorOptions, 'cause'>,
): Promise<void> {
  try {
    await workflow();
  } catch (cause) {
    throw cause instanceof ConnectorWorkflowError
      ? cause
      : new ConnectorWorkflowError(kind, { ...options, cause });
  }
}

export enum ConnectorOperationKind {
  COUNT,
  FIND,
  CREATE,
  UPDATE,
  DELETE,
}

export interface ConnectorOperationErrorOptions
  extends utils.GraphErrorOptions {}

export class ConnectorOperationError extends AbstractConnectorError {
  public readonly code: 'CONNECTOR_OPERATION_ERROR' | 'DUPLICATE' =
    'CONNECTOR_OPERATION_ERROR';

  public constructor(
    node: Node,
    kind: ConnectorOperationKind,
    options?: ConnectorOperationErrorOptions,
  ) {
    super(`Failed at "${node}.${ConnectorOperationKind[kind]}"`, options);
  }
}

export async function catchConnectorOperationError<T>(
  operation: () => Promise<T>,
  node: Node,
  kind: ConnectorOperationKind,
  options?: Except<ConnectorOperationErrorOptions, 'cause'>,
): Promise<T> {
  try {
    return await operation();
  } catch (cause) {
    throw cause instanceof ConnectorOperationError
      ? cause
      : new ConnectorOperationError(node, kind, { ...options, cause });
  }
}
