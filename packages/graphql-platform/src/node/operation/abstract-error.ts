import * as utils from '@prismamedia/graphql-platform-utils';
import { GraphQLError } from 'graphql';

export abstract class AbstractOperationError extends utils.GraphError {
  public abstract readonly code: string;
  readonly #message: string;

  public constructor(message: string, options?: utils.GraphErrorOptions) {
    super(message, options);
    this.#message = message;
  }

  public toGraphQLError(): GraphQLError {
    return new GraphQLError(
      `${this.#message}${
        this.cause instanceof Error ? ` - ${this.cause.message}` : ''
      }`,
      {
        ...(this.cause instanceof Error && { originalError: this.cause }),
        ...(this.path && { path: utils.pathToArray(this.path) }),
        ...(this.code && { extensions: { code: this.code } }),
      },
    );
  }
}
