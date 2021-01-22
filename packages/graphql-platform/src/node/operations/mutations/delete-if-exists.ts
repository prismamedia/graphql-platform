import { Node } from '../../node';
import { DeleteOperation } from './delete';

export class DeleteIfExistsOperation extends DeleteOperation {
  public readonly name = `delete${this.node}IfExists`;
  public readonly description = `Deletes one "${this.node}" node then returns it or null if it does not exist`;
  public readonly ifExists = true;

  public constructor(node: Node) {
    super(node, node.config.operations?.delete);
  }
}
