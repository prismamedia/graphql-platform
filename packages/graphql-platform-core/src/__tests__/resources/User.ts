import { GraphQLString } from 'graphql';
import { MyResourceConfig } from '../gp';

const resource: MyResourceConfig = {
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
