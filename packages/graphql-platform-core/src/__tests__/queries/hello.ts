import { GraphQLNonNull, GraphQLString } from 'graphql';
import { CustomOperationConfig } from '../..';

export default (({ resourceMap }) => ({
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
})) as CustomOperationConfig;
