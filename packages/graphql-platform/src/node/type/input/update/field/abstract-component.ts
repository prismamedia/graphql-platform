import {
  addPath,
  getOptionalFlag,
  Input,
  MutationType,
  UnexpectedConfigError,
  type InputConfig,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
import type {
  Component,
  ComponentUpdate,
} from '../../../../definition/component.js';
import type { MutationContext } from '../../../../operation/mutation/context.js';

export abstract class AbstractComponentUpdateInput<
  TInputValue,
> extends Input<TInputValue> {
  public constructor(
    public readonly component: Component,
    config: Omit<InputConfig<TInputValue>, 'name' | 'optional'>,
    configPath: Path,
  ) {
    assert(component.isMutable());

    const publicConfig = config.public;
    const publicConfigPath = addPath(configPath, 'public');

    super(
      {
        description: component.description,
        deprecated: component.deprecationReason,
        ...config,
        name: component.name,
        public: getOptionalFlag(
          publicConfig,
          component.isPublic() &&
            component.node.isMutationPublic(MutationType.UPDATE),
          publicConfigPath,
        ),
        optional: true,
      },
      configPath,
    );

    if (this.isPublic()) {
      if (!component.node.isMutationPublic(MutationType.UPDATE)) {
        throw new UnexpectedConfigError(
          `not to be "true" as the "${component.node.name}"'s ${MutationType.UPDATE} is private`,
          publicConfig,
          { path: publicConfigPath },
        );
      }
    }
  }

  public abstract resolveComponentUpdate(
    inputValue: TInputValue,
    context: MutationContext,
    path: Path,
  ): Promise<ComponentUpdate | undefined>;
}
