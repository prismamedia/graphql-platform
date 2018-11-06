import { GraphQLNonNull, GraphQLString } from 'graphql';

export default {
  description: 'Returns a JWT in case of success.',
  args: {
    login: {
      type: new GraphQLNonNull(GraphQLString),
    },
    password: {
      type: new GraphQLNonNull(GraphQLString),
    },
  },
  type: GraphQLString,
};
