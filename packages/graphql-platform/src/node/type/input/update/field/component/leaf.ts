import {
  addPath,
  InputConfig,
  MutationType,
  nonNullableInputTypeDecorator,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import type { SetOptional } from 'type-fest';
import type {
  Leaf,
  LeafUpdate,
  LeafValue,
} from '../../../../../definition/component/leaf.js';
import type { MutationContext } from '../../../../../operation/mutation/context.js';
import { AbstractComponentUpdateInput } from '../abstract-component.js';

export type LeafUpdateInputConfig = Omit<
  SetOptional<InputConfig<LeafUpdate | undefined>, 'type'>,
  'name' | 'optional'
>;

export class LeafUpdateInput extends AbstractComponentUpdateInput<
  LeafValue | undefined
> {
  public constructor(public readonly leaf: Leaf) {
    super(
      leaf,
      {
        type: nonNullableInputTypeDecorator(leaf.type, !leaf.isNullable()),
        ...leaf.config[MutationType.UPDATE],
      },
      addPath(leaf.configPath, MutationType.UPDATE),
    );
  }

  public override async resolveComponentUpdate(
    inputValue: LeafValue | undefined,
    _context: MutationContext,
    _path: Path,
  ): Promise<LeafValue | undefined> {
    return inputValue;
  }
}
