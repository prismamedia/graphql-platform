import {
  AbstractOperation,
  IOperationConfig,
  TDefaultOperationArgs,
  TOperationArgs,
} from '../abstract-operation';

export interface IQueryConfig<TArgs extends TOperationArgs>
  extends IOperationConfig {
  readonly defaultArgs?: TDefaultOperationArgs<TArgs>;
}

export abstract class AbstractQuery<
  TArgs extends TOperationArgs,
  TResult,
  TConfig extends IQueryConfig<TArgs>
> extends AbstractOperation<TArgs, TResult, TConfig> {
  public readonly type = 'query';
  public readonly defaultArgs?: TDefaultOperationArgs<TArgs> = this.config
    ?.defaultArgs;
}
