import sqlFormatter from 'sql-formatter';
import {
  CreateTableStatement,
  Database,
} from '../graphql-platform/connector/database';
import { config, MyGP } from './gp';

describe('Database', () => {
  let gp: MyGP;
  let database: Database;

  beforeAll(() => {
    gp = new MyGP(config);
    database = gp.getConnector().getDatabase();
  });

  it('creates a database', () => {
    expect(database).toBeInstanceOf(Database);
  });

  it('creates tables', () => {
    expect([...database.getTableSet()].map((table) => table.name))
      .toMatchInlineSnapshot(`
      Array [
        "categories",
        "users",
        "articles",
        "tags",
        "article_tags",
        "article_tag_comments",
        "article_urls",
        "article_url_metas",
      ]
    `);
  });

  it('print the "CREATE TABLE" statements', () => {
    expect(
      [...database.getTableSet()]
        .map((table) =>
          sqlFormatter.format(new CreateTableStatement(table).sql),
        )
        .join('\n\n'),
    ).toMatchSnapshot();
  });
});
