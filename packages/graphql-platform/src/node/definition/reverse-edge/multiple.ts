import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import inflection from 'inflection';
import assert from 'node:assert';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type { OrderingDirection } from '../../statement/ordering/direction.js';
import { MultipleReverseEdgeCreationInput } from '../../type/input/creation/field/reverse-edge/multiple.js';
import { MultipleReverseEdgeCountOrderingInput } from '../../type/input/ordering/expression/reverse-edge-multiple-count.js';
import { MultipleReverseEdgeUpdateInput } from '../../type/input/update/field/reverse-edge/multiple.js';
import type { MultipleReverseEdgeHeadOutputArgs } from '../../type/output/node/field/reverse-edge/multiple-head.js';
import {
  AbstractReverseEdge,
  AbstractReverseEdgeConfig,
} from '../abstract-reverse-edge.js';
import type { Edge } from '../component/edge.js';

export interface MultipleReverseEdgeConfig extends AbstractReverseEdgeConfig {
  /**
   * Optional, used to discriminate the multiple reverse-edge's configuration
   */
  kind?: 'Multiple';

  /**
   * Optional, if the error concerning the name seems illegitimate to you
   *
   * Default: false
   */
  forceName?: utils.OptionalFlag;

  output?: {
    /**
     * Optional, provide some defaults to the outputs' field arguments
     */
    defaultArgs?: {
      [TKey in keyof MultipleReverseEdgeHeadOutputArgs]?: utils.Thunkable<
        MultipleReverseEdgeHeadOutputArgs[TKey]
      >;
    };
  };
}

export class MultipleReverseEdge<
  TConnector extends ConnectorInterface = any,
> extends AbstractReverseEdge<TConnector> {
  public readonly countFieldName: string;

  public constructor(
    originalEdge: Edge<TConnector>,
    name: utils.Name,
    public override readonly config: MultipleReverseEdgeConfig,
    public override readonly configPath: utils.Path,
  ) {
    assert(!originalEdge.isUnique());
    super(originalEdge, name, config, configPath);

    // name
    {
      const forceNameConfig = config.forceName;
      const forceNameConfigPath = utils.addPath(configPath, 'forceName');
      const forceName = utils.getOptionalFlag(
        forceNameConfig,
        false,
        forceNameConfigPath,
      );

      if (!forceName) {
        const pluralizedName = inflection.pluralize(name);

        if (name !== pluralizedName) {
          throw new utils.UnexpectedValueError(
            `a plural (= "${pluralizedName}" ?)`,
            name,
            { path: configPath },
          );
        }
      }
    }

    this.countFieldName = `${inflection.singularize(name)}Count`;
  }

  @Memoize((direction: OrderingDirection) => direction)
  public getOrderingInput(
    direction: OrderingDirection,
  ): MultipleReverseEdgeCountOrderingInput {
    return new MultipleReverseEdgeCountOrderingInput(this, direction);
  }

  @Memoize()
  public override get creationInput():
    | MultipleReverseEdgeCreationInput
    | undefined {
    return MultipleReverseEdgeCreationInput.supports(this)
      ? new MultipleReverseEdgeCreationInput(this)
      : undefined;
  }

  @Memoize()
  public override get updateInput():
    | MultipleReverseEdgeUpdateInput
    | undefined {
    return MultipleReverseEdgeUpdateInput.supports(this)
      ? new MultipleReverseEdgeUpdateInput(this)
      : undefined;
  }
}
