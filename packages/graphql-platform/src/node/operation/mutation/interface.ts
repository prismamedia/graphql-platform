import type * as utils from '@prismamedia/graphql-platform-utils';
import type * as graphql from 'graphql';
import type { OperationInterface } from '../interface.js';

export interface MutationInterface<TRequestContext extends object = any>
  extends OperationInterface<TRequestContext> {
  readonly operationType: graphql.OperationTypeNode.MUTATION;
  readonly mutationTypes: ReadonlyArray<utils.MutationType>;
}
