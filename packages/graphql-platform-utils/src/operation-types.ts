import * as graphql from 'graphql';
import { createGraphQLEnumType } from './graphql.js';

export const operationTypes = Object.freeze([
  graphql.OperationTypeNode.QUERY,
  graphql.OperationTypeNode.MUTATION,
  graphql.OperationTypeNode.SUBSCRIPTION,
] satisfies graphql.OperationTypeNode[]);

export enum MutationType {
  CREATION = 'creation',
  DELETION = 'deletion',
  UPDATE = 'update',
}

export const mutationTypes = Object.freeze([
  MutationType.CREATION,
  MutationType.DELETION,
  MutationType.UPDATE,
] satisfies MutationType[]);

export const MutationTypeType = createGraphQLEnumType(
  'MutationType',
  MutationType,
);
