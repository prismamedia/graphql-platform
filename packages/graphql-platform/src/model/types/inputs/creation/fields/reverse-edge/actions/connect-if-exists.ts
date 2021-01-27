import { ConnectReverseEdgeAction } from './connect';

export class ConnectIfExistsReverseEdgeAction extends ConnectReverseEdgeAction {
  protected readonly ifExists: boolean = true;
}
