import { Class } from '@prismamedia/graphql-platform-utils';
import { CreateInputType } from './input/create';
import { OrderByInputType } from './input/order-by';
import { UpdateInputType } from './input/update';
import { WhereInputType } from './input/where';
import { WhereUniqueInputType } from './input/where-unique';

export * from './input/create';
export * from './input/order-by';
export * from './input/update';
export * from './input/where';
export * from './input/where-unique';

export const inputTypeMap = {
  Create: CreateInputType,
  OrderBy: OrderByInputType,
  Update: UpdateInputType,
  Where: WhereInputType,
  WhereUnique: WhereUniqueInputType,
};

export type InputTypeMap = typeof inputTypeMap;

export type InputTypeId = keyof InputTypeMap;

export type InputTypeConstructor<TId extends InputTypeId> = InputTypeMap[TId] extends Class ? InputTypeMap[TId] : never;
