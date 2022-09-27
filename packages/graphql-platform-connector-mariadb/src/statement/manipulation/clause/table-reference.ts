import type { JoinTable } from './table-reference/join-table.js';
import type { TableFactor } from './table-reference/table-factor.js';

export * from './table-reference/join-table.js';
export * from './table-reference/table-factor.js';

/**
 * @see https://mariadb.com/kb/en/join-syntax/
 */
export type TableReference = TableFactor | JoinTable;
