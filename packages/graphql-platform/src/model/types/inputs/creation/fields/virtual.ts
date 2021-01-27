import { Input, InputConfig } from '@prismamedia/graphql-platform-utils';

export type VirtualInputFieldValue = any;

export type VirtualInputFieldConfig = InputConfig<VirtualInputFieldValue>;

export class VirtualInputField extends Input<VirtualInputFieldValue> {}
