import {
  getOptionalFlag,
  OptionalFlag,
} from '@prismamedia/graphql-platform-utils';
import assert from 'assert';
import { assertValidName } from 'graphql';
import { Node } from '../node';
import { Edge } from './components/edge';

export interface IReverseEdgeConfig {
  /**
   * Required, the targeted node's name as a string, ex: { to: "Article" }
   * In case more than one edge in that node is referencing this node, you can specify which one to use, ex: { to: "Article.category" }
   */
  to: string;

  /**
   * Optional, this reverse edge can be hidden in the public API
   *
   * Default: the edge's visibility
   */
  public?: OptionalFlag;

  /**
   * Optional, provide a description for this reverse edge
   */
  description?: string;

  // /**
  //  * Optional, provide some default arguments to the "ReverseEdge" fields
  //  */
  // defaultArgs?: Partial<IReverseEdgeFieldArgs>;

  /**
   * Optional, fine-tune the inputs related to this reverse edge
   */
  inputs?: {
    // /**
    //  * Optional, fine-tune the reverse edge's input field for creating a node record
    //  */
    // create?: ICreateReverseEdgeInputFieldConfig;
  };
}

export class ReverseEdge {
  public readonly to: Node;
  public readonly edge: Edge;
  public readonly unique: boolean;
  public readonly id: string;
  public readonly description?: string;
  public readonly public: boolean;

  public constructor(
    public readonly node: Node,
    public readonly name: string,
    public readonly config: IReverseEdgeConfig,
  ) {
    // Is valid against the GraphQL rules
    assertValidName(name);

    this.id = `${node.name}.${name}`;

    const [nodeName, edgeName] = config.to.split('.');
    this.to = node.gp.getNode(nodeName);

    const edge = edgeName
      ? this.to.getEdge(edgeName)
      : [...this.to.edgeMap.values()].find((edge) => edge.to === node);
    assert(edge?.to === node);

    this.edge = edge;

    this.unique = [...this.to.uniqueConstraintMap.values()].some(
      (uniqueConstraint) =>
        uniqueConstraint.componentSet.size === 1 &&
        uniqueConstraint.componentSet.has(this.edge),
    );

    this.public = getOptionalFlag(config?.public, this.edge.public);
    assert(
      !this.public || this.edge.public,
      `The "${this}" reverse edge cannot be public as the original edge "${this.edge}" is not`,
    );

    this.description = config?.description;
  }

  public toString(): string {
    return this.id;
  }
}
