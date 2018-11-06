import { SuperMapOfNamedObject } from '@prismamedia/graphql-platform-utils';
import { Component } from './types';

export class ComponentMap<TComponent extends Component = Component> extends SuperMapOfNamedObject<TComponent> {}
