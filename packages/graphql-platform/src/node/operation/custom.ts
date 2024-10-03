import type * as graphql from 'graphql';
import assert from 'node:assert/strict';
import type { Constructor } from 'type-fest';
import type { BrokerInterface } from '../../broker-interface.js';
import type { ConnectorInterface } from '../../connector-interface.js';
import type { Node } from '../../node.js';
import { AbstractOperation } from '../abstract-operation.js';
import type { Operation } from '../operation.js';

export type CustomOperationConstructor<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TBroker extends BrokerInterface,
  TContainer extends object,
> =
  | Constructor<
      AbstractOperation<
        any,
        any,
        TRequestContext,
        TConnector,
        TBroker,
        TContainer,
        any
      >,
      [node: Node<TRequestContext, TConnector, TBroker, TContainer>]
    >
  | ((
      node: Node<TRequestContext, TConnector, TBroker, TContainer>,
    ) => AbstractOperation<
      any,
      any,
      TRequestContext,
      TConnector,
      TBroker,
      TContainer,
      any
    >);

export function constructCustomOperation<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TBroker extends BrokerInterface,
  TContainer extends object,
>(
  constructor: CustomOperationConstructor<
    TRequestContext,
    TConnector,
    TBroker,
    TContainer
  >,
  node: Node<TRequestContext, TConnector, TBroker, TContainer>,
  operationType?: graphql.OperationTypeNode,
): Operation {
  assert.equal(typeof constructor, 'function');

  const operation: Operation =
    constructor.prototype instanceof AbstractOperation
      ? new (constructor as any)(node)
      : (constructor as any)(node);

  !operationType || assert.equal(operation.operationType, operationType);

  return operation;
}
