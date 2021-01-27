import { EdgeField, EdgeFieldSelection } from './fields/edge';
import {
  EdgeExistenceField,
  EdgeExistenceFieldSelection,
} from './fields/edge-existence';
import { LeafField, LeafFieldSelection } from './fields/leaf';
import {
  ReverseEdgeField,
  ReverseEdgeFieldSelection,
} from './fields/reverse-edge';
import {
  ReverseEdgeCountField,
  ReverseEdgeCountFieldSelection,
} from './fields/reverse-edge-count';
import {
  ReverseEdgeExistenceField,
  ReverseEdgeExistenceFieldSelection,
} from './fields/reverse-edge-existence';
import {
  ReverseEdgesField,
  ReverseEdgesFieldSelection,
} from './fields/reverse-edges';
import { VirtualField } from './fields/virtual';

export * from './fields/edge';
export * from './fields/edge-existence';
export * from './fields/leaf';
export * from './fields/reverse-edge';
export * from './fields/reverse-edge-count';
export * from './fields/reverse-edge-existence';
export * from './fields/reverse-edges';
export * from './fields/virtual';

export type LeafAwareField = LeafField;

export type LeafAwareFieldSelection = ReturnType<LeafAwareField['select']>;

export function isLeafAwareFieldSelection(
  maybeLeafAwareFieldSelection: unknown,
): maybeLeafAwareFieldSelection is LeafAwareFieldSelection {
  return maybeLeafAwareFieldSelection instanceof LeafFieldSelection;
}

export type ReferenceAwareField = EdgeField | EdgeExistenceField;

export type ReferenceAwareFieldSelection = ReturnType<
  ReferenceAwareField['select']
>;

export function isReferenceAwareFieldSelection(
  maybeReferenceAwareFieldSelection: unknown,
): maybeReferenceAwareFieldSelection is ReferenceAwareFieldSelection {
  return (
    maybeReferenceAwareFieldSelection instanceof EdgeFieldSelection ||
    maybeReferenceAwareFieldSelection instanceof EdgeExistenceFieldSelection
  );
}

export type ComponentAwareField = LeafAwareField | ReferenceAwareField;

export type ComponentAwareFieldSelection = ReturnType<
  ComponentAwareField['select']
>;

export function isComponentAwareFieldSelection(
  maybeComponentAwareFieldSelection: unknown,
): maybeComponentAwareFieldSelection is ComponentAwareFieldSelection {
  return (
    isLeafAwareFieldSelection(maybeComponentAwareFieldSelection) ||
    isReferenceAwareFieldSelection(maybeComponentAwareFieldSelection)
  );
}

export type ReferrerAwareField =
  | ReverseEdgesField
  | ReverseEdgeCountField
  | ReverseEdgeField
  | ReverseEdgeExistenceField;

export type ReferrerAwareFieldSelection = ReturnType<
  ReferrerAwareField['select']
>;

export function isReferrerAwareFieldSelection(
  maybeReferrerAwareFieldSelection: unknown,
): maybeReferrerAwareFieldSelection is ReferrerAwareFieldSelection {
  return (
    maybeReferrerAwareFieldSelection instanceof ReverseEdgesFieldSelection ||
    maybeReferrerAwareFieldSelection instanceof
      ReverseEdgeCountFieldSelection ||
    maybeReferrerAwareFieldSelection instanceof ReverseEdgeFieldSelection ||
    maybeReferrerAwareFieldSelection instanceof
      ReverseEdgeExistenceFieldSelection
  );
}

export type Field = ComponentAwareField | ReferrerAwareField | VirtualField;

export type FieldValue = ReturnType<
  Exclude<Field, VirtualField>['assertValue']
>;

export type FieldSelection = ReturnType<Exclude<Field, VirtualField>['select']>;

export function isFieldSelection(
  maybeFieldSelection: unknown,
): maybeFieldSelection is FieldSelection {
  return (
    isComponentAwareFieldSelection(maybeFieldSelection) ||
    isReferrerAwareFieldSelection(maybeFieldSelection)
  );
}
