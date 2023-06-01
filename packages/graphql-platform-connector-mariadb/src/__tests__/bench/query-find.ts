import * as scalars from '@prismamedia/graphql-platform-scalars';
import { myAdminContext } from '@prismamedia/graphql-platform/__tests__/config.js';
import type { MyGP } from '../config.js';

export default async function (gp: MyGP, iteration: number) {
  const articles = await gp.api.query.articles(myAdminContext, {
    orderBy: '_id_ASC',
    first: scalars.GRAPHQL_MAX_UNSIGNED_INT,
    selection: `{
      id
      status
      createdAt
      title
      category { title }
      tags(orderBy: order_ASC, first: 100) { tag { title } }
      extension { source }
    }`,
  });

  if (iteration === 0) {
    // console.debug(`ARTICLE_COUNT: ${articles.length}`);
  }
}
