import { GraphQLString } from 'graphql';
import { ResourceConfig } from '../..';

const resource: ResourceConfig = {
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
