import { MyResourceConfig } from '../gp';

const resource: MyResourceConfig = {
  plural: 'ArticleUrlMetas',
  uniques: ['url'],
  relations: {
    url: {
      to: 'ArticleUrl',
      inversedBy: 'meta',
    },
  },
};

export default resource;
