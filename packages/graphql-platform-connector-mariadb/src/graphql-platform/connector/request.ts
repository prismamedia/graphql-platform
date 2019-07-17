import * as mysql from 'mysql';
import { Connector } from '../connector';

export class ConnectorRequest {
  /**
   * During a "mutation", we store the connection here
   */
  public connection?: mysql.PoolConnection;

  public constructor(readonly connector: Connector) {}
}
