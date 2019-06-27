import * as mysql from 'mysql';
import { Connector } from '../connector';

export class ConnectorRequest {
  public connection?: mysql.PoolConnection;
  public transaction?: boolean;

  public constructor(readonly connector: Connector) {}
}
