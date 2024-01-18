import assert from 'node:assert/strict';
import { IndexInformation } from '../../statement.js';
import { DiagnosisError } from '../diagnosis.js';
import type { AbstractIndex } from './abstract-index.js';
import type { Column } from './column.js';

export type IndexInformationsByColumnName = Map<
  Column['name'],
  IndexInformation
>;

export type IndexDiagnosisOptions = {};

export type IndexDiagnosisSummary = {
  columns?: DiagnosisError;
};

export abstract class AbstractIndexDiagnosis<
  TIndex extends AbstractIndex = any,
> {
  public readonly columnsError?: DiagnosisError;

  public readonly errorCount: number;

  public constructor(
    public readonly index: TIndex,
    indexInformationsByColumnName: IndexInformationsByColumnName,
    options?: IndexDiagnosisOptions,
  ) {
    indexInformationsByColumnName.forEach((indexInformation) => {
      assert.equal(indexInformation.TABLE_SCHEMA, index.table.schema.name);
      assert.equal(indexInformation.TABLE_NAME, index.table.name);
      assert.equal(indexInformation.INDEX_NAME, index.name);
    });

    const actualColumnNames = Array.from(indexInformationsByColumnName.keys());
    const expectedColumnNames = index.columns.map(({ name }) => name);

    if (
      !actualColumnNames.every(
        (columnName, i) => columnName === expectedColumnNames[i],
      )
    ) {
      this.columnsError = {
        actual: actualColumnNames,
        expected: expectedColumnNames,
      };
    }

    this.errorCount = this.columnsError ? 1 : 0;
  }

  public isValid(): boolean {
    return !this.errorCount;
  }

  public summarize(): IndexDiagnosisSummary {
    return {
      ...(this.columnsError && { columns: this.columnsError }),
    };
  }
}
