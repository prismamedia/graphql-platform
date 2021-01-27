import {
  getOptionalFlag,
  Path,
  PlainObject,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'assert';
import { ConnectorInterface } from '../../../connector';
import { AbstractOperation } from '../abstract';
import { BoundAPI, OperationContext } from '../context';

export type CommonHookArgs<
  TRequestContext,
  TConnector extends ConnectorInterface,
> = {
  /**
   * The "API" bound with the current "context" and "path"
   */
  api: BoundAPI<TRequestContext, TConnector>;

  /**
   * The current hook's path among the resolving tree
   */
  path: Path;

  /**
   * The current operation's context
   */
  operationContext: OperationContext<TRequestContext, TConnector>;
};

export interface AbstractMutationConfig {
  /**
   * Optional, the mutation can be disabled totally: publicly (= in the GraphQL API) AND internally
   */
  enabled?: boolean;

  /**
   * Optional, the mutation can be disabled publicly (= in the GraphQL API)
   */
  public?: boolean;
}

export abstract class AbstractMutation<
  TRequestContext,
  TConnector extends ConnectorInterface,
  TArgs extends PlainObject | undefined,
  TResult,
> extends AbstractOperation<TRequestContext, TConnector, TArgs, TResult> {
  protected readonly config?: Readonly<AbstractMutationConfig>;

  public readonly type = 'mutation';

  @Memoize()
  public get enabled(): boolean {
    return getOptionalFlag(this.config?.enabled, true);
  }

  @Memoize()
  public get public(): boolean {
    const isPublic = getOptionalFlag(
      this.config?.public,
      this.enabled && this.model.public,
    );

    assert(
      !isPublic || this.enabled,
      `The "${this.name}" mutation cannot be public as it is disabled`,
    );

    assert(
      !isPublic || this.model.public,
      `The "${this.name}" mutation cannot be public as the "${this.model.name}" model is not`,
    );

    return isPublic;
  }
}
