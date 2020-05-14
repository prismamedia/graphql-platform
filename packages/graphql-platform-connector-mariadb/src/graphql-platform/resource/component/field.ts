import {
  CustomContext,
  Field as CoreField,
  FieldConfig as CoreFieldConfig,
} from '@prismamedia/graphql-platform-core';
import { Maybe } from '@prismamedia/graphql-platform-utils';
import { BaseContext } from '../../../graphql-platform';
import { ColumnConfig } from '../../connector';

export interface FieldConfig<TCustomContext extends CustomContext = {}>
  extends CoreFieldConfig<TCustomContext, BaseContext> {
  column?: Maybe<ColumnConfig>;
}

export type Field = CoreField<FieldConfig>;
