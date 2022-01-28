import {
  addPath,
  assertName,
  getOptionalDeprecation,
  getOptionalDescription,
  getOptionalFlag,
  indefinite,
  MutationType,
  Nillable,
  UnexpectedConfigError,
  type Name,
  type OptionalDeprecation,
  type OptionalDescription,
  type OptionalFlag,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import type { ConnectorInterface } from '../../connector-interface.js';
import type { Node } from '../../node.js';
import type { AbstractComponentCreationInput } from '../type/input/creation/field/abstract-component.js';
import type { AbstractComponentUpdateInput } from '../type/input/update/field/abstract-component.js';
import type { ComponentUpdate, ComponentValue, Edge } from './component.js';

export type AbstractComponentConfig = {
  /**
   * Optional, provide a description for this component
   */
  description?: OptionalDescription;

  /**
   * Optional, either this component is deprecated or not
   *
   * The information will be shown in all the operations
   */
  deprecated?: OptionalDeprecation;

  /**
   * Optional, either this component is exposed publicly (in the GraphQL API) or not (only available in the internal API)
   */
  public?: OptionalFlag;

  /**
   * Optional, either its value can be "null" or not
   *
   * Default: true
   */
  nullable?: OptionalFlag;

  /**
   * Optional, either its value can be updated or not
   *
   * Default: true
   */
  mutable?: OptionalFlag;
};

export abstract class AbstractComponent<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> {
  public readonly indefinite: string;
  public readonly description?: string;
  public readonly deprecationReason?: string;
  public abstract readonly kind: string;
  public abstract readonly selection: any;
  public abstract readonly creationInput?: AbstractComponentCreationInput<any>;
  public abstract readonly updateInput?: AbstractComponentUpdateInput<any>;

  public constructor(
    public readonly node: Node<TRequestContext, TConnector>,
    public readonly name: Name,
    protected readonly config: AbstractComponentConfig,
    protected readonly configPath: Path,
  ) {
    assertName(name, configPath);

    // indefinite
    {
      this.indefinite = indefinite(name);
    }

    // description
    {
      const descriptionConfig = config.description;
      const descriptionConfigPath = addPath(configPath, 'description');

      this.description = getOptionalDescription(
        descriptionConfig,
        descriptionConfigPath,
      );
    }

    // deprecated
    {
      const deprecatedConfig = config.deprecated;
      const deprecatedConfigPath = addPath(configPath, 'deprecated');

      this.deprecationReason = getOptionalDeprecation(
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
      Array.from(this.node.gp.nodesByName.values()).flatMap((node) =>
        Array.from(node.edgesByName.values()).filter((edge) =>
          edge.referencedUniqueConstraint.componentSet.has(this as any),
        ),
      ),
    );
  }

  @Memoize()
  public isMutable(): boolean {
    const mutableConfig = this.config.mutable;
    const mutableConfigPath = addPath(this.configPath, 'mutable');

    const isMutable = getOptionalFlag(
      mutableConfig,
      this.node.isMutationEnabled(MutationType.UPDATE),
      mutableConfigPath,
    );

    if (isMutable && !this.node.isMutationEnabled(MutationType.UPDATE)) {
      throw new UnexpectedConfigError(
        `not to be "true" as the "${this.node}"'s ${MutationType.UPDATE} is disabled`,
        mutableConfig,
        { path: mutableConfigPath },
      );
    }

    return isMutable;
  }

  @Memoize()
  public isNullable(): boolean {
    const nullableConfig = this.config.nullable;
    const nullableConfigPath = addPath(this.configPath, 'nullable');

    return getOptionalFlag(nullableConfig, true, nullableConfigPath);
  }

  public abstract isPublic(): boolean;

  @Memoize()
  public isIdentifier(): boolean {
    return (
      this.node.identifier.componentsByName.size === 1 &&
      this.node.identifier.componentsByName.has(this.name)
    );
  }

  @Memoize()
  public isUnique(): boolean {
    return [...this.node.uniqueConstraintsByName.values()].some(
      ({ componentsByName }) =>
        componentsByName.size === 1 && componentsByName.has(this.name),
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
    this.creationInput?.validate();
    this.updateInput?.validate();
  }

  public abstract parseValue(maybeValue: unknown, path?: Path): ComponentValue;

  public abstract parseUpdate(
    maybeUpdate: unknown,
    path?: Path,
  ): ComponentUpdate;

  public abstract areValuesEqual(
    a: Nillable<ComponentValue>,
    b: Nillable<ComponentValue>,
  ): boolean;
}
