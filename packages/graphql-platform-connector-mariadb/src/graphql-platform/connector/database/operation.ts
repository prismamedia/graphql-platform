import { CustomContext, OperationEvent as CoreOperationEvent } from '@prismamedia/graphql-platform-core';
import { Class, POJO } from '@prismamedia/graphql-platform-utils';
import { BaseContext } from '../../../graphql-platform';
import { ConnectorOperationParams } from '../../connector';
import { CountOperation as Count } from './operation/count';
import { CreateOperation as Create } from './operation/create';
import { DeleteOperation as Delete } from './operation/delete';
import { FindOperation as Find } from './operation/find';
import { UpdateOperation as Update } from './operation/update';

export const operationMap = { Count, Create, Delete, Find, Update };

export type OperationMap = typeof operationMap;

export type OperationId = keyof OperationMap;

export type OperationConstructor<TId extends OperationId> = OperationMap[TId] extends Class ? OperationMap[TId] : never;

export type OperationResolverParams<TArgs extends POJO, TCustomContext extends CustomContext = {}> = Omit<
  ConnectorOperationParams<TArgs, TCustomContext>,
  'resource'
>;

export type OperationEvent<TArgs extends POJO = any, TCustomContext extends CustomContext = {}> = CoreOperationEvent<
  TArgs,
  TCustomContext,
  BaseContext
>;
