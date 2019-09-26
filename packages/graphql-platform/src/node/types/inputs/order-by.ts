import {
  addPath,
  isIterable,
  isPublicEntry,
  Path,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'assert';
import {
  GraphQLEnumType,
  GraphQLEnumValueConfig,
  GraphQLInputType,
  GraphQLList,
  GraphQLNonNull,
} from 'graphql';
import type { Node } from '../../../node';
import { Leaf } from '../../../node/components';
import { TSortValue } from './order-by/ast';

export * from './order-by/ast';

export interface ISort {
  readonly public: boolean;
  readonly name: string;
  readonly description?: string;
  readonly value: TSortValue;
}

export type TOrderByNodeValue = Iterable<string>;

export class OrderByNodeInput {
  public readonly public: boolean;
  public readonly name: string;

  public constructor(public readonly node: Node) {
    this.public = node.public;
    this.name = `${node}OrderByInput`;
  }

  protected getLeafSorts(leaf: Leaf): ISort[] {
    const sorts: ISort[] = [];

    if (leaf.sortable) {
      sorts.push(
        {
          public: leaf.public,
          name: `${leaf.name}_ASC`,
          description: `Sort the "${this.node}" nodes from the lowest "${leaf.name}" leaf to the highest`,
          value: {
            kind: 'Leaf',
            leaf: leaf.name,
            direction: 'ASC',
          },
        },
        {
          public: leaf.public,
          name: `${leaf.name}_DESC`,
          description: `Sort the "${this.node}" nodes from the highest "${leaf.name}" leaf to the lowest`,
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
          `"${this.name}" contains at least 2 sorts with the same name: ${sort.name}`,
        );
      }

      sortMap.set(sort.name, sort);
    }

    return sortMap;
  }

  @Memoize()
  public get type(): GraphQLInputType | undefined {
    assert(this.public, `"${this.name}" is private`);

    const publicSortMap = new Map([...this.sortMap].filter(isPublicEntry));

    return publicSortMap.size > 0
      ? GraphQLList(
          GraphQLNonNull(
            new GraphQLEnumType({
              name: this.name,
              values: Object.fromEntries(
                Array.from(publicSortMap.values(), ({ name, description }): [
                  string,
                  GraphQLEnumValueConfig,
                ] => [name, { value: name, description }]),
              ),
            }),
          ),
        )
      : undefined;
  }

  public parseValue(values: TOrderByNodeValue, path?: Path): TSortValue[] {
    if (!isIterable(values)) {
      throw new UnexpectedValueError(
        values,
        `a list of non-null "${this.name}"`,
        path,
      );
    }

    return Array.from(values, (name, index) => {
      const orderingExpression = this.sortMap.get(name);
      if (!orderingExpression) {
        throw new UnexpectedValueError(
          values,
          `not to contain the unknown ordering expression "${name}"`,
          addPath(path, index),
        );
      }

      return orderingExpression.value;
    });
  }
}
