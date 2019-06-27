import {
  CustomContext,
  Resource as CoreResource,
  ResourceConfig as CoreResourceConfig,
} from '@prismamedia/graphql-platform-core';
import { Maybe } from '@prismamedia/graphql-platform-utils';
import { BaseContext } from '../graphql-platform';
import { OperationContext } from './connector';
import { TableConfig } from './connector/database/table';
import { FieldConfig, RelationConfig } from './resource/component';
import { UniqueFullConfig } from './resource/unique';

export * from './resource/component';
export * from './resource/unique';

export interface ResourceConfig<TCustomContext extends CustomContext = any>
  extends CoreResourceConfig<
    TCustomContext,
    BaseContext,
    OperationContext,
    UniqueFullConfig,
    FieldConfig<TCustomContext>,
    RelationConfig<TCustomContext>
  > {
  table?: Maybe<TableConfig>;
}

export type Resource = CoreResource<ResourceConfig>;
