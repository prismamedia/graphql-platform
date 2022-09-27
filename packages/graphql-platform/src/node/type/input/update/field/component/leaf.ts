import * as utils from '@prismamedia/graphql-platform-utils';
import type { SetOptional } from 'type-fest';
import type {
  Leaf,
  LeafUpdate,
  LeafValue,
} from '../../../../../definition/component/leaf.js';
import type { MutationContext } from '../../../../../operation/mutation/context.js';
import { AbstractComponentUpdateInput } from '../abstract-component.js';

export type LeafUpdateInputConfig = Omit<
  SetOptional<utils.InputConfig<LeafUpdate | undefined>, 'type'>,
  'name' | 'optional'
>;

export class LeafUpdateInput extends AbstractComponentUpdateInput<
  LeafValue | undefined
> {
  public constructor(public readonly leaf: Leaf) {
    super(
      leaf,
      {
        type: utils.nonNullableInputTypeDecorator(
          leaf.type,
          !leaf.isNullable(),
        ),
        ...leaf.config[utils.MutationType.UPDATE],
      },
      utils.addPath(leaf.configPath, utils.MutationType.UPDATE),
    );
  }

  public override async resolveComponentUpdate(
    inputValue: LeafValue | undefined,
    _context: MutationContext,
    _path: utils.Path,
  ): Promise<LeafValue | undefined> {
    return inputValue;
  }
}
