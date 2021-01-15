import { CreateEdgeInputField } from './fields/edge';
import { CreateLeafInputField } from './fields/leaf';
import { CreateReverseEdgeInputField } from './fields/reverse-edge';

export * from './fields/edge';
export * from './fields/leaf';
export * from './fields/reverse-edge';

export type TCreateComponentInputField =
  | CreateLeafInputField
  | CreateEdgeInputField;

export type TCreateInputField =
  | TCreateComponentInputField
  | CreateReverseEdgeInputField;

export function isCreateComponentInputField(
  field: TCreateInputField,
): field is TCreateComponentInputField {
  return (
    field instanceof CreateLeafInputField ||
    field instanceof CreateEdgeInputField
  );
}

export function isCreateComponentInputEntry(
  entry: [string, TCreateInputField],
): entry is [string, TCreateComponentInputField] {
  return isCreateComponentInputField(entry[1]);
}

export function isCreateReverseEdgeInputField(
  field: TCreateInputField,
): field is CreateReverseEdgeInputField {
  return field instanceof CreateReverseEdgeInputField;
}

export function isCreateReverseEdgeInputEntry(
  entry: [string, TCreateInputField],
): entry is [string, CreateReverseEdgeInputField] {
  return isCreateReverseEdgeInputField(entry[1]);
}
