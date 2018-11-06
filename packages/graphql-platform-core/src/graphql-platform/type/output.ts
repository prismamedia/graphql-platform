import { Class } from '@prismamedia/graphql-platform-utils';
import { NodeType } from './output/node';

export * from './output/node';

export const outputTypeMap = { Node: NodeType };

export type OutputTypeMap = typeof outputTypeMap;

export type OutputTypeId = keyof OutputTypeMap;

export type OutputTypeConstructor<TId extends OutputTypeId> = OutputTypeMap[TId] extends Class
  ? OutputTypeMap[TId]
  : never;
