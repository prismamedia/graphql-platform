import { Maybe, Merge } from '@prismamedia/graphql-platform-utils';
import { GraphQLFieldConfig } from 'graphql';
import { Memoize } from 'typescript-memoize';
import { AnyBaseContext, BaseContext, Context, CustomContext } from '../../graphql-platform';
import { Resource } from '../resource';
import { Component, ComponentSet } from './component';

export * from './virtual-field/map';
export * from './virtual-field/set';

export type VirtualFieldConfig<
  TCustomContext extends CustomContext = {},
  TBaseContext extends AnyBaseContext = BaseContext
> = Merge<
  GraphQLFieldConfig<any, Context<TCustomContext, TBaseContext>>,
  {
    dependencies?: Maybe<Component['name'][]>;
    dependency?: Maybe<Component['name']>;
  }
>;

export type AnyVirtualFieldConfig = VirtualFieldConfig<any, any>;

export class VirtualField<TConfig extends AnyVirtualFieldConfig = VirtualFieldConfig> {
  readonly dependencySet: ComponentSet;

  public constructor(readonly name: string, readonly config: TConfig, readonly resource: Resource) {
    this.dependencySet = new ComponentSet(
      (typeof this.config.dependency === 'string'
        ? [this.config.dependency]
        : Array.isArray(this.config.dependencies)
        ? this.config.dependencies
        : []
      ).map(dependency => this.resource.getComponentMap().assert(dependency)),
    );
  }

  @Memoize()
  public toString(): string {
    return `${this.resource}.${this.name}`;
  }
}
