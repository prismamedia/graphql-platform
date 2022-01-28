import { CharType, type CharTypeConfig } from './string/char.js';
import { EnumType, type EnumTypeConfig } from './string/enum.js';
import { JsonType, type JsonTypeConfig } from './string/json.js';
import { TextType, type TextTypeConfig } from './string/text.js';
import { UuidType, type UuidTypeConfig } from './string/uuid.js';
import { VarCharType, type VarCharTypeConfig } from './string/var-char.js';

export * from './string/char.js';
export * from './string/enum.js';
export * from './string/json.js';
export * from './string/text.js';
export * from './string/uuid.js';
export * from './string/var-char.js';

export type StringDataTypeConfig =
  | CharTypeConfig
  | EnumTypeConfig
  | JsonTypeConfig
  | TextTypeConfig
  | UuidTypeConfig
  | VarCharTypeConfig;

export type StringDataType =
  | CharType
  | EnumType
  | JsonType
  | TextType
  | UuidType
  | VarCharType;
