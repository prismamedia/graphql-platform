import {
  EdgeInputField,
  EdgeInputFieldValue,
  EdgeUpdate,
} from './components/edge';
import {
  LeafInputField,
  LeafInputFieldValue,
  LeafUpdate,
} from './components/leaf';

export * from './components/edge';
export * from './components/leaf';

export type ComponentInputField = LeafInputField | EdgeInputField;

export type ComponentInputFieldValue =
  | LeafInputFieldValue
  | EdgeInputFieldValue;

export type ComponentUpdate = LeafUpdate | EdgeUpdate;
