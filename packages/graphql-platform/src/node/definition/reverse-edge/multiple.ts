import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import inflection from 'inflection';
import assert from 'node:assert/strict';
import type { ConnectorInterface } from '../../../connector-interface.js';
import { ReverseEdgeMultipleCreationInput } from '../../type/input/creation/field/reverse-edge/multiple.js';
import { ReverseEdgeMultipleUpdateInput } from '../../type/input/update/field/reverse-edge/multiple.js';
import {
  AbstractReverseEdge,
  AbstractReverseEdgeConfig,
} from '../abstract-reverse-edge.js';
import type { Edge } from '../component/edge.js';

export interface ReverseEdgeMultipleConfig<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> extends AbstractReverseEdgeConfig<TRequestContext, TConnector> {
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

  /**
   * Optional, you can provide this referrer's singular form if the one guessed is not what you expect
   *
   * Default: guessed from the name
   */
  singular?: string;
}

export class ReverseEdgeMultiple<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> extends AbstractReverseEdge<TRequestContext, TConnector> {
  public readonly countFieldName: string;

  public constructor(
    edge: Edge<TRequestContext, TConnector>,
    name: utils.Name,
    public override readonly config: ReverseEdgeMultipleConfig<
      TRequestContext,
      TConnector
    >,
    public override readonly configPath: utils.Path,
  ) {
    assert(!edge.isUnique());
    super(edge, name, config, configPath);

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

  @Memoize()
  public override get creationInput():
    | ReverseEdgeMultipleCreationInput
    | undefined {
    return this.head.isMutationEnabled(utils.MutationType.CREATION) ||
      (this.head.isMutationEnabled(utils.MutationType.UPDATE) &&
        this.originalEdge.isMutable())
      ? new ReverseEdgeMultipleCreationInput(this)
      : undefined;
  }

  @Memoize()
  public override get updateInput():
    | ReverseEdgeMultipleUpdateInput
    | undefined {
    return this.head.isMutationEnabled(utils.MutationType.CREATION) ||
      (this.head.isMutationEnabled(utils.MutationType.UPDATE) &&
        this.originalEdge.isMutable()) ||
      this.head.isMutationEnabled(utils.MutationType.DELETION)
      ? new ReverseEdgeMultipleUpdateInput(this)
      : undefined;
  }
}
