import {
  GraphQLSelectionNodeChildren,
  SuperSetOfNamedObject,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { TypeKind } from '../../type';
import { ComponentSet } from '../component';
import { Unique } from '../unique';

export class UniqueSet extends SuperSetOfNamedObject<Unique> {
  @Memoize()
  public getComponentSet(): ComponentSet {
    return new ComponentSet().concat(
      ...[...this].map(({ componentSet }) => componentSet),
    );
  }

  @Memoize((use: TypeKind = TypeKind.Output) => use)
  public getSelectionNodeChildren(
    use: TypeKind = TypeKind.Output,
  ): GraphQLSelectionNodeChildren {
    return this.getComponentSet().getSelectionNodeChildren(use);
  }
}
