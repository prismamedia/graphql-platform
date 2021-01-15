import {
  getOptionalFlagValue,
  OptionalFlagValue,
} from '@prismamedia/graphql-platform-utils';
import assert from 'assert';
import { assertValidName } from 'graphql';
import { camelize } from 'inflection';
import { Node } from '../node';
import { ICreateReverseEdgeInputFieldConfig } from '../operations/mutations';
import { Edge } from './component/edge';
import { IReverseEdgeFieldArgs } from './fields/reverse-edge';

export interface IReverseEdgeConfig {
  /**
   * Optional, the reverse edge name
   *
   * Default: guessed from the edge it comes from
   */
  name?: string;

  /**
   * Optional, provide a description for this reverse edge
   */
  description?: string;

  /**
   * Optional, this reverse edge can be hidden in the public API
   *
   * Default: the edge's visibility
   */
  public?: OptionalFlagValue;

  /**
   * Optional, provide some default arguments to the "ReverseEdge" fields
   */
  defaultArgs?: Partial<IReverseEdgeFieldArgs>;

  /**
   * Optional, fine-tune the inputs related to this reverse edge
   */
  inputs?: {
    /**
     * Optional, fine-tune the reverse edge's input field for creating a node record
     */
    create?: ICreateReverseEdgeInputFieldConfig
  };
}

export class ReverseEdge {
  public readonly node: Node;
  public readonly to: Node;
  public readonly id: string;
  public readonly description?: string;
  public readonly public: boolean;
  public readonly unique: boolean;
  public readonly name: string;

  public constructor(
    public readonly edge: Edge,
    public readonly config?: IReverseEdgeConfig,
  ) {
    this.node = edge.to;
    this.to = edge.node;

    this.unique = [...this.to.uniqueConstraintMap.values()].some(
      (uniqueConstraint) =>
        uniqueConstraint.componentSet.size === 1 &&
        uniqueConstraint.componentSet.has(edge),
    );

    this.name = assertValidName(
      config?.name ||
        camelize(
          (this.unique ? this.to.name : this.to.plural)
            // By default, the reverse edge is contextualized (= an edge to a "User" from a "UserProfile" node will result in a "User.profile" reverse edge instead of "User.userProfile")
            .replace(new RegExp(`^${this.node.name}`), ''),
          true,
        ),
    );

    this.id = `${this.node.name}.${this.name}`;

    this.public = getOptionalFlagValue(config?.public, edge.public);
    assert(
      !this.public || edge.public,
      `The "${this.id}" reverse edge cannot be public as the edge "${edge.id}" is not`,
    );

    this.description =
      config?.description ||
      `The "${this.to.name}" nodes having a(n) "${this.edge.name}" edge to this "${this.node.name}" node`;
  }

  public toString(): string {
    return this.id;
  }
}
