import { InverseRelation, Relation } from './component';

export * from './any-relation/map';
export * from './any-relation/set';

export type AnyRelation = Relation | InverseRelation;
