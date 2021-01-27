import {
  ComponentInputField,
  ComponentInputFieldValue,
} from './fields/components';
import {
  ReverseEdgeInputField,
  ReverseEdgeInputFieldValue,
} from './fields/reverse-edge';
import { VirtualInputField, VirtualInputFieldValue } from './fields/virtual';

export * from './fields/components';
export * from './fields/reverse-edge';
export * from './fields/virtual';

export type InputFieldValue =
  | ComponentInputFieldValue
  | ReverseEdgeInputFieldValue
  | VirtualInputFieldValue;

export type InputField =
  | ComponentInputField
  | ReverseEdgeInputField
  | VirtualInputField;
