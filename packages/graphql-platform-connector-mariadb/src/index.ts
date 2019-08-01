import { GraphQLPlatform } from './graphql-platform';

export * from '@prismamedia/graphql-platform-core';
export * from './graphql-platform';
// Overrides some exports
export {
  BaseContext,
  Component,
  Context,
  CustomOperationConfig,
  Field,
  FieldConfig,
  GraphQLPlatform,
  GraphQLPlatformConfig,
  Relation,
  RelationConfig,
  Resource,
  ResourceConfig,
  UniqueFullConfig,
} from './graphql-platform';

export default GraphQLPlatform;
