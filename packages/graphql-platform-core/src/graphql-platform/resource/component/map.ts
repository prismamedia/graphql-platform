import { SuperMapOfNamedObject } from '@prismamedia/graphql-platform-utils';
import { AnyComponent, Component } from './types';

export class ComponentMap<
  TComponent extends AnyComponent = Component,
> extends SuperMapOfNamedObject<TComponent> {}
