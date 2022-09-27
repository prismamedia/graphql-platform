import * as graphql from 'graphql';

export const operationTypes = [
  graphql.OperationTypeNode.QUERY,
  graphql.OperationTypeNode.MUTATION,
  graphql.OperationTypeNode.SUBSCRIPTION,
] as const;

export enum MutationType {
  CREATION = 'creation',
  DELETION = 'deletion',
  UPDATE = 'update',
}

export const mutationTypes = [
  MutationType.CREATION,
  MutationType.DELETION,
  MutationType.UPDATE,
] as const;
