import { DisconnectReverseEdgeAction } from './disconnect';

export class DisconnectIfExistsReverseEdgeAction extends DisconnectReverseEdgeAction {
  protected readonly ifExists: boolean = true;
}
