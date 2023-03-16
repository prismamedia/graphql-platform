import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import inflection from 'inflection';
import assert from 'node:assert/strict';
import type { ConnectorInterface } from '../../../connector-interface.js';
import { MultipleReverseEdgeCreationInput } from '../../type/input/creation/field/reverse-edge/multiple.js';
import { MultipleReverseEdgeUpdateInput } from '../../type/input/update/field/reverse-edge/multiple.js';
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

  /**
   * Optional, you can provide this referrer's singular form if the one guessed is not what you expect
   *
   * Default: guessed from the name
   */
  singular?: string;
}

export class MultipleReverseEdge<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TContainer extends object = any,
> extends AbstractReverseEdge<TRequestContext, TConnector, TContainer> {
  public readonly countFieldName: string;

  public constructor(
    edge: Edge<TRequestContext, TConnector, TContainer>,
    name: utils.Name,
    public override readonly config: MultipleReverseEdgeConfig,
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
    | MultipleReverseEdgeCreationInput
    | undefined {
    return this.head.isMutationEnabled(utils.MutationType.CREATION) ||
      (this.head.isMutationEnabled(utils.MutationType.UPDATE) &&
        this.originalEdge.isMutable())
      ? new MultipleReverseEdgeCreationInput(this)
      : undefined;
  }

  @Memoize()
  public override get updateInput():
    | MultipleReverseEdgeUpdateInput
    | undefined {
    return this.head.isMutationEnabled(utils.MutationType.CREATION) ||
      (this.head.isMutationEnabled(utils.MutationType.UPDATE) &&
        this.originalEdge.isMutable()) ||
      this.head.isMutationEnabled(utils.MutationType.DELETION)
      ? new MultipleReverseEdgeUpdateInput(this)
      : undefined;
  }
}
