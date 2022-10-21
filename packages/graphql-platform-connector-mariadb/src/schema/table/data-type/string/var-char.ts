import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import type { SetOptional } from 'type-fest';
import { escapeStringValue } from '../../../../escaping.js';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../../abstract-data-type.js';

export interface VarCharTypeConfig<
  TLeafValue extends NonNullable<core.LeafValue> = any,
> extends AbstractDataTypeConfig<VarCharType['kind'], TLeafValue, string> {
  length: number;
  charset?: string;
  collation?: string;
}

/**
 * A variable-length string.
 *
 * @see https://mariadb.com/kb/en/varchar/
 */
export class VarCharType<
  TLeafValue extends NonNullable<core.LeafValue> = any,
> extends AbstractDataType<'VARCHAR', TLeafValue, string> {
  public readonly length: number;
  public readonly charset?: string;
  public readonly collation?: string;

  public constructor(
    config: SetOptional<VarCharTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super(
      {
        kind: 'VARCHAR',
        serialize: (value) => escapeStringValue(value),
        toColumnValue: config.toColumnValue ?? String,
        fromColumnValue: config.fromColumnValue,
        fromJsonValue: config.fromJsonValue,
      },
      configPath,
    );

    // length
    {
      const lengthConfig = config.length;
      const lengthConfigPath = utils.addPath(configPath, 'length');

      if (!Number.isInteger(lengthConfig)) {
        throw new utils.UnexpectedConfigError('an integer', lengthConfig, {
          path: lengthConfigPath,
        });
      } else if (lengthConfig < 0) {
        throw new utils.UnexpectedConfigError(
          'an integer greater-than-or-equal to 0',
          lengthConfig,
          { path: lengthConfigPath },
        );
      }

      this.length = lengthConfig;
    }

    this.charset = config?.charset || undefined;
    this.collation = config?.collation || undefined;
  }

  @Memoize()
  public override get definition(): string {
    return [
      `${this.kind}(${this.length})`,
      this.charset && `CHARSET ${escapeStringValue(this.charset)}`,
      this.collation && `COLLATE ${escapeStringValue(this.collation)}`,
    ]
      .filter(Boolean)
      .join(' ');
  }
}
