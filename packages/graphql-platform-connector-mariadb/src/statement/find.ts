import type * as core from '@prismamedia/graphql-platform';
import type * as utils from '@prismamedia/graphql-platform-utils';
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
  TTuple extends utils.PlainObject,
> extends AbstractSelectStatement<TTuple[]> {
  public constructor(
    table: Table,
    { selection, where, orderBy, limit, offset }: core.ConnectorFindStatement,
    protected readonly config?: FindStatementConfig,
  ) {
    super(table);
  }

  protected override get select(): string {
    return '`a`.`title`, `a>category`.`title`';
  }
}
