import { ConnectorInterface } from '../../../../connector';
import { AbstractMutationConfig } from '../abstract';

export interface DeleteOperationConfig<
  TRequestContext,
  TConnector extends ConnectorInterface,
> extends AbstractMutationConfig {}
