import { Field, FieldValue } from './field';
import { NormalizedRelationValue, Relation, RelationValue } from './relation';

export enum ManagementKind {
  /** The component's value comes from the system, a database or a hook, it cannot be provided by the client */
  Full = 'FULL',

  /** The component's value comes from either the client or fallbacks from the system */
  Optional = 'OPTIONAL',
}

export type ComponentValue = FieldValue | RelationValue;

export type NormalizedComponentValue = FieldValue | NormalizedRelationValue;

export type Component = Field | Relation;
