import { NodeValue } from '@prismamedia/graphql-platform-core';
import { isScalar, loadModuleMap, Maybe, POJO } from '@prismamedia/graphql-platform-utils';
import inflector from 'inflection';
import { escapeId } from 'mysql';
import { Memoize } from 'typescript-memoize';
import { Component, Relation } from '../../../resource';
import { Table } from '../table';
import { Column, ColumnDataType, ColumnValue } from './column';

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

  public parseValue(value: unknown): ColumnValue | undefined {
    if (typeof value !== 'undefined') {
      if (value === null) {
        if (this.nullable) {
          return null;
        } else {
          throw new Error(`The "${this}" column is not nullable.`);
        }
      } else if (isScalar(value)) {
        return value;
      } else {
        throw new Error(`The "${this}" column's value has to be a scalar: "${value}" given.`);
      }
    }

    return undefined;
  }

  public getValue(node: POJO): ColumnValue | undefined {
    const relatedNode = this.relation.getValue(node);
    if (typeof relatedNode !== 'undefined') {
      return relatedNode ? this.reference.getValue(relatedNode) : null;
    }

    return undefined;
  }

  public assertValue(node: POJO): ColumnValue {
    const parsedValue = this.getValue(node);
    if (typeof parsedValue === 'undefined') {
      throw new Error(`The "${this}" column's value is not defined.`);
    }

    return parsedValue;
  }

  public setValue(node: POJO, value: unknown): void {
    const parsedValue = this.parseValue(value);
    if (typeof parsedValue !== 'undefined') {
      if (typeof node[this.relation.name] === 'undefined' || node[this.relation.name] === null) {
        node[this.relation.name] = {};
      }

      this.reference.setValue(node[this.relation.name] as NodeValue, parsedValue);
    }
  }
}
