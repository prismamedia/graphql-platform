import { myAdminContext } from '@prismamedia/graphql-platform/__tests__/config.js';
import type { MyGP } from '../config.js';

export default async function (gp: MyGP, iteration: number) {
  const cursor = gp.getNodeByName('Article').scroll(myAdminContext, {
    chunkSize: 100,
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
    console.debug(`ARTICLE_CURSOR_COUNT: ${await cursor.size()}`);
  }

  let articleCount: number = 0;
  await cursor.forEach(() => {
    articleCount++;
  });

  if (iteration === 0) {
    console.debug(`ARTICLE_COUNT: ${articleCount}`);
  }
}
