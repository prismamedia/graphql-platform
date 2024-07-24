import type * as mariadb from 'mariadb';
import assert from 'node:assert';
import { EOL } from 'node:os';
import { escapeIdentifier, escapeStringValue } from '../../escaping.js';
import type {
  Schema,
  SchemaDiagnosis,
  SchemaDiagnosisFixConfig,
} from '../../schema.js';
import { StatementKind } from '../kind.js';

/**
 * @see https://mariadb.com/kb/en/alter-database/
 */
export class FixSchemaStatement implements mariadb.QueryOptions {
  public readonly schema: Schema;
  public readonly kind = StatementKind.DATA_DEFINITION;
  public readonly sql: string;

  public static fixes(
    diagnosis: SchemaDiagnosis,
    config?: SchemaDiagnosisFixConfig,
  ): boolean {
    return (
      diagnosis.fixesComment(config) ||
      diagnosis.fixesCharset(config) ||
      diagnosis.fixesCollation(config)
    );
  }

  public constructor(
    public readonly diagnosis: SchemaDiagnosis,
    config?: SchemaDiagnosisFixConfig,
  ) {
    this.schema = diagnosis.schema;

    assert(
      (this.constructor as typeof FixSchemaStatement).fixes(diagnosis, config),
    );

    this.sql = [
      `ALTER SCHEMA ${escapeIdentifier(diagnosis.schema.name)}`,
      diagnosis.fixesComment(config) &&
        `COMMENT = ${escapeStringValue(diagnosis.schema.comment ?? '')}`,
      diagnosis.fixesCharset(config) &&
        `DEFAULT CHARSET = ${escapeStringValue(
          diagnosis.schema.defaultCharset,
        )}`,
      diagnosis.fixesCollation(config) &&
        `DEFAULT COLLATE = ${escapeStringValue(
          diagnosis.schema.defaultCollation,
        )}`,
    ]
      .filter(Boolean)
      .join(EOL);
  }
}
