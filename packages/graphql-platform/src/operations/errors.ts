import { MaybePathAwareError, Path } from '@prismamedia/graphql-platform-utils';
import type { Node, TWhereUniqueInputValue } from '../node';

export class NodeNotFoundError extends MaybePathAwareError {
  public constructor(node: Node, where: TWhereUniqueInputValue, path?: Path) {
    super(
      `No "${node.name}" node has been found given the filter: ${JSON.stringify(
        where,
      )}`,
      path,
    );
  }
}
