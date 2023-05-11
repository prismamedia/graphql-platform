import * as utils from '@prismamedia/graphql-platform-utils';
import type { Except } from 'type-fest';
import type { Component } from '../../../../definition/component.js';

export abstract class AbstractComponentCreationInput<
  TInputValue,
> extends utils.Input<TInputValue> {
  public constructor(
    public readonly component: Component,
    config: Except<utils.InputConfig<TInputValue>, 'name'>,
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
          component.isPublic() && component.node.isPubliclyCreatable(),
          publicConfigPath,
        ),
      },
      configPath,
    );

    if (this.isPublic()) {
      if (!component.node.isPubliclyCreatable()) {
        throw new utils.UnexpectedValueError(
          `not to be "true" as the ${utils.MutationType.CREATION} is private`,
          publicConfig,
          { path: publicConfigPath },
        );
      }
    } else {
      if (component.node.isPubliclyCreatable() && this.isRequired()) {
        throw new utils.UnexpectedValueError(
          `to be "true" as it is required in the public ${utils.MutationType.CREATION}, you may want to set it "optional: true"`,
          publicConfig,
          { path: publicConfigPath },
        );
      }
    }
  }
}
