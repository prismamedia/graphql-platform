import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as graphql from 'graphql';
import type * as mariadb from 'mariadb';
import assert from 'node:assert/strict';
import { EOL } from 'node:os';
import * as R from 'remeda';
import { escapeIdentifier, escapeStringValue } from '../../escaping.js';
import type { LeafColumn, Table } from '../../schema.js';
import { StatementKind } from '../kind.js';

export type LeafColumnNormalizer = (expr: string) => string;

export const nullIfEmptyString = (expr: string) => `NULLIF(${expr}, '')`;

export const trimWhitespaces = (expr: string) =>
  `REGEXP_REPLACE(${expr}, '^\\\\s+|\\\\s+$', '')`;

export const nullIfEmptyTrimmedString = (expr: string) =>
  nullIfEmptyString(trimWhitespaces(expr));

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

  customize?: (args: {
    column: LeafColumn;
    columnIdentifier: string;
    defaultNormalization: string | undefined;
  }) => string | undefined;
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
    const exprsByColumn = R.pipe(
      Array.from(table.columnsByLeaf.values()),
      R.map((column): [LeafColumn, string] | undefined => {
        let expr: string | undefined;

        let normalizers: Array<LeafColumnNormalizer | undefined> | undefined;

        switch (column.leaf.type) {
          case scalars.GraphQLUUID:
          case scalars.GraphQLUUIDv1:
          case scalars.GraphQLUUIDv2:
          case scalars.GraphQLUUIDv3:
          case scalars.GraphQLUUIDv4:
          case scalars.GraphQLUUIDv5:
            if (column.dataType.kind !== 'UUID') {
              normalizers = [
                trimWhitespaces,
                column.isNullable() ? nullIfEmptyString : undefined,
              ];
            }
            break;

          case scalars.GraphQLNonEmptyString:
            normalizers = [column.isNullable() ? nullIfEmptyString : undefined];
            break;

          case graphql.GraphQLID:
          case scalars.GraphQLEmailAddress:
          case scalars.GraphQLNonEmptyTrimmedString:
          case scalars.GraphQLURL:
            normalizers = [
              trimWhitespaces,
              column.isNullable() ? nullIfEmptyString : undefined,
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

        if (normalizers?.length) {
          expr = normalizers.reduce(
            (expr, normalizer) => normalizer?.(expr) ?? expr,
            escapeIdentifier(column.name),
          );
        }

        if (config?.customize) {
          expr = config.customize({
            column,
            columnIdentifier: escapeIdentifier(column.name),
            defaultNormalization: expr,
          });
        }

        return expr ? [column, expr] : undefined;
      }),
      R.filter(R.isDefined),
    );

    return new Map<LeafColumn, string>(
      exprsByColumn.some(
        ([{ name }, expr]) => name !== expr && escapeIdentifier(name) !== expr,
      )
        ? exprsByColumn
        : undefined,
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
