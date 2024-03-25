import * as scalars from '@prismamedia/graphql-platform-scalars';
import type * as mariadb from 'mariadb';
import assert from 'node:assert/strict';
import { EOL } from 'node:os';
import { escapeIdentifier, escapeStringValue } from '../../escaping.js';
import type { LeafColumn, Table } from '../../schema.js';
import { StatementKind } from '../kind.js';

export type LeafColumnNormalizer = (expr: string) => string;

export const trimWhitespaces = (expr: string) =>
  `REGEXP_REPLACE(${expr}, '^\\\\s+|\\\\s+$', '')`;

export const normalizeDoubleSpaces = (expr: string) =>
  `REGEXP_REPLACE(${expr}, '\\\\s+', ' ')`;

const normalizeJSON = (
  expr: string,
  type: 'ARRAY' | 'OBJECT',
  onInvalid: string,
) =>
  `IF(${[
    `JSON_VALID(${expr})`,
    `JSON_TYPE(${expr}) = ${escapeStringValue(type)}`,
    `JSON_LENGTH(${expr}) > 0`,
  ].join(' AND ')}, JSON_COMPACT(${expr}), ${onInvalid})`;

export const normalizeJSONArray = (expr: string, isNullable: boolean) =>
  normalizeJSON(
    expr,
    'ARRAY',
    isNullable ? 'NULL' : escapeStringValue(JSON.stringify([])),
  );

export const normalizeJSONObject = (expr: string, isNullable: boolean) =>
  normalizeJSON(
    expr,
    'OBJECT',
    isNullable ? 'NULL' : escapeStringValue(JSON.stringify({})),
  );

export const normalizeDraftJS = (expr: string, isNullable: boolean) =>
  `IF(${[
    `JSON_VALID(${expr})`,
    `JSON_EXISTS(${expr}, '$.blocks')`,
    `JSON_TYPE(JSON_EXTRACT(${expr}, '$.blocks')) != 'NULL'`,
    `JSON_LENGTH(${expr}, '$.blocks') > 0`,
  ].join(' AND ')}, JSON_COMPACT(${expr}), ${
    isNullable
      ? 'NULL'
      : escapeStringValue(JSON.stringify({ entityMap: {}, blocks: [] }))
  })`;

export interface NormalizeStatementConfig {
  /**
   * @see https://mariadb.com/kb/en/ignore/
   */
  ignore?: boolean;

  customize?: (column: LeafColumn, expr?: string) => string | undefined;
}

/**
 * @see https://mariadb.com/kb/en/update/
 */
export class NormalizeStatement implements mariadb.QueryOptions {
  public readonly kind = StatementKind.DATA_MANIPULATION;
  public readonly sql: string;

  public static normalizations(
    table: Table,
    config?: NormalizeStatementConfig,
  ): Map<LeafColumn, string> {
    return new Map<LeafColumn, string>(
      Array.from(
        table.columnsByLeaf.values(),
        (column): [LeafColumn, string] | undefined => {
          let normalizers: Array<LeafColumnNormalizer | undefined> = [];

          switch (column.leaf.type) {
            case scalars.GraphQLNonEmptyString:
              normalizers = [
                column.isNullable()
                  ? (expr) => `NULLIF(${expr}, '')`
                  : undefined,
              ];
              break;

            case scalars.GraphQLEmailAddress:
            case scalars.GraphQLNonEmptyTrimmedString:
            case scalars.GraphQLURL:
              normalizers = [
                trimWhitespaces,
                column.isNullable()
                  ? (expr) => `NULLIF(${expr}, '')`
                  : undefined,
              ];
              break;

            case scalars.GraphQLJSONArray:
              normalizers = [
                (expr) => normalizeJSONArray(expr, column.isNullable()),
              ];
              break;

            case scalars.GraphQLJSONObject:
              normalizers = [
                (expr) => normalizeJSONObject(expr, column.isNullable()),
              ];
              break;

            case scalars.GraphQLDraftJS:
              normalizers = [
                (expr) => normalizeDraftJS(expr, column.isNullable()),
              ];
              break;
          }

          const initialValue = escapeIdentifier(column.name);

          let expr: string | undefined = normalizers.reduce(
            (expr, normalizer) => normalizer?.(expr) ?? expr,
            initialValue,
          );

          config?.customize && (expr = config.customize(column, expr));

          return expr && expr !== initialValue ? [column, expr] : undefined;
        },
      ).filter<[LeafColumn, string]>(Boolean as any),
    );
  }

  public constructor(
    public readonly table: Table,
    config?: NormalizeStatementConfig,
  ) {
    const normalizationsByColumn = (
      this.constructor as typeof NormalizeStatement
    ).normalizations(table, config);

    assert(
      normalizationsByColumn.size > 0,
      `No normalization to perform on "${table.name}"`,
    );

    this.sql = [
      [
        'UPDATE',
        config?.ignore === true && 'IGNORE',
        escapeIdentifier(table.name),
      ]
        .filter(Boolean)
        .join(' '),
      'SET',
      Array.from(
        normalizationsByColumn,
        ([column, expr]) => `  ${escapeIdentifier(column.name)} = ${expr}`,
      ).join(`,${EOL}`),
    ]
      .filter(Boolean)
      .join(EOL);
  }
}
