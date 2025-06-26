import { CountStatement } from './manipulation/count.js';
import { DeleteStatement } from './manipulation/delete.js';
import { FindStatement } from './manipulation/find.js';
import { InsertStatement } from './manipulation/insert.js';
import { NormalizeStatement } from './manipulation/normalize.js';
import { SelectStatement } from './manipulation/select.js';
import { UpdateStatement } from './manipulation/update.js';

export * from './manipulation/count.js';
export * from './manipulation/delete.js';
export * from './manipulation/find.js';
export * from './manipulation/insert.js';
export * from './manipulation/normalize.js';
export * from './manipulation/select.js';
export * from './manipulation/update.js';

/**
 * @see https://mariadb.com/kb/en/data-manipulation/
 */
export type ManipulationStatement =
  | CountStatement
  | DeleteStatement
  | FindStatement
  | InsertStatement
  | NormalizeStatement
  | SelectStatement
  | UpdateStatement;

export function isManipulationStatement(
  maybeStatement: unknown,
): maybeStatement is ManipulationStatement {
  return (
    maybeStatement instanceof CountStatement ||
    maybeStatement instanceof DeleteStatement ||
    maybeStatement instanceof FindStatement ||
    maybeStatement instanceof InsertStatement ||
    maybeStatement instanceof NormalizeStatement ||
    maybeStatement instanceof SelectStatement ||
    maybeStatement instanceof UpdateStatement
  );
}
