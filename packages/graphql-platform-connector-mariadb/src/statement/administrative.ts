import { GetColumnInformationStatement } from './administrative/get-column-information.js';
import { GetConstraintInformationStatement } from './administrative/get-constraint-information.js';
import { GetForeignKeyInformationStatement } from './administrative/get-foreign-key-information.js';
import { GetIndexInformationStatement } from './administrative/get-index-information.js';
import { GetSchemaInformationStatement } from './administrative/get-schema-information.js';
import { GetTableInformationStatement } from './administrative/get-table-information.js';

export * from './administrative/get-column-information.js';
export * from './administrative/get-constraint-information.js';
export * from './administrative/get-foreign-key-information.js';
export * from './administrative/get-index-information.js';
export * from './administrative/get-schema-information.js';
export * from './administrative/get-table-information.js';

/**
 * @see https://mariadb.com/kb/en/administrative-sql-statements/
 */
export type AdministrativeStatement =
  | GetColumnInformationStatement
  | GetConstraintInformationStatement
  | GetForeignKeyInformationStatement
  | GetIndexInformationStatement
  | GetSchemaInformationStatement
  | GetTableInformationStatement;

export function isAdministrativeStatement(
  maybeStatement: unknown,
): maybeStatement is AdministrativeStatement {
  return (
    maybeStatement instanceof GetColumnInformationStatement ||
    maybeStatement instanceof GetConstraintInformationStatement ||
    maybeStatement instanceof GetForeignKeyInformationStatement ||
    maybeStatement instanceof GetIndexInformationStatement ||
    maybeStatement instanceof GetSchemaInformationStatement ||
    maybeStatement instanceof GetTableInformationStatement
  );
}
