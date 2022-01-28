import type { MutationType } from '@prismamedia/graphql-platform-utils';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type { CreationConfig } from './abstract-creation.js';
import type { DeletionConfig } from './abstract-deletion.js';
import type { UpdateConfig } from './abstract-update.js';

export type {
  CreationConfig,
  PostCreateArgs,
  PreCreateArgs,
} from './abstract-creation.js';
export type {
  DeletionConfig,
  PostDeleteArgs,
  PreDeleteArgs,
} from './abstract-deletion.js';
export type {
  PostUpdateArgs,
  PreUpdateArgs,
  UpdateConfig,
} from './abstract-update.js';

export interface MutationConfig<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> {
  [MutationType.CREATION]: CreationConfig<TRequestContext, TConnector>;
  [MutationType.UPDATE]: UpdateConfig<TRequestContext, TConnector>;
  [MutationType.DELETION]: DeletionConfig<TRequestContext, TConnector>;
}
