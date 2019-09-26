import {
  getOptionalFlagValue,
  resolveThunkOrValue,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'assert';
import {
  IConnector,
  TConnectorOverridesKind,
  TGetConnectorOverrides,
} from '../../connector';
import { Node } from '../../node';
import { ICreateEdgeInputFieldConfig } from '../../operations/mutations/create';
import { IEdgeSelection } from '../fields';
import { UniqueConstraint } from '../unique-constraint';
import { AbstractComponent, IComponentConfig } from './abstract';
import { TLeafValue } from './leaf';

export type TReferenceValue = null | {
  [componentName: string]: TLeafValue | TReferenceValue;
};

export type TEdgeConfig<
  TContext,
  TConnector extends IConnector
> = IComponentConfig<'Edge'> & {
  /**
   * Required, the referenced "node"'s name as a string, ex: { type: "Category" }
   */
  type: string;

  /**
   * Optional, specify the referenced "unique constraint"'s name as a string, ex: { reference: "parent-title" }
   *
   * Default: the referenced "node"'s identifier
   */
  reference?: string;

  /**
   * Optional, fine-tune the inputs related to this edge
   */
  inputs?: {
    /**
     * Optional, fine-tune the edge's input field for creating a node record
     */
    create?: ICreateEdgeInputFieldConfig;
  };
} & TGetConnectorOverrides<TConnector, TConnectorOverridesKind.Edge>;

export class Edge<
  TConnector extends IConnector = any
> extends AbstractComponent {
  public constructor(
    node: Node,
    name: string,
    public readonly config: TEdgeConfig<any, TConnector>,
  ) {
    super(node, name, {
      ...config,
      public: () =>
        getOptionalFlagValue(
          resolveThunkOrValue(config.public),
          this.node.public && this.to.public,
        ),
    });

    assert(
      typeof config.type === 'string' && config.type,
      `The "${this.id}" edge expects a non-empty string, got "${config.type}"`,
    );
  }

  @Memoize()
  public get public(): boolean {
    const isPublic = super.public;

    assert(
      !isPublic || this.to.public,
      `The "${this.id}" edge cannot be public as the referenced node "${this.to.name}" is not`,
    );

    return isPublic;
  }

  @Memoize()
  public get to(): Node {
    return this.node.gp.getNode(this.config.type);
  }

  @Memoize()
  public get reference(): UniqueConstraint<TConnector> {
    const reference = this.config.reference
      ? this.to.getUniqueConstraint(this.config.reference)
      : this.to.identifier;

    assert(
      ![...reference.componentSet].some(
        (component) => component instanceof Edge && component === this,
      ),
      `The "${this.id}" edge cannot references itself`,
    );

    return reference;
  }

  @Memoize()
  public get selection(): IEdgeSelection {
    return Object.freeze({
      kind: 'Edge',
      name: this.name,
      selections: Object.freeze(
        Array.from(this.reference.componentSet, ({ selection }) => selection),
      ),
    });
  }

  @Memoize()
  public get preferredUniqueConstraintSet(): ReadonlySet<
    UniqueConstraint<TConnector>
  > {
    return new Set([this.reference, ...this.to.uniqueConstraintMap.values()]);
  }
}
