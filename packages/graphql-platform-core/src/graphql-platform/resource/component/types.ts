import { AnyField, Field, FieldHookMap, FieldValue, SerializedFieldValue } from './field';
import { AnyRelation, Relation, RelationHookMap, RelationValue, SerializedRelationValue } from './relation';

export enum ManagementKind {
  /** The component's value comes from the system, a database or a hook, it cannot be provided by the client */
  Full = 'FULL',

  /** The component's value comes from either the client or fallbacks from the system */
  Optional = 'OPTIONAL',
}

export type Component = Field | Relation;

export type AnyComponent = AnyField | AnyRelation;

export type List<TComponent extends AnyComponent = Component> = TComponent & {
  isList(): true;
};

export type ComponentHookMap = FieldHookMap | RelationHookMap;

export type ComponentValue = FieldValue | RelationValue;

export type SerializedComponentValue = SerializedFieldValue | SerializedRelationValue;
