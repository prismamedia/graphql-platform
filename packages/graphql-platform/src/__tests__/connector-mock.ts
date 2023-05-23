import { jest } from '@jest/globals';
import type { IterableElement } from 'type-fest';
import type { ConnectorInterface } from '../connector-interface.js';

const mockableWorkflowSteps = [
  'preMutation',
  'postSuccessfulMutation',
  'postFailedMutation',
  'postMutation',
] satisfies (keyof ConnectorInterface)[];

const mockableOperations = [
  'count',
  'find',
  'create',
  'delete',
  'update',
] satisfies (keyof ConnectorInterface)[];

const mockableMethods = [
  ...mockableWorkflowSteps,
  ...mockableOperations,
] satisfies (keyof ConnectorInterface)[];

type MockableMethod = IterableElement<typeof mockableMethods>;

export const mockConnector = (
  connector?: Partial<ConnectorInterface>,
): ConnectorInterface =>
  Object.fromEntries([
    ...mockableWorkflowSteps.map((name) => [
      name,
      connector?.[name] ? jest.fn(connector[name] as any) : undefined,
    ]),
    ...mockableOperations.map((name) => [
      name,
      jest.fn(
        connector?.[name]
          ? (connector[name] as any)
          : async () => {
              throw new Error(
                `The mocked connector does not implement the "${name}" operation`,
              );
            },
      ),
    ]),
  ]) as any;

export function getConnectorMock<TKey extends MockableMethod>(
  connector: ConnectorInterface,
  key: TKey,
): jest.MockedFunction<NonNullable<ConnectorInterface[TKey]>> {
  const maybeMock = connector[key];
  if (!jest.isMockFunction(maybeMock)) {
    throw new Error(`The "${key}" method is not mocked properly`);
  }

  return maybeMock as any;
}

export function clearConnectorMock<TKey extends MockableMethod>(
  connector: ConnectorInterface,
  key: TKey,
): void {
  getConnectorMock(connector, key).mockClear();
}

export function clearAllConnectorMocks(connector: ConnectorInterface): void {
  Object.values(connector).forEach(
    (value) => jest.isMockFunction(value) && value.mockClear(),
  );
}
