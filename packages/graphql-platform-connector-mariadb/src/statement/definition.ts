import { AddTableForeignKeysStatement } from './definition/add-table-foreign-keys.js';
import { CreateSchemaStatement } from './definition/create-schema.js';
import { CreateTableStatement } from './definition/create-table.js';
import { DropSchemaStatement } from './definition/drop-schema.js';
import { DropTableForeignKeysStatement } from './definition/drop-table-foreign-keys.js';
import { FixSchemaStatement } from './definition/fix-schema.js';
import { FixTableStatement } from './definition/fix-table.js';

export * from './definition/add-table-foreign-keys.js';
export * from './definition/create-schema.js';
export * from './definition/create-table.js';
export * from './definition/drop-schema.js';
export * from './definition/drop-table-foreign-keys.js';
export * from './definition/fix-schema.js';
export * from './definition/fix-table.js';

/**
 * @see https://mariadb.com/kb/en/data-definition/
 */
export type DefinitionStatement =
  | AddTableForeignKeysStatement
  | DropTableForeignKeysStatement
  | CreateSchemaStatement
  | CreateTableStatement
  | DropSchemaStatement
  | FixSchemaStatement
  | FixTableStatement;

export function isDefinitionStatement(
  maybeStatement: unknown,
): maybeStatement is DefinitionStatement {
  return (
    maybeStatement instanceof AddTableForeignKeysStatement ||
    maybeStatement instanceof DropTableForeignKeysStatement ||
    maybeStatement instanceof CreateSchemaStatement ||
    maybeStatement instanceof CreateTableStatement ||
    maybeStatement instanceof DropSchemaStatement ||
    maybeStatement instanceof FixSchemaStatement ||
    maybeStatement instanceof FixTableStatement
  );
}
