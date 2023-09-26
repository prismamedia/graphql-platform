import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import inflection from 'inflection';
import assert from 'node:assert/strict';
import type { ConnectorInterface } from '../../../connector-interface.js';
import { UniqueReverseEdgeCreationInput } from '../../type/input/creation/field/reverse-edge/unique.js';
import { UniqueReverseEdgeUpdateInput } from '../../type/input/update/field/reverse-edge/unique.js';
import {
  AbstractReverseEdge,
  AbstractReverseEdgeConfig,
} from '../abstract-reverse-edge.js';
import type { Edge } from '../component/edge.js';

export interface UniqueReverseEdgeConfig extends AbstractReverseEdgeConfig {
  /**
   * Optional, used to discriminate the unique reverse-edge's configuration
   */
  kind?: 'Unique';

  /**
   * Optional, if the error concerning the name seems illegitimate to you
   *
   * Default: false
   */
  forceName?: utils.OptionalFlag;
}

export class UniqueReverseEdge<
  TConnector extends ConnectorInterface = any,
> extends AbstractReverseEdge<TConnector> {
  public constructor(
    originalEdge: Edge<TConnector>,
    name: utils.Name,
    public override readonly config: UniqueReverseEdgeConfig,
    public override readonly configPath: utils.Path,
  ) {
    assert(originalEdge.isUnique());
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
        const singularizedName = inflection.singularize(name);

        if (name !== singularizedName) {
          throw new utils.UnexpectedValueError(
            `a singular (= "${singularizedName}" ?)`,
            name,
            { path: configPath },
          );
        }
      }
    }
  }

  @Memoize()
  public override get creationInput():
    | UniqueReverseEdgeCreationInput
    | undefined {
    return UniqueReverseEdgeCreationInput.supports(this)
      ? new UniqueReverseEdgeCreationInput(this)
      : undefined;
  }

  @Memoize()
  public override get updateInput(): UniqueReverseEdgeUpdateInput | undefined {
    return UniqueReverseEdgeUpdateInput.supports(this)
      ? new UniqueReverseEdgeUpdateInput(this)
      : undefined;
  }
}
