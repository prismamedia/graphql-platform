import { GraphQLString } from 'graphql';
import { MyResourceConfig } from '../gp';

const resource: MyResourceConfig = {
  uniques: ['article'],
  fields: {
    path: {
      type: GraphQLString,
      nullable: false,
    },
  },
  relations: {
    article: {
      to: 'Article',
      inversedBy: 'url',
    },
  },
};

export default resource;
