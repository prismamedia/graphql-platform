import { CustomField } from './fields/custom';
import { NodeOutputEdgeField } from './fields/edge';
import { NodeOutputEdgeExistenceField } from './fields/edge-existence';
import { NodeOutputLeafField } from './fields/leaf';
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

export type TNodeOutputField =
  | NodeOutputLeafField
  | NodeOutputEdgeField
  | NodeOutputEdgeExistenceField
  | UniqueReverseEdgeField
  | UniqueReverseEdgeExistenceField
  | ReverseEdgeField
  | ReverseEdgeCountField
  | CustomField;

export type TNodeOutputSelectionKind = ReturnType<
  TNodeOutputField['parseFieldNode']
>['kind'];

export type TNodeOutputSelection<
  TKind extends TNodeOutputSelectionKind = TNodeOutputSelectionKind
> = Extract<ReturnType<TNodeOutputField['parseFieldNode']>, { kind: TKind }>;

export type TNodeOutputFieldValue = ReturnType<TNodeOutputField['assertValue']>;
