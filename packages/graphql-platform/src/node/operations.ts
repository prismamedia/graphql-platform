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

export const operationConstructorMap = Object.freeze({
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
});

type TOperationConstructorMap = typeof operationConstructorMap;

export type TOperationKey = keyof TOperationConstructorMap;

export type TOperationConfigMap = {
  readonly [TKey in TOperationKey as Exclude<
    TKey,
    `${string}IfExists`
  >]?: ConstructorParameters<TOperationConstructorMap[TKey]>[1];
};

export type TOperationMap = {
  readonly [TKey in TOperationKey]: InstanceType<
    TOperationConstructorMap[TKey]
  >;
};

export type TOperation<TKey extends TOperationKey> = TOperationMap[TKey];
