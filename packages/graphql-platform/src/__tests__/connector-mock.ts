import { IConnector } from '../connector';

function throwUnimplementedMethod(name: string): never {
  throw new Error(
    `The mocked connector does not implement the "${name}" method`,
  );
}

export const mockConnector = (connector?: Partial<IConnector>): IConnector => ({
  count: jest.fn(async () => throwUnimplementedMethod('count')),
  create: jest.fn(async () => throwUnimplementedMethod('create')),
  delete: jest.fn(async () => throwUnimplementedMethod('delete')),
  find: jest.fn(async () => throwUnimplementedMethod('find')),
  update: jest.fn(async () => throwUnimplementedMethod('update')),
  ...connector,
});

export function getConnectorMock<TKey extends keyof IConnector>(
  connector: IConnector,
  key: TKey,
): IConnector[TKey] & jest.Mock {
  const maybeMock = connector[key];
  if (!jest.isMockFunction(maybeMock)) {
    throw new Error(`The function "${key}" is not mocked properly`);
  }

  return maybeMock as any;
}

export function clearConnectorMock<TKey extends keyof IConnector>(
  connector: IConnector,
  key: TKey,
): void {
  getConnectorMock(connector, key).mockClear();
}

export function clearAllConnectorMocks(connector: IConnector): void {
  Object.values(connector).forEach(
    (value) => jest.isMockFunction(value) && value.mockClear(),
  );
}
