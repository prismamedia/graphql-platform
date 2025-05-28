import * as utils from '@prismamedia/graphql-platform-utils';
import { inspect } from 'node:util';
import * as R from 'remeda';
import type { Except, Merge, Promisable } from 'type-fest';
import type {
  MutationContextChanges,
  Node,
  NodeValue,
  UniqueConstraint,
} from '../../node.js';
import { NodeFeature } from '../feature.js';
import type { NodeUniqueFilterInputValue } from '../type/input/unique-filter.js';

export enum RequestErrorCode {
  CONNECTOR_WORKFLOW_ERROR,
  DISABLED,
  DUPLICATE,
  INVALID_ARGUMENTS,
  INVALID_REQUEST_CONTEXT,
  INVALID_SELECTION,
  NOT_FOUND,
  OPERATION_ERROR,
  REQUEST_ERROR,
  UNAUTHENTICATED,
  UNAUTHORIZED,
}

// export interface RequestErrorExtensions<TRequestContext extends object = any>
//   extends utils.GraphErrorExtensions {
//   readonly requestContext: TRequestContext;
// }

export type RequestErrorOptions = Merge<
  utils.GraphErrorOptions,
  {
    readonly code?: RequestErrorCode;
    readonly message?: string;
    readonly reason?: string;
  }
>;

export class RequestError<
  TRequestContext extends object = any,
> extends utils.GraphError {
  public constructor(
    public readonly requestContext: TRequestContext,
    { code, message, reason, ...options }: RequestErrorOptions = {},
  ) {
    super(
      message ??
        [
          `The request failed`,
          reason ?? (code != null ? RequestErrorCode[code] : undefined),
        ]
          .filter(Boolean)
          .join(' - '),
      {
        ...options,
        code: code != null ? RequestErrorCode[code] : undefined,
      },
    );

    Object.defineProperty(this, 'requestContext', { enumerable: false });
  }

  // @MGetter
  // public override get extensions(): RequestErrorExtensions<TRequestContext> {
  //   return {
  //     ...super.extensions,
  //     requestContext: this.requestContext,
  //   };
  // }
}

export class InvalidRequestContextError extends RequestError<any> {
  public constructor(
    requestContext: unknown,
    options?: Except<RequestErrorOptions, 'code'>,
  ) {
    super(requestContext, {
      code: RequestErrorCode.INVALID_REQUEST_CONTEXT,
      ...options,
    });
  }
}

export class UnauthenticatedError<
  TRequestContext extends object = any,
> extends RequestError<TRequestContext> {
  public constructor(
    requestContext: TRequestContext,
    options?: Except<RequestErrorOptions, 'code'>,
  ) {
    super(requestContext, {
      code: RequestErrorCode.UNAUTHENTICATED,
      ...options,
    });
  }
}

export enum ConnectorWorkflowKind {
  PRE_MUTATION,
  POST_SUCCESSFUL_MUTATION,
  POST_FAILED_MUTATION,
  POST_MUTATION,
}

export class ConnectorWorkflowError<
  TRequestContext extends object = any,
> extends RequestError<TRequestContext> {
  public constructor(
    requestContext: TRequestContext,
    kind: ConnectorWorkflowKind,
    options?: Except<RequestErrorOptions, 'code'>,
  ) {
    super(requestContext, {
      code: RequestErrorCode.CONNECTOR_WORKFLOW_ERROR,
      reason: `the connector failed at "${ConnectorWorkflowKind[kind]}"`,
      ...options,
    });
  }
}

export class ChangesNotificationError<
  TRequestContext extends object = any,
> extends RequestError<TRequestContext> {
  public constructor(
    requestContext: TRequestContext,
    public readonly changes: MutationContextChanges<TRequestContext>,
    options: RequestErrorOptions,
  ) {
    super(requestContext, {
      reason: `the "changes" have been applied but have failed to be notified`,
      ...options,
    });

    Object.defineProperty(this, 'changes', { enumerable: false });
  }
}

export type MutationHook = `${'pre' | 'post'}-${utils.MutationType}`;

export interface OperationErrorOptions extends RequestErrorOptions {
  readonly mutationType?: utils.MutationType;
  readonly mutationHook?: MutationHook;
  readonly mutatedValue?: Readonly<NodeValue>;
  readonly message?: string;
  readonly reason?: string;
}

export class OperationError<
  TRequestContext extends object = any,
> extends RequestError<TRequestContext> {
  public readonly mutationType?: utils.MutationType;
  public readonly mutationHook?: MutationHook;
  public readonly mutatedValue?: Readonly<NodeValue>;

  public constructor(
    requestContext: TRequestContext,
    public readonly node: Node,
    {
      code,
      mutationType,
      mutationHook,
      mutatedValue,
      message,
      reason,
      ...options
    }: OperationErrorOptions = {},
  ) {
    super(requestContext, {
      code: code ?? RequestErrorCode.OPERATION_ERROR,
      message:
        message ??
        [
          `The "${node}"'s "${mutationHook ?? mutationType ?? 'query'}" failed`,
          reason ?? (code != null ? RequestErrorCode[code] : undefined),
        ]
          .filter(Boolean)
          .join(' - '),
      ...options,
    });

    mutationType && (this.mutationType = mutationType);
    mutationHook && (this.mutationHook = mutationHook);
    mutatedValue && (this.mutatedValue = mutatedValue);

    Object.defineProperties(
      this,
      R.fromKeys(
        ['node', 'mutationType', 'mutationHook', 'mutatedValue'],
        R.constant({ enumerable: false }),
      ),
    );
  }
}

export const catchOperationError = <T, TRequestContext extends object>(
  operation: () => Promisable<T>,
  requestContext: TRequestContext,
  node: Node,
  options?: Except<OperationErrorOptions, 'cause'>,
): Promise<T> =>
  utils.PromiseTry(operation).catch((error) => {
    throw error instanceof OperationError
      ? error
      : new OperationError(requestContext, node, { ...options, cause: error });
  });

export class UnauthorizedError<
  TRequestContext extends object = any,
> extends OperationError<TRequestContext> {
  public constructor(
    requestContext: TRequestContext,
    node: Node,
    options?: Except<OperationErrorOptions, 'code'>,
  ) {
    super(requestContext, node, {
      code: RequestErrorCode.UNAUTHORIZED,
      ...options,
    });
  }
}

export class InvalidArgumentsError<
  TRequestContext extends object = any,
> extends OperationError<TRequestContext> {
  public constructor(
    requestContext: TRequestContext,
    node: Node,
    options?: Except<OperationErrorOptions, 'code'>,
  ) {
    super(requestContext, node, {
      code: RequestErrorCode.INVALID_ARGUMENTS,
      reason:
        options?.cause instanceof Error
          ? utils.setGraphErrorAncestor(options.cause, options.path).message
          : undefined,
      ...options,
    });
  }
}

export class InvalidSelectionError<
  TRequestContext extends object = any,
> extends OperationError<TRequestContext> {
  public constructor(
    requestContext: TRequestContext,
    node: Node,
    options?: Except<OperationErrorOptions, 'code'>,
  ) {
    super(requestContext, node, {
      code: RequestErrorCode.INVALID_SELECTION,
      ...options,
    });
  }
}

export class NotFoundError<
  TRequestContext extends object = any,
> extends OperationError<TRequestContext> {
  public constructor(
    requestContext: TRequestContext,
    node: Node,
    public readonly where: NonNullable<NodeUniqueFilterInputValue>,
    options?: Except<OperationErrorOptions, 'code'>,
  ) {
    super(requestContext, node, {
      code: RequestErrorCode.NOT_FOUND,
      reason: `no entry found for: ${inspect(where)}`,
      ...options,
    });

    Object.defineProperty(this, 'where', { enumerable: false });
  }
}

export class MutationHookError<
  TRequestContext extends object = any,
> extends OperationError<TRequestContext> {
  public readonly feature?: NodeFeature;
  declare public readonly mutationType: utils.MutationType;
  declare public readonly mutationHook: MutationHook;
  declare public readonly mutatedValue: Readonly<NodeValue>;

  public constructor(
    requestContext: TRequestContext,
    nodeOrFeature: Node | NodeFeature,
    mutationType: utils.MutationType,
    mutationHook: 'pre' | 'post',
    mutatedValue: Readonly<NodeValue>,
    options: Except<
      OperationErrorOptions,
      'code' | 'message' | 'mutationType' | 'mutatedValue' | 'reason'
    >,
  ) {
    const [node, feature] =
      nodeOrFeature instanceof NodeFeature
        ? [nodeOrFeature.node, nodeOrFeature]
        : [nodeOrFeature, undefined];

    super(requestContext, node, {
      ...options,
      mutationType,
      mutationHook: `${mutationHook}-${mutationType}`,
      mutatedValue,
      reason:
        options?.cause instanceof Error
          ? utils.setGraphErrorAncestor(options.cause, options.path).message
          : undefined,
    });

    feature && (this.feature = feature);

    Object.defineProperty(this, 'feature', { enumerable: false });
  }
}

export class ConnectorOperationError<
  TRequestContext extends object = any,
> extends OperationError<TRequestContext> {}

export class DuplicateError<
  TRequestContext extends object = any,
> extends ConnectorOperationError<TRequestContext> {
  public constructor(
    request: TRequestContext,
    node: Node,
    options?: Except<OperationErrorOptions, 'code' | 'reason' | 'message'> & {
      readonly uniqueConstraint?: UniqueConstraint;
      readonly hint?: string;
    },
  ) {
    super(request, node, {
      code: RequestErrorCode.DUPLICATE,
      reason: [
        'duplicate',
        options?.uniqueConstraint
          ? `"${options.uniqueConstraint.name}"`
          : undefined,
        options?.hint ? `(${options.hint})` : undefined,
        'found',
      ]
        .filter(Boolean)
        .join(' '),
      ...options,
    });
  }
}

export const catchConnectorOperationError = <T, TRequestContext extends object>(
  operation: () => Promisable<T>,
  requestContext: TRequestContext,
  node: Node,
  options?: Except<OperationErrorOptions, 'cause'>,
): Promise<T> =>
  utils.PromiseTry(operation).catch((error) => {
    throw error instanceof ConnectorOperationError
      ? error
      : new ConnectorOperationError(requestContext, node, {
          ...options,
          cause: error,
        });
  });
