import {
  bigintScalarTypes,
  DateScalarTypes,
  GraphQLURL,
  isScalarTypeAmong,
  numberScalarTypes,
  primitiveScalarTypes,
  Scalars,
} from '@prismamedia/graphql-platform-scalars';
import {
  addPath,
  assertInputObject,
  GraphQLNonNullDecorator,
  isNullish,
  Path,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import {
  assertValidName,
  GraphQLList,
  GraphQLNonNull,
  isEnumType,
} from 'graphql';
import { Model } from '../../../model';
import { Leaf, Reference } from '../../components';
import { Referrer } from '../../referrer';
import { FilterValue, LeafFilterOperator } from './where/ast';
import { Filter } from './where/filter';
import { optimizeFilterValue } from './where/optimization';

export * from './where/ast';
export * from './where/filter';
export * from './where/optimization';

export type WhereInputValue =
  // a combination of filters
  | Record<string, any>
  // "null" / "false" = "false"
  | null
  | false
  // "undefined" / "true" = "true"
  | undefined
  | true;

export class WhereInput {
  public readonly public: boolean;
  public readonly name: string;

  public constructor(public readonly model: Model) {
    this.public = model.public;
    this.name = assertValidName(`${model.name}WhereInput`);
  }

  public toString(): string {
    return this.name;
  }

  protected getLeafFilters(leaf: Leaf): Filter[] {
    const filters: Filter[] = [];

    // eq, not
    filters.push(
      new Filter(this, leaf.name, {
        public: leaf.public,
        type: leaf.type,
        nullable: leaf.nullable,
        parseValue: (value) => ({
          kind: 'Leaf',
          leaf: leaf.name,
          operator: 'eq',
          value,
        }),
      }),
      new Filter(this, `${leaf.name}_not`, {
        public: leaf.public,
        type: leaf.type,
        nullable: leaf.nullable,
        parseValue: (value) => ({
          kind: 'Leaf',
          leaf: leaf.name,
          operator: 'not',
          value,
        }),
      }),
    );

    // is_null
    if (leaf.nullable) {
      filters.push(
        new Filter(this, `${leaf.name}_is_null`, {
          public: leaf.public,
          type: Scalars.Boolean,
          parseValue: (value) => ({
            kind: 'Leaf',
            leaf: leaf.name,
            operator: value ? 'eq' : 'not',
            value: null,
          }),
        }),
      );
    }

    // in, not_in
    if (
      isEnumType(leaf.type) ||
      isScalarTypeAmong(leaf.type, [
        ...primitiveScalarTypes,
        ...DateScalarTypes,
        GraphQLURL,
      ])
    ) {
      for (const operator of <LeafFilterOperator[]>['in', 'not_in']) {
        filters.push(
          new Filter(this, `${leaf.name}_${operator}`, {
            public: leaf.public,
            type: GraphQLList(
              GraphQLNonNullDecorator(leaf.type, !leaf.nullable),
            ),
            parseValue: (value) => ({
              kind: 'Leaf',
              leaf: leaf.name,
              operator,
              value,
            }),
          }),
        );
      }
    }

    // gt, gte, lt, lte
    if (
      isScalarTypeAmong(leaf.type, [
        ...bigintScalarTypes,
        ...DateScalarTypes,
        ...numberScalarTypes,
      ])
    ) {
      for (const operator of <LeafFilterOperator[]>['gt', 'gte', 'lt', 'lte']) {
        filters.push(
          new Filter(this, `${leaf.name}_${operator}`, {
            public: leaf.public,
            type: leaf.type,
            parseValue: (value) => ({
              kind: 'Leaf',
              leaf: leaf.name,
              operator,
              value,
            }),
          }),
        );
      }
    }

    return filters;
  }

  protected getEdgeFilters(edge: Reference): Filter[] {
    const filters: Filter[] = [];

    // eq, not
    filters.push(
      new Filter(this, edge.name, {
        public: edge.public,
        type: () => edge.head.whereInputType.type,
        nullable: edge.nullable,
        parseValue: (value, path) => ({
          kind: 'Edge',
          edge: edge.name,
          operator: 'eq',
          value: edge.head.whereInputType.parseValue(value, path),
        }),
      }),

      new Filter(this, `${edge.name}_not`, {
        public: edge.public,
        type: () => edge.head.whereInputType.type,
        nullable: edge.nullable,
        parseValue: (value, path) => ({
          kind: 'Edge',
          edge: edge.name,
          operator: 'not',
          value: edge.head.whereInputType.parseValue(value, path),
        }),
      }),
    );

    // is_null
    if (edge.nullable) {
      filters.push(
        new Filter(this, `${edge.name}_is_null`, {
          public: edge.public,
          type: Scalars.Boolean,
          parseValue: (value, path) => ({
            kind: 'Edge',
            edge: edge.name,
            operator: 'eq',
            value: {
              kind: 'Boolean',
              value: !value,
            },
          }),
        }),
      );
    }

    return filters;
  }

  protected getReverseEdgeFilters(reverseEdge: Referrer): Filter[] {
    const filters: Filter[] = [];

    if (reverseEdge.unique) {
      filters.push(
        new Filter(this, reverseEdge.name, {
          public: reverseEdge.public,
          type: () => reverseEdge.head.whereInputType.type,
          parseValue: (value, path) => ({
            kind: 'ReverseEdge',
            reverseEdge: reverseEdge.name,
            operator: 'eq',
            value: reverseEdge.head.whereInputType.parseValue(value, path),
          }),
        }),
        new Filter(this, `${reverseEdge.name}_not`, {
          public: reverseEdge.public,
          type: () => reverseEdge.head.whereInputType.type,
          parseValue: (value, path) => ({
            kind: 'ReverseEdge',
            reverseEdge: reverseEdge.name,
            operator: 'not',
            value: reverseEdge.head.whereInputType.parseValue(value, path),
          }),
        }),
        new Filter(this, `${reverseEdge.name}_is_null`, {
          public: reverseEdge.public,
          type: Scalars.Boolean,
          parseValue: (value, path) => ({
            kind: 'ReverseEdge',
            reverseEdge: reverseEdge.name,
            operator: 'eq',
            value: {
              kind: 'Boolean',
              value: !value,
            },
          }),
        }),
      );
    } else {
      filters.push(
        new Filter(this, `${reverseEdge.name}_none`, {
          public: reverseEdge.public,
          type: () => reverseEdge.head.whereInputType.type,
          parseValue: (value, path) => ({
            kind: 'ReverseEdge',
            reverseEdge: reverseEdge.name,
            operator: 'none',
            value: reverseEdge.head.whereInputType.parseValue(value, path),
          }),
        }),
        new Filter(this, `${reverseEdge.name}_some`, {
          public: reverseEdge.public,
          type: () => reverseEdge.head.whereInputType.type,
          parseValue: (value, path) => ({
            kind: 'ReverseEdge',
            reverseEdge: reverseEdge.name,
            operator: 'some',
            value: reverseEdge.head.whereInputType.parseValue(value, path),
          }),
        }),
        new Filter(this, `${reverseEdge.name}_every`, {
          public: reverseEdge.public,
          type: () => reverseEdge.head.whereInputType.type,
          parseValue: (value, path) => ({
            kind: 'ReverseEdge',
            reverseEdge: reverseEdge.name,
            operator: 'every',
            value: reverseEdge.head.whereInputType.parseValue(value, path),
          }),
        }),
      );
    }

    return filters;
  }

  protected getLogicalFilters(): Filter[] {
    return [
      new Filter(this, 'AND', {
        public: this.public,
        type: () => GraphQLList(GraphQLNonNull(this.type)),
        parseValue: (value, path) => {
          if (!Array.isArray(value)) {
            throw new UnexpectedValueError(value, `a [${this.name}!]`, path);
          }

          return {
            kind: 'Logical',
            operator: 'and',
            value: value.map((value, index) =>
              this.parseValue(value, addPath(path, index)),
            ),
          };
        },
      }),
      new Filter(this, 'OR', {
        public: this.public,
        type: () => GraphQLList(GraphQLNonNull(this.type)),
        parseValue: (value, path) => {
          if (!Array.isArray(value)) {
            throw new UnexpectedValueError(value, `a [${this.name}!]`, path);
          }

          return {
            kind: 'Logical',
            operator: 'or',
            value: value.map((value, index) =>
              this.parseValue(value, addPath(path, index)),
            ),
          };
        },
      }),
      new Filter(this, 'NOT', {
        public: this.public,
        type: () => this.type,
        parseValue: (value, path) => ({
          kind: 'Logical',
          operator: 'not',
          value: this.parseValue(value, path),
        }),
      }),
    ];
  }

  @Memoize()
  public get fieldMap(): ReadonlyMap<string, Filter> {
    const filters: Filter[] = [];

    for (const component of this.model.componentMap.values()) {
      if (component instanceof Leaf) {
        filters.push(...this.getLeafFilters(component));
      } else {
        filters.push(...this.getEdgeFilters(component));
      }
    }

    for (const reverseEdge of this.model.referrerMap.values()) {
      filters.push(...this.getReverseEdgeFilters(reverseEdge));
    }

    filters.push(...this.getLogicalFilters());

    const fieldMap = new Map<string, Filter>();

    for (const filter of filters) {
      if (fieldMap.has(filter.name)) {
        throw new Error(
          `"${this.name}" contains at least 2 filters with the same name: ${filter.name}`,
        );
      }

      fieldMap.set(filter.name, filter);
    }

    return fieldMap;
  }

  public assertValue(
    maybeValue: unknown,
    path: Path,
  ): Readonly<WhereInputValue> {
    return Object.freeze(
      isNullish(maybeValue) || typeof maybeValue === 'boolean'
        ? maybeValue
        : assertInputObject(maybeValue, this.fieldMap.values(), path),
    );
  }

  public parseValue(maybeValue: unknown, path: Path): FilterValue {
    const assertedValue = this.assertValue(maybeValue, path);

    if (assertedValue === null) {
      return {
        kind: 'Boolean',
        value: false,
      };
    } else if (typeof assertedValue === 'boolean') {
      return {
        kind: 'Boolean',
        value: assertedValue,
      };
    }

    return optimizeFilterValue(
      {
        kind: 'Logical',
        operator: 'and',
        value: assertedValue
          ? Object.entries(assertedValue).map(([filterName, filterValue]) =>
              this.fieldMap
                .get(filterName)!
                .parseValue(filterValue, addPath(path, filterName)),
            )
          : [],
      },
      this.model,
    );
  }
}
