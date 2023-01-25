import type { AdministrativeStatement } from './statement/administrative.js';
import type { DefinitionStatement } from './statement/definition.js';
import type { ManipulationStatement } from './statement/manipulation.js';

export * from './statement/administrative.js';
export * from './statement/definition.js';
export * from './statement/kind.js';
export * from './statement/manipulation.js';

/**
 * @see https://mariadb.com/kb/en/sql-statements/
 */
export type Statement =
  | AdministrativeStatement
  | DefinitionStatement
  | ManipulationStatement;

export type ExecutedStatement = {
  statement: Statement;
  result: any;

  /**
   * Time spent to execute this statement, including the transport, in seconds
   */
  took: number;
};
