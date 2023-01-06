import * as utils from '@prismamedia/graphql-platform-utils';
import { inspect } from 'node:util';
import type { Node, UniqueConstraint } from '../../node.js';
import type { NodeUniqueFilterInputValue } from '../type/input/unique-filter.js';

export class InvalidRequestContextError extends utils.GraphError {
  public constructor(options?: utils.GraphErrorOptions) {
    super(`Invalid request`, options);
  }
}

export class UnauthorizedError extends utils.GraphError {
  public constructor(
    node: Node,
    mutationType: utils.MutationType | undefined,
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

export class NodeNotFoundError extends utils.GraphError {
  public constructor(
    node: Node,
    where: NonNullable<NodeUniqueFilterInputValue>,
    options?: utils.GraphErrorOptions,
  ) {
    super(
      `No "${node}" has been found given the following filter: ${inspect({
        ...where,
      })}`,
      options,
    );
  }
}

export interface DuplicateNodeErrorOptions extends utils.GraphErrorOptions {
  readonly uniqueConstraint?: UniqueConstraint;
  readonly value?: string;
}

export class DuplicateNodeError extends utils.GraphError {
  public constructor(node: Node, options?: DuplicateNodeErrorOptions) {
    super(
      [
        `Duplicate "${options?.uniqueConstraint || node}"`,
        options?.value ? `: ${options.value}` : undefined,
      ]
        .filter(Boolean)
        .join(''),
      options,
    );
  }
}

export enum NodeLifecycleHookKind {
  PRE_CREATE = 'pre-create',
  POST_CREATE = 'post-create',
  PRE_UPDATE = 'pre-update',
  POST_UPDATE = 'post-update',
  PRE_DELETE = 'pre-delete',
  POST_DELETE = 'post-delete',
}

export class NodeLifecycleHookError extends utils.GraphError {
  public constructor(
    node: Node,
    kind: NodeLifecycleHookKind,
    options?: utils.GraphErrorOptions,
  ) {
    super(`${node}'s "${kind}" lifecycle hook error`, options);
  }
}

export class ConnectorError extends utils.GraphError {
  public constructor(options?: utils.GraphErrorOptions) {
    super(
      options?.cause instanceof DuplicateNodeError
        ? options.cause.message
        : 'Connector error',
      options,
    );
  }
}
