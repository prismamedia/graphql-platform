import {
  GraphQLPlatform,
  IConnector,
  IConnectorCountOperationArgs,
  IConnectorCreateOperationArgs,
  IConnectorFindOperationArgs,
  INodeValue,
  Node,
  TFilterValue,
  TSortValue,
} from '@prismamedia/graphql-platform';
import { includes, isEqual } from 'lodash';

export type TInMemoryConnectorConfig = {
  storage?: Map<Node, Set<INodeValue>>;
};

export class InMemoryConnector implements IConnector {
  #storage: Map<Node, Set<INodeValue>>;

  public constructor(public readonly config?: TInMemoryConnectorConfig) {
    this.#storage = config?.storage ?? new Map();
  }

  public connect(gp: GraphQLPlatform) {
    for (const node of gp.nodeMap.values()) {
      if (!this.#storage.has(node)) {
        this.#storage.set(node, new Set());
      }
    }

    return this;
  }

  public async create(
    resource: Node,
    args: IConnectorCreateOperationArgs,
  ): Promise<INodeValue> {
    const resourceValueSet = this.#storage.get(resource)!;

    for (const resourceValue of resourceValueSet) {
      for (const uniqueConstraint of resource.uniqueConstraintMap.values()) {
        if (
          [...uniqueConstraint.componentSet].every((component) =>
            isEqual(resourceValue[component.name], args.data[component.name]),
          )
        ) {
          throw new Error(`CONFLICT found in "${resource.name}"`);
        }
      }
    }

    resourceValueSet.add(args.data);

    return args.data;
  }

  protected filter(
    node: Node,
    value: INodeValue,
    filter: TFilterValue,
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
    node: Node,
    a: INodeValue,
    b: INodeValue,
    orderingExpression: TSortValue,
  ): number {
    switch (orderingExpression.kind) {
      case 'Leaf':
        if (a[orderingExpression.leaf] > b[orderingExpression.leaf]) {
          return orderingExpression.direction === 'ASC' ? 1 : -1;
        } else {
          return 0;
        }
    }
  }

  public async find(
    node: Node,
    { filter: where, orderBy, skip = 0, first }: IConnectorFindOperationArgs,
  ): Promise<INodeValue[]> {
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
    node: Node,
    { filter: where }: IConnectorCountOperationArgs,
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
