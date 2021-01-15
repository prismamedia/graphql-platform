import { CustomField } from './fields/custom';
import { EdgeField } from './fields/edge';
import { EdgeExistenceField } from './fields/edge-existence';
import { LeafField } from './fields/leaf';
import { ReverseEdgeField } from './fields/reverse-edge';
import { ReverseEdgeCountField } from './fields/reverse-edge-count';
import { UniqueReverseEdgeField } from './fields/unique-reverse-edge';
import { UniqueReverseEdgeExistenceField } from './fields/unique-reverse-edge-existence';

export * from './fields/custom';
export * from './fields/edge';
export * from './fields/edge-existence';
export * from './fields/leaf';
export * from './fields/reverse-edge';
export * from './fields/reverse-edge-count';
export * from './fields/unique-reverse-edge';
export * from './fields/unique-reverse-edge-existence';

export type TField =
  | LeafField
  | EdgeField
  | EdgeExistenceField
  | UniqueReverseEdgeField
  | UniqueReverseEdgeExistenceField
  | ReverseEdgeField
  | ReverseEdgeCountField
  | CustomField;

export type TFieldSelectionKind = ReturnType<TField['parseFieldNode']>['kind'];

export type TFieldSelection<
  TKind extends TFieldSelectionKind = TFieldSelectionKind
> = Extract<ReturnType<TField['parseFieldNode']>, { kind: TKind }>;

export type TFieldValue = ReturnType<TField['assertValue']>;
