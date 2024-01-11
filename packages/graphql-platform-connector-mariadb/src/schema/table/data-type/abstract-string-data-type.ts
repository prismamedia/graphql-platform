import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../abstract-data-type.js';

export interface AbstractStringDataTypeConfig<
  TKind extends string,
  TLeafValue extends core.LeafValue,
  TValue,
> extends AbstractDataTypeConfig<TKind, TLeafValue, TValue> {
  charset?: string;
  collation?: string;
}

export abstract class AbstractStringDataType<
  TKind extends string,
  TLeafValue extends core.LeafValue,
  TValue,
> extends AbstractDataType<TKind, TLeafValue, TValue> {
  public readonly charset?: string;
  public readonly collation?: string;

  public constructor(
    config: AbstractStringDataTypeConfig<TKind, TLeafValue, TValue>,
    configPath?: utils.Path,
  ) {
    super(config, configPath);

    this.charset = config?.charset || undefined;
    this.collation = config?.collation || undefined;
  }
}
