import {
  getPlainObjectKeys,
  Maybe,
  MaybePromise,
  SuperMapOfNamedObject,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { GraphQLEnumType, GraphQLEnumValueConfigMap } from 'graphql';
import { Field } from '../../resource/component';
import { AbstractInputType } from '../abstract-type';

export type OrderByInputValue = string[];

export interface OrderBySort {
  id: string;
  name: string;
  parse(parser: OrderByInputParser): Promise<void>;
}

export class OrderBySortMap extends SuperMapOfNamedObject<OrderBySort> {}

enum FieldOrderBySort {
  asc,
  desc,
}

export type FieldOrderBySortId = keyof typeof FieldOrderBySort;

type FieldOrderBySortConfigMap = Record<
  FieldOrderBySortId,
  (field: Field) => Maybe<OrderBySort['name']>
>;

export type OrderByInputParser = {
  parseFieldFilter(
    field: Field,
    sortId: FieldOrderBySortId,
  ): MaybePromise<void>;
};

export class OrderByInputType extends AbstractInputType {
  protected fieldSortConfigMap: FieldOrderBySortConfigMap = {
    asc: (field) => `${field.name}_ASC`,
    desc: (field) => `${field.name}_DESC`,
  };

  @Memoize()
  public getSortMap(): OrderBySortMap {
    const sortMap = new OrderBySortMap();

    for (const field of this.resource.getFieldSet()) {
      const ids = getPlainObjectKeys(this.fieldSortConfigMap);
      for (const id of ids) {
        const name = this.fieldSortConfigMap[id](field);
        if (name) {
          sortMap.set(name, {
            name,
            id,
            parse: async ({ parseFieldFilter }) => parseFieldFilter(field, id),
          });
        }
      }
    }

    return sortMap;
  }

  public async parse(
    parser: OrderByInputParser,
    value: Maybe<OrderByInputValue>,
  ) {
    const sortMap = this.getSortMap();
    if (value != null) {
      await Promise.all(
        value.map(async (sortName) => {
          const sort = sortMap.get(sortName);
          if (!sort) {
            throw new Error(
              `The "${this.resource.name}"'s orderBy sort "${sortName}" does not exist`,
            );
          }

          await sort.parse(parser);
        }),
      );
    }
  }

  @Memoize()
  public isSupported(): boolean {
    return this.getSortMap().size > 0;
  }

  @Memoize()
  public getGraphQLType() {
    const values: GraphQLEnumValueConfigMap = {};
    for (const name of this.getSortMap().keys()) {
      values[name] = { value: name };
    }

    return new GraphQLEnumType({
      name: [this.resource.name, 'OrderByInput'].join(''),
      values,
    });
  }
}
