import {
  Connector,
  ConnectorCountOperationArgs,
  ConnectorCreateOperationArgs,
  ConnectorFindOperationArgs,
  FilterValue,
  GraphQLPlatform,
  Model,
  NodeValue,
  SortValue,
} from '@prismamedia/graphql-platform';
import { includes, isEqual } from 'lodash';

export type TInMemoryConnectorConfig = {
  storage?: Map<Model, Set<NodeValue>>;
};

export class InMemoryConnector implements Connector {
  #storage: Map<Model, Set<NodeValue>>;

  public constructor(public readonly config?: TInMemoryConnectorConfig) {
    this.#storage = config?.storage ?? new Map();
  }

  public connect(gp: GraphQLPlatform) {
    for (const model of gp.modelSet) {
      if (!this.#storage.has(model)) {
        this.#storage.set(model, new Set());
      }
    }

    return this;
  }

  public async create(
    resource: Model,
    args: ConnectorCreateOperationArgs,
  ): Promise<NodeValue> {
    const resourceValueSet = this.#storage.get(resource)!;

    for (const resourceValue of resourceValueSet) {
      for (const uniqueConstraint of resource.uniqueConstraintSet) {
        if (
          [...uniqueConstraint.componentSet].every((component) =>
            isEqual(
              resourceValue[component.name],
              args.records[component.name],
            ),
          )
        ) {
          throw new Error(`CONFLICT found in "${resource.name}"`);
        }
      }
    }

    resourceValueSet.add(args.records);

    return args.records;
  }

  protected filter(
    node: Model,
    value: NodeValue,
    filter: FilterValue,
  ): boolean {
    switch (filter.kind) {
      case 'Boolean':
        return filter.value;

      case 'Leaf': {
        const componentValue = value[filter.leaf];

        switch (filter.operator) {
          case 'eq':
            return isEqual(componentValue, filter.value);

          case 'not':
            return !isEqual(componentValue, filter.value);

          case 'gt':
            return componentValue > filter.value;

          case 'gte':
            return componentValue >= filter.value;

          case 'lt':
            return componentValue < filter.value;

          case 'lte':
            return componentValue <= filter.value;

          case 'in':
            return includes(filter.value, componentValue);

          case 'not_in':
            return !includes(filter.value, componentValue);

          default:
            throw new Error(
              // @ts-expect-error
              `The leaf filter operator "${filter.operator}" is not supported, yet`,
            );
        }
      }

      case 'Logical': {
        switch (filter.operator) {
          case 'and':
            return [...filter.value].every((filter) =>
              this.filter(node, value, filter),
            );

          case 'or':
            return [...filter.value].some((filter) =>
              this.filter(node, value, filter),
            );

          case 'not':
            return !this.filter(node, value, filter.value);

          default:
            throw new Error(
              // @ts-expect-error
              `The logical filter operator "${filter.operator}" is not supported, yet`,
            );
        }
      }

      default:
        throw new Error(
          `The filter kind "${filter.kind}" is not supported, yet`,
        );
    }
  }

  protected compare(
    node: Model,
    a: NodeValue,
    b: NodeValue,
    orderingExpression: SortValue,
  ): number {
    switch (orderingExpression.kind) {
      case 'Leaf':
        if (a[orderingExpression.name] > b[orderingExpression.name]) {
          return orderingExpression.direction === 'ASC' ? 1 : -1;
        } else {
          return 0;
        }
    }
  }

  public async find(
    node: Model,
    { filter: where, orderBy, skip = 0, first }: ConnectorFindOperationArgs,
  ): Promise<NodeValue[]> {
    let nodeValues = [...this.#storage.get(node)!];

    // Filtered values
    nodeValues =
      !where || (where.kind === 'Boolean' && where.value)
        ? nodeValues
        : where?.kind === 'Boolean' && !where.value
        ? []
        : nodeValues.filter((nodeValue) => this.filter(node, nodeValue, where));

    // Ordered values
    nodeValues =
      !orderBy || orderBy.size === 0
        ? nodeValues
        : nodeValues.sort((a, b) => {
            for (const sort of orderBy) {
              const comparison = this.compare(node, a, b, sort);

              if (comparison === 0) {
                continue;
              } else {
                return comparison;
              }
            }

            return 0;
          });

    return nodeValues.slice(skip, skip + first);
  }

  public async count(
    node: Model,
    { filter: where }: ConnectorCountOperationArgs,
  ): Promise<number> {
    if (where?.kind === 'Boolean' && !where.value) {
      return 0;
    }

    let nodeValues = [...this.#storage.get(node)!];

    // Filtered values
    nodeValues =
      !where || (where.kind === 'Boolean' && where.value)
        ? nodeValues
        : where.kind === 'Boolean' && !where.value
        ? []
        : nodeValues.filter((nodeValue) => this.filter(node, nodeValue, where));

    return nodeValues.length;
  }
}
