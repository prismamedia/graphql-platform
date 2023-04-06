import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import inflection from 'inflection';
import assert from 'node:assert/strict';
import type { JsonObject } from 'type-fest';
import type {
  ConnectorConfigOverride,
  ConnectorConfigOverrideKind,
  ConnectorInterface,
} from '../../../connector-interface.js';
import type { Node } from '../../../node.js';
import { EdgeHeadSelection } from '../../statement/selection/expression/component/edge/head.js';
import {
  EdgeCreationInput,
  type EdgeCreationInputConfig,
} from '../../type/input/creation/field/component/edge.js';
import {
  EdgeUpdateInput,
  type EdgeUpdateInputConfig,
} from '../../type/input/update/field/component/edge.js';
import {
  AbstractComponent,
  type AbstractComponentConfig,
} from '../abstract-component.js';
import { ReverseEdge } from '../reverse-edge.js';
import type {
  UniqueConstraint,
  UniqueConstraintValue,
} from '../unique-constraint.js';

export type ReferenceValue = UniqueConstraintValue | null;

export enum OnEdgeHeadDeletion {
  RESTRICT,
  SET_NULL,
  CASCADE,
}

export type EdgeConfig<TConnector extends ConnectorInterface = any> =
  AbstractComponentConfig & {
    kind: 'Edge';

    /**
     * Required, the "head"'s name, ex: { kind: "Edge", head: "Category" }
     *
     * Optional, specify the referenced unique-constraint's name after a ".", ex: { kind: "Edge", head: "Category.parent-title" }
     *
     * Default: the "head"'s identifier (= its first unique-constraint)
     */
    head: Node['name'] | `${Node['name']}.${UniqueConstraint['name']}`;

    /**
     * Optional, what to do if the edge is "beheaded"
     *
     * Default: RESTRICT
     */
    onHeadDeletion?: OnEdgeHeadDeletion;

    /**
     * Optional, fine-tune the "creation"'s input
     */
    [utils.MutationType.CREATION]?: EdgeCreationInputConfig;

    /**
     * Optional, fine-tune the "update"'s input
     */
    [utils.MutationType.UPDATE]?: EdgeUpdateInputConfig;
  } & ConnectorConfigOverride<TConnector, ConnectorConfigOverrideKind.EDGE>;

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
  TContainer extends object = any,
> extends AbstractComponent<TRequestContext, TConnector, TContainer> {
  readonly #headConfigPath: utils.Path;
  readonly #nodeHeadConfig: string;
  readonly #uniqueConstraintHeadConfig?: string;
  public readonly pascalCasedName: string;
  public readonly onHeadDeletion: OnEdgeHeadDeletion;

  public constructor(
    public readonly tail: Node<TRequestContext, TConnector, TContainer>,
    name: utils.Name,
    public override readonly config: EdgeConfig<TConnector>,
    public override readonly configPath: utils.Path,
  ) {
    super(tail, name, config, configPath);

    // Pascal case name
    {
      this.pascalCasedName = inflection.camelize(name, false);
    }

    // head
    {
      const headConfig = config.head;
      this.#headConfigPath = utils.addPath(configPath, 'head');

      if (typeof headConfig !== 'string' || !headConfig) {
        throw new utils.UnexpectedValueError(`a non-empty string`, headConfig, {
          path: this.#headConfigPath,
        });
      }

      [this.#nodeHeadConfig, this.#uniqueConstraintHeadConfig] =
        headConfig.split('.');
    }

    // onHeadDeletion
    {
      const onHeadDeletionConfig = config.onHeadDeletion;
      const onHeadDeletionConfigPath = utils.addPath(
        configPath,
        'onHeadDeletion',
      );

      if (onHeadDeletionConfig) {
        switch (onHeadDeletionConfig) {
          case OnEdgeHeadDeletion.SET_NULL: {
            if (!this.isMutable()) {
              throw new utils.UnexpectedValueError(
                `not to be "${
                  OnEdgeHeadDeletion[OnEdgeHeadDeletion.SET_NULL]
                }" as the edge "${this}" is immutable`,
                OnEdgeHeadDeletion[onHeadDeletionConfig],
                { path: onHeadDeletionConfigPath },
              );
            } else if (!this.isNullable()) {
              throw new utils.UnexpectedValueError(
                `not to be "${
                  OnEdgeHeadDeletion[OnEdgeHeadDeletion.SET_NULL]
                }" as the edge "${this}" is not nullable`,
                OnEdgeHeadDeletion[onHeadDeletionConfig],
                { path: onHeadDeletionConfigPath },
              );
            }
            break;
          }

          case OnEdgeHeadDeletion.CASCADE: {
            if (!this.node.isMutationEnabled(utils.MutationType.DELETION)) {
              throw new utils.UnexpectedValueError(
                `not to be "${
                  OnEdgeHeadDeletion[OnEdgeHeadDeletion.CASCADE]
                }" as the node "${this.node}" cannot be deleted`,
                OnEdgeHeadDeletion[onHeadDeletionConfig],
                { path: onHeadDeletionConfigPath },
              );
            }
            break;
          }
        }
      }

      this.onHeadDeletion = onHeadDeletionConfig ?? OnEdgeHeadDeletion.RESTRICT;
    }
  }

  @Memoize()
  public get head(): Node<TRequestContext, TConnector, TContainer> {
    return this.node.gp.getNodeByName(
      this.#nodeHeadConfig,
      this.#headConfigPath,
    );
  }

  @Memoize()
  public get referencedUniqueConstraint(): UniqueConstraint<
    TRequestContext,
    TConnector,
    TContainer
  > {
    let referencedUniqueConstraint: UniqueConstraint;

    if (this.#uniqueConstraintHeadConfig) {
      const uniqueConstraint = this.head.getUniqueConstraintByName(
        this.#uniqueConstraintHeadConfig,
        this.#headConfigPath,
      );

      referencedUniqueConstraint = uniqueConstraint;
    } else {
      referencedUniqueConstraint = this.head.identifier;
    }

    if (
      Array.from(referencedUniqueConstraint.componentsByName.values()).some(
        (component) => component instanceof Edge && component === this,
      )
    ) {
      throw new utils.UnexpectedValueError(
        `a unique-constraint not refering itself`,
        this.#uniqueConstraintHeadConfig,
        { path: this.#headConfigPath },
      );
    }

    // Nullable unique-constraint are not yet supported
    if (referencedUniqueConstraint.isNullable()) {
      throw new utils.UnexpectedValueError(
        `a non-nullable unique-constraint`,
        this.#uniqueConstraintHeadConfig,
        { path: this.#headConfigPath },
      );
    }

    // Mutable unique-constraint are not yet supported as it is not trivial to keep track of the updates
    if (referencedUniqueConstraint.isMutable()) {
      throw new utils.UnexpectedValueError(
        `an immutable unique-constraint`,
        this.#uniqueConstraintHeadConfig,
        { path: this.#headConfigPath },
      );
    }

    return referencedUniqueConstraint;
  }

  @Memoize()
  public override get selection(): EdgeHeadSelection<ReferenceValue> {
    return new EdgeHeadSelection(
      this,
      undefined,
      this.referencedUniqueConstraint.selection,
    );
  }

  @Memoize()
  public override isPublic(): boolean {
    const publicConfig = this.config.public;
    const publicConfigPath = utils.addPath(this.configPath, 'public');

    const isPublic = utils.getOptionalFlag(
      publicConfig,
      this.tail.isPublic() && this.head.isPublic(),
      publicConfigPath,
    );

    if (isPublic) {
      if (!this.tail.isPublic()) {
        throw new utils.UnexpectedValueError(
          `not to be "true" as its tail, the "${this.tail}" node, is private`,
          publicConfig,
          { path: publicConfigPath },
        );
      }

      if (!this.head.isPublic()) {
        throw new utils.UnexpectedValueError(
          `not to be "true" as its head, the "${this.head}" node, is private`,
          publicConfig,
          { path: publicConfigPath },
        );
      }
    }

    return isPublic;
  }

  @Memoize()
  public get reverseEdge(): ReverseEdge<
    TRequestContext,
    TConnector,
    TContainer
  > {
    const reverseEdge = Array.from(this.head.reverseEdgesByName.values()).find(
      (reverseEdge) => reverseEdge.originalEdge === this,
    );

    assert(reverseEdge, `The edge "${this}" does not have its "reverse-edge"`);

    return reverseEdge;
  }

  @Memoize()
  public override get creationInput(): EdgeCreationInput {
    return new EdgeCreationInput(this);
  }

  @Memoize()
  public override get updateInput(): EdgeUpdateInput {
    assert(this.isMutable(), `The "${this}" edge is immutable`);

    return new EdgeUpdateInput(this);
  }

  public parseValue(
    maybeValue: unknown,
    path: utils.Path = utils.addPath(undefined, this.toString()),
  ): ReferenceValue {
    return this.selection.parseValue(maybeValue, path);
  }

  public areValuesEqual(a: ReferenceValue, b: ReferenceValue): boolean {
    return this.selection.areValuesEqual(a, b);
  }

  public uniqValues(values: ReadonlyArray<ReferenceValue>): ReferenceValue[] {
    return this.selection.uniqValues(values);
  }

  public serialize(
    maybeValue: unknown,
    path: utils.Path = utils.addPath(undefined, this.toString()),
  ): JsonObject | null {
    return this.selection.serialize(maybeValue, path);
  }

  public stringify(
    maybeValue: unknown,
    path: utils.Path = utils.addPath(undefined, this.toString()),
  ): string {
    return this.selection.stringify(maybeValue, path);
  }
}
