import { MaybePathAwareError, Path } from '@prismamedia/graphql-platform-utils';
import type { Node, TWhereUniqueNodeValue } from '../node';

export class NodeNotFoundError extends MaybePathAwareError {
  public constructor(node: Node, where: TWhereUniqueNodeValue, path?: Path) {
    super(
      `No "${node.name}" node has been found given the filter: ${JSON.stringify(
        where,
      )}`,
      path,
    );
  }
}
