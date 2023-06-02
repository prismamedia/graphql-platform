import * as graphql from 'graphql';
import { UnexpectedValueError } from './error.js';
import { createGraphQLEnumType } from './graphql.js';
import type { Path } from './path.js';

export const operationTypes: ReadonlyArray<graphql.OperationTypeNode> = [
  graphql.OperationTypeNode.QUERY,
  graphql.OperationTypeNode.MUTATION,
  graphql.OperationTypeNode.SUBSCRIPTION,
];

export const operationTypeSet: ReadonlySet<graphql.OperationTypeNode> = new Set(
  operationTypes,
);

export function assertOperationType(
  maybeOperationType: unknown,
  path?: Path,
): asserts maybeOperationType is graphql.OperationTypeNode {
  if (!operationTypeSet.has(maybeOperationType as any)) {
    throw new UnexpectedValueError(
      `an operation-type among "${operationTypes.join(', ')}"`,
      maybeOperationType,
      { path },
    );
  }
}

export enum MutationType {
  CREATION = 'creation',
  DELETION = 'deletion',
  UPDATE = 'update',
}

export const mutationTypes: ReadonlyArray<MutationType> = [
  MutationType.CREATION,
  MutationType.DELETION,
  MutationType.UPDATE,
];

export const MutationTypeType = createGraphQLEnumType(
  'MutationType',
  MutationType,
);
