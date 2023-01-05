import * as utils from '@prismamedia/graphql-platform-utils';
import { inspect } from 'node:util';
import type { Leaf, Node } from '../../node.js';
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

export class NotFoundError extends utils.GraphError {
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

export class UnexpectedLeafValueError extends utils.UnexpectedValueError {
  public constructor(
    leaf: Leaf,
    unexpectedLeafValue: any,
    options?: utils.GraphErrorOptions,
  ) {
    super('', unexpectedLeafValue, options);
  }
}

export class UnexpectedNodeValueError extends utils.AggregateGraphError {
  public constructor(
    node: Node,
    errors: Iterable<UnexpectedLeafValueError>,
    options?: utils.AggregateGraphErrorOptions,
  ) {
    super(errors, options);
  }
}

export enum LifecycleHookKind {
  PRE_CREATE = 'pre-create',
  POST_CREATE = 'post-create',
  PRE_UPDATE = 'pre-update',
  POST_UPDATE = 'post-update',
  PRE_DELETE = 'pre-delete',
  POST_DELETE = 'post-delete',
}

export class LifecycleHookError extends utils.GraphError {
  public constructor(
    node: Node,
    kind: LifecycleHookKind,
    options?: utils.GraphErrorOptions,
  ) {
    super(`${node}'s "${kind}" lifecycle hook error`, options);
  }
}

export class ConnectorError extends utils.GraphError {
  public constructor(options?: utils.GraphErrorOptions) {
    super('Connector error', options);
  }
}
