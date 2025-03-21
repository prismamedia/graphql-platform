import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter } from '@prismamedia/memoize';
import type { Edge, Node } from '../../../node.js';
import { Leaf, type LeafValue } from '../../definition/component/leaf.js';
import type { MultipleReverseEdge } from '../../definition/reverse-edge/multiple.js';
import { UniqueReverseEdge } from '../../definition/reverse-edge/unique.js';
import type { OperationContext } from '../../operation/context.js';
import {
  AndOperation,
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
  type BooleanFilter,
} from '../../statement/filter.js';
import { FieldFilterInput } from './filter/field.js';
import { EdgeFilterInput } from './filter/field/edge.js';
import { LeafFilterInput } from './filter/field/leaf.js';
import { ReverseEdgeFilterInput } from './filter/field/reverse-edge.js';

export * from './filter/field.js';
export * from './filter/field/edge.js';
export * from './filter/field/leaf.js';
export * from './filter/field/reverse-edge.js';

export type NodeFilterInputValue = utils.Nillable<utils.PlainObject>;

export type NodeFilterInputTypeOverride = {
  name?: string;
  description?: string;
};

export class NodeFilterInputType extends utils.ObjectInputType<FieldFilterInput> {
  public static createLeafComparisonFields(leaf: Leaf): LeafFilterInput[] {
    const fields: LeafFilterInput[] = [];

    const inputType = scalars.stringTypes.includes(leaf.type as any)
      ? scalars.typesByName.NonEmptyTrimmedString
      : leaf.type;

    if (leaf.isComparable()) {
      // eq, not
      for (const operator of ['eq', 'not'] as const) {
        fields.push(
          new LeafFilterInput<LeafValue>(leaf, operator, {
            type: utils.nonNullableInputTypeDecorator(
              inputType,
              !leaf.isNullable(),
            ),
            filter: (value, _context, _path) =>
              new LeafComparisonFilter(leaf, operator, value),
          }),
        );
      }

      if (leaf.type !== scalars.typesByName.Boolean || leaf.isNullable()) {
        // in, not_in
        fields.push(
          new LeafFilterInput<LeafValue[]>(leaf, 'in', {
            type: new utils.NonNullableInputType(
              new utils.ListableInputType(
                new utils.NonOptionalInputType(
                  utils.nonNullableInputTypeDecorator(
                    inputType,
                    !leaf.isNullable(),
                  ),
                ),
              ),
            ),
            filter: (values, _context, _path) =>
              LeafInFilter.create(leaf, values),
          }),
          new LeafFilterInput<LeafValue[]>(leaf, 'not_in', {
            type: new utils.NonNullableInputType(
              new utils.ListableInputType(
                new utils.NonOptionalInputType(
                  utils.nonNullableInputTypeDecorator(
                    inputType,
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
            new LeafFilterInput<NonNullable<LeafValue>>(leaf, operator, {
              type: new utils.NonNullableInputType(inputType),
              filter: (value, _context, _path) =>
                new LeafComparisonFilter(leaf, operator, value),
            }),
          );
        }
      }
    }

    // is_null
    if (leaf.isNullable()) {
      fields.push(
        new LeafFilterInput<boolean>(leaf, 'is_null', {
          type: new utils.NonNullableInputType(scalars.typesByName.Boolean),
          filter: (value, _context, _path) =>
            new LeafComparisonFilter(leaf, value ? 'eq' : 'not', null),
        }),
      );
    }

    return fields;
  }

  public static createLeafFullTextFields(leaf: Leaf): LeafFilterInput[] {
    const fields: LeafFilterInput[] = [];

    // Full-text search
    // contains, starts_with, ends_with
    if (
      [
        scalars.typesByName.DraftJS,
        scalars.typesByName.URL,
        ...scalars.stringTypes,
      ].includes(leaf.type as any)
    ) {
      for (const operator of [
        'contains',
        'starts_with',
        'ends_with',
      ] as const) {
        fields.push(
          new LeafFilterInput<string>(leaf, operator, {
            type: new utils.NonNullableInputType(
              scalars.typesByName.NonEmptyString,
            ),
            filter: (value, _context, _path) =>
              new LeafFullTextFilter(leaf, operator, value),
          }),
          new LeafFilterInput<string>(leaf, `not_${operator}`, {
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

  public static createLeafFields(leaf: Leaf): LeafFilterInput[] {
    return [
      ...this.createLeafComparisonFields(leaf),
      ...this.createLeafFullTextFields(leaf),
    ];
  }

  public static createEdgeFields(
    edge: Edge,
    headFilterInputType: NodeFilterInputType = edge.head.filterInputType,
  ): EdgeFilterInput[] {
    const fields: EdgeFilterInput[] = [
      new EdgeFilterInput<NodeFilterInputValue>(edge, 'eq', {
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
      new EdgeFilterInput<NodeFilterInputValue>(edge, 'not', {
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
        new EdgeFilterInput<boolean>(edge, 'is_null', {
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

  public static createUniqueReverseEdgeFields(
    reverseEdge: UniqueReverseEdge,
    headFilterInputType: NodeFilterInputType = reverseEdge.head.filterInputType,
  ): ReverseEdgeFilterInput[] {
    return [
      new ReverseEdgeFilterInput<NodeFilterInputValue>(reverseEdge, 'eq', {
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
      new ReverseEdgeFilterInput<NodeFilterInputValue>(reverseEdge, 'not', {
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
      new ReverseEdgeFilterInput<NodeFilterInputValue>(reverseEdge, 'is_null', {
        type: new utils.NonNullableInputType(scalars.typesByName.Boolean),
        filter: (value, _context, _path) =>
          value
            ? NotOperation.create(
                UniqueReverseEdgeExistsFilter.create(reverseEdge),
              )
            : UniqueReverseEdgeExistsFilter.create(reverseEdge),
      }),
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
  public static createMultipleReverseEdgeFields(
    reverseEdge: MultipleReverseEdge,
    headFilterInputType: NodeFilterInputType = reverseEdge.head.filterInputType,
  ): ReverseEdgeFilterInput[] {
    return [
      new ReverseEdgeFilterInput<NonNullable<NodeFilterInputValue>>(
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
      new ReverseEdgeFilterInput<NonNullable<NodeFilterInputValue>>(
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
      new ReverseEdgeFilterInput<NonNullable<NodeFilterInputValue>>(
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
          new ReverseEdgeFilterInput<number>(reverseEdge, `count_${operator}`, {
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

  public createBooleanOperationFields(): FieldFilterInput[] {
    return [
      new FieldFilterInput<NodeFilterInputValue[]>({
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
      new FieldFilterInput<NodeFilterInputValue[]>({
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
      new FieldFilterInput<NodeFilterInputValue>({
        name: 'NOT',
        type: this,
        filter: (value, context, path) =>
          NotOperation.create(this.filter(value, context, path).filter),
      }),
    ];
  }

  @MGetter
  public override get fields(): ReadonlyArray<FieldFilterInput> {
    const constructor = this.constructor as typeof NodeFilterInputType;

    return [
      ...this.node.componentSet
        .values()
        .flatMap<FieldFilterInput>((component) =>
          component instanceof Leaf
            ? constructor.createLeafFields(component)
            : constructor.createEdgeFields(component),
        ),
      ...this.node.reverseEdgeSet
        .values()
        .flatMap<FieldFilterInput>((reverseEdge) =>
          reverseEdge instanceof UniqueReverseEdge
            ? constructor.createUniqueReverseEdgeFields(reverseEdge)
            : constructor.createMultipleReverseEdgeFields(reverseEdge),
        ),
      ...this.createBooleanOperationFields(),
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
