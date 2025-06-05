import * as utils from '@prismamedia/graphql-platform-utils';
import type { Merge } from 'type-fest';

export enum BrokerErrorCode {
  ASSIGNER,
  HEARTBEAT,
}

export type BrokerErrorOptions = Merge<
  utils.GraphErrorOptions,
  {
    readonly code?: BrokerErrorCode;
    readonly message?: string;
    readonly reason?: string;
  }
>;

export class BrokerError extends utils.GraphError {
  public constructor({
    code,
    message,
    reason,
    ...options
  }: BrokerErrorOptions = {}) {
    super(
      message ??
        [
          `The broker failed`,
          reason ?? (code != null ? BrokerErrorCode[code] : undefined),
        ]
          .filter(Boolean)
          .join(' - '),
      { ...options, code: code != null ? BrokerErrorCode[code] : undefined },
    );
  }
}
