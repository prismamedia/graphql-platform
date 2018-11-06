import { Field } from './component/field';
import { Relation } from './component/relation';
import { Component } from './component/types';

export * from './component/field';
export * from './component/map';
export * from './component/relation';
export * from './component/set';
export * from './component/types';

export function isComponent(maybeComponent: unknown): maybeComponent is Component {
  return maybeComponent && (maybeComponent instanceof Field || maybeComponent instanceof Relation);
}
