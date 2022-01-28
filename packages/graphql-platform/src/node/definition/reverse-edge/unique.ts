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
import { ReverseEdgeUniqueCreationInput } from '../../type/input/creation/field/reverse-edge/unique.js';
import { ReverseEdgeUniqueUpdateInput } from '../../type/input/update/field/reverse-edge/unique.js';
import {
  AbstractReverseEdge,
  AbstractReverseEdgeConfig,
} from '../abstract-reverse-edge.js';
import type { Edge } from '../component/edge.js';

export interface ReverseEdgeUniqueConfig<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> extends AbstractReverseEdgeConfig<TRequestContext, TConnector> {
  /**
   * Optional, used to discriminate the unique reverse-edge's configuration
   */
  kind?: 'Unique';

  /**
   * Optional, if the error concerning the name seems illegitimate to you
   *
   * Default: false
   */
  forceName?: OptionalFlag;
}

export class ReverseEdgeUnique<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> extends AbstractReverseEdge<TRequestContext, TConnector> {
  public override readonly kind: NonNullable<
    ReverseEdgeUniqueConfig<any, any>['kind']
  > = 'Unique';

  public constructor(
    edge: Edge<TRequestContext, TConnector>,
    name: Name,
    config: ReverseEdgeUniqueConfig<TRequestContext, TConnector>,
    configPath: Path,
  ) {
    assert(edge.isUnique());
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
        const singularizedName = inflection.singularize(name);

        if (name !== singularizedName) {
          throw new UnexpectedConfigError(
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
    | ReverseEdgeUniqueCreationInput
    | undefined {
    return this.head.isMutationEnabled(MutationType.CREATION) ||
      (this.head.isMutationEnabled(MutationType.UPDATE) &&
        this.originalEdge.isMutable())
      ? new ReverseEdgeUniqueCreationInput(this)
      : undefined;
  }

  @Memoize()
  public override get updateInput(): ReverseEdgeUniqueUpdateInput | undefined {
    return this.head.isMutationEnabled(MutationType.CREATION) ||
      (this.head.isMutationEnabled(MutationType.UPDATE) &&
        this.originalEdge.isMutable()) ||
      this.head.isMutationEnabled(MutationType.DELETION)
      ? new ReverseEdgeUniqueUpdateInput(this)
      : undefined;
  }
}
