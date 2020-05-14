import { Memoize } from '@prismamedia/ts-memoize';
import inflector from 'inflection';
import {
  AnyRelationConfig,
  Relation,
  RelationConfig,
  RelationKind,
} from '../relation';

export * from './inverse/map';
export * from './inverse/set';

export class Inverse<TConfig extends AnyRelationConfig = RelationConfig> {
  public constructor(readonly relation: Relation<TConfig>) {}

  @Memoize()
  public get name(): string {
    return (
      this.relation.config.inversedBy ||
      inflector.camelize(
        this.isToOne() ? this.getTo().name : this.getTo().plural,
        true,
      )
    );
  }

  @Memoize()
  public get pascalCasedName(): string {
    return inflector.camelize(this.name, false);
  }

  @Memoize()
  public get description(): string {
    return `"${this.relation}"'s inverse relation`;
  }

  @Memoize()
  public get countName(): string {
    if (this.isToOne()) {
      throw new Error(
        `The "countName" property does not exist on the "toOne" ${this}"" relation.`,
      );
    }

    return `${inflector.singularize(this.name)}Count`;
  }

  @Memoize()
  public get countDescription(): string {
    return `"${this.relation}"'s inverse relation count`;
  }

  public getFrom() {
    return this.relation.getTo();
  }

  public getTo() {
    return this.relation.getFrom();
  }

  @Memoize()
  public toString(): string {
    return `${this.getFrom().name}.${this.name}`;
  }

  @Memoize()
  public getKind(): RelationKind {
    return this.relation.isUnique() ? RelationKind.ToOne : RelationKind.ToMany;
  }

  public isToOne(): boolean {
    return this.getKind() === RelationKind.ToOne;
  }

  public isToMany(): boolean {
    return this.getKind() === RelationKind.ToMany;
  }

  public getInverse() {
    return this.relation;
  }
}

export type AnyInverse = Inverse<any>;
