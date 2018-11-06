import { ResourceConfig } from '../..';

const resource: ResourceConfig = {
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
