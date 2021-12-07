import {
  NodeValue,
  NullComponentValueError,
  RelationValue,
  UndefinedComponentValueError,
} from '@prismamedia/graphql-platform-core';
import {
  loadModuleMap,
  Maybe,
  MaybeUndefinedDecorator,
  POJO,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import inflector from 'inflection';
import { escapeId } from 'mysql';
import { Component, Relation } from '../../../resource';
import { Table } from '../table';
import { Column, ColumnDataType, ColumnValue } from './column';

export interface ColumnReferenceConfig {
  /** Optional, the column's name, default: guessed from relation and reference name */
  name?: Maybe<string>;
}

export class ColumnReference {
  readonly component: Component;

  public constructor(
    readonly table: Table,
    readonly relation: Relation,
    readonly reference: Column | ColumnReference,
  ) {
    this.component = relation;
  }

  @Memoize()
  public getReferencedColumn(): Column {
    return this.reference instanceof ColumnReference
      ? this.reference.getReferencedColumn()
      : this.reference;
  }

  @Memoize()
  public get config(): ColumnReferenceConfig {
    return (
      loadModuleMap(this.relation.config.columns).get(
        this.getReferencedColumn().field.name,
      ) || {}
    );
  }

  @Memoize()
  public get name(): string {
    return (
      (
        this.config.name ||
        `${this.relation.name}${inflector.camelize(this.reference.name, false)}`
      )
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

  public getValue(value: RelationValue): ColumnValue {
    if (typeof value === 'undefined') {
      throw new UndefinedComponentValueError(this.component);
    } else if (value === null) {
      if (!this.nullable) {
        throw new NullComponentValueError(this.component);
      }

      return null;
    }

    return this.reference.pickValue(value, true);
  }

  public pickValue<TStrict extends boolean>(
    node: NodeValue,
    strict?: TStrict,
  ): MaybeUndefinedDecorator<ColumnValue, TStrict> {
    const value = this.relation.pickValue(node, true, strict);

    return (
      typeof value !== 'undefined'
        ? this.getValue(value as RelationValue)
        : undefined
    ) as any;
  }

  public setValue(node: POJO, value: ColumnValue): void {
    if (value === null && !this.reference.nullable) {
      node[this.relation.name] = null;
    } else {
      if (!node[this.relation.name]) {
        node[this.relation.name] = Object.create(null);
      }

      this.reference.setValue(node[this.relation.name], value);
    }
  }
}
