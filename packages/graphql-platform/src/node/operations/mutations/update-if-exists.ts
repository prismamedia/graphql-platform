import { Node } from '../../node';
import { UpdateOperation } from './update';

export class UpdateIfExistsOperation extends UpdateOperation {
  public readonly name = `update${this.node}IfExists`;
  public readonly description = `Deletes one "${this.node}" node then returns it or null if it does not exist`;
  public readonly ifExists = true;

  public constructor(node: Node) {
    super(node, node.config.operations?.update);
  }
}
