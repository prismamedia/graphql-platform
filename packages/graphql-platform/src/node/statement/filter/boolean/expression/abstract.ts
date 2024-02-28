import { AbstractBooleanFilter } from '../../abstract.js';

export abstract class AbstractBooleanExpression extends AbstractBooleanFilter {
  public abstract readonly key: string;
}
