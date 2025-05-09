import * as utils from '@prismamedia/graphql-platform-utils';
import { inspect } from 'node:util';
import * as R from 'remeda';
import type { Except, Promisable } from 'type-fest';
import type {
  Node,
  NodeCreation,
  NodeCreationStatement,
  NodeCreationValue,
  NodeDeletion,
  NodeUpdate,
  NodeUpdateStatement,
  NodeValue,
  UniqueConstraint,
} from '../../node.js';
import { NodeFeature } from '../feature.js';
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

abstract class AbstractOperationError<
  TRequestContext extends object = any,
> extends utils.GraphError {
  public constructor(
    public readonly request: TRequestContext,
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

    // Prevent these properties from being enumerable
    Object.defineProperties(
      this,
      R.fromKeys(['request'], R.constant({ enumerable: false })),
    );
  }
}

export class InvalidRequestContextError extends AbstractOperationError<any> {
  public constructor(request: unknown, options?: OperationErrorOptions) {
    super(request, `Invalid request-context`, {
      ...options,
      code: OperationErrorCode.INVALID_REQUEST_CONTEXT,
    });
  }
}

export class UnauthenticatedError<
  TRequestContext extends object = any,
> extends AbstractOperationError<TRequestContext> {
  public constructor(
    request: TRequestContext,
    options?: OperationErrorOptions,
  ) {
    super(request, `Unauthenticated`, {
      ...options,
      code: OperationErrorCode.UNAUTHENTICATED,
    });
  }
}

export class UnauthorizedError<
  TRequestContext extends object = any,
> extends AbstractOperationError<TRequestContext> {
  public constructor(
    request: TRequestContext,
    node: Node,
    mutationType?: utils.MutationType,
    options?: OperationErrorOptions,
  ) {
    super(
      request,
      `Unauthorized access to "${node}"${
        mutationType ? `'s ${mutationType}` : ''
      }`,
      { ...options, code: OperationErrorCode.UNAUTHORIZED },
    );
  }
}

export class InvalidArgumentsError<
  TRequestContext extends object = any,
> extends AbstractOperationError<TRequestContext> {
  public constructor(
    request: TRequestContext,
    options?: OperationErrorOptions,
  ) {
    super(request, `Invalid argument(s)`, {
      ...options,
      code: OperationErrorCode.INVALID_ARGUMENTS,
    });
  }
}

export class InvalidSelectionError<
  TRequestContext extends object = any,
> extends AbstractOperationError<TRequestContext> {
  public constructor(
    request: TRequestContext,
    options?: OperationErrorOptions,
  ) {
    super(request, `Invalid selection`, {
      ...options,
      code: OperationErrorCode.INVALID_SELECTION,
    });
  }
}

export class NotFoundError<
  TRequestContext extends object = any,
> extends AbstractOperationError<TRequestContext> {
  public constructor(
    request: TRequestContext,
    node: Node,
    where: NonNullable<NodeUniqueFilterInputValue>,
    options?: OperationErrorOptions,
  ) {
    super(
      request,
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

export interface LifecycleHookErrorOptions extends OperationErrorOptions {
  readonly creation?: NodeCreationValue;
}

export abstract class AbstractLifecycleHookError<
  TRequestContext extends object = any,
> extends AbstractOperationError<TRequestContext> {
  public readonly feature?: NodeFeature;
  public readonly node: Node;

  public constructor(
    request: TRequestContext,
    nodeOrFeature: Node | NodeFeature,
    public readonly kind: LifecycleHookKind,
    options?: OperationErrorOptions,
  ) {
    super(
      request,
      `The "${nodeOrFeature}"'s "${LifecycleHookKind[kind]}" lifecycle-hook failed`,
      { ...options, code: OperationErrorCode.LIFECYCLE_HOOK_ERROR },
    );

    if (nodeOrFeature instanceof NodeFeature) {
      this.feature = nodeOrFeature;
      this.node = nodeOrFeature.node;
    } else {
      this.node = nodeOrFeature;
    }

    // Prevent these properties from being enumerable
    Object.defineProperties(
      this,
      R.fromKeys(
        ['feature', 'node', 'kind'],
        R.constant({ enumerable: false }),
      ),
    );
  }
}

export class PreCreateError<
  TRequestContext extends object = any,
> extends AbstractLifecycleHookError<TRequestContext> {
  public constructor(
    request: TRequestContext,
    nodeOrFeature: Node | NodeFeature,
    public readonly statement: NodeCreationStatement,
    options?: OperationErrorOptions,
  ) {
    super(request, nodeOrFeature, LifecycleHookKind.PRE_CREATE, options);

    Object.defineProperty(this, 'statement', { enumerable: false });
  }
}

export class PostCreateError<
  TRequestContext extends object = any,
> extends AbstractLifecycleHookError<TRequestContext> {
  public constructor(
    request: TRequestContext,
    nodeOrFeature: Node | NodeFeature,
    public readonly change: NodeCreation<TRequestContext>,
    options?: OperationErrorOptions,
  ) {
    super(request, nodeOrFeature, LifecycleHookKind.POST_CREATE, options);

    Object.defineProperty(this, 'change', { enumerable: false });
  }
}

export class PreUpdateError<
  TRequestContext extends object = any,
> extends AbstractLifecycleHookError<TRequestContext> {
  public constructor(
    request: TRequestContext,
    nodeOrFeature: Node | NodeFeature,
    public readonly statement: NodeUpdateStatement,
    options?: OperationErrorOptions,
  ) {
    super(request, nodeOrFeature, LifecycleHookKind.PRE_UPDATE, options);

    Object.defineProperty(this, 'statement', { enumerable: false });
  }
}

export class PostUpdateError<
  TRequestContext extends object = any,
> extends AbstractLifecycleHookError<TRequestContext> {
  public constructor(
    request: TRequestContext,
    nodeOrFeature: Node | NodeFeature,
    public readonly change: NodeUpdate<TRequestContext>,
    options?: OperationErrorOptions,
  ) {
    super(request, nodeOrFeature, LifecycleHookKind.POST_UPDATE, options);

    Object.defineProperty(this, 'change', { enumerable: false });
  }
}

export class PreDeleteError<
  TRequestContext extends object = any,
> extends AbstractLifecycleHookError<TRequestContext> {
  public constructor(
    request: TRequestContext,
    nodeOrFeature: Node | NodeFeature,
    public readonly currentValue: Readonly<NodeValue>,
    options?: OperationErrorOptions,
  ) {
    super(request, nodeOrFeature, LifecycleHookKind.PRE_DELETE, options);

    Object.defineProperty(this, 'currentValue', { enumerable: false });
  }
}

export class PostDeleteError<
  TRequestContext extends object = any,
> extends AbstractLifecycleHookError<TRequestContext> {
  public constructor(
    request: TRequestContext,
    nodeOrFeature: Node | NodeFeature,
    public readonly change: NodeDeletion<TRequestContext>,
    options?: OperationErrorOptions,
  ) {
    super(request, nodeOrFeature, LifecycleHookKind.POST_DELETE, options);

    Object.defineProperty(this, 'change', { enumerable: false });
  }
}

export type PreLifecycleHookError<TRequestContext extends object = any> =
  | PreCreateError<TRequestContext>
  | PreUpdateError<TRequestContext>
  | PreDeleteError<TRequestContext>;

export const isPreLifecycleHookError = <TRequestContext extends object = any>(
  error: unknown,
): error is PreLifecycleHookError<TRequestContext> =>
  error instanceof PreCreateError ||
  error instanceof PreUpdateError ||
  error instanceof PreDeleteError;

export type PostLifecycleHookError<TRequestContext extends object = any> =
  | PostCreateError<TRequestContext>
  | PostUpdateError<TRequestContext>
  | PostDeleteError<TRequestContext>;

export const isPostLifecycleHookError = <TRequestContext extends object = any>(
  error: unknown,
): error is PostLifecycleHookError<TRequestContext> =>
  error instanceof PostCreateError ||
  error instanceof PostUpdateError ||
  error instanceof PostDeleteError;

export type LifecycleHookError<TRequestContext extends object = any> =
  | PreLifecycleHookError<TRequestContext>
  | PostLifecycleHookError<TRequestContext>;

export const isLifecycleHookError = <TRequestContext extends object = any>(
  error: unknown,
): error is LifecycleHookError<TRequestContext> =>
  isPreLifecycleHookError(error) || isPostLifecycleHookError(error);

export abstract class AbstractConnectorError<
  TRequestContext extends object,
> extends AbstractOperationError<TRequestContext> {}

export enum ConnectorWorkflowKind {
  PRE_MUTATION,
  POST_SUCCESSFUL_MUTATION,
  POST_FAILED_MUTATION,
  POST_MUTATION,
}

export interface ConnectorWorkflowErrorOptions extends OperationErrorOptions {}

export class ConnectorWorkflowError<
  TRequestContext extends object = any,
> extends AbstractConnectorError<TRequestContext> {
  public constructor(
    request: TRequestContext,
    kind: ConnectorWorkflowKind,
    options?: ConnectorWorkflowErrorOptions,
  ) {
    super(request, `The connector failed at "${ConnectorWorkflowKind[kind]}"`, {
      ...options,
      code: OperationErrorCode.CONNECTOR_WORKFLOW_ERROR,
    });
  }
}

export const catchConnectorWorkflowError = <TRequestContext extends object>(
  workflow: () => Promisable<void>,
  request: TRequestContext,
  kind: ConnectorWorkflowKind,
  options?: Except<ConnectorWorkflowErrorOptions, 'cause'>,
): Promise<void> =>
  utils.PromiseTry(workflow).catch((error) => {
    throw error instanceof ConnectorWorkflowError
      ? error
      : new ConnectorWorkflowError(request, kind, { ...options, cause: error });
  });

export enum ConnectorOperationKind {
  COUNT,
  FIND,
  CREATE,
  UPDATE,
  DELETE,
}

export interface ConnectorOperationErrorOptions extends OperationErrorOptions {
  readonly message?: string;
}

export class ConnectorOperationError<
  TRequestContext extends object = any,
> extends AbstractConnectorError<TRequestContext> {
  public constructor(
    request: TRequestContext,
    node: Node,
    kind: ConnectorOperationKind,
    {
      code,
      message,
      ...options
    }: ConnectorOperationErrorOptions & {
      readonly code?: OperationErrorCode.DUPLICATE;
    } = {},
  ) {
    super(
      request,
      message ??
        `The connector failed at "${node}.${ConnectorOperationKind[kind]}"`,
      {
        ...options,
        code: code ?? OperationErrorCode.CONNECTOR_OPERATION_ERROR,
      },
    );
  }
}

export interface DuplicateErrorOptions extends OperationErrorOptions {
  readonly uniqueConstraint?: UniqueConstraint;
  readonly hint?: string;
}

export class DuplicateError<
  TRequestContext extends object = any,
> extends ConnectorOperationError<TRequestContext> {
  public constructor(
    request: TRequestContext,
    node: Node,
    kind: ConnectorOperationKind.CREATE | ConnectorOperationKind.UPDATE,
    options?: DuplicateErrorOptions,
  ) {
    super(request, node, kind, {
      ...options,
      code: OperationErrorCode.DUPLICATE,
      message: `Duplicate "${options?.uniqueConstraint ?? node}"${options?.hint ? `: ${options.hint}` : ''}`,
    });
  }
}

export const catchConnectorOperationError = <T, TRequestContext extends object>(
  operation: () => Promisable<T>,
  request: TRequestContext,
  node: Node,
  kind: ConnectorOperationKind,
  options?: Except<ConnectorOperationErrorOptions, 'cause'>,
): Promise<T> =>
  utils.PromiseTry(operation).catch((error) => {
    throw error instanceof ConnectorOperationError
      ? error
      : new ConnectorOperationError(request, node, kind, {
          ...options,
          cause: error,
        });
  });
