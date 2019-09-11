import { GraphQLNonNull, GraphQLString } from 'graphql';
import { CustomOperationConfig } from '../..';

const query: CustomOperationConfig = ({ resourceMap }) => ({
  description: 'A custom query.',
  args: {
    name: {
      type: GraphQLNonNull(GraphQLString),
    },
    id: {
      type: GraphQLNonNull(
        resourceMap
          .assert('User')
          .getInputType('WhereUnique')
          .getGraphQLType(),
      ),
    },
  },
  type: resourceMap
    .assert('User')
    .getOutputType('Node')
    .getGraphQLType(),
});

export default query;
