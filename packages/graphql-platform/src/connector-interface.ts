import type * as utils from '@prismamedia/graphql-platform-utils';
import type {
  MutationContext,
  Node,
  NodeCreation,
  NodeFilter,
  NodeOrdering,
  NodeSelectedValue,
  NodeSelection,
  NodeUpdate,
  NodeValue,
  OperationContext,
} from './node.js';

/**
 * The connector can define its own typing for some of the internal objects
 */
export enum ConnectorConfigOverrideKind {
  'NODE',
  'LEAF',
  'EDGE',
  'UNIQUE_CONSTRAINT',
}

export type GetConnectorConfigOverride<
  TConnector extends ConnectorInterface,
  TKind extends ConnectorConfigOverrideKind,
> = Partial<NonNullable<TConnector['configOverrides']>[TKind]>;

export interface ConnectorCountStatement {
  readonly node: Node;
  readonly filter?: NodeFilter;
}

export interface ConnectorFindStatement {
  readonly node: Node;
  readonly filter?: NodeFilter;
  readonly ordering?: NodeOrdering;
  readonly offset?: number;
  readonly limit: number;
  readonly selection: NodeSelection;
  readonly forMutation?:
    | utils.MutationType.DELETION
    | utils.MutationType.UPDATE;
}

export interface ConnectorCreateStatement {
  readonly node: Node;
  readonly creations: ReadonlyArray<NodeCreation>;
}

export interface ConnectorDeleteStatement {
  readonly node: Node;
  readonly filter: NodeFilter;
}

export interface ConnectorUpdateStatement {
  readonly node: Node;
  readonly update: NodeUpdate;
  readonly filter: NodeFilter;
}

export interface ConnectorInterface {
  readonly config?: utils.PlainObject;

  /**
   * This property has no other purpose than carrying the "TypeScript typing" provided by the connector, it will never be filled by anything
   */
  readonly configOverrides?: Partial<
    Record<ConnectorConfigOverrideKind, utils.PlainObject>
  >;

  /**
   * Returns the number of nodes
   */
  count(
    statement: ConnectorCountStatement,
    context: OperationContext,
  ): Promise<number>;

  /**
   * Returns a list of nodes
   */
  find(
    statement: ConnectorFindStatement,
    context: OperationContext,
  ): Promise<NodeSelectedValue[]>;

  /**
   * This method, if provided, is called at the beginning of a new mutation (= would be a good place to start a transaction)
   */
  preMutation?(context: MutationContext): Promise<void>;

  /**
   * This method, if provided, is called at the end of the whole mutation, including the nested ones (= would be a good place to commit a transaction)
   */
  postSuccessfulMutation?(context: MutationContext): Promise<void>;

  /**
   * This method, if provided, is called if the mutation fails (= would be a good place to rollback a transaction)
   */
  postFailedMutation?(context: MutationContext, error: Error): Promise<void>;

  /**
   * This method, if provided, is called after the mutation, regardless of its success or failure (= would be a good place to release a connection)
   */
  postMutation?(context: MutationContext): Promise<void>;

  /**
   * Creates some nodes and returns them
   */
  create(
    statement: ConnectorCreateStatement,
    context: MutationContext,
  ): Promise<NodeValue[]>;

  /**
   * Update many nodes and returns the number of actually updated nodes
   */
  update(
    statement: ConnectorUpdateStatement,
    context: MutationContext,
  ): Promise<number>;

  /**
   * Deletes many nodes and returns the number of actually deleted nodes
   */
  delete(
    statement: ConnectorDeleteStatement,
    context: MutationContext,
  ): Promise<number>;
}
