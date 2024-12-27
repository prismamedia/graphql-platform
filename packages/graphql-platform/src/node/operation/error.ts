import * as utils from '@prismamedia/graphql-platform-utils';
import { inspect } from 'node:util';
import type { Except, Promisable } from 'type-fest';
import type { Node, NodeFeature, UniqueConstraint } from '../../node.js';
import type { NodeUniqueFilterInputValue } from '../type/input/unique-filter.js';

export enum OperationErrorCode {
  INVALID_REQUEST_CONTEXT,
  UNAUTHENTICATED,
  UNAUTHORIZED,
  INVALID_ARGUMENTS,
  INVALID_SELECTION,
  NOT_FOUND,
  LIFECYCLE_HOOK_ERROR,
  CONNECTOR_WORKFLOW_ERROR,
  CONNECTOR_OPERATION_ERROR,
  DUPLICATE,
}

export type OperationErrorOptions = Except<utils.GraphErrorOptions, 'code'>;

abstract class AbstractOperationError extends utils.GraphError {
  public constructor(
    message: string,
    options?: OperationErrorOptions & {
      readonly code: OperationErrorCode;
    },
  ) {
    super(message, {
      ...options,
      code:
        options?.code != null ? OperationErrorCode[options.code] : undefined,
    });
  }
}

export class InvalidRequestContextError extends AbstractOperationError {
  public constructor(options?: OperationErrorOptions) {
    super(`Invalid request-context`, {
      ...options,
      code: OperationErrorCode.INVALID_REQUEST_CONTEXT,
    });
  }
}

export class UnauthenticatedError extends AbstractOperationError {
  public constructor(options?: OperationErrorOptions) {
    super(`Unauthenticated`, {
      ...options,
      code: OperationErrorCode.UNAUTHENTICATED,
    });
  }
}

export class UnauthorizedError extends AbstractOperationError {
  public constructor(
    node: Node,
    mutationType?: utils.MutationType,
    options?: OperationErrorOptions,
  ) {
    super(
      `Unauthorized access to "${node}"${
        mutationType ? `'s ${mutationType}` : ''
      }`,
      { ...options, code: OperationErrorCode.UNAUTHORIZED },
    );
  }
}

export class InvalidArgumentsError extends AbstractOperationError {
  public constructor(options?: OperationErrorOptions) {
    super(`Invalid argument(s)`, {
      ...options,
      code: OperationErrorCode.INVALID_ARGUMENTS,
    });
  }
}

export class InvalidSelectionError extends AbstractOperationError {
  public constructor(options?: OperationErrorOptions) {
    super(`Invalid selection`, {
      ...options,
      code: OperationErrorCode.INVALID_SELECTION,
    });
  }
}

export class NotFoundError extends AbstractOperationError {
  public constructor(
    node: Node,
    where: NonNullable<NodeUniqueFilterInputValue>,
    options?: OperationErrorOptions,
  ) {
    super(
      `No "${node}" has been found given the following filter: ${inspect(
        where,
      )}`,
      { ...options, code: OperationErrorCode.NOT_FOUND },
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

export class LifecycleHookError extends AbstractOperationError {
  public constructor(
    nodeOrFeature: Node | NodeFeature,
    kind: LifecycleHookKind,
    options?: OperationErrorOptions,
  ) {
    super(
      `The "${nodeOrFeature}"'s "${LifecycleHookKind[kind]}" lifecycle-hook failed`,
      {
        ...options,
        code: OperationErrorCode.LIFECYCLE_HOOK_ERROR,
      },
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

export interface ConnectorWorkflowErrorOptions extends OperationErrorOptions {}

export class ConnectorWorkflowError extends AbstractConnectorError {
  public constructor(
    kind: ConnectorWorkflowKind,
    options?: ConnectorWorkflowErrorOptions,
  ) {
    super(`The connector failed at "${ConnectorWorkflowKind[kind]}"`, {
      ...options,
      code: OperationErrorCode.CONNECTOR_WORKFLOW_ERROR,
      causeIsPrivate: options?.causeIsPrivate ?? true,
    });
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

export interface ConnectorOperationErrorOptions extends OperationErrorOptions {}

export class ConnectorOperationError extends AbstractConnectorError {
  public constructor(
    node: Node,
    kind: ConnectorOperationKind,
    options?: ConnectorOperationErrorOptions & {
      readonly code?: OperationErrorCode.DUPLICATE;
    },
  ) {
    super(`The connector failed at "${node}.${ConnectorOperationKind[kind]}"`, {
      ...options,
      code: options?.code ?? OperationErrorCode.CONNECTOR_OPERATION_ERROR,
      causeIsPrivate: options?.causeIsPrivate ?? true,
    });
  }
}

export interface DuplicateErrorOptions extends OperationErrorOptions {
  readonly uniqueConstraint?: UniqueConstraint;
  readonly hint?: string;
}

export class DuplicateError extends ConnectorOperationError {
  public constructor(
    node: Node,
    kind: ConnectorOperationKind.CREATE | ConnectorOperationKind.UPDATE,
    options?: DuplicateErrorOptions,
  ) {
    super(node, kind, {
      ...options,
      code: OperationErrorCode.DUPLICATE,
      cause: new Error(
        [
          'duplicate',
          options?.uniqueConstraint && `"${options?.uniqueConstraint.name}"`,
          options?.hint && `(${options.hint})`,
        ]
          .filter(Boolean)
          .join(' '),
        { cause: options?.cause },
      ),
      causeIsPrivate: false,
    });
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
