import type { DiagnosisError } from '../../../diagnosis.js';
import {
  AbstractIndexDiagnosis,
  type IndexDiagnosisOptions,
  type IndexDiagnosisSummary,
  type IndexInformationsByColumnName,
} from '../../abstract-index-diagnosis.js';
import type { UniqueIndex } from '../unique.js';

export type UniqueIndexDiagnosisSummary = IndexDiagnosisSummary & {
  unique?: DiagnosisError;
};

export class UniqueIndexDiagnosis extends AbstractIndexDiagnosis<UniqueIndex> {
  public readonly uniqueError?: DiagnosisError;

  public constructor(
    index: UniqueIndex,
    indexInformationsByColumnName: IndexInformationsByColumnName,
    options?: IndexDiagnosisOptions,
  ) {
    super(index, indexInformationsByColumnName, options);

    const nonUniqueColumns = Array.from(
      indexInformationsByColumnName.values(),
    ).filter(({ NON_UNIQUE }) => Number(NON_UNIQUE) === 1);

    if (nonUniqueColumns.length) {
      this.uniqueError = { actual: false, expected: true };
    }
  }

  public override isValid(): boolean {
    return super.isValid() && !this.uniqueError;
  }

  public override summarize(): UniqueIndexDiagnosisSummary {
    return {
      ...super.summarize(),
      ...(this.uniqueError && { unique: this.uniqueError }),
    };
  }
}
