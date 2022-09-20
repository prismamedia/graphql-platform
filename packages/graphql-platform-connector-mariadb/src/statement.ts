import type { AddTableForeignKeysStatement } from './statement/add-table-foreign-keys.js';
import type { CountStatement } from './statement/count.js';
import type { CreateSchemaStatement } from './statement/create-schema.js';
import type { CreateTableStatement } from './statement/create-table.js';
import type { DropSchemaStatement } from './statement/drop-schema.js';
import type { FindStatement } from './statement/find.js';
import type { InsertStatement } from './statement/insert.js';

export * from './statement/add-table-foreign-keys.js';
export * from './statement/count.js';
export * from './statement/create-schema.js';
export * from './statement/create-table.js';
export * from './statement/drop-schema.js';
export * from './statement/find.js';
export * from './statement/insert.js';

export type Statement =
  | AddTableForeignKeysStatement
  | CountStatement
  | CreateSchemaStatement
  | CreateTableStatement
  | DropSchemaStatement
  | FindStatement
  | InsertStatement;

export type ExecutedStatement<TStatement extends Statement = Statement> = {
  statement: TStatement;
  result: Awaited<ReturnType<TStatement['execute']>>;
  sql: string;
};
