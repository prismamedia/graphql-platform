import {
  addPath,
  getOptionalFlag,
  Input,
  MutationType,
  UnexpectedConfigError,
  type InputConfig,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import type {
  Component,
  ComponentValue,
} from '../../../../definition/component.js';
import type { MutationContext } from '../../../../operation/mutation/context.js';

export abstract class AbstractComponentCreationInput<
  TInputValue,
> extends Input<TInputValue> {
  public constructor(
    public readonly component: Component,
    config: Omit<InputConfig<TInputValue>, 'name'>,
    configPath: Path,
  ) {
    const publicConfig = config.public;
    const publicConfigPath = addPath(configPath, 'public');

    super(
      {
        description: component.description,
        deprecated: component.deprecationReason,
        optional: component.isNullable(),
        nullable: component.isNullable(),
        ...config,
        name: component.name,
        public: getOptionalFlag(
          publicConfig,
          component.isPublic() &&
            component.node.isMutationPublic(MutationType.CREATION),
          publicConfigPath,
        ),
      },
      configPath,
    );

    if (this.isPublic()) {
      if (!component.node.isMutationPublic(MutationType.CREATION)) {
        throw new UnexpectedConfigError(
          `not to be "true" as the "${component.node.name}"'s ${MutationType.CREATION} is private`,
          publicConfig,
          { path: publicConfigPath },
        );
      }
    } else {
      if (
        component.node.isMutationPublic(MutationType.CREATION) &&
        this.isRequired()
      ) {
        throw new UnexpectedConfigError(
          `to be "true" as the "${component.name}" is required in the public "${component.node.name}"'s ${MutationType.CREATION}`,
          publicConfig,
          { path: publicConfigPath },
        );
      }
    }
  }

  public abstract resolveComponentValue(
    inputValue: Readonly<TInputValue>,
    context: MutationContext,
    path: Path,
  ): Promise<ComponentValue | undefined>;
}
