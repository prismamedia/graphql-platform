import { GraphQLSelectionNode, GraphQLSelectionNodeChildren } from '@prismamedia/graphql-platform-utils';
import { Memoize } from 'typescript-memoize';
import { Resource } from '../resource';
import { TypeKind } from '../type';
import { ComponentSet } from './component/set';
import { Component } from './component/types';

export * from './unique/map';
export * from './unique/set';

export interface UniqueFullConfig {
  /**
   * Required, the components list that form the constraint, the order can be important in case it's used to build a database index
   */
  components: string[];

  /**
   * Optional, a name used to identify this constraint, default: computed from the components' name
   */
  name?: string;
}

export type AnyUniqueFullConfig = UniqueFullConfig;

export type UniqueConfig<TConfig extends AnyUniqueFullConfig = UniqueFullConfig> =
  | Component['name']
  | Component['name'][]
  | TConfig;

export class Unique<TConfig extends AnyUniqueFullConfig = UniqueFullConfig> {
  readonly componentSet: ComponentSet;
  readonly name: string;

  constructor(readonly config: UniqueConfig<TConfig>, readonly resource: Resource) {
    const [name = null, componentNames = []] =
      config != null
        ? typeof config === 'string'
          ? [, [config]]
          : Array.isArray(config)
          ? [, config]
          : [config.name, config.components]
        : [];

    if (componentNames.length === 0) {
      throw new Error(
        `A unique constraint has to contain at least one component, none have been provided in the resource "${resource}".}`,
      );
    }

    this.componentSet = new ComponentSet(
      componentNames.map(componentName => {
        const component = resource.getComponentMap().get(componentName);
        if (!component) {
          throw new Error(
            `The component "${componentName}" does not exist in the resource "${resource}", it has been used in a unique constraint.`,
          );
        }

        return component;
      }),
    );

    this.name = name || [...this.componentSet].map(({ name }) => name).join('-');
  }

  @Memoize()
  public isIdentifier(): boolean {
    return this === this.resource.getIdentifier();
  }

  @Memoize()
  public toString(): string {
    return [this.resource.name, this.name].join('.');
  }

  @Memoize()
  public isComposite(): boolean {
    return this.componentSet.size > 1;
  }

  @Memoize()
  public isNullable(): boolean {
    return this.componentSet.every(component => component.isNullable());
  }

  @Memoize()
  public isPublic(): boolean {
    return this.componentSet.every(component => component.isPublic());
  }

  public contains(component: Component): boolean {
    return this.componentSet.has(component);
  }

  @Memoize((use: TypeKind = TypeKind.Output) => use)
  public getSelectionNode(use: TypeKind = TypeKind.Output): GraphQLSelectionNode {
    if (use === TypeKind.Output && !this.isPublic()) {
      throw new Error(`As the unique "${this}"'s components are not public, they can't be selectionned.`);
    }

    return new GraphQLSelectionNode(this.name, {}, this.getSelectionNodeChildren(use));
  }

  @Memoize((use: TypeKind = TypeKind.Output) => use)
  public getSelectionNodeChildren(use: TypeKind = TypeKind.Output): GraphQLSelectionNodeChildren {
    return this.componentSet.getSelectionNodeChildren(use);
  }
}

export type AnyUnique = Unique<any>;
