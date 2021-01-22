import didyoumean2, { ReturnTypeEnums, ThresholdTypeEnums } from 'didyoumean2';

export function didYouMean(needle: string, haystack: Iterable<string>): string {
  return didyoumean2(needle, [...haystack], {
    returnType: ReturnTypeEnums.ALL_SORTED_MATCHES,
    thresholdType: ThresholdTypeEnums.EDIT_DISTANCE,
  }).join(', ');
}
