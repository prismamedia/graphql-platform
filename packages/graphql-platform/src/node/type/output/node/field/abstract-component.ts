import type * as utils from '@prismamedia/graphql-platform-utils';
import { MMethod } from '@prismamedia/memoize';
import type { Component } from '../../../../definition/component.js';
import { NodeOutputType } from '../../node.js';
import { AbstractFieldOutputType } from '../abstract-field.js';

export abstract class AbstractComponentOutputType<
  TArgs extends utils.Nillable<utils.PlainObject>,
> extends AbstractFieldOutputType<TArgs> {
  public constructor(
    public readonly parent: NodeOutputType,
    public readonly component: Component,
  ) {
    super();
  }

  @MMethod()
  public override isPublic(): boolean {
    return this.component.isPublic();
  }
}
