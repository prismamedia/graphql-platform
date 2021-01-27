import { ConnectorInterface } from '../../connector';
import { Model } from '../../model';
import { NodeRecord } from '../types/node';

export enum NodeChangeKind {
  Created = 'CREATED',
  Updated = 'UPDATED',
  Deleted = 'DELETED',
}

export type NodeChange<
  TRequestContext,
  TConnector extends ConnectorInterface,
> = (
  | {
      kind: NodeChangeKind.Created;

      /**
       * The new record
       */
      new: Readonly<NodeRecord>;
    }
  | {
      kind: NodeChangeKind.Updated;

      /**
       * The old record
       */
      old: Readonly<NodeRecord>;

      /**
       * The new record
       */
      new: Readonly<NodeRecord>;
    }
  | {
      kind: NodeChangeKind.Deleted;

      /**
       * The old record
       */
      old: Readonly<NodeRecord>;
    }
) & {
  /**
   * The "model"'s definition
   */
  model: Model<TRequestContext, TConnector>;
};
