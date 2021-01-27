import { ComponentValue } from '../../components';
import { FieldValue } from './fields';

/**
 * Every node output have this shape
 */
export type NodeValue = {
  [fieldName: string]: FieldValue;
};

/**
 * A "unique value" fills a "unique constraint", identifying exactly one node
 *
 * -> think of a "UNIQUE INDEX" in SQL
 */
export type NodeUniqueValue = {
  [componentName: string]: ComponentValue;
};

/**
 * An "identifier" is a special "unique value" as it fills the "identifier constraint" (= the first defined "unique constraint")
 *
 * -> think of a "PRIMARY KEY" in SQL
 */
export type NodeIdentifier = NodeUniqueValue;

/**
 * A "record" includes all the components' value
 *
 * -> think of a "row" in SQL or a whole "document" in NoSQL
 */
export type NodeRecord = NodeIdentifier & {
  [componentName: string]: ComponentValue;
};
