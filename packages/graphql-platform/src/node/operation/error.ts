import {
  NestableError,
  type NestableErrorOptions,
  type NonNillable,
} from '@prismamedia/graphql-platform-utils';
import { inspect } from 'node:util';
import type { Node } from '../../node.js';
import type { NodeUniqueFilterInputValue } from '../type/input/unique-filter.js';

export class RuntimeError extends NestableError {}

export class InvalidContextError extends RuntimeError {
  public constructor(options?: NestableErrorOptions) {
    super(`Invalid context`, options);
  }
}

export class UnauthorizedError extends RuntimeError {
  public constructor(node: Node, options?: NestableErrorOptions) {
    super(`Unauthorized access to "${node.name}"`, options);
  }
}

export class NotFoundError extends RuntimeError {
  public constructor(
    node: Node,
    where: NonNillable<NodeUniqueFilterInputValue>,
    options?: NestableErrorOptions,
  ) {
    super(
      `No "${
        node.name
      }" node has been found given the following filter: ${inspect(where)}`,
      options,
    );
  }
}
