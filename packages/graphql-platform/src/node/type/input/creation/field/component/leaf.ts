import {
  addPath,
  InputConfig,
  MutationType,
  type NonNillable,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import type { SetOptional } from 'type-fest';
import type {
  Leaf,
  LeafValue,
} from '../../../../../definition/component/leaf.js';
import type { MutationContext } from '../../../../../operation/mutation/context.js';
import { AbstractComponentCreationInput } from '../abstract-component.js';

export type LeafCreationInputConfig = Omit<
  SetOptional<InputConfig<LeafValue | undefined>, 'type'>,
  'name'
>;

export class LeafCreationInput extends AbstractComponentCreationInput<
  LeafValue | undefined
> {
  public constructor(public readonly leaf: Leaf) {
    super(
      leaf,
      {
        type: leaf.type,
        ...leaf.config[MutationType.CREATION],
      },
      addPath(leaf.configPath, MutationType.CREATION),
    );
  }

  public override async resolveComponentValue(
    inputValue: NonNillable<LeafValue>,
    _context: MutationContext,
    _path: Path,
  ): Promise<LeafValue | undefined> {
    return inputValue;
  }
}
