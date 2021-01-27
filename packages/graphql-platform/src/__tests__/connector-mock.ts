import { ConnectorInterface } from '../connector';

export const mockConnector = (
  connector?: Partial<ConnectorInterface>,
): ConnectorInterface => ({
  ...(Object.fromEntries(
    ['count', 'create', 'delete', 'find', 'update'].map((name) => [
      name,
      jest.fn(async () => {
        throw new Error(
          `The mocked connector does not implement the "${name}" method`,
        );
      }),
    ]),
  ) as any),
  ...connector,
});

export function getConnectorMock<TKey extends keyof ConnectorInterface>(
  connector: ConnectorInterface,
  key: TKey,
): ConnectorInterface[TKey] & jest.Mock {
  const maybeMock = connector[key];
  if (!jest.isMockFunction(maybeMock)) {
    throw new Error(`The "${key}" method is not mocked properly`);
  }

  return maybeMock as any;
}

export function clearConnectorMock<TKey extends keyof ConnectorInterface>(
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
