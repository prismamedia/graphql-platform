import {
  addPath,
  assertInputObject,
  GraphQLNonNullDecorator,
  isPublicEntry,
  Path,
  Public,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'assert';
import { GraphQLInputObjectType, GraphQLList, GraphQLNonNull } from 'graphql';
import { Node } from '../node';
import { Edge, Leaf, Scalars } from './component';
import { ReverseEdge } from './reverse-edge';
import { TFilterValue, TLeafFilterOperator } from './where-input/ast';
import { Filter } from './where-input/filter';
import { optimizeFilterValue } from './where-input/optimization';

export * from './where-input/ast';
export * from './where-input/filter';
export * from './where-input/optimization';

export type TWhereInputValue = { [filterName: string]: any };

export type TParsedWhereInputValue = TFilterValue;

export class WhereInput {
  public readonly public: boolean;
  public readonly name: string;
  public readonly description: string;

  public constructor(public readonly node: Node) {
    this.public = node.public;
    this.name = `${node.name}WhereInput`;
    this.description = `Used to filter the "${node.name}" nodes`;
  }

  protected getLeafFilters(leaf: Leaf): Filter[] {
    const filters: Filter[] = [];

    // eq
    if (leaf.isFilterableWith('eq')) {
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
      );
    }

    // not
    if (leaf.isFilterableWith('not')) {
      filters.push(
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
    }

    // is_null
    if (
      leaf.isFilterableWith('eq') &&
      leaf.isFilterableWith('not') &&
      leaf.nullable
    ) {
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
    for (const operator of <TLeafFilterOperator[]>['in', 'not_in']) {
      if (leaf.isFilterableWith(operator)) {
        filters.push(
          new Filter(this, `${leaf.name}_${operator}`, {
            public: leaf.public,
            type: GraphQLList(
              GraphQLNonNullDecorator(leaf.type, !leaf.nullable),
            ),
            parseValue: (value: any) => ({
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
    for (const operator of <TLeafFilterOperator[]>['gt', 'gte', 'lt', 'lte']) {
      if (leaf.isFilterableWith(operator)) {
        filters.push(
          new Filter(this, `${leaf.name}_${operator}`, {
            public: leaf.public,
            type: leaf.type,
            parseValue: (value, path) => ({
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

  protected getEdgeFilters(edge: Edge): Filter[] {
    const filters: Filter[] = [];

    // eq, not
    filters.push(
      new Filter(this, edge.name, {
        public: edge.public,
        type: () => edge.to.whereInput.type,
        nullable: edge.nullable,
        parseValue: (value, path) => ({
          kind: 'Edge',
          edge: edge.name,
          operator: 'eq',
          value: edge.to.whereInput.parseValue(value, path),
        }),
      }),

      new Filter(this, `${edge.name}_not`, {
        public: edge.public,
        type: () => edge.to.whereInput.type,
        nullable: edge.nullable,
        parseValue: (value, path) => ({
          kind: 'Edge',
          edge: edge.name,
          operator: 'not',
          value: edge.to.whereInput.parseValue(value, path),
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

  protected getReverseEdgeFilters(reverseEdge: ReverseEdge): Filter[] {
    const filters: Filter[] = [];

    if (reverseEdge.unique) {
      filters.push(
        new Filter(this, reverseEdge.name, {
          public: reverseEdge.public,
          type: () => reverseEdge.to.whereInput.type,
          parseValue: (value, path) => ({
            kind: 'ReverseEdge',
            reverseEdge: reverseEdge.name,
            operator: 'eq',
            value: reverseEdge.to.whereInput.parseValue(value, path),
          }),
        }),
        new Filter(this, `${reverseEdge.name}_not`, {
          public: reverseEdge.public,
          type: () => reverseEdge.to.whereInput.type,
          parseValue: (value, path) => ({
            kind: 'ReverseEdge',
            reverseEdge: reverseEdge.name,
            operator: 'not',
            value: reverseEdge.to.whereInput.parseValue(value, path),
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
          type: () => reverseEdge.to.whereInput.type,
          parseValue: (value, path) => ({
            kind: 'ReverseEdge',
            reverseEdge: reverseEdge.name,
            operator: 'none',
            value: reverseEdge.to.whereInput.parseValue(value, path),
          }),
        }),
        new Filter(this, `${reverseEdge.name}_some`, {
          public: reverseEdge.public,
          type: () => reverseEdge.to.whereInput.type,
          parseValue: (value, path) => ({
            kind: 'ReverseEdge',
            reverseEdge: reverseEdge.name,
            operator: 'some',
            value: reverseEdge.to.whereInput.parseValue(value, path),
          }),
        }),
        new Filter(this, `${reverseEdge.name}_every`, {
          public: reverseEdge.public,
          type: () => reverseEdge.to.whereInput.type,
          parseValue: (value, path) => ({
            kind: 'ReverseEdge',
            reverseEdge: reverseEdge.name,
            operator: 'every',
            value: reverseEdge.to.whereInput.parseValue(value, path),
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
  public get filterMap(): ReadonlyMap<string, Filter> {
    const filters: Filter[] = [];

    for (const component of this.node.componentMap.values()) {
      if (component instanceof Leaf) {
        filters.push(...this.getLeafFilters(component));
      } else {
        filters.push(...this.getEdgeFilters(component));
      }
    }

    for (const reverseEdge of this.node.reverseEdgeMap.values()) {
      filters.push(...this.getReverseEdgeFilters(reverseEdge));
    }

    filters.push(...this.getLogicalFilters());

    const filterMap = new Map<string, Filter>();

    for (const filter of filters) {
      if (filterMap.has(filter.name)) {
        throw new Error(
          `"${this.name}" contains at least 2 filters with the same name "${filter.name}"`,
        );
      }

      filterMap.set(filter.name, filter);
    }

    return filterMap;
  }

  @Memoize()
  public get publicFilterMap(): ReadonlyMap<string, Public<Filter>> {
    return new Map([...this.filterMap].filter(isPublicEntry));
  }

  @Memoize()
  public get type(): GraphQLInputObjectType {
    assert(this.public, `"${this.name}" is private`);

    assert(
      this.publicFilterMap.size > 0,
      `"${this.name}" expects at least one public filter`,
    );

    return new GraphQLInputObjectType({
      name: this.name,
      description: this.description,
      fields: () =>
        Object.fromEntries(
          Array.from(this.publicFilterMap.values(), (filter) => [
            filter.name,
            filter.graphqlInputFieldConfig,
          ]),
        ),
    });
  }

  public parseValue(
    value: TWhereInputValue | boolean | null | undefined,
    path: Path = addPath(undefined, this.name),
  ): TParsedWhereInputValue {
    if (value === null) {
      return {
        kind: 'Boolean',
        value: false,
      };
    } else if (typeof value === 'boolean') {
      return {
        kind: 'Boolean',
        value,
      };
    }

    const assertedValue = assertInputObject(
      value,
      this.filterMap.values(),
      path,
    );

    return optimizeFilterValue(
      {
        kind: 'Logical',
        operator: 'and',
        value: assertedValue
          ? Object.entries(assertedValue).map(([filterName, filterValue]) =>
              this.filterMap
                .get(filterName)!
                .parseValue(filterValue, addPath(path, filterName)),
            )
          : [],
      },
      this.node,
    );
  }
}
