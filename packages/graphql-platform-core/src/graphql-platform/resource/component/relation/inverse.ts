import inflector from 'inflection';
import { Memoize } from 'typescript-memoize';
import { Relation, RelationConfig, RelationKind } from '../relation';

export * from './inverse/map';
export * from './inverse/set';

export class Inverse<TConfig extends RelationConfig = RelationConfig> {
  public constructor(readonly relation: Relation<TConfig>) {}

  @Memoize()
  public get name(): string {
    return (
      this.relation.config.inversedBy ||
      inflector.camelize(this.isToOne() ? this.getTo().name : this.getTo().plural, true)
    );
  }

  @Memoize()
  public get description(): string {
    return `"${this.relation}"'s inverse relation`;
  }

  @Memoize()
  public get countName(): string {
    if (this.isToOne()) {
      throw new Error(`The "countName" property does not exist on the "toOne" ${this}"" relation.`);
    }

    return `${inflector.singularize(this.name)}Count`;
  }

  @Memoize()
  public get countDescription(): string {
    return `"${this.relation}"'s inverse relation count`;
  }

  @Memoize()
  public toString(): string {
    return `${this.relation.resource.name}.${this.name}`;
  }

  public getFrom() {
    return this.relation.getTo();
  }

  public getTo() {
    return this.relation.getFrom();
  }

  public getKind(): RelationKind {
    return this.relation.isUnique() ? RelationKind.toOne : RelationKind.toMany;
  }

  public isToOne(): boolean {
    return this.getKind() === RelationKind.toOne;
  }

  public isToMany(): boolean {
    return this.getKind() === RelationKind.toMany;
  }

  public getInverse() {
    return this.relation;
  }
}
