import { GraphQLString } from 'graphql';
import { ResourceConfig } from '../..';

const resource: ResourceConfig = {
  uniques: ['articleTag'],
  fields: {
    body: {
      type: GraphQLString,
    },
  },
  relations: {
    articleTag: {
      to: 'ArticleTag',
      inversedBy: 'comment',
    },
  },
};

export default resource;
