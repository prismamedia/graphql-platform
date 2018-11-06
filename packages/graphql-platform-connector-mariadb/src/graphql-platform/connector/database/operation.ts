import { OperationResolverParams as CoreOperationResolverParams } from '@prismamedia/graphql-platform-core';
import { Class, POJO } from '@prismamedia/graphql-platform-utils';
import { BaseContext } from '../../../graphql-platform';
import { OperationContext } from '../../connector';
import { CountOperation as Count } from './operation/count';
import { CreateOperation as Create } from './operation/create';
import { DeleteOperation as Delete } from './operation/delete';
import { FindOperation as Find } from './operation/find';
import { UpdateOperation as Update } from './operation/update';

export const operationMap = { Count, Create, Delete, Find, Update };

export type OperationMap = typeof operationMap;

export type OperationId = keyof OperationMap;

export type OperationConstructor<TId extends OperationId> = OperationMap[TId] extends Class ? OperationMap[TId] : never;

export type OperationResolverParams<TArgs extends POJO> = CoreOperationResolverParams<
  TArgs,
  BaseContext,
  OperationContext
>;
