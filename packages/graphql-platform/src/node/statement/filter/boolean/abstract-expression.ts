import * as graphql from 'graphql';
import type { NodeFilterInputValue } from '../../../type/input/filter.js';
import { AbstractBooleanFilter } from '../abstract.js';

export abstract class AbstractBooleanExpression extends AbstractBooleanFilter {
  public abstract readonly key: string;

  public abstract override get ast(): graphql.ConstObjectValueNode;

  public abstract override get inputValue(): NonNullable<NodeFilterInputValue>;
}
