import * as utils from '@prismamedia/graphql-platform-utils';
import type { SetOptional } from 'type-fest';
import type {
  Leaf,
  LeafValue,
} from '../../../../../definition/component/leaf.js';
import type { MutationContext } from '../../../../../operation/mutation/context.js';
import { AbstractComponentCreationInput } from '../abstract-component.js';

export type LeafCreationInputConfig = Omit<
  SetOptional<utils.InputConfig<LeafValue | undefined>, 'type'>,
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
        ...leaf.config[utils.MutationType.CREATION],
      },
      utils.addPath(leaf.configPath, utils.MutationType.CREATION),
    );
  }

  public override async resolveComponentValue(
    inputValue: utils.NonNillable<LeafValue>,
    _context: MutationContext,
    _path: utils.Path,
  ): Promise<LeafValue | undefined> {
    return inputValue;
  }
}
