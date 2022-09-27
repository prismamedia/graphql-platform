import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
import type {
  Component,
  ComponentUpdate,
} from '../../../../definition/component.js';
import type { MutationContext } from '../../../../operation/mutation/context.js';

export abstract class AbstractComponentUpdateInput<
  TInputValue,
> extends utils.Input<TInputValue> {
  public constructor(
    public readonly component: Component,
    config: Omit<utils.InputConfig<TInputValue>, 'name' | 'optional'>,
    configPath: utils.Path,
  ) {
    assert(component.isMutable());

    const publicConfig = config.public;
    const publicConfigPath = utils.addPath(configPath, 'public');

    super(
      {
        description: component.description,
        deprecated: component.deprecationReason,
        ...config,
        name: component.name,
        public: utils.getOptionalFlag(
          publicConfig,
          component.isPublic() &&
            component.node.isMutationPublic(utils.MutationType.UPDATE),
          publicConfigPath,
        ),
        optional: true,
      },
      configPath,
    );

    if (this.isPublic()) {
      if (!component.node.isMutationPublic(utils.MutationType.UPDATE)) {
        throw new utils.UnexpectedConfigError(
          `not to be "true" as the "${component.node.name}"'s ${utils.MutationType.UPDATE} is private`,
          publicConfig,
          { path: publicConfigPath },
        );
      }
    }
  }

  public abstract resolveComponentUpdate(
    inputValue: TInputValue,
    context: MutationContext,
    path: utils.Path,
  ): Promise<ComponentUpdate | undefined>;
}
