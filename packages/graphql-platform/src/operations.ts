import {
  CreateOperation,
  DeleteIfExistsOperation,
  DeleteOperation,
  UpdateIfExistsOperation,
  UpdateOperation,
} from './operations/mutations';
import {
  CountOperation,
  FindOperation,
  GetIfExistsOperation,
  GetOperation,
} from './operations/queries';

export * from './operations/context';
export * from './operations/errors';
export * from './operations/mutations';
export * from './operations/queries';

export const operationConstructorMap = {
  // mutations
  create: CreateOperation,
  delete: DeleteOperation,
  deleteIfExists: DeleteIfExistsOperation,
  update: UpdateOperation,
  updateIfExists: UpdateIfExistsOperation,

  // queries
  count: CountOperation,
  find: FindOperation,
  get: GetOperation,
  getIfExists: GetIfExistsOperation,
};

type TOperationConstructorMap = typeof operationConstructorMap;

export type TOperationKey = keyof TOperationConstructorMap;

export type TOperationConfigMap<TKey extends TOperationKey = TOperationKey> = {
  readonly [TName in TKey]?: ConstructorParameters<
    TOperationConstructorMap[TName]
  >[1];
};

export type TOperationMap<TKey extends TOperationKey = TOperationKey> = {
  readonly [TName in TKey]: InstanceType<TOperationConstructorMap[TName]>;
};

export type TOperation<
  TKey extends TOperationKey = TOperationKey
> = TOperationMap[TKey];
