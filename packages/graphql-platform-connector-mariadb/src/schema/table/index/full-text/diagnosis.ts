import type { DiagnosisError } from '../../../diagnosis.js';
import {
  AbstractIndexDiagnosis,
  type IndexDiagnosisOptions,
  type IndexDiagnosisSummary,
  type IndexInformationsByColumnName,
} from '../../abstract-index-diagnosis.js';
import type { FullTextIndex } from '../full-text.js';

export type FullTextIndexDiagnosisSummary = IndexDiagnosisSummary & {
  fullText?: DiagnosisError;
};

export class FullTextIndexDiagnosis extends AbstractIndexDiagnosis<FullTextIndex> {
  public readonly fullTextError?: DiagnosisError;

  public constructor(
    index: FullTextIndex,
    indexInformationsByColumnName: IndexInformationsByColumnName,
    options?: IndexDiagnosisOptions,
  ) {
    super(index, indexInformationsByColumnName, options);

    const nonFullTextColumns = Array.from(
      indexInformationsByColumnName.values(),
    ).filter(({ INDEX_TYPE }) => INDEX_TYPE !== 'FULLTEXT');

    if (nonFullTextColumns.length) {
      this.fullTextError = { actual: false, expected: true };
    }
  }

  public override isValid(): boolean {
    return super.isValid() && !this.fullTextError;
  }

  public override summarize(): FullTextIndexDiagnosisSummary {
    return {
      ...super.summarize(),
      ...(this.fullTextError && { fullText: this.fullTextError }),
    };
  }
}
