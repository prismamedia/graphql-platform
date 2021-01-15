import type { GraphQLPlatform } from '.';
import type {
  INodeValue,
  Node,
  TFieldSelection,
  TLeafValue,
  TReferenceValue,
} from './node';
import { TParsedOrderByInputValue } from './node/order-by-input';
import { TParsedWhereInputValue } from './node/where-input';
import type { OperationContext } from './operations';

/**
 * The connector can define its own typing for some of the internal objects
 */
export enum TConnectorOverridesKind {
  'Node',
  'Leaf',
  'Edge',
  'UniqueConstraint',
}

export interface TCreateValue {
  [componentName: string]: TLeafValue | TReferenceValue;
}

export interface IConnectorCreateOperationArgs {
  readonly data: ReadonlyArray<TCreateValue | undefined>;
  readonly selections: ReadonlyArray<TFieldSelection>;
}

export interface IConnectorDeleteOperationArgs {
  readonly filter?: TParsedWhereInputValue;
  readonly orderBy?: TParsedOrderByInputValue;
  readonly first: number;
  readonly selections: ReadonlyArray<TFieldSelection>;
}

export interface TUpdateValue {
  [componentName: string]: any;
}

export interface IConnectorUpdateOperationArgs {
  readonly filter?: TParsedWhereInputValue;
  readonly orderBy?: TParsedOrderByInputValue;
  readonly first: number;
  readonly data: TUpdateValue;
  readonly selections: ReadonlyArray<TFieldSelection>;
}

export interface IConnectorFindOperationArgs {
  readonly filter?: TParsedWhereInputValue;
  readonly orderBy?: TParsedOrderByInputValue;
  readonly skip?: number;
  readonly first: number;
  readonly selections: ReadonlyArray<TFieldSelection>;
}

export interface IConnectorCountOperationArgs {
  readonly filter?: TParsedWhereInputValue;
}

export type TConnectorOperationArgs<TArgs> = [
  node: Node,
  args: TArgs,
  operationContext: OperationContext,
];

export interface IConnector {
  /**
   * This property has no other purpose than carrying the overrides "types" provided by the connector, its value will never be filled by anything
   */
  overrides?: Partial<Record<TConnectorOverridesKind, Record<string, any>>>;

  /**
   * This method, if provided, is called at construct time, can be used to check the configuration validity against this connector
   */
  connect?(gp: GraphQLPlatform<any, any>): this;

  /**
   * This method, if provided, is called at the end of the whole operation, including the nested ones (= would be good place to commit a transaction)
   */
  onSuccess?(operationContext: OperationContext): Promise<void>;

  /**
   * This method, if provided, is called whenever the operation fails (= would be good place to rollback a transaction)
   */
  onFailure?(operationContext: OperationContext): Promise<void>;

  /**
   * Returns a list of nodes
   */
  find(
    ...args: TConnectorOperationArgs<IConnectorFindOperationArgs>
  ): Promise<INodeValue[]>;

  /**
   * Returns the number of nodes
   */
  count(
    ...args: TConnectorOperationArgs<IConnectorCountOperationArgs>
  ): Promise<number>;

  /**
   * Creates some nodes and returns them
   */
  create(
    ...args: TConnectorOperationArgs<IConnectorCreateOperationArgs>
  ): Promise<INodeValue[]>;

  /**
   * Deletes some nodes and returns them
   */
  delete(
    ...args: TConnectorOperationArgs<IConnectorDeleteOperationArgs>
  ): Promise<INodeValue[]>;

  /**
   * Updates some nodes and returns them
   */
  update(
    ...args: TConnectorOperationArgs<IConnectorUpdateOperationArgs>
  ): Promise<INodeValue[]>;
}

export type TGetConnectorOverrides<
  TConnector extends IConnector,
  TKey extends TConnectorOverridesKind
> = Partial<NonNullable<TConnector['overrides']>[TKey]>;
