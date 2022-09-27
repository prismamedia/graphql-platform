import { AddTableForeignKeysStatement } from './definition/add-table-foreign-keys.js';
import { CreateSchemaStatement } from './definition/create-schema.js';
import { CreateTableStatement } from './definition/create-table.js';
import { DropSchemaStatement } from './definition/drop-schema.js';

export * from './definition/add-table-foreign-keys.js';
export * from './definition/create-schema.js';
export * from './definition/create-table.js';
export * from './definition/drop-schema.js';

/**
 * @see https://mariadb.com/kb/en/data-definition/
 */
export type DefinitionStatement =
  | AddTableForeignKeysStatement
  | CreateSchemaStatement
  | CreateTableStatement
  | DropSchemaStatement;

export function isDefinitionStatement(
  maybeStatement: unknown,
): maybeStatement is DefinitionStatement {
  return (
    maybeStatement instanceof AddTableForeignKeysStatement ||
    maybeStatement instanceof CreateSchemaStatement ||
    maybeStatement instanceof CreateTableStatement ||
    maybeStatement instanceof DropSchemaStatement
  );
}
