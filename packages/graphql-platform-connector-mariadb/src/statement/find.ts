import type * as core from '@prismamedia/graphql-platform';
import type * as utils from '@prismamedia/graphql-platform-utils';
import { escapeIdentifier } from '../escape.js';
import type { Table } from '../schema.js';
import { AbstractSelectStatement } from './abstract-select.js';

export interface FindStatementConfig {}

/**
 * {
  articles(where: {}, orderBy: [createdAt_DESC], first: 5, skip: 0) {
    title
    articleCategories(orderBy: [order_ASC], first: 10) {
      category {
        title
      }
    }
    articleTags(orderBy: [order_ASC], first: 10) {
      tag {
        title
      }
    }
    source {
      title
    }
  }
}
 * 
 * @see https://mariadb.com/kb/en/selecting-data/
 */
export class FindStatement<
  TTuple extends utils.PlainObject = any,
> extends AbstractSelectStatement<TTuple[]> {
  public constructor(
    table: Table,
    { selection, where, orderBy, limit, offset }: core.ConnectorFindStatement,
    protected readonly config?: FindStatementConfig,
  ) {
    super(table);

    const Article = table.node;
    const ArticleCategory = Article.edgesByName.get('category')!;
    const ArticleCategoryParent =
      ArticleCategory.head.edgesByName.get('parent')!;

    this.from
      .join(ArticleCategory)
      .join(ArticleCategoryParent)
      .join(ArticleCategoryParent);

    const ArticleCreatedBy = Article.edgesByName.get('createdBy')!;

    this.from.join(ArticleCreatedBy);

    const ArticleTags = Article.reverseEdgesByName.get('tags')!;

    this.from.join(ArticleTags);
  }

  protected override get select(): string {
    return `${escapeIdentifier(this.from.alias)}.*`;
  }
}
