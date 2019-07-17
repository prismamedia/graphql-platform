import {
  CustomContext,
  Relation as CoreRelation,
  RelationConfig as CoreRelationConfig,
} from '@prismamedia/graphql-platform-core';
import { Maybe, ModuleMapConfig } from '@prismamedia/graphql-platform-utils';
import { BaseContext } from '../../../graphql-platform';
import { ColumnReferenceConfig, ForeignKeyConfig } from '../../connector';

export interface RelationConfig<TCustomContext extends CustomContext = {}>
  extends CoreRelationConfig<TCustomContext, BaseContext> {
  /** The column's key is the final referenced field's name */
  columns?: ModuleMapConfig<ColumnReferenceConfig>;

  foreignKey?: Maybe<ForeignKeyConfig>;
}

export type Relation = CoreRelation<RelationConfig>;
