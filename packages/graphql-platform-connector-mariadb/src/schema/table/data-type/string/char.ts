import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
import type { SetOptional } from 'type-fest';
import { escapeStringValue } from '../../../../escaping.js';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../../abstract-data-type.js';

export interface CharTypeConfig<TLeafValue extends core.LeafValue = any>
  extends AbstractDataTypeConfig<CharType['kind'], TLeafValue, string> {
  length?: number;
  charset?: string;
  collation?: string;
}

/**
 * A fixed-length string that is always right-padded with spaces to the specified length when stored
 *
 * @see https://mariadb.com/kb/en/char/
 */
export class CharType<
  TLeafValue extends core.LeafValue = any,
> extends AbstractDataType<'CHAR', TLeafValue, string> {
  public readonly length: number;
  public readonly charset?: string;
  public readonly collation?: string;
  public readonly definition: string;

  public constructor(
    config?: SetOptional<CharTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super(
      {
        ...config,
        kind: 'CHAR',
        serializer: config?.serializer ?? String,
      },
      configPath,
    );

    if (config?.length != null) {
      const lengthConfig = config?.length;
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
    } else {
      this.length = 1;
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
