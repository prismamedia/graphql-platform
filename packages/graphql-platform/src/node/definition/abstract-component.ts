import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter, MMethod } from '@prismamedia/memoize';
import type { ConnectorInterface } from '../../connector-interface.js';
import type { Node } from '../../node.js';
import type { AbstractComponentCreationInput } from '../type/input/creation/field/abstract-component.js';
import type { AbstractComponentUpdateInput } from '../type/input/update/field/abstract-component.js';
import { Edge } from './component.js';

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

export abstract class AbstractComponent<TConnector extends ConnectorInterface> {
  public readonly indefinite: string;
  public readonly description?: string;
  public readonly deprecationReason?: string;
  public abstract readonly selection: any;
  public abstract readonly creationInput: AbstractComponentCreationInput<any>;
  public abstract readonly updateInput?: AbstractComponentUpdateInput<any>;

  public constructor(
    public readonly node: Node<any, TConnector>,
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

  @MMethod()
  public toString(): string {
    return `${this.node.name}.${this.name}`;
  }

  @MGetter
  public get referrerSet(): ReadonlySet<Edge<TConnector>> {
    return new Set(
      this.node.gp.nodesByName
        .values()
        .flatMap((node) =>
          node.edgesByName
            .values()
            .filter((edge) =>
              edge.referencedUniqueConstraint.componentSet.has(this as any),
            ),
        ),
    );
  }

  @MMethod()
  public isMutable(): boolean {
    const mutableConfig = this.config.mutable;
    const mutableConfigPath = utils.addPath(this.configPath, 'mutable');

    const isMutable = utils.getOptionalFlag(
      mutableConfig,
      this.node.isUpdatable(),
      mutableConfigPath,
    );

    if (isMutable && !this.node.isUpdatable()) {
      throw new utils.UnexpectedValueError(
        `not to be "true" as the "${this.node}"'s ${utils.MutationType.UPDATE} is disabled`,
        mutableConfig,
        { path: mutableConfigPath },
      );
    }

    return isMutable;
  }

  @MMethod()
  public isNullable(): boolean {
    const nullableConfig = this.config.nullable;
    const nullableConfigPath = utils.addPath(this.configPath, 'nullable');

    return utils.getOptionalFlag(nullableConfig, true, nullableConfigPath);
  }

  public abstract isPublic(): boolean;

  @MMethod()
  public isMainIdentifier(): boolean {
    return (
      this.node.mainIdentifier.componentSet.size === 1 &&
      this.node.mainIdentifier.componentSet.has(this as any)
    );
  }

  @MMethod()
  public isUnique(): boolean {
    return this.node.uniqueConstraintsByName
      .values()
      .some(
        ({ componentSet }) =>
          componentSet.size === 1 && componentSet.has(this as any),
      );
  }

  @MMethod()
  public validateDefinition(): void {
    this.referrerSet;
    this.isMutable();
    this.isNullable();
    this.isPublic();
    this.isMainIdentifier();
    this.isUnique();
    this.selection;
  }

  @MMethod()
  public validateTypes(): void {
    this.creationInput.validate();
    this.updateInput?.validate();
  }
}
