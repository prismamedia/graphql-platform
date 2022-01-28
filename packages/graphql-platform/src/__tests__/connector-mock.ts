import { jest } from '@jest/globals';
import type { IterableElement } from 'type-fest';
import type { ConnectorInterface } from '../connector-interface.js';

const mockableMethods = [
  'count',
  'find',
  'create',
  'delete',
  'update',
] as const;

type MockableMethod = IterableElement<typeof mockableMethods>;

export const mockConnector = (
  connector?: Partial<ConnectorInterface>,
): ConnectorInterface =>
  Object.fromEntries(
    mockableMethods.map((name) => [
      name,
      jest.fn(
        connector && name in connector && connector[name]
          ? (connector[name] as any)
          : async () => {
              throw new Error(
                `The mocked connector does not implement the "${name}" method`,
              );
            },
      ),
    ]),
  ) as any;

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
