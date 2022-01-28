import {
  addPath,
  ConfigError,
  getOptionalFlag,
  MutationType,
  Name,
  Path,
  UnexpectedConfigError,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import inflection from 'inflection';
import type {
  ConnectorConfigOverrideKind,
  ConnectorInterface,
  GetConnectorConfigOverride,
} from '../../../connector-interface.js';
import type { Node } from '../../../node.js';
import { EdgeHeadSelection } from '../../statement/selection/expression/component/edge-head.js';
import {
  EdgeCreationInput,
  EdgeCreationInputConfig,
} from '../../type/input/creation/field/component/edge.js';
import {
  EdgeUpdateInput,
  EdgeUpdateInputConfig,
} from '../../type/input/update/field/component/edge.js';
import {
  AbstractComponent,
  AbstractComponentConfig,
} from '../abstract-component.js';
import { ReverseEdge } from '../reverse-edge.js';
import type {
  UniqueConstraint,
  UniqueConstraintValue,
} from '../unique-constraint.js';

export type EdgeValue = null | UniqueConstraintValue;

export type EdgeUpdate = EdgeValue;

export enum OnHeadDeletion {
  RESTRICT = 'RESTRICT',
  SET_NULL = 'SET_NULL',
  CASCADE = 'CASCADE',
}

export type EdgeConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> = AbstractComponentConfig & {
  kind: 'Edge';

  /**
   * Required, the "head"'s name, ex: { kind: "Edge", head: "Category" }
   *
   * Optional, specify the referenced unique constraint's name after a ".", ex: { kind: "Edge", head: "Category.parent-title" }
   *
   * Default: the "head"'s identifier (= its first unique constraint)
   */
  head: Node['name'] | `${Node['name']}.${UniqueConstraint['name']}`;

  /**
   * Optional, what to do if the edge is "beheaded"
   *
   * Default: RESTRICT
   */
  onHeadDeletion?: OnHeadDeletion;

  /**
   * Optional, fine-tune the "creation"'s input
   */
  [MutationType.CREATION]?: EdgeCreationInputConfig;

  /**
   * Optional, fine-tune the "update"'s input
   */
  [MutationType.UPDATE]?: EdgeUpdateInputConfig;
} & GetConnectorConfigOverride<TConnector, ConnectorConfigOverrideKind.EDGE>;

/**
 * A directed edge is a link to another node
 *
 * - defines a "many-to-one / n:1" relationship if the reference is not unique
 * - defines a "one-to-one / 1:1" relationship if the reference is unique
 *
 * @see https://en.wikipedia.org/wiki/Glossary_of_graph_theory#edge
 */
export class Edge<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> extends AbstractComponent<TRequestContext, TConnector> {
  public override readonly kind: EdgeConfig['kind'] = 'Edge';
  readonly #headConfigPath: Path;
  readonly #nodeHeadConfig: string;
  readonly #uniqueConstraintHeadConfig?: string;
  public readonly pascalCasedName: string;
  public readonly onHeadDeletion: OnHeadDeletion;

  public constructor(
    public readonly tail: Node<TRequestContext, TConnector>,
    name: Name,
    public override readonly config: EdgeConfig<TRequestContext, TConnector>,
    public override readonly configPath: Path,
  ) {
    super(tail, name, config, configPath);

    // Pascal case name
    {
      this.pascalCasedName = inflection.camelize(name, false);
    }

    // head
    {
      const headConfig = config.head;
      this.#headConfigPath = addPath(configPath, 'head');

      if (typeof headConfig !== 'string' || !headConfig) {
        throw new UnexpectedConfigError(`a non-empty string`, headConfig, {
          path: this.#headConfigPath,
        });
      }

      [this.#nodeHeadConfig, this.#uniqueConstraintHeadConfig] =
        headConfig.split('.');
    }

    // onHeadDeletion
    {
      const onHeadDeletionConfig = config.onHeadDeletion;
      const onHeadDeletionConfigPath = addPath(configPath, 'onHeadDeletion');

      if (onHeadDeletionConfig) {
        switch (onHeadDeletionConfig) {
          case OnHeadDeletion.SET_NULL: {
            if (!this.isMutable()) {
              throw new UnexpectedConfigError(
                `not to be "${OnHeadDeletion.SET_NULL}" as the edge "${this}" is immutable`,
                onHeadDeletionConfig,
                { path: onHeadDeletionConfigPath },
              );
            } else if (!this.isNullable()) {
              throw new UnexpectedConfigError(
                `not to be "${OnHeadDeletion.SET_NULL}" as the edge "${this}" is not nullable`,
                onHeadDeletionConfig,
                { path: onHeadDeletionConfigPath },
              );
            }
            break;
          }

          case OnHeadDeletion.CASCADE: {
            if (!this.node.isMutationEnabled(MutationType.DELETION)) {
              throw new UnexpectedConfigError(
                `not to be "${OnHeadDeletion.CASCADE}" as the node "${this.node}" cannot be deleted`,
                onHeadDeletionConfig,
                { path: onHeadDeletionConfigPath },
              );
            }
            break;
          }
        }
      }

      this.onHeadDeletion = onHeadDeletionConfig ?? OnHeadDeletion.RESTRICT;
    }
  }

  @Memoize()
  public get head(): Node<TRequestContext, TConnector> {
    const node = this.node.gp.nodesByName.get(this.#nodeHeadConfig);
    if (!node) {
      throw new UnexpectedConfigError(
        `a "node"'s name among "${[...this.node.gp.nodesByName.keys()].join(
          ', ',
        )}"`,
        this.#nodeHeadConfig,
        { path: this.#headConfigPath },
      );
    }

    return node;
  }

  @Memoize()
  public get referencedUniqueConstraint(): UniqueConstraint<
    TRequestContext,
    TConnector
  > {
    let referencedUniqueConstraint: UniqueConstraint;

    if (this.#uniqueConstraintHeadConfig) {
      const uniqueConstraint = this.head.uniqueConstraintsByName.get(
        this.#uniqueConstraintHeadConfig,
      );

      if (!uniqueConstraint) {
        throw new UnexpectedConfigError(
          `a "unique-constraint"'s name among "${[
            ...this.head.uniqueConstraintsByName.keys(),
          ].join(', ')}"`,
          this.#uniqueConstraintHeadConfig,
          { path: this.#headConfigPath },
        );
      }

      referencedUniqueConstraint = uniqueConstraint;
    } else {
      referencedUniqueConstraint = this.head.identifier;
    }

    if (
      [...referencedUniqueConstraint.componentsByName.values()].some(
        (component) => component instanceof Edge && component === this,
      )
    ) {
      throw new UnexpectedConfigError(
        `a "unique-constraint" not refering itself`,
        this.#uniqueConstraintHeadConfig,
        { path: this.#headConfigPath },
      );
    }

    // Nullable "unique-constraint" are not yet support
    if (referencedUniqueConstraint.isNullable()) {
      throw new UnexpectedConfigError(
        `an non-nullable "unique-constraint"`,
        this.#uniqueConstraintHeadConfig,
        { path: this.#headConfigPath },
      );
    }

    // Mutable "unique-constraint" are not yet support as it is not trivial to keep track of the updates
    if (referencedUniqueConstraint.isMutable()) {
      throw new UnexpectedConfigError(
        `an immutable "unique-constraint"`,
        this.#uniqueConstraintHeadConfig,
        { path: this.#headConfigPath },
      );
    }

    return referencedUniqueConstraint;
  }

  @Memoize()
  public get prioritizedHeadUniqueConstraintSet(): ReadonlySet<
    UniqueConstraint<TRequestContext, TConnector>
  > {
    return new Set([
      this.referencedUniqueConstraint,
      ...this.head.uniqueConstraintsByName.values(),
    ]);
  }

  @Memoize()
  public override get selection(): EdgeHeadSelection {
    return new EdgeHeadSelection(
      this,
      this.referencedUniqueConstraint.selection,
    );
  }

  public parseValue(
    maybeValue: unknown,
    path: Path = addPath(undefined, this.toString()),
  ): EdgeValue {
    if (maybeValue === undefined) {
      throw new UnexpectedValueError(
        `a non-undefined "${this.referencedUniqueConstraint}"`,
        maybeValue,
        { path },
      );
    } else if (maybeValue === null) {
      if (!this.isNullable()) {
        throw new UnexpectedValueError(
          `a non-null "${this.referencedUniqueConstraint}"`,
          maybeValue,
          { path },
        );
      }

      return null;
    }

    return this.referencedUniqueConstraint.parseValue(maybeValue, path);
  }

  public parseUpdate(
    maybeUpdate: unknown,
    path: Path = addPath(undefined, this.toString()),
  ): EdgeUpdate {
    return this.parseValue(maybeUpdate, path) as any;
  }

  public areValuesEqual(a: EdgeValue, b: EdgeValue): boolean {
    return a === null || b === null
      ? a === b
      : this.referencedUniqueConstraint.areValuesEqual(a, b);
  }

  @Memoize()
  public override isPublic(): boolean {
    const publicConfig = this.config.public;
    const publicConfigPath = addPath(this.configPath, 'public');

    const isPublic = getOptionalFlag(
      publicConfig,
      this.tail.isPublic() && this.head.isPublic(),
      publicConfigPath,
    );

    if (isPublic) {
      if (!this.tail.isPublic()) {
        throw new UnexpectedConfigError(
          `not to be "true" as its tail, the "${this.tail}" node, is private`,
          publicConfig,
          { path: publicConfigPath },
        );
      }

      if (!this.head.isPublic()) {
        throw new UnexpectedConfigError(
          `not to be "true" as its head, the "${this.head}" node, is private`,
          publicConfig,
          { path: publicConfigPath },
        );
      }
    }

    return isPublic;
  }

  @Memoize()
  public get reverseEdge(): ReverseEdge<TRequestContext, TConnector> {
    const reverseEdge = Array.from(this.head.reverseEdgesByName.values()).find(
      (reverseEdge) => reverseEdge.originalEdge === this,
    );

    if (!reverseEdge) {
      throw new ConfigError('Unexpected', { path: this.configPath });
    }

    return reverseEdge;
  }

  @Memoize()
  public override get creationInput(): EdgeCreationInput | undefined {
    return new EdgeCreationInput(this);
  }

  @Memoize()
  public override get updateInput(): EdgeUpdateInput | undefined {
    return this.isMutable() ? new EdgeUpdateInput(this) : undefined;
  }
}
