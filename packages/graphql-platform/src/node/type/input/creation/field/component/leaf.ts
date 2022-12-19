import * as utils from '@prismamedia/graphql-platform-utils';
import type { Except, SetOptional } from 'type-fest';
import type {
  Leaf,
  LeafValue,
} from '../../../../../definition/component/leaf.js';
import { AbstractComponentCreationInput } from '../abstract-component.js';

export type LeafCreationInputValue = utils.Nillable<LeafValue>;

export type LeafCreationInputConfig = Except<
  SetOptional<utils.InputConfig<LeafCreationInputValue>, 'type'>,
  'name'
>;

export class LeafCreationInput extends AbstractComponentCreationInput<LeafCreationInputValue> {
  public constructor(public readonly leaf: Leaf) {
    const config = leaf.config[utils.MutationType.CREATION];
    const configPath = utils.addPath(
      leaf.configPath,
      utils.MutationType.CREATION,
    );

    super(
      leaf,
      { type: leaf.type, parser: leaf.customParser, ...config },
      configPath,
    );
  }
}
