import { GraphQLInt } from 'graphql';
import { MyResourceConfig } from '../gp';

const resource: MyResourceConfig = {
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
