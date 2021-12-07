import {
  getPlainObjectEntries,
  GraphQLNonNullDecorator,
  isPlainObject,
  Maybe,
  MaybePromise,
  POJO,
  SuperMapOfNamedObject,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import {
  GraphQLBoolean,
  GraphQLInputFieldConfig,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
} from 'graphql';
import { Field, InverseRelation, Relation } from '../../resource';
import { AbstractInputType } from '../abstract-type';

export type WhereInputValue = { [filterName: string]: any };

export interface WhereFilter {
  id: string;
  name: string;
  fieldConfig: GraphQLInputFieldConfig;
  clean?(value: any): any;
  parse(parser: WhereInputParser, value: any): Promise<void>;
}

export class WhereFilterMap extends SuperMapOfNamedObject<WhereFilter> {}

type WhereFilterConfig = Omit<WhereFilter, 'id' | 'parse'>;

enum FieldWhereFilter {
  eq,
  not,
  is_null,
  in,
  not_in,
  contains,
  not_contains,
  starts_with,
  not_starts_with,
  ends_with,
  not_ends_with,
  lt,
  lte,
  gt,
  gte,
}

export type FieldWhereFilterId = keyof typeof FieldWhereFilter;

type FieldWhereFilterConfigMap = Record<
  FieldWhereFilterId,
  (field: Field) => Maybe<WhereFilterConfig>
>;

enum RelationWhereFilter {
  eq,
  is_null,
}

export type RelationWhereFilterId = keyof typeof RelationWhereFilter;

type RelationWhereFilterConfigMap = Record<
  RelationWhereFilterId,
  (relation: Relation) => Maybe<WhereFilterConfig>
>;

enum InverseRelationWhereFilter {
  eq,
  is_null,
  some,
}

export type InverseRelationWhereFilterId =
  keyof typeof InverseRelationWhereFilter;

type InverseRelationWhereFilterConfigMap = Record<
  InverseRelationWhereFilterId,
  (inverseRelation: InverseRelation) => Maybe<WhereFilterConfig>
>;

enum LogicalOperatorWhereFilter {
  and,
  or,
  not,
}

export type LogicalOperatorWhereFilterId =
  keyof typeof LogicalOperatorWhereFilter;

type LogicalOperatorWhereFilterConfigMap = Record<
  LogicalOperatorWhereFilterId,
  () => Maybe<WhereFilterConfig>
>;

export type WhereInputParser = {
  parseFieldFilter(
    field: Field,
    filterId: FieldWhereFilterId,
    value: any,
  ): MaybePromise<void>;
  parseRelationFilter(
    relation: Relation,
    filterId: RelationWhereFilterId,
    value: any,
  ): MaybePromise<void>;
  parseInverseRelationFilter(
    inverseRelation: InverseRelation,
    filterId: InverseRelationWhereFilterId,
    value: any,
  ): MaybePromise<void>;
  parseLogicalOperatorFilter(
    filterId: LogicalOperatorWhereFilterId,
    value: any,
  ): MaybePromise<void>;
};

export class WhereInputType extends AbstractInputType {
  protected fieldFilterConfigMap: FieldWhereFilterConfigMap = {
    eq: (field) => ({
      name: field.name,
      clean: (value: unknown) => {
        if (value === null && !field.isNullable()) {
          throw new Error(
            `The "${field.resource}.${field.name}" operator does not accept the "null" value as the field is non-nullable.`,
          );
        }

        return value;
      },
      fieldConfig: { type: field.getType() },
    }),
    not: (field) => ({
      name: `${field.name}_not`,
      clean: (value: unknown) => {
        if (value === null && !field.isNullable()) {
          throw new Error(
            `The "${field.resource}.${field.name}_not" operator does not accept the "null" value as the field is non-nullable.`,
          );
        }

        return value;
      },
      fieldConfig: { type: field.getType() },
    }),
    is_null: (field) =>
      field.isNullable()
        ? {
            name: `${field.name}_is_null`,
            clean: (value: unknown) =>
              typeof value === 'boolean' ? value : undefined,
            fieldConfig: { type: GraphQLBoolean },
          }
        : null,
    in: (field) => ({
      name: `${field.name}_in`,
      clean: (value: unknown) =>
        Array.isArray(value) ? [...new Set(value)] : undefined,
      fieldConfig: {
        type: GraphQLList(
          GraphQLNonNullDecorator(field.getType(), !field.isNullable()),
        ),
      },
    }),
    not_in: (field) => ({
      name: `${field.name}_not_in`,
      clean: (value: unknown) =>
        Array.isArray(value) ? [...new Set(value)] : undefined,
      fieldConfig: {
        type: GraphQLList(
          GraphQLNonNullDecorator(field.getType(), !field.isNullable()),
        ),
      },
    }),
    contains: (field) =>
      ['String'].includes(field.getType().name)
        ? {
            name: `${field.name}_contains`,
            clean: (value: null | string) => value || undefined,
            fieldConfig: { type: field.getType() },
          }
        : null,
    not_contains: (field) =>
      ['String'].includes(field.getType().name)
        ? {
            name: `${field.name}_not_contains`,
            clean: (value: null | string) => value || undefined,
            fieldConfig: { type: field.getType() },
          }
        : null,
    starts_with: (field) =>
      ['String'].includes(field.getType().name)
        ? {
            name: `${field.name}_starts_with`,
            clean: (value: null | string) => value || undefined,
            fieldConfig: { type: field.getType() },
          }
        : null,
    not_starts_with: (field) =>
      ['String'].includes(field.getType().name)
        ? {
            name: `${field.name}_not_starts_with`,
            clean: (value: null | string) => value || undefined,
            fieldConfig: { type: field.getType() },
          }
        : null,
    ends_with: (field) =>
      ['String'].includes(field.getType().name)
        ? {
            name: `${field.name}_ends_with`,
            clean: (value: null | string) => value || undefined,
            fieldConfig: { type: field.getType() },
          }
        : null,
    not_ends_with: (field) =>
      ['String'].includes(field.getType().name)
        ? {
            name: `${field.name}_not_ends_with`,
            clean: (value: null | string) => value || undefined,
            fieldConfig: { type: field.getType() },
          }
        : null,
    lt: (field) =>
      ['String', 'Int', 'Float', 'DateTime', 'Date', 'Time'].includes(
        field.getType().name,
      )
        ? {
            name: `${field.name}_lt`,
            clean: (value: unknown) => (value !== null ? value : undefined),
            fieldConfig: { type: field.getType() },
          }
        : null,
    lte: (field) =>
      ['String', 'Int', 'Float', 'DateTime', 'Date', 'Time'].includes(
        field.getType().name,
      )
        ? {
            name: `${field.name}_lte`,
            clean: (value: unknown) => (value !== null ? value : undefined),
            fieldConfig: { type: field.getType() },
          }
        : null,
    gt: (field) =>
      ['String', 'Int', 'Float', 'DateTime', 'Date', 'Time'].includes(
        field.getType().name,
      )
        ? {
            name: `${field.name}_gt`,
            clean: (value: unknown) => (value !== null ? value : undefined),
            fieldConfig: { type: field.getType() },
          }
        : null,
    gte: (field) =>
      ['String', 'Int', 'Float', 'DateTime', 'Date', 'Time'].includes(
        field.getType().name,
      )
        ? {
            name: `${field.name}_gte`,
            clean: (value: unknown) => (value !== null ? value : undefined),
            fieldConfig: { type: field.getType() },
          }
        : null,
  };

  protected relationFilterConfigMap: RelationWhereFilterConfigMap = {
    eq: (relation) => ({
      name: relation.name,
      clean: (value: unknown) => {
        if (value === null) {
          if (relation.isNullable()) {
            return value;
          }

          throw new Error(
            `The "${relation.resource}.${relation.name}" operator does not accept the "null" value as the relation is non-nullable.`,
          );
        }

        return relation.getTo().getInputType('Where').clean(value);
      },
      fieldConfig: {
        type: relation.getTo().getInputType('Where').getGraphQLType(),
      },
    }),
    is_null: (relation) =>
      relation.isNullable()
        ? {
            name: `${relation.name}_is_null`,
            clean: (value: unknown) =>
              typeof value === 'boolean' ? value : undefined,
            fieldConfig: {
              type: GraphQLBoolean,
            },
          }
        : null,
  };

  protected inverseRelationFilterConfigMap: InverseRelationWhereFilterConfigMap =
    {
      eq: (relationInverse) =>
        relationInverse.isToOne()
          ? {
              name: relationInverse.name,
              clean: (value: unknown) =>
                value === null
                  ? value
                  : relationInverse.getTo().getInputType('Where').clean(value),
              fieldConfig: {
                type: relationInverse
                  .getTo()
                  .getInputType('Where')
                  .getGraphQLType(),
              },
            }
          : null,
      is_null: (relationInverse) =>
        relationInverse.isToOne()
          ? {
              name: `${relationInverse.name}_is_null`,
              clean: (value: unknown) =>
                typeof value === 'boolean' ? value : undefined,
              fieldConfig: {
                type: GraphQLBoolean,
              },
            }
          : null,
      some: (relationInverse) =>
        relationInverse.isToMany()
          ? {
              name: `${relationInverse.name}_some`,
              clean: (value: unknown) =>
                relationInverse.getTo().getInputType('Where').clean(value),
              fieldConfig: {
                type: relationInverse
                  .getTo()
                  .getInputType('Where')
                  .getGraphQLType(),
              },
            }
          : null,
    };

  protected logicalOperatorFilterConfigMap: LogicalOperatorWhereFilterConfigMap =
    {
      and: () => ({
        name: 'AND',
        clean: (value: unknown) => {
          const cleanedValues = Array.isArray(value)
            ? value.reduce((cleanedValues: any[], value) => {
                const cleanedValue = this.clean(value);
                if (typeof cleanedValue !== 'undefined') {
                  cleanedValues.push(cleanedValue);
                }

                return cleanedValues;
              }, [])
            : [];

          return cleanedValues.length > 0 ? cleanedValues : undefined;
        },
        fieldConfig: {
          type: GraphQLList(GraphQLNonNull(this.getGraphQLType())),
        },
      }),
      or: () => ({
        name: 'OR',
        clean: (value: unknown) => {
          const cleanedValues = Array.isArray(value)
            ? value.reduce((cleanedValues: any[], value) => {
                const cleanedValue = this.clean(value);
                if (typeof cleanedValue !== 'undefined') {
                  cleanedValues.push(cleanedValue);
                }

                return cleanedValues;
              }, [])
            : [];

          return cleanedValues.length > 0 ? cleanedValues : undefined;
        },
        fieldConfig: {
          type: GraphQLList(GraphQLNonNull(this.getGraphQLType())),
        },
      }),
      not: () => ({
        name: 'NOT',
        clean: (value: unknown) => this.clean(value),
        fieldConfig: { type: this.getGraphQLType() },
      }),
    };

  @Memoize()
  public getFilterMap(): WhereFilterMap {
    const filterMap = new WhereFilterMap();

    for (const field of this.resource.getFieldSet()) {
      for (const [id, configProvider] of getPlainObjectEntries(
        this.fieldFilterConfigMap,
      )) {
        const config = configProvider(field);
        if (config) {
          filterMap.set(config.name, {
            ...config,
            id,
            parse: async ({ parseFieldFilter }, value) =>
              parseFieldFilter(field, id, value),
          });
        }
      }
    }

    for (const relation of this.resource.getRelationSet()) {
      for (const [id, configProvider] of getPlainObjectEntries(
        this.relationFilterConfigMap,
      )) {
        const config = configProvider(relation);
        if (config) {
          filterMap.set(config.name, {
            ...config,
            id,
            parse: async ({ parseRelationFilter }, value) =>
              parseRelationFilter(relation, id, value),
          });
        }
      }
    }

    for (const inverseRelation of this.resource.getInverseRelationSet()) {
      for (const [id, configProvider] of getPlainObjectEntries(
        this.inverseRelationFilterConfigMap,
      )) {
        const config = configProvider(inverseRelation);
        if (config) {
          filterMap.set(config.name, {
            ...config,
            id,
            parse: async ({ parseInverseRelationFilter }, value) =>
              parseInverseRelationFilter(inverseRelation, id, value),
          });
        }
      }
    }

    for (const [id, configProvider] of getPlainObjectEntries(
      this.logicalOperatorFilterConfigMap,
    )) {
      const config = configProvider();
      if (config) {
        filterMap.set(config.name, {
          ...config,
          id,
          parse: async ({ parseLogicalOperatorFilter }, value) =>
            parseLogicalOperatorFilter(id, value),
        });
      }
    }

    return filterMap;
  }

  public clean(value: unknown): POJO | undefined {
    if (isPlainObject(value)) {
      const cleanedValue = Object.create(null);

      for (const [filterName, filterValue] of Object.entries(value)) {
        if (typeof filterValue !== 'undefined') {
          const filter = this.getFilterMap().assert(filterName);

          const cleanedFilterValue = filter.clean
            ? filter.clean(filterValue)
            : filterValue;
          if (typeof cleanedFilterValue !== 'undefined') {
            cleanedValue[filterName] = cleanedFilterValue;
          }
        }
      }

      return Object.keys(cleanedValue).length > 0 ? cleanedValue : undefined;
    }

    return undefined;
  }

  public async parse(parser: WhereInputParser, value: unknown) {
    const cleanedValue = this.clean(value);
    if (cleanedValue) {
      await Promise.all(
        Object.entries(cleanedValue).map(async ([filterName, filterValue]) =>
          this.getFilterMap().assert(filterName).parse(parser, filterValue),
        ),
      );
    }
  }

  @Memoize()
  public getGraphQLType() {
    return new GraphQLInputObjectType({
      name: [this.resource.name, 'WhereInput'].join(''),
      description: `Filters the "${this.resource}" nodes by specifying some conditions`,
      fields: () => {
        const fields: GraphQLInputFieldConfigMap = {};

        for (const { name, fieldConfig } of this.getFilterMap().values()) {
          fields[name] = fieldConfig;
        }

        return fields;
      },
    });
  }
}
