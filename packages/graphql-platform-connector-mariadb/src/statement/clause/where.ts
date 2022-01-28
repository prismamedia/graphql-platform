import type * as core from '@prismamedia/graphql-platform';

export class WhereClause {
  public constructor(public readonly where: core.NodeFilter) {}

  public toString(): string {
    return `slug = 'my_slug'`;
  }
}
