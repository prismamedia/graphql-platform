import {
  bigintScalarTypes,
  booleanScalarTypes,
  DateScalarTypes,
  isScalarTypeAmong,
  numberScalarTypes,
} from '@prismamedia/graphql-platform-scalars';
import {
  addPath,
  getOptionalFlag,
  isIterable,
  Path,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'assert';
import {
  assertValidName,
  GraphQLEnumType,
  GraphQLInputType,
  GraphQLList,
  GraphQLNonNull,
} from 'graphql';
import { Leaf, Model } from '../../../model';
import { SortDirection, SortValue } from './order-by/ast';

export * from './order-by/ast';

export type Sort = {
  public: boolean;
  name: string;
  description?: string;
  value: SortValue;
};

export type ReadonlySortMap = ReadonlyMap<Sort['name'], Sort>;

export type OrderByInputValue = Iterable<string>;

export class OrderByInputType {
  public readonly public: boolean;
  public readonly name: string;

  public constructor(public readonly model: Model) {
    this.public = model.public;
    this.name = assertValidName(`${model.name}OrderByInput`);
  }

  public toString(): string {
    return this.name;
  }

  protected getLeafSorts(leaf: Leaf): ReadonlyArray<Sort> {
    const sorts: Sort[] = [];

    const sortable = getOptionalFlag(
      leaf.config.inputs?.sortable,
      isScalarTypeAmong(leaf.type, [
        ...bigintScalarTypes,
        ...booleanScalarTypes,
        ...DateScalarTypes,
        ...numberScalarTypes,
      ]),
    );

    if (sortable) {
      sorts.push(
        {
          public: leaf.public,
          name: `${leaf.name}_ASC`,
          description: `Sort the "${this.model.nodeType}" nodes from the lowest "${leaf.name}" leaf to the highest`,
          value: {
            kind: 'Leaf',
            leaf: leaf.name,
            direction: SortDirection.Ascending,
          },
        },
        {
          public: leaf.public,
          name: `${leaf.name}_DESC`,
          description: `Sort the "${this.model.nodeType}" nodes from the highest "${leaf.name}" leaf to the lowest`,
          value: {
            kind: 'Leaf',
            leaf: leaf.name,
            direction: SortDirection.Descending,
          },
        },
      );
    }

    return Object.freeze(sorts);
  }

  @Memoize()
  public get sortMap(): ReadonlySortMap {
    const sorts: Sort[] = [];

    for (const component of this.model.componentMap.values()) {
      if (component instanceof Leaf) {
        sorts.push(...this.getLeafSorts(component));
      }
    }

    const sortMap = new Map<Sort['name'], Sort>();

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
  public get publicSortMap(): ReadonlySortMap {
    return new Map([...this.sortMap].filter(([, sort]) => sort.public));
  }

  @Memoize()
  public get type(): GraphQLInputType {
    assert(this.public, `"${this.name}" is private`);
    assert(
      this.publicSortMap.size > 0,
      `"${this.name}" expects at least one public "sort"`,
    );

    return new GraphQLList(
      new GraphQLNonNull(
        new GraphQLEnumType({
          name: this.name,
          description: `Sort the "${this.model.nodeType}" nodes`,
          values: Object.fromEntries(
            Array.from(this.publicSortMap.values(), (sort) => [
              sort.name,
              { value: sort.name, description: sort.description },
            ]),
          ),
        }),
      ),
    );
  }

  public assertValue(maybeValue: unknown, path?: Path): OrderByInputValue {
    if (typeof maybeValue === 'string' || !isIterable(maybeValue)) {
      throw new UnexpectedValueError(
        maybeValue,
        `an iterable of non-null "${this.name}"`,
        path,
      );
    }
  }

  public parseValue(maybeValue: OrderByInputValue, path?: Path): SortValue[] {
    if (typeof maybeValue === 'string' || !isIterable(maybeValue)) {
      throw new UnexpectedValueError(
        maybeValue,
        `a list of non-null "${this.name}"`,
        path,
      );
    }

    return Array.from(maybeValue, (name, index) => {
      const sort = this.sortMap.get(name);
      if (!sort) {
        throw new UnexpectedValueError(
          maybeValue,
          `not to contain the unknown ordering expression "${name}"`,
          addPath(path, index),
        );
      }

      return sort.value;
    });
  }
}
