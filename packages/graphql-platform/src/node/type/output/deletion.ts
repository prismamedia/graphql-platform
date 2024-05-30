import type { Name } from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import type { Node } from '../../../node.js';
import { Leaf } from '../../definition.js';

export class DeletionOutputType {
  public readonly name: Name;

  public constructor(public readonly node: Node) {
    this.name = `${node}Deletion`;
  }

  public toString(): string {
    return this.name;
  }

  @Memoize()
  public getGraphQLObjectType(): graphql.GraphQLObjectType {
    assert(this.node.isPublic(), `The "${this.node}" node is private`);

    return new graphql.GraphQLObjectType({
      name: this.name,
      description: `A single "${this.node}" deletion`,
      fields: () =>
        Array.from(this.node.componentSet).reduce((fields, component) => {
          if (component.isPublic()) {
            const type =
              component instanceof Leaf
                ? component.type
                : component.referencedUniqueConstraint.isPublic()
                  ? component.referencedUniqueConstraint.getGraphQLObjectType()
                  : undefined;

            if (type) {
              fields[component.name] = {
                ...(component.description && {
                  description: component.description,
                }),
                ...(component.deprecationReason && {
                  deprecationReason: component.deprecationReason,
                }),
                type: component.isNullable()
                  ? type
                  : new graphql.GraphQLNonNull(type),
              };
            }
          }

          return fields;
        }, Object.create(null)),
    });
  }
}
