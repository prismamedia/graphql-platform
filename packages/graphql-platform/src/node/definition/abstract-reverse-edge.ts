import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import inflection from 'inflection';
import type { ConnectorInterface } from '../../connector-interface.js';
import type { Node } from '../../node.js';
import { AbstractReverseEdgeCreationInput } from '../type/input/creation/field/abstract-reverse-edge.js';
import { AbstractReverseEdgeUpdateInput } from '../type/input/update/field/abstract-reverse-edge.js';
import type { Edge } from './component/edge.js';

export interface AbstractReverseEdgeConfig {
  /**
   * Required, the "head"'s name having an edge to this node, ex: { originalEdge: "Article" }
   *
   * Optional, specify the edge's name after a ".", ex: { originalEdge: "Article.category" }
   *
   * Default: the first edge heading to this node
   */
  originalEdge: Node['name'] | `${Node['name']}.${Edge['name']}`;

  /**
   * Optional, provide a description for this reverse-edge
   */
  description?: utils.OptionalDescription;

  /**
   * Optional, either this reverse edge is deprecated or not
   *
   * The information will be shown in all the operations
   */
  deprecated?: utils.OptionalDeprecation;

  /**
   * Optional, either this reverse edge is exposed publicly (in the GraphQL API) or not (only available in the internal API)
   */
  public?: utils.OptionalFlag;
}

export abstract class AbstractReverseEdge<
  TConnector extends ConnectorInterface,
> {
  public readonly tail: Node<any, TConnector>;
  public readonly head: Node<any, TConnector>;
  public readonly description?: string;
  public readonly deprecationReason?: string;
  public readonly pascalCasedName: string;
  public abstract readonly creationInput?: AbstractReverseEdgeCreationInput<any>;
  public abstract readonly updateInput?: AbstractReverseEdgeUpdateInput<any>;

  public constructor(
    public readonly originalEdge: Edge<TConnector>,
    public readonly name: utils.Name,
    protected readonly config: AbstractReverseEdgeConfig,
    protected readonly configPath: utils.Path,
  ) {
    utils.assertName(name, configPath);

    // tail & head
    {
      this.tail = originalEdge.head;
      this.head = originalEdge.tail;
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
        `The "${this.name}" reverse-edge is deprecated`,
        deprecatedConfigPath,
      );
    }

    // Pascal case name
    {
      this.pascalCasedName = inflection.camelize(name, false);
    }
  }

  @Memoize()
  public toString(): string {
    return `${this.tail.name}.${this.name}`;
  }

  @Memoize()
  public isMutable(): boolean {
    return (
      this.head.isCreatable() ||
      this.originalEdge.isMutable() ||
      this.head.isDeletable()
    );
  }

  @Memoize()
  public isUnique(): boolean {
    return this.originalEdge.isUnique();
  }

  @Memoize()
  public isPublic(): boolean {
    const publicConfig = this.config.public;
    const publicConfigPath = utils.addPath(this.configPath, 'public');

    const isPublic = utils.getOptionalFlag(
      publicConfig,
      this.originalEdge.isPublic(),
      publicConfigPath,
    );

    if (isPublic && !this.originalEdge.isPublic()) {
      throw new utils.UnexpectedValueError(
        `not to be "true" as the "${this.originalEdge}" edge is private`,
        publicConfig,
        { path: publicConfigPath },
      );
    }

    return isPublic;
  }

  public isNullable(): boolean {
    return true;
  }

  @Memoize()
  public validateDefinition(): void {
    this.isMutable();
    this.isUnique();
    this.isPublic();
    this.isNullable();

    // Resolve the lazy property
    this.originalEdge.reverseEdge;
  }

  @Memoize()
  public validateTypes(): void {
    this.creationInput?.validate();
    this.updateInput?.validate();
  }
}
