import { NodeValue } from '@prismamedia/graphql-platform-core';
import { loadModuleMap, Maybe, MaybeUndefinedDecorator, POJO } from '@prismamedia/graphql-platform-utils';
import inflector from 'inflection';
import { escapeId } from 'mysql';
import { Memoize } from 'typescript-memoize';
import { Component, Relation } from '../../../resource';
import { Table } from '../table';
import { Column, ColumnDataType, ColumnValue, isColumnValue } from './column';

export interface ColumnReferenceConfig {
  /** Optional, the column's name, default: guessed from relation and reference name */
  name?: Maybe<string>;
}

export class ColumnReference {
  readonly component: Component;

  public constructor(readonly table: Table, readonly relation: Relation, readonly reference: Column | ColumnReference) {
    this.component = relation;
  }

  @Memoize()
  public getReferencedColumn(): Column {
    return this.reference instanceof ColumnReference ? this.reference.getReferencedColumn() : this.reference;
  }

  @Memoize()
  public get config(): ColumnReferenceConfig {
    return loadModuleMap(this.relation.config.columns).get(this.getReferencedColumn().field.name) || {};
  }

  @Memoize()
  public get name(): string {
    return (
      (this.config.name || `${this.relation.name}${inflector.camelize(this.reference.name, false)}`)
        // cf: https://dev.mysql.com/doc/refman/8.0/en/identifiers.html
        .substr(0, 64)
    );
  }

  public getEscapedName(alias?: string): string {
    return `${alias ? `${escapeId(alias)}.` : ''}${escapeId(this.name)}`;
  }

  @Memoize()
  public toString(): string {
    return `${this.table}.${this.name}`;
  }

  public get dataType(): ColumnDataType {
    return this.getReferencedColumn().dataType;
  }

  public get autoIncrement(): boolean {
    return false;
  }

  @Memoize()
  public get nullable(): boolean {
    return this.relation.isNullable() || this.reference.nullable;
  }

  public get default(): string | undefined {
    return undefined;
  }

  public get comment(): string | undefined {
    return undefined;
  }

  public getValue<TStrict extends boolean>(node: POJO, strict: TStrict): MaybeUndefinedDecorator<ColumnValue, TStrict> {
    const relatedNode = this.relation.getValue(node, strict);
    if (typeof relatedNode !== 'undefined') {
      if (relatedNode === null) {
        if (!this.nullable) {
          throw new Error(`The "${this}" column reference's value cannot be null`);
        }

        return null as any;
      }

      return this.reference.getValue(relatedNode as NodeValue, strict);
    }

    if (strict) {
      throw new Error(`The "${this}" column reference's value cannot be undefined`);
    }

    return undefined as any;
  }

  public setValue(node: POJO, value: ColumnValue | undefined): void {
    if (isColumnValue(value, this.nullable)) {
      let relatedNode = this.relation.getValue(node, false);
      if (relatedNode === null) {
        throw new Error(`The "${this}" column reference's cannot be set on a "null" relation`);
      }

      if (typeof relatedNode === 'undefined' && value != null) {
        relatedNode = {} as NodeValue;
      }

      if (relatedNode) {
        this.reference.setValue(relatedNode, value);
        this.relation.setValue(node, relatedNode);
      }
    }
  }
}
