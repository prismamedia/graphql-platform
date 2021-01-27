import { ConnectorInterface } from '../connector';
import { Model } from '../model';
import {
  CreateManyOperation,
  CreateOneOperation,
  DeleteManyOperation,
  DeleteOneIfExistsOperation,
  DeleteOneOperation,
  UpdateManyOperation,
  UpdateOneIfExistsOperation,
  UpdateOneOperation,
  UpsertOneOperation,
} from './operations/mutations';
import {
  CountOperation,
  FindManyOperation,
  GetOneIfExistsOperation,
  GetOneOperation,
} from './operations/queries';

export * from './operations/change';
export * from './operations/context';
export * from './operations/errors';
export * from './operations/mutations';
export * from './operations/queries';

// As a "class constructor" cannot be generic, we cannot construct this type from the "operationConstructorMap" below
export type OperationMap<
  TRequestContext = any,
  TConnector extends ConnectorInterface = any,
> = {
  // mutations
  create: CreateOneOperation<TRequestContext, TConnector>;
  createMany: CreateManyOperation<TRequestContext, TConnector>;
  delete: DeleteOneOperation<TRequestContext, TConnector>;
  deleteIfExists: DeleteOneIfExistsOperation<TRequestContext, TConnector>;
  deleteMany: DeleteManyOperation<TRequestContext, TConnector>;
  update: UpdateOneOperation<TRequestContext, TConnector>;
  updateIfExists: UpdateOneIfExistsOperation<TRequestContext, TConnector>;
  updateMany: UpdateManyOperation<TRequestContext, TConnector>;
  upsert: UpsertOneOperation<TRequestContext, TConnector>;

  // queries
  count: CountOperation<TRequestContext, TConnector>;
  find: FindManyOperation<TRequestContext, TConnector>;
  get: GetOneOperation<TRequestContext, TConnector>;
  getIfExists: GetOneIfExistsOperation<TRequestContext, TConnector>;
};

export const operationConstructorMap: {
  [TKey in keyof OperationMap]: new <
    TRequestContext = any,
    TConnector extends ConnectorInterface = any,
  >(
    model: Model<TRequestContext, TConnector>,
  ) => Operation<TKey, TRequestContext, TConnector>;
} = {
  // mutations
  create: CreateOneOperation,
  createMany: CreateManyOperation,
  delete: DeleteOneOperation,
  deleteIfExists: DeleteOneIfExistsOperation,
  deleteMany: DeleteManyOperation,
  update: UpdateOneOperation,
  updateIfExists: UpdateOneIfExistsOperation,
  updateMany: UpdateManyOperation,
  upsert: UpsertOneOperation,

  // queries
  count: CountOperation,
  find: FindManyOperation,
  get: GetOneOperation,
  getIfExists: GetOneIfExistsOperation,
};

export type OperationKey = keyof OperationMap;

export type Operation<
  TKey extends OperationKey = OperationKey,
  TRequestContext = any,
  TConnector extends ConnectorInterface = any,
> = OperationMap<TRequestContext, TConnector>[TKey];

export type OperationParameters<
  TKey extends OperationKey,
  TRequestContext,
  TConnector extends ConnectorInterface,
> = Parameters<Operation<TKey, TRequestContext, TConnector>['execute']>;

export type OperationResult<TKey extends OperationKey> = ReturnType<
  Operation<TKey>['execute']
>;
