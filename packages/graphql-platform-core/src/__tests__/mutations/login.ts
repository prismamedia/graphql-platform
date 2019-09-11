import { GraphQLNonNull, GraphQLString } from 'graphql';
import { CustomOperationConfig } from '../../graphql-platform';

const query: CustomOperationConfig = {
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

export default query;
