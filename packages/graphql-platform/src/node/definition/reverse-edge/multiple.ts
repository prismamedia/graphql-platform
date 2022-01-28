import {
  addPath,
  getOptionalFlag,
  MutationType,
  OptionalFlag,
  UnexpectedConfigError,
  type Name,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
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
  forceName?: OptionalFlag;

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
  public override readonly kind: NonNullable<
    ReverseEdgeMultipleConfig<any, any>['kind']
  > = 'Multiple';
  public readonly countFieldName: string;

  public constructor(
    edge: Edge<TRequestContext, TConnector>,
    name: Name,
    config: ReverseEdgeMultipleConfig<TRequestContext, TConnector>,
    configPath: Path,
  ) {
    assert(!edge.isUnique());
    super(edge, name, config, configPath);

    // name
    {
      const forceNameConfig = config.forceName;
      const forceNameConfigPath = addPath(configPath, 'forceName');
      const forceName = getOptionalFlag(
        forceNameConfig,
        false,
        forceNameConfigPath,
      );

      if (!forceName) {
        const pluralizedName = inflection.pluralize(name);

        if (name !== pluralizedName) {
          throw new UnexpectedConfigError(
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
    return this.head.isMutationEnabled(MutationType.CREATION) ||
      (this.head.isMutationEnabled(MutationType.UPDATE) &&
        this.originalEdge.isMutable())
      ? new ReverseEdgeMultipleCreationInput(this)
      : undefined;
  }

  @Memoize()
  public override get updateInput():
    | ReverseEdgeMultipleUpdateInput
    | undefined {
    return this.head.isMutationEnabled(MutationType.CREATION) ||
      (this.head.isMutationEnabled(MutationType.UPDATE) &&
        this.originalEdge.isMutable()) ||
      this.head.isMutationEnabled(MutationType.DELETION)
      ? new ReverseEdgeMultipleUpdateInput(this)
      : undefined;
  }
}
