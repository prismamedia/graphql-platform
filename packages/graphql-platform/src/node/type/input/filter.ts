import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type { Edge, Node } from '../../../node.js';
import { Leaf, type LeafValue } from '../../definition/component/leaf.js';
import type { ReverseEdgeMultiple } from '../../definition/reverse-edge/multiple.js';
import { ReverseEdgeUnique } from '../../definition/reverse-edge/unique.js';
import type { OperationContext } from '../../operation/context.js';
import {
  AndOperation,
  BooleanFilter,
  BooleanValue,
  EdgeExistsFilter,
  LeafComparisonFilter,
  LeafFullTextFilter,
  LeafInFilter,
  NodeFilter,
  NotOperation,
  OrOperation,
  ReverseEdgeMultipleCountFilter,
  ReverseEdgeMultipleExistsFilter,
  ReverseEdgeUniqueExistsFilter,
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

export class NodeFilterInputType extends utils.ObjectInputType<FieldFilterInputType> {
  public constructor(public readonly node: Node) {
    super({
      name: `${node}FilterInput`,
      description: `The "${node}" nodes' filter`,
    });
  }

  protected getLeafFields(leaf: Leaf): LeafFilterInputType[] {
    const fields: LeafFilterInputType[] = [];

    // eq, not
    fields.push(
      new LeafFilterInputType<LeafValue>(leaf, 'eq', {
        type: utils.nonNullableInputTypeDecorator(
          leaf.type,
          !leaf.isNullable(),
        ),
        filter: (value, _context, _path) =>
          new LeafComparisonFilter(leaf, 'eq', value),
      }),
      new LeafFilterInputType<LeafValue>(leaf, 'not', {
        type: utils.nonNullableInputTypeDecorator(
          leaf.type,
          !leaf.isNullable(),
        ),
        filter: (value, _context, _path) =>
          new NotOperation(new LeafComparisonFilter(leaf, 'eq', value)),
      }),
    );

    // is_null
    if (leaf.isNullable()) {
      fields.push(
        new LeafFilterInputType<boolean>(leaf, 'is_null', {
          type: new utils.NonNullableInputType(scalars.typesByName.Boolean),
          filter: (value, _context, _path) =>
            value
              ? new LeafComparisonFilter(leaf, 'eq', null)
              : new NotOperation(new LeafComparisonFilter(leaf, 'eq', null)),
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
          filter: (values, _context, _path) => new LeafInFilter(leaf, values),
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
            new NotOperation(new LeafInFilter(leaf, values)),
        }),
      );
    }

    // gt, gte, lt, lte
    if (leaf.isSortable()) {
      for (const operator of ['gt', 'gte', 'lt', 'lte'] as const) {
        fields.push(
          new LeafFilterInputType<LeafValue>(leaf, operator, {
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
              new NotOperation(new LeafFullTextFilter(leaf, operator, value)),
          }),
        );
      }
    }

    return fields;
  }

  protected getEdgeFields(edge: Edge): EdgeFilterInputType[] {
    const fields: EdgeFilterInputType[] = [];

    fields.push(
      new EdgeFilterInputType<NodeFilterInputValue>(edge, 'eq', {
        type: utils.nonNullableInputTypeDecorator(
          edge.head.filterInputType,
          !edge.isNullable(),
        ),
        filter: (value, context, path) =>
          value === null
            ? new NotOperation(new EdgeExistsFilter(edge))
            : new EdgeExistsFilter(
                edge,
                edge.head.filterInputType.filter(value, context, path),
              ),
      }),
      new EdgeFilterInputType<NodeFilterInputValue>(edge, 'not', {
        type: utils.nonNullableInputTypeDecorator(
          edge.head.filterInputType,
          !edge.isNullable(),
        ),
        filter: (value, context, path) =>
          value === null
            ? new EdgeExistsFilter(edge)
            : new NotOperation(
                new EdgeExistsFilter(
                  edge,
                  edge.head.filterInputType.filter(value, context, path),
                ),
              ),
      }),
    );

    // is_null
    if (edge.isNullable()) {
      fields.push(
        new EdgeFilterInputType<boolean>(edge, 'is_null', {
          type: new utils.NonNullableInputType(scalars.typesByName.Boolean),
          filter: (value, _context, _path) =>
            value
              ? new NotOperation(new EdgeExistsFilter(edge))
              : new EdgeExistsFilter(edge),
        }),
      );
    }

    return fields;
  }

  protected getReverseEdgeUniqueFields(
    reverseEdge: ReverseEdgeUnique,
  ): ReverseEdgeFilterInputType[] {
    return [
      new ReverseEdgeFilterInputType<NodeFilterInputValue>(reverseEdge, 'eq', {
        type: reverseEdge.head.filterInputType,
        filter: (value, context, path) =>
          value === null
            ? new NotOperation(new ReverseEdgeUniqueExistsFilter(reverseEdge))
            : new ReverseEdgeUniqueExistsFilter(
                reverseEdge,
                reverseEdge.head.filterInputType.filter(value, context, path),
              ),
      }),
      new ReverseEdgeFilterInputType<NodeFilterInputValue>(reverseEdge, 'not', {
        type: reverseEdge.head.filterInputType,
        filter: (value, context, path) =>
          value === null
            ? new ReverseEdgeUniqueExistsFilter(reverseEdge)
            : new NotOperation(
                new ReverseEdgeUniqueExistsFilter(
                  reverseEdge,
                  reverseEdge.head.filterInputType.filter(value, context, path),
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
              ? new NotOperation(new ReverseEdgeUniqueExistsFilter(reverseEdge))
              : new ReverseEdgeUniqueExistsFilter(reverseEdge),
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
  protected getReverseEdgeMultipleFields(
    reverseEdge: ReverseEdgeMultiple,
  ): ReverseEdgeFilterInputType[] {
    return [
      new ReverseEdgeFilterInputType<NonNullable<NodeFilterInputValue>>(
        reverseEdge,
        'every',
        {
          type: new utils.NonNullableInputType(
            reverseEdge.head.filterInputType,
          ),

          // set.every(filter) = !set.some(!filter);
          filter: (value, context, path) =>
            new NotOperation(
              new ReverseEdgeMultipleExistsFilter(
                reverseEdge,
                reverseEdge.head.filterInputType.filter(
                  value,
                  context,
                  path,
                ).complement,
              ),
            ),
        },
      ),
      new ReverseEdgeFilterInputType<NonNullable<NodeFilterInputValue>>(
        reverseEdge,
        'some',
        {
          type: new utils.NonNullableInputType(
            reverseEdge.head.filterInputType,
          ),
          filter: (value, context, path) =>
            new ReverseEdgeMultipleExistsFilter(
              reverseEdge,
              reverseEdge.head.filterInputType.filter(value, context, path),
            ),
        },
      ),
      new ReverseEdgeFilterInputType<NonNullable<NodeFilterInputValue>>(
        reverseEdge,
        'none',
        {
          type: new utils.NonNullableInputType(
            reverseEdge.head.filterInputType,
          ),

          // set.none(filter) = !set.some(filter);
          filter: (value, context, path) =>
            new NotOperation(
              new ReverseEdgeMultipleExistsFilter(
                reverseEdge,
                reverseEdge.head.filterInputType.filter(value, context, path),
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
                ? new NotOperation(
                    new ReverseEdgeMultipleCountFilter(
                      reverseEdge,
                      'eq',
                      value,
                    ),
                  )
                : new ReverseEdgeMultipleCountFilter(
                    reverseEdge,
                    operator,
                    value,
                  ),
          }),
      ),
    ];
  }

  protected getBooleanOperationFields(): BooleanOperationFilterInputType[] {
    return [
      new BooleanOperationFilterInputType<NodeFilterInputValue[]>({
        name: 'AND',
        type: new utils.NonNullableInputType(new utils.ListableInputType(this)),
        filter: (values, context, path) =>
          new AndOperation(
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
          new OrOperation(
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
          new NotOperation(this.filter(value, context, path).filter),
      }),
    ];
  }

  @Memoize()
  public override get fields(): ReadonlyArray<FieldFilterInputType> {
    return [
      ...this.node.components.flatMap<FieldFilterInputType>((component) =>
        component instanceof Leaf
          ? this.getLeafFields(component)
          : this.getEdgeFields(component),
      ),
      ...this.node.reverseEdges.flatMap<FieldFilterInputType>((reverseEdge) =>
        reverseEdge instanceof ReverseEdgeUnique
          ? this.getReverseEdgeUniqueFields(reverseEdge)
          : this.getReverseEdgeMultipleFields(reverseEdge),
      ),
      ...this.getBooleanOperationFields(),
    ];
  }

  public filter<
    TRequestContext extends object,
    TConnector extends ConnectorInterface,
  >(
    value: NodeFilterInputValue,
    context?: OperationContext<TRequestContext, TConnector>,
    path?: utils.Path,
  ): NodeFilter {
    return new NodeFilter(
      this.node,
      value === undefined
        ? new BooleanValue(true)
        : value === null
        ? new BooleanValue(false)
        : new AndOperation(
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

  public parseAndFilter<
    TRequestContext extends object,
    TConnector extends ConnectorInterface,
  >(
    maybeValue: unknown,
    context?: OperationContext<TRequestContext, TConnector>,
    path?: utils.Path,
  ): NodeFilter {
    return this.filter(this.parseValue(maybeValue, path), context, path);
  }
}
