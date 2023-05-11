import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
import type { Except } from 'type-fest';
import type { Component } from '../../../../definition/component.js';

export abstract class AbstractComponentUpdateInput<
  TInputValue,
> extends utils.Input<TInputValue> {
  public constructor(
    public readonly component: Component,
    config: Except<utils.InputConfig<TInputValue>, 'name' | 'optional'>,
    configPath: utils.Path,
  ) {
    assert(component.isMutable(), `The "${component}" component is immutable`);

    const publicConfig = config.public;
    const publicConfigPath = utils.addPath(configPath, 'public');

    super(
      {
        description: component.description,
        deprecated: component.deprecationReason,
        ...config,
        name: component.name,
        optional: true,
        nullable: component.isNullable(),
        public: utils.getOptionalFlag(
          publicConfig,
          component.isPublic() && component.node.isPubliclyUpdatable(),
          publicConfigPath,
        ),
      },
      configPath,
    );

    if (this.isPublic()) {
      if (!component.node.isPubliclyUpdatable()) {
        throw new utils.UnexpectedValueError(
          `not to be "true" as the ${utils.MutationType.UPDATE} is private`,
          publicConfig,
          { path: publicConfigPath },
        );
      }
    }
  }
}
