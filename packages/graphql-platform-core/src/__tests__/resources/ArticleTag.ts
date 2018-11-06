import { GraphQLInt } from 'graphql';
import { ResourceConfig } from '../..';

const resource: ResourceConfig = {
  uniques: [['article', 'tag'], { components: ['article', 'order'], name: 'article/order' }],
  fields: {
    order: {
      type: GraphQLInt,
      nullable: false,
    },
  },
  relations: {
    article: {
      to: 'Article',
      inversedBy: 'tags',
    },
    tag: {
      to: 'Tag',
      inversedBy: 'articles',
    },
  },
};

export default resource;
