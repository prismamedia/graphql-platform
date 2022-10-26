import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
import type { SetOptional } from 'type-fest';
import { escapeStringValue } from '../../../../escaping.js';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../../abstract-data-type.js';

export interface TextTypeConfig<TLeafValue extends core.LeafValue = any>
  extends AbstractDataTypeConfig<
    TextType['kind'] | 'LONG' | 'LONG VARCHAR',
    TLeafValue,
    string
  > {
  length?: number;
  charset?: string;
  collation?: string;
}

/**
 * @see https://mariadb.com/kb/en/text/
 */
export class TextType<
  TLeafValue extends core.LeafValue = any,
> extends AbstractDataType<
  'LONGTEXT' | 'MEDIUMTEXT' | 'TEXT' | 'TINYTEXT',
  TLeafValue,
  string
> {
  public readonly length?: number;
  public readonly charset?: string;
  public readonly collation?: string;
  public readonly definition: string;

  public constructor(
    config?: SetOptional<TextTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super(
      {
        ...config,
        kind: !config?.kind
          ? 'TEXT'
          : config.kind === 'LONG' || config.kind === 'LONG VARCHAR'
          ? 'MEDIUMTEXT'
          : config.kind,
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
      } else if (lengthConfig < 1) {
        throw new utils.UnexpectedConfigError(
          'an integer greater-than-or-equal to 1',
          lengthConfig,
          { path: lengthConfigPath },
        );
      }

      this.length = lengthConfig;
    }

    this.charset = config?.charset || undefined;
    this.collation = config?.collation || undefined;

    this.definition = [
      `${this.kind}${this.length ? `(${this.length})` : ''}`,
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
