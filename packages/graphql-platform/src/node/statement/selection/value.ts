import type { SelectionExpression } from './expression.js';

export interface NodeSelectedValue {
  [key: SelectionExpression['key']]: ReturnType<
    SelectionExpression['parseValue']
  >;
}
