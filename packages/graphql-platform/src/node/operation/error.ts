import * as utils from '@prismamedia/graphql-platform-utils';
import { inspect } from 'node:util';
import * as R from 'remeda';
import type { Except, Merge, Promisable } from 'type-fest';
import type { Node, NodeValue, UniqueConstraint } from '../../node.js';
import { NodeFeature } from '../feature.js';
import type { NodeUniqueFilterInputValue } from '../type/input/unique-filter.js';

export enum RequestErrorCode {
  CONNECTOR_WORKFLOW_ERROR,
  DUPLICATE,
  INVALID_ARGUMENTS,
  INVALID_REQUEST_CONTEXT,
  INVALID_SELECTION,
  NOT_FOUND,
  OPERATION_ERROR,
  UNAUTHENTICATED,
  UNAUTHORIZED,
}

export type RequestErrorOptions = Merge<
  utils.GraphErrorOptions,
  { readonly code?: RequestErrorCode }
>;

export class RequestError<
  TRequestContext extends object = any,
> extends utils.GraphError {
  public constructor(
    public readonly requestContext: TRequestContext,
    message: string,
    options?: RequestErrorOptions,
  ) {
    super(message, {
      ...options,
      code: options?.code != null ? RequestErrorCode[options.code] : undefined,
    });

    Object.defineProperty(this, 'requestContext', { enumerable: false });
  }
}

export class InvalidRequestContextError extends RequestError<any> {
  public constructor(
    requestContext: unknown,
    options?: Except<RequestErrorOptions, 'code'>,
  ) {
    super(requestContext, `Invalid request-context`, {
      ...options,
      code: RequestErrorCode.INVALID_REQUEST_CONTEXT,
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
    super(requestContext, `Unauthenticated`, {
      ...options,
      code: RequestErrorCode.UNAUTHENTICATED,
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
    super(
      requestContext,
      `The connector failed at "${ConnectorWorkflowKind[kind]}"`,
      {
        ...options,
        code: RequestErrorCode.CONNECTOR_WORKFLOW_ERROR,
      },
    );
  }
}

export interface OperationErrorOptions extends RequestErrorOptions {
  readonly mutationType?: utils.MutationType;
  readonly mutatedValue?: Readonly<NodeValue>;
  readonly message?: string;
  readonly reason?: string;
}

export class OperationError<
  TRequestContext extends object = any,
> extends RequestError<TRequestContext> {
  public readonly node: Node;
  public readonly feature?: NodeFeature;
  public readonly mutationType?: utils.MutationType;
  public readonly mutatedValue?: Readonly<NodeValue>;

  public constructor(
    requestContext: TRequestContext,
    nodeOrFeature: Node | NodeFeature,
    {
      code = RequestErrorCode.OPERATION_ERROR,
      mutationType,
      mutatedValue,
      message,
      reason,
      ...options
    }: OperationErrorOptions = {},
  ) {
    const [node, feature] =
      nodeOrFeature instanceof NodeFeature
        ? [nodeOrFeature.node, nodeOrFeature]
        : [nodeOrFeature, undefined];

    super(
      requestContext,
      message ??
        `The "${node}"'s "${mutationType ?? 'query'}" failed${reason ? `: ${reason}` : ''}`,
      { code, ...options },
    );

    this.node = node;
    feature && (this.feature = feature);
    mutationType && (this.mutationType = mutationType);
    mutatedValue && (this.mutatedValue = mutatedValue);

    // Prevent these properties from being enumerable
    Object.defineProperties(
      this,
      R.fromKeys(
        ['node', 'feature', 'mutationType', 'mutatedValue'],
        R.constant({ enumerable: false }),
      ),
    );
  }
}

export class UnauthorizedError<
  TRequestContext extends object = any,
> extends OperationError<TRequestContext> {
  public constructor(
    requestContext: TRequestContext,
    nodeOrFeature: Node | NodeFeature,
    options?: Except<OperationErrorOptions, 'code'>,
  ) {
    super(requestContext, nodeOrFeature, {
      reason: `unauthorized`,
      ...options,
      code: RequestErrorCode.UNAUTHORIZED,
    });
  }
}

export class InvalidArgumentsError<
  TRequestContext extends object = any,
> extends OperationError<TRequestContext> {
  public constructor(
    requestContext: TRequestContext,
    nodeOrFeature: Node | NodeFeature,
    options?: Except<OperationErrorOptions, 'code'>,
  ) {
    super(requestContext, nodeOrFeature, {
      reason: `invalid argument(s)`,
      ...options,
      code: RequestErrorCode.INVALID_ARGUMENTS,
    });
  }
}

export class InvalidSelectionError<
  TRequestContext extends object = any,
> extends OperationError<TRequestContext> {
  public constructor(
    requestContext: TRequestContext,
    nodeOrFeature: Node | NodeFeature,
    options?: Except<OperationErrorOptions, 'code'>,
  ) {
    super(requestContext, nodeOrFeature, {
      reason: `invalid selection`,
      ...options,
      code: RequestErrorCode.INVALID_SELECTION,
    });
  }
}

export class NotFoundError<
  TRequestContext extends object = any,
> extends OperationError<TRequestContext> {
  public constructor(
    requestContext: TRequestContext,
    nodeOrFeature: Node | NodeFeature,
    public readonly where: NonNullable<NodeUniqueFilterInputValue>,
    options?: Except<OperationErrorOptions, 'code'>,
  ) {
    super(requestContext, nodeOrFeature, {
      reason: `no entry found given the filter "${inspect(where)}"`,
      ...options,
      code: RequestErrorCode.NOT_FOUND,
    });

    Object.defineProperty(this, 'where', { enumerable: false });
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
      ...options,
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
    });
  }
}

export const catchConnectorOperationError = <T, TRequestContext extends object>(
  operation: () => Promisable<T>,
  requestContext: TRequestContext,
  node: Node,
  options?: Except<OperationErrorOptions, 'code' | 'cause'>,
): Promise<T> =>
  utils.PromiseTry(operation).catch((error) => {
    throw error instanceof ConnectorOperationError
      ? error
      : new ConnectorOperationError(requestContext, node, {
          ...options,
          cause: error,
        });
  });
