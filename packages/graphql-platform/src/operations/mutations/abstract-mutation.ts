import { getOptionalFlagValue } from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import {
  AbstractOperation,
  IOperationConfig,
  TOperationArgs,
} from '../abstract-operation';

export interface IMutationConfig extends IOperationConfig {
  /**
   * Optional, the mutation can be disabled totally: publicly (= in the GraphQL API) AND internally
   */
  readonly enabled?: boolean;
}

export abstract class AbstractMutation<
  TArgs extends TOperationArgs,
  TResult,
  TConfig extends IMutationConfig
> extends AbstractOperation<TArgs, TResult, TConfig> {
  public readonly type = 'mutation';

  @Memoize()
  public get enabled(): boolean {
    return getOptionalFlagValue(this.config?.enabled, true);
  }
}
