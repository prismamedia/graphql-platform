import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
import type { SetOptional } from 'type-fest';
import { escapeStringValue } from '../../../../escaping.js';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../../abstract-data-type.js';

export interface VarCharTypeConfig<TLeafValue extends core.LeafValue = any>
  extends AbstractDataTypeConfig<VarCharType['kind'], TLeafValue, string> {
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
  TLeafValue extends core.LeafValue = any,
> extends AbstractDataType<'VARCHAR', TLeafValue, string> {
  public readonly length: number;
  public readonly charset?: string;
  public readonly collation?: string;
  public readonly definition: string;

  public constructor(
    config: SetOptional<VarCharTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super(
      {
        ...config,
        kind: 'VARCHAR',
        serializer: config?.serializer ?? String,
      },
      configPath,
    );

    // length
    {
      const lengthConfig = config.length;
      const lengthConfigPath = utils.addPath(configPath, 'length');

      if (!Number.isInteger(lengthConfig)) {
        throw new utils.UnexpectedValueError('an integer', lengthConfig, {
          path: lengthConfigPath,
        });
      } else if (lengthConfig < 0) {
        throw new utils.UnexpectedValueError(
          'an integer greater-than-or-equal to 0',
          lengthConfig,
          { path: lengthConfigPath },
        );
      }

      this.length = lengthConfig;
    }

    this.charset = config?.charset || undefined;
    this.collation = config?.collation || undefined;

    this.definition = [
      `${this.kind}(${this.length})`,
      this.charset && `CHARSET ${escapeStringValue(this.charset)}`,
      this.collation && `COLLATE ${escapeStringValue(this.collation)}`,
    ]
      .filter(Boolean)
      .join(' ');
  }

  protected override doSerialize(value: string): string {
    assert.equal(typeof value, 'string');

    return escapeStringValue(value);
  }
}
