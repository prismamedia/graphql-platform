import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import type { Edge, Node } from '../../../node.js';
import { Leaf, type LeafValue } from '../../definition/component/leaf.js';
import type { MultipleReverseEdge } from '../../definition/reverse-edge/multiple.js';
import { UniqueReverseEdge } from '../../definition/reverse-edge/unique.js';
import type { OperationContext } from '../../operation/context.js';
import {
  AndOperation,
  BooleanFilter,
  EdgeExistsFilter,
  FalseValue,
  LeafComparisonFilter,
  LeafFullTextFilter,
  LeafInFilter,
  MultipleReverseEdgeCountFilter,
  MultipleReverseEdgeExistsFilter,
  NodeFilter,
  NotOperation,
  OrOperation,
  TrueValue,
  UniqueReverseEdgeExistsFilter,
  sortableLeafComparisonOperatorSet,
} from '../../statement/filter.js';
import {
  BooleanOperationFilterInputType,
  EdgeFilterInputType,
  FieldFilterInputType,
  LeafFilterInputType,
  ReverseEdgeFilterInputType,
} from './filter/field.js';

export * from './filter/field.js';

export type NodeFilterInputValue = utils.Nillable<utils.PlainObject>;

export type NodeFilterInputTypeOverride = {
  name?: string;
  description?: string;
};

export class NodeFilterInputType extends utils.ObjectInputType<FieldFilterInputType> {
  public static getLeafFields(leaf: Leaf): LeafFilterInputType[] {
    const fields: LeafFilterInputType[] = (['eq', 'not'] as const).map(
      (operator) =>
        new LeafFilterInputType<LeafValue>(leaf, operator, {
          type: utils.nonNullableInputTypeDecorator(
            leaf.type,
            !leaf.isNullable(),
          ),
          filter: (value, _context, _path) =>
            new LeafComparisonFilter(leaf, operator, value),
        }),
    );

    // is_null
    if (leaf.isNullable()) {
      fields.push(
        new LeafFilterInputType<boolean>(leaf, 'is_null', {
          type: new utils.NonNullableInputType(scalars.typesByName.Boolean),
          filter: (value, _context, _path) =>
            new LeafComparisonFilter(leaf, value ? 'eq' : 'not', null),
        }),
      );
    }

    // in, not_in
    if (
      graphql.isEnumType(leaf.type) ||
      (leaf.type === scalars.typesByName.Boolean && leaf.isNullable()) ||
      ![
        scalars.typesByName.DraftJS,
        scalars.typesByName.JSONArray,
        scalars.typesByName.JSONObject,
      ].includes(leaf.type as any)
    ) {
      fields.push(
        new LeafFilterInputType<LeafValue[]>(leaf, 'in', {
          type: new utils.NonNullableInputType(
            new utils.ListableInputType(
              new utils.NonOptionalInputType(
                utils.nonNullableInputTypeDecorator(
                  leaf.type,
                  !leaf.isNullable(),
                ),
              ),
            ),
          ),
          filter: (values, _context, _path) =>
            LeafInFilter.create(leaf, values),
        }),
        new LeafFilterInputType<LeafValue[]>(leaf, 'not_in', {
          type: new utils.NonNullableInputType(
            new utils.ListableInputType(
              new utils.NonOptionalInputType(
                utils.nonNullableInputTypeDecorator(
                  leaf.type,
                  !leaf.isNullable(),
                ),
              ),
            ),
          ),
          filter: (values, _context, _path) =>
            NotOperation.create(LeafInFilter.create(leaf, values)),
        }),
      );
    }

    // gt, gte, lt, lte
    if (leaf.isSortable()) {
      for (const operator of sortableLeafComparisonOperatorSet) {
        fields.push(
          new LeafFilterInputType<NonNullable<LeafValue>>(leaf, operator, {
            type: new utils.NonNullableInputType(leaf.type),
            filter: (value, _context, _path) =>
              new LeafComparisonFilter(leaf, operator, value),
          }),
        );
      }
    }

    // Full-text search
    // contains, starts_with, ends_with
    if (
      [
        scalars.typesByName.DraftJS,
        scalars.typesByName.NonEmptyString,
        scalars.typesByName.NonEmptyTrimmedString,
        scalars.typesByName.String,
      ].includes(leaf.type as any)
    ) {
      for (const operator of [
        'contains',
        'starts_with',
        'ends_with',
      ] as const) {
        fields.push(
          new LeafFilterInputType<string>(leaf, operator, {
            type: new utils.NonNullableInputType(
              scalars.typesByName.NonEmptyString,
            ),
            filter: (value, _context, _path) =>
              new LeafFullTextFilter(leaf, operator, value),
          }),
          new LeafFilterInputType<string>(leaf, `not_${operator}`, {
            type: new utils.NonNullableInputType(
              scalars.typesByName.NonEmptyString,
            ),
            filter: (value, _context, _path) =>
              NotOperation.create(
                new LeafFullTextFilter(leaf, operator, value),
              ),
          }),
        );
      }
    }

    return fields;
  }

  public static getEdgeFields(
    edge: Edge,
    headFilterInputType: NodeFilterInputType = edge.head.filterInputType,
  ): EdgeFilterInputType[] {
    const fields: EdgeFilterInputType[] = [
      new EdgeFilterInputType<NodeFilterInputValue>(edge, 'eq', {
        type: utils.nonNullableInputTypeDecorator(
          headFilterInputType,
          !edge.isNullable(),
        ),
        filter: (value, context, path) =>
          value === null
            ? NotOperation.create(EdgeExistsFilter.create(edge))
            : EdgeExistsFilter.create(
                edge,
                headFilterInputType.filter(value, context, path),
              ),
      }),
      new EdgeFilterInputType<NodeFilterInputValue>(edge, 'not', {
        type: utils.nonNullableInputTypeDecorator(
          headFilterInputType,
          !edge.isNullable(),
        ),
        filter: (value, context, path) =>
          value === null
            ? EdgeExistsFilter.create(edge)
            : NotOperation.create(
                EdgeExistsFilter.create(
                  edge,
                  headFilterInputType.filter(value, context, path),
                ),
              ),
      }),
    ];

    // is_null
    if (edge.isNullable()) {
      fields.push(
        new EdgeFilterInputType<boolean>(edge, 'is_null', {
          type: new utils.NonNullableInputType(scalars.typesByName.Boolean),
          filter: (value, _context, _path) =>
            value
              ? NotOperation.create(EdgeExistsFilter.create(edge))
              : EdgeExistsFilter.create(edge),
        }),
      );
    }

    return fields;
  }

  public static getUniqueReverseEdgeFields(
    reverseEdge: UniqueReverseEdge,
    headFilterInputType: NodeFilterInputType = reverseEdge.head.filterInputType,
  ): ReverseEdgeFilterInputType[] {
    return [
      new ReverseEdgeFilterInputType<NodeFilterInputValue>(reverseEdge, 'eq', {
        type: headFilterInputType,
        filter: (value, context, path) =>
          value === null
            ? NotOperation.create(
                UniqueReverseEdgeExistsFilter.create(reverseEdge),
              )
            : UniqueReverseEdgeExistsFilter.create(
                reverseEdge,
                headFilterInputType.filter(value, context, path),
              ),
      }),
      new ReverseEdgeFilterInputType<NodeFilterInputValue>(reverseEdge, 'not', {
        type: headFilterInputType,
        filter: (value, context, path) =>
          value === null
            ? UniqueReverseEdgeExistsFilter.create(reverseEdge)
            : NotOperation.create(
                UniqueReverseEdgeExistsFilter.create(
                  reverseEdge,
                  headFilterInputType.filter(value, context, path),
                ),
              ),
      }),
      new ReverseEdgeFilterInputType<NodeFilterInputValue>(
        reverseEdge,
        'is_null',
        {
          type: new utils.NonNullableInputType(scalars.typesByName.Boolean),
          filter: (value, _context, _path) =>
            value
              ? NotOperation.create(
                  UniqueReverseEdgeExistsFilter.create(reverseEdge),
                )
              : UniqueReverseEdgeExistsFilter.create(reverseEdge),
        },
      ),
    ];
  }

  /**
   * We can note the following equivalences:
   *
   *  set.every(filter);
   *    = !set.some(!filter);
   *    = set.none(!filter);
   *
   *  set.some(filter);
   *    = !set.every(!filter);
   *    = !set.none(filter);
   *
   *  set.none(filter);
   *    = !set.some(filter);
   *    = set.every(!filter);
   */
  public static getMultipleReverseEdgeFields(
    reverseEdge: MultipleReverseEdge,
    headFilterInputType: NodeFilterInputType = reverseEdge.head.filterInputType,
  ): ReverseEdgeFilterInputType[] {
    return [
      new ReverseEdgeFilterInputType<NonNullable<NodeFilterInputValue>>(
        reverseEdge,
        'every',
        {
          type: new utils.NonNullableInputType(headFilterInputType),

          // set.every(filter) = !set.some(!filter);
          filter: (value, context, path) =>
            NotOperation.create(
              MultipleReverseEdgeExistsFilter.create(
                reverseEdge,
                headFilterInputType.filter(value, context, path).complement,
              ),
            ),
        },
      ),
      new ReverseEdgeFilterInputType<NonNullable<NodeFilterInputValue>>(
        reverseEdge,
        'some',
        {
          type: new utils.NonNullableInputType(headFilterInputType),
          filter: (value, context, path) =>
            MultipleReverseEdgeExistsFilter.create(
              reverseEdge,
              headFilterInputType.filter(value, context, path),
            ),
        },
      ),
      new ReverseEdgeFilterInputType<NonNullable<NodeFilterInputValue>>(
        reverseEdge,
        'none',
        {
          type: new utils.NonNullableInputType(headFilterInputType),

          // set.none(filter) = !set.some(filter);
          filter: (value, context, path) =>
            NotOperation.create(
              MultipleReverseEdgeExistsFilter.create(
                reverseEdge,
                headFilterInputType.filter(value, context, path),
              ),
            ),
        },
      ),
      ...(['eq', 'not', 'gt', 'gte', 'lt', 'lte'] as const).map(
        (operator) =>
          new ReverseEdgeFilterInputType<number>(reverseEdge, operator, {
            name:
              operator === 'eq'
                ? reverseEdge.countFieldName
                : `${reverseEdge.countFieldName}_${operator}`,
            type: new utils.NonNullableInputType(
              scalars.typesByName.UnsignedInt,
            ),
            filter: (value, _context, _path) =>
              operator === 'not'
                ? NotOperation.create(
                    MultipleReverseEdgeCountFilter.create(
                      reverseEdge,
                      'eq',
                      value,
                    ),
                  )
                : MultipleReverseEdgeCountFilter.create(
                    reverseEdge,
                    operator,
                    value,
                  ),
          }),
      ),
    ];
  }

  public constructor(
    public readonly node: Node,
    override?: Partial<NodeFilterInputTypeOverride>,
  ) {
    super({
      name: override?.name ?? `${node}FilterInput`,
      description: override?.description ?? `The "${node}" nodes' filter`,
    });
  }

  protected getBooleanOperationFields(): BooleanOperationFilterInputType[] {
    return [
      new BooleanOperationFilterInputType<NodeFilterInputValue[]>({
        name: 'AND',
        type: new utils.NonNullableInputType(new utils.ListableInputType(this)),
        filter: (values, context, path) =>
          AndOperation.create(
            utils.aggregateGraphError<NodeFilterInputValue, BooleanFilter[]>(
              values,
              (operands, value, index) => [
                ...operands,
                this.filter(value, context, utils.addPath(path, index)).filter,
              ],
              [],
              { path },
            ),
          ),
      }),
      new BooleanOperationFilterInputType<NodeFilterInputValue[]>({
        name: 'OR',
        type: new utils.NonNullableInputType(new utils.ListableInputType(this)),
        filter: (values, context, path) =>
          OrOperation.create(
            utils.aggregateGraphError<NodeFilterInputValue, BooleanFilter[]>(
              values,
              (operands, value, index) => [
                ...operands,
                this.filter(value, context, utils.addPath(path, index)).filter,
              ],
              [],
              { path },
            ),
          ),
      }),
      new BooleanOperationFilterInputType<NodeFilterInputValue>({
        name: 'NOT',
        type: this,
        filter: (value, context, path) =>
          NotOperation.create(this.filter(value, context, path).filter),
      }),
    ];
  }

  @Memoize()
  public override get fields(): ReadonlyArray<FieldFilterInputType> {
    const constructor = this.constructor as typeof NodeFilterInputType;

    return [
      ...Array.from(this.node.componentSet).flatMap<FieldFilterInputType>(
        (component) =>
          component instanceof Leaf
            ? constructor.getLeafFields(component)
            : constructor.getEdgeFields(component),
      ),
      ...Array.from(this.node.reverseEdgeSet).flatMap<FieldFilterInputType>(
        (reverseEdge) =>
          reverseEdge instanceof UniqueReverseEdge
            ? constructor.getUniqueReverseEdgeFields(reverseEdge)
            : constructor.getMultipleReverseEdgeFields(reverseEdge),
      ),
      ...this.getBooleanOperationFields(),
    ];
  }

  public filter(
    value: NodeFilterInputValue,
    context?: OperationContext,
    path?: utils.Path,
  ): NodeFilter {
    return new NodeFilter(
      this.node,
      value === undefined
        ? TrueValue
        : value === null
        ? FalseValue
        : AndOperation.create(
            Object.entries(value).map(([filterName, filterValue]) =>
              this.getFieldByName(filterName, path).filter(
                filterValue,
                context,
                utils.addPath(path, filterName),
              ),
            ),
          ),
    );
  }

  public parseAndFilter(
    maybeValue: unknown,
    context?: OperationContext,
    path?: utils.Path,
  ): NodeFilter {
    return this.filter(this.parseValue(maybeValue, path), context, path);
  }
}
