import {
  DateTimeType,
  type DateTimeTypeConfig,
} from './date-and-time/date-time.js';
import { DateType, type DateTypeConfig } from './date-and-time/date.js';
import {
  TimestampType,
  type TimestampTypeConfig,
} from './date-and-time/timestamp.js';

export * from './date-and-time/date-time.js';
export * from './date-and-time/date.js';
export * from './date-and-time/timestamp.js';

export type DateAndTimeDataTypeConfig =
  | DateTimeTypeConfig
  | DateTypeConfig
  | TimestampTypeConfig;

export type DateAndTimeDataType = DateTimeType | DateType | TimestampType;
