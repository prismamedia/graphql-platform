import { CustomContext, Field as CoreField, FieldConfig as CoreFieldConfig } from '@prismamedia/graphql-platform-core';
import { Maybe } from '@prismamedia/graphql-platform-utils';
import { BaseContext } from '../../../graphql-platform';
import { ColumnConfig, OperationContext } from '../../connector';

export interface FieldConfig<TCustomContext extends CustomContext = any>
  extends CoreFieldConfig<TCustomContext, BaseContext, OperationContext> {
  column?: Maybe<ColumnConfig>;
}

export type Field = CoreField<FieldConfig>;
