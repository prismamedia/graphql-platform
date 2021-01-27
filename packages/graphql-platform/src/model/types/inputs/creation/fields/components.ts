import { EdgeInputField, EdgeInputFieldValue } from './components/edge';
import { LeafInputField, LeafInputFieldValue } from './components/leaf';

export * from './components/edge';
export * from './components/leaf';

export type ComponentInputField = LeafInputField | EdgeInputField;

export type ComponentInputFieldValue =
  | LeafInputFieldValue
  | EdgeInputFieldValue;
