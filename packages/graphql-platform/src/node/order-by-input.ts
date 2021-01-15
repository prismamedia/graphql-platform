import {
  addPath,
  isPublicEntry,
  Path,
  Public,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'assert';
import { GraphQLEnumType, GraphQLEnumValueConfig } from 'graphql';
import { Node } from '../node';
import { Leaf } from './component';
import { TSortValue } from './order-by-input/ast';

export * from './order-by-input/ast';

export interface ISort {
  readonly public: boolean;
  readonly name: string;
  readonly description?: string;
  readonly value: TSortValue;
}

export type TOrderByInputValue = string[];

export type TParsedOrderByInputValue = TSortValue[];

export class OrderByInput {
  public readonly public: boolean;
  public readonly name: string;
  public readonly description: string;

  public constructor(public readonly node: Node) {
    this.public = node.public;
    this.name = `${node.name}OrderByInput`;
    this.description = `Used to sort the "${node.name}" nodes`;
  }

  protected getLeafSorts(leaf: Leaf): ISort[] {
    const sorts: ISort[] = [];

    if (leaf.sortable) {
      sorts.push(
        {
          public: leaf.public,
          name: `${leaf.name}_ASC`,
          description: `Sort the "${this.node.name}" nodes from the lowest "${leaf.name}" leaf to the highest`,
          value: {
            kind: 'Leaf',
            leaf: leaf.name,
            direction: 'ASC',
          },
        },
        {
          public: leaf.public,
          name: `${leaf.name}_DESC`,
          description: `Sort the "${this.node.name}" nodes from the highest "${leaf.name}" leaf to the lowest`,
          value: {
            kind: 'Leaf',
            leaf: leaf.name,
            direction: 'DESC',
          },
        },
      );
    }

    return sorts;
  }

  @Memoize()
  public get sortMap(): ReadonlyMap<string, ISort> {
    const sorts: ISort[] = [];

    for (const component of this.node.componentMap.values()) {
      if (component instanceof Leaf) {
        sorts.push(...this.getLeafSorts(component));
      }
    }

    const sortMap = new Map<string, ISort>();

    for (const sort of sorts) {
      if (sortMap.has(sort.name)) {
        throw new Error(
          `"${this.name}" contains at least 2 sorts with the same name "${sort.name}"`,
        );
      }

      sortMap.set(sort.name, sort);
    }

    return sortMap;
  }

  @Memoize()
  public get publicSortMap(): ReadonlyMap<string, Public<ISort>> {
    return new Map([...this.sortMap].filter(isPublicEntry));
  }

  @Memoize()
  public get type(): GraphQLEnumType | undefined {
    assert(this.public, `"${this.name}" is private`);

    return this.publicSortMap.size > 0
      ? new GraphQLEnumType({
          name: this.name,
          description: this.description,
          values: Object.fromEntries(
            Array.from(this.publicSortMap.values(), ({ name, description }): [
              string,
              GraphQLEnumValueConfig,
            ] => [name, { value: name, description }]),
          ),
        })
      : undefined;
  }

  public parseValue(
    value: TOrderByInputValue,
    path?: Path,
  ): TParsedOrderByInputValue {
    if (!Array.isArray(value)) {
      throw new UnexpectedValueError(value, `an array`, path);
    }

    return value.map((name, index) => {
      const orderingExpression = this.sortMap.get(name);
      if (!orderingExpression) {
        throw new UnexpectedValueError(
          value,
          `not to contain the unknown ordering expression "${name}"`,
          addPath(path, index),
        );
      }

      return orderingExpression.value;
    });
  }
}
