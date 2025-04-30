import { myAdminContext } from '@prismamedia/graphql-platform/__tests__/config.js';
import type { MyGP } from '../config.js';

export default async function (gp: MyGP, iteration: number) {
  const scroll = gp.getNodeByName('Article').api.scroll(myAdminContext, {
    cursor: { size: 100 },
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

  let articleCount: number = 0;
  await scroll.forEach(() => {
    articleCount++;
  });
}
