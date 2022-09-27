import type * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type { OperationInterface } from '../interface.js';

export interface MutationInterface<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> extends OperationInterface<TRequestContext, TConnector> {
  readonly operationType: graphql.OperationTypeNode.MUTATION;
  readonly mutationTypes: ReadonlyArray<utils.MutationType>;
}
