import * as utils from '@prismamedia/graphql-platform-utils';
import type { Except, SetOptional } from 'type-fest';
import type {
  Leaf,
  LeafValue,
} from '../../../../../definition/component/leaf.js';
import { AbstractComponentUpdateInput } from '../abstract-component.js';

export type LeafUpdateInputValue = utils.Nillable<LeafValue>;

export type LeafUpdateInputConfig<TValue extends LeafUpdateInputValue = any> =
  Except<SetOptional<utils.InputConfig<TValue>, 'type'>, 'name' | 'optional'>;

export class LeafUpdateInput extends AbstractComponentUpdateInput<LeafUpdateInputValue> {
  public constructor(public readonly leaf: Leaf) {
    const config = leaf.config[utils.MutationType.UPDATE];
    const configPath = utils.addPath(
      leaf.configPath,
      utils.MutationType.UPDATE,
    );

    super(
      leaf,
      {
        type: leaf.type,
        ...(leaf.customParser && {
          parser: (value, path) =>
            leaf.customParser!(value, utils.MutationType.UPDATE, path),
        }),
        ...config,
      },
      configPath,
    );
  }
}
