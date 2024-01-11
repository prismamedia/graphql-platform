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

export interface VarCharTypeConfig<TLeafValue extends core.LeafValue = any>
  extends AbstractStringDataTypeConfig<
    VarCharType['kind'],
    TLeafValue,
    string
  > {
  length: number;
}

/**
 * A variable-length string.
 *
 * @see https://mariadb.com/kb/en/varchar/
 */
export class VarCharType<
  TLeafValue extends core.LeafValue = any,
> extends AbstractStringDataType<'VARCHAR', TLeafValue, string> {
  public readonly length: number;
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

  public isInformationValid(information: ColumnInformation): boolean {
    return (
      super.isInformationValid(information) &&
      (!this.length ||
        !information.CHARACTER_MAXIMUM_LENGTH ||
        this.length === Number(information.CHARACTER_MAXIMUM_LENGTH))
    );
  }
}
