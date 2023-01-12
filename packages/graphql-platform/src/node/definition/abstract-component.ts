import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import type { JsonValue } from 'type-fest';
import type { ConnectorInterface } from '../../connector-interface.js';
import type { Node } from '../../node.js';
import type { AbstractComponentCreationInput } from '../type/input/creation/field/abstract-component.js';
import type { AbstractComponentUpdateInput } from '../type/input/update/field/abstract-component.js';
import type { Edge } from './component.js';

export type AbstractComponentConfig = {
  /**
   * Optional, provide a description for this component
   */
  description?: utils.OptionalDescription;

  /**
   * Optional, either this component is deprecated or not
   *
   * The information will be shown in all the operations
   */
  deprecated?: utils.OptionalDeprecation;

  /**
   * Optional, either this component is exposed publicly (in the GraphQL API) or not (only available in the internal API)
   */
  public?: utils.OptionalFlag;

  /**
   * Optional, either its value can be "null" or not
   *
   * Default: true
   */
  nullable?: utils.OptionalFlag;

  /**
   * Optional, either its value can be updated or not
   *
   * Default: true
   */
  mutable?: utils.OptionalFlag;
};

export abstract class AbstractComponent<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> {
  public readonly indefinite: string;
  public readonly description?: string;
  public readonly deprecationReason?: string;
  public abstract readonly selection: any;
  public abstract readonly creationInput: AbstractComponentCreationInput<any>;
  public abstract readonly updateInput: AbstractComponentUpdateInput<any>;

  public constructor(
    public readonly node: Node<TRequestContext, TConnector>,
    public readonly name: utils.Name,
    protected readonly config: AbstractComponentConfig,
    protected readonly configPath: utils.Path,
  ) {
    utils.assertName(name, configPath);

    // indefinite
    {
      this.indefinite = utils.indefinite(name);
    }

    // description
    {
      const descriptionConfig = config.description;
      const descriptionConfigPath = utils.addPath(configPath, 'description');

      this.description = utils.getOptionalDescription(
        descriptionConfig,
        descriptionConfigPath,
      );
    }

    // deprecated
    {
      const deprecatedConfig = config.deprecated;
      const deprecatedConfigPath = utils.addPath(configPath, 'deprecated');

      this.deprecationReason = utils.getOptionalDeprecation(
        deprecatedConfig,
        `The "${this.name}" component is deprecated`,
        deprecatedConfigPath,
      );
    }
  }

  @Memoize()
  public toString(): string {
    return `${this.node.name}.${this.name}`;
  }

  @Memoize()
  public get referrerSet(): ReadonlySet<Edge> {
    return new Set(
      this.node.gp.nodes.flatMap((node) =>
        node.edges.filter((edge) =>
          edge.referencedUniqueConstraint.componentSet.has(this as any),
        ),
      ),
    );
  }

  @Memoize()
  public isMutable(): boolean {
    const mutableConfig = this.config.mutable;
    const mutableConfigPath = utils.addPath(this.configPath, 'mutable');

    const isMutable = utils.getOptionalFlag(
      mutableConfig,
      this.node.isMutationEnabled(utils.MutationType.UPDATE),
      mutableConfigPath,
    );

    if (isMutable && !this.node.isMutationEnabled(utils.MutationType.UPDATE)) {
      throw new utils.UnexpectedValueError(
        `not to be "true" as the "${this.node}"'s ${utils.MutationType.UPDATE} is disabled`,
        mutableConfig,
        { path: mutableConfigPath },
      );
    }

    return isMutable;
  }

  @Memoize()
  public isNullable(): boolean {
    const nullableConfig = this.config.nullable;
    const nullableConfigPath = utils.addPath(this.configPath, 'nullable');

    return utils.getOptionalFlag(nullableConfig, true, nullableConfigPath);
  }

  public abstract isPublic(): boolean;

  @Memoize()
  public isIdentifier(): boolean {
    return (
      this.node.identifier.componentSet.size === 1 &&
      this.node.identifier.componentSet.has(this as any)
    );
  }

  @Memoize()
  public isUnique(): boolean {
    return this.node.uniqueConstraints.some(
      ({ componentSet }) =>
        componentSet.size === 1 && componentSet.has(this as any),
    );
  }

  @Memoize()
  public validateDefinition(): void {
    this.referrerSet;
    this.isMutable();
    this.isNullable();
    this.isPublic();
    this.isUnique();
    this.selection;
  }

  @Memoize()
  public validateTypes(): void {
    this.creationInput.validate();
    this.isMutable() && this.updateInput.validate();
  }

  public abstract parseValue(maybeValue: unknown, path?: utils.Path): any;

  public abstract areValuesEqual(a: any, b: any): boolean;

  public abstract serialize(maybeValue: unknown, path?: utils.Path): JsonValue;

  public abstract stringify(maybeValue: unknown, path?: utils.Path): string;
}
