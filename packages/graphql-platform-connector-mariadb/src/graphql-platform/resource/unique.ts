import { UniqueFullConfig as CoreUniqueFullConfig } from '@prismamedia/graphql-platform-core';
import { Maybe } from '@prismamedia/graphql-platform-utils';
import { UniqueIndexConfig } from '../connector/database/table';

export interface UniqueFullConfig extends CoreUniqueFullConfig {
  index?: Maybe<UniqueIndexConfig>;
}
