import { camelize } from 'inflection';
import { Node } from '../../node';
import { GetOperation } from './get';

export class GetIfExistsOperation extends GetOperation {
  public readonly name = `${camelize(this.node.name, true)}IfExists`;
  public readonly description = `Retrieves one "${this.node}" node, returns null if it does not exist`;
  public readonly ifExists = true;

  public constructor(node: Node) {
    super(node, node.config.operations?.get);
  }
}
