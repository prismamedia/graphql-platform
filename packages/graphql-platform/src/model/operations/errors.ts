import { MaybePathAwareError, Path } from '@prismamedia/graphql-platform-utils';
import { Model } from '../../model';
import { WhereUniqueInputValue } from '../types/inputs/where-unique';

export class NodeNotFoundError extends MaybePathAwareError {
  public constructor(
    public readonly model: Model,
    public readonly where: WhereUniqueInputValue,
    path: Path,
  ) {
    super(
      `No "${
        model.name
      }" node has been found given the following filter: ${JSON.stringify(
        where,
      )}`,
      path,
    );
  }
}
