import type { GraphQLPlatform } from '.';
import type { Model } from './model';
import type { OperationContext } from './model/operations';
import type { NodeCreation } from './model/types/inputs/creation';
import type { SortValue } from './model/types/inputs/order-by';
import type { NodeUpdate } from './model/types/inputs/update';
import type { FilterValue } from './model/types/inputs/where';
import type { NodeRecord, NodeSelection, NodeValue } from './model/types/node';

/**
 * The connector can define its own typing for some of the internal objects
 */
export enum ConnectorConfigOverrideKind {
  'Model',
  'Leaf',
  'Reference',
  'UniqueConstraint',
}

export type ConnectorConfigOverride<
  TConnector extends ConnectorInterface,
  TKind extends ConnectorConfigOverrideKind,
> = Partial<NonNullable<TConnector['configOverrides']>[TKind]>;

export type ConnectorCreateOperationArgs = {
  creations: ReadonlyArray<
    | NodeCreation
    // "undefined" is to the support the edge case when there are only generated columns
    | undefined
  >;
};

export type ConnectorDeleteOperationArgs = {
  filter?: FilterValue;
  sorts?: SortValue[];
  first: number;
};

export type ConnectorUpdateOperationArgs = {
  filter?: FilterValue;
  sorts?: SortValue[];
  first: number;
  update: NodeUpdate;
};

export type ConnectorFindOperationArgs = {
  filter?: FilterValue;
  sorts?: SortValue[];
  skip?: number;
  first: number;
  selection: NodeSelection;
};

export type ConnectorCountOperationArgs =
  | {
      filter?: FilterValue;
    }
  | undefined;

export type ConnectorOperationArgs<TArgs> = [
  model: Model,
  args: Readonly<TArgs>,
  operationContext: OperationContext,
];

export interface ConnectorInterface {
  /**
   * This property has no other purpose than carrying the "TypeScript typing" provided by the connector, it will never be filled by anything
   */
  configOverrides?: Partial<
    Record<ConnectorConfigOverrideKind, Record<string, any>>
  >;

  /**
   * This method, if provided, is called at construct time, can be used to check the configuration validity against this connector
   */
  connect?(gp: GraphQLPlatform): void;

  /**
   * This method, if provided, is called at the beginning of a new operation
   */
  preOperation?(operationContext: OperationContext): Promise<void>;

  /**
   * This method, if provided, is called at the end of the whole operation, including the nested ones (= would be a good place to commit a transaction)
   */
  postSuccessfulOperation?(operationContext: OperationContext): Promise<void>;

  /**
   * This method, if provided, is called if the operation fails (= would be a good place to rollback a transaction)
   */
  postFailedOperation?(operationContext: OperationContext): Promise<void>;

  /**
   * This method, if provided, is called after the operation, regardless of its success or failure
   */
  postOperation?(operationContext: OperationContext): Promise<void>;

  /**
   * Returns a list of nodes
   */
  find(
    ...args: ConnectorOperationArgs<ConnectorFindOperationArgs>
  ): Promise<NodeValue[]>;

  /**
   * Returns the number of nodes
   */
  count(
    ...args: ConnectorOperationArgs<ConnectorCountOperationArgs>
  ): Promise<number>;

  /**
   * Creates some records and returns them
   */
  create(
    ...args: ConnectorOperationArgs<ConnectorCreateOperationArgs>
  ): Promise<NodeRecord[]>;

  /**
   * Deletes some records and returns them
   */
  delete(
    ...args: ConnectorOperationArgs<ConnectorDeleteOperationArgs>
  ): Promise<NodeRecord[]>;

  /**
   * Updates some records and returns them
   */
  update(
    ...args: ConnectorOperationArgs<ConnectorUpdateOperationArgs>
  ): Promise<NodeRecord[]>;
}
