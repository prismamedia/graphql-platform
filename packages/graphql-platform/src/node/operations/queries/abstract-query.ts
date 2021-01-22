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
  TConfig extends IQueryConfig<TArgs>,
  TArgs extends TOperationArgs,
  TResult
> extends AbstractOperation<TConfig, TArgs, TResult> {
  public readonly type = 'query';
  public readonly defaultArgs?: TDefaultOperationArgs<TArgs> = this.config
    ?.defaultArgs;
}
