import type {
  Nillable,
  PlainObject,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import type { Component } from '../../../../definition/component.js';
import { AbstractNodeFieldOutputType } from '../abstract-field.js';

export abstract class AbstractComponentOutputType<
  TArgs extends Nillable<PlainObject>,
> extends AbstractNodeFieldOutputType<TArgs> {
  public constructor(public readonly component: Component) {
    super();
  }

  @Memoize()
  public override isPublic(): boolean {
    return this.component.isPublic();
  }
}
