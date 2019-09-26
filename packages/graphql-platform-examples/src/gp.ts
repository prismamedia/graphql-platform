import { GraphQLPlatform } from '@prismamedia/graphql-platform';
import { config as Article } from './resources/article';

export const gp = new GraphQLPlatform({
  resources: {
    Article,
  },
});

console.debug(gp.schema);
