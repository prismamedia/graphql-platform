import { GraphQLString } from 'graphql';
import { ResourceConfig } from '../..';

const resource: ResourceConfig = {
  uniques: ['username'],
  fields: {
    username: {
      type: GraphQLString,
      description: "The user's username",
      nullable: false,
      immutable: true,
    },
  },
};

export default resource;
