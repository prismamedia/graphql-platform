import { GraphQLString } from 'graphql';
import { MyResourceConfig } from '../gp';

const resource: MyResourceConfig = {
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
