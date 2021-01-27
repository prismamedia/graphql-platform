import { DeleteReverseEdgeAction } from './delete';

export class DeleteIfExistsReverseEdgeAction extends DeleteReverseEdgeAction {
  protected readonly ifExists: boolean = true;
}
