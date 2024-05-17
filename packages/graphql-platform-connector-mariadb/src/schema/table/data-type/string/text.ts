import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
import type { SetOptional } from 'type-fest';
import { escapeStringValue } from '../../../../escaping.js';
import type { ColumnInformation } from '../../../../statement.js';
import {
  AbstractStringDataType,
  type AbstractStringDataTypeConfig,
} from '../abstract-string-data-type.js';

export interface TextTypeConfig<TLeafValue extends core.LeafValue = any>
  extends AbstractStringDataTypeConfig<
    TextType['kind'] | 'LONG' | 'LONG VARCHAR',
    TLeafValue,
    string
  > {
  length?: number;
}

/**
 * @see https://mariadb.com/kb/en/text/
 */
export class TextType<
  TLeafValue extends core.LeafValue = any,
> extends AbstractStringDataType<
  'LONGTEXT' | 'MEDIUMTEXT' | 'TEXT' | 'TINYTEXT',
  TLeafValue,
  string
> {
  public readonly length?: number;
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
        throw new utils.UnexpectedValueError('an integer', lengthConfig, {
          path: lengthConfigPath,
        });
      } else if (lengthConfig < 1) {
        throw new utils.UnexpectedValueError(
          'an integer greater-than-or-equal to 1',
          lengthConfig,
          { path: lengthConfigPath },
        );
      }

      this.length = lengthConfig;
    }

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

  public override isInformationValid(information: ColumnInformation): boolean {
    return (
      super.isInformationValid(information) &&
      (!this.length ||
        !information.CHARACTER_MAXIMUM_LENGTH ||
        this.length === Number(information.CHARACTER_MAXIMUM_LENGTH))
    );
  }
}
