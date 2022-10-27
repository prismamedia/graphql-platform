import * as utils from '@prismamedia/graphql-platform-utils';
import type {
  Component,
  ComponentValue,
} from '../../../../definition/component.js';
import type { MutationContext } from '../../../../operation/mutation/context.js';

export abstract class AbstractComponentCreationInput<
  TInputValue,
> extends utils.Input<TInputValue> {
  public constructor(
    public readonly component: Component,
    config: Omit<utils.InputConfig<TInputValue>, 'name'>,
    configPath: utils.Path,
  ) {
    const publicConfig = config.public;
    const publicConfigPath = utils.addPath(configPath, 'public');

    super(
      {
        description: component.description,
        deprecated: component.deprecationReason,
        optional: component.isNullable(),
        nullable: component.isNullable(),
        ...config,
        name: component.name,
        public: utils.getOptionalFlag(
          publicConfig,
          component.isPublic() &&
            component.node.isMutationPublic(utils.MutationType.CREATION),
          publicConfigPath,
        ),
      },
      configPath,
    );

    if (this.isPublic()) {
      if (!component.node.isMutationPublic(utils.MutationType.CREATION)) {
        throw new utils.UnexpectedConfigError(
          `not to be "true" as the ${utils.MutationType.CREATION} is private`,
          publicConfig,
          { path: publicConfigPath },
        );
      }
    } else {
      if (
        component.node.isMutationPublic(utils.MutationType.CREATION) &&
        this.isRequired()
      ) {
        throw new utils.UnexpectedConfigError(
          `to be "true" as it is required in the public ${utils.MutationType.CREATION}, you may want to set it "optional: true"`,
          publicConfig,
          { path: publicConfigPath },
        );
      }
    }
  }

  public abstract resolveComponentValue(
    inputValue: Readonly<TInputValue>,
    context: MutationContext,
    path: utils.Path,
  ): Promise<ComponentValue | undefined>;
}
