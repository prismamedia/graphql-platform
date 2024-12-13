import { mock, type Mock, type TestContext } from 'node:test';
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

export type MockedConnector = {
  [TMethod in IterableElement<typeof mockableWorkflowSteps>]:
    | Mock<NonNullable<ConnectorInterface[TMethod]>>
    | undefined;
} & {
  [TMethod in IterableElement<typeof mockableOperations>]: Mock<
    NonNullable<ConnectorInterface[TMethod]>
  >;
};

export const mockConnector = (
  connector?: Partial<ConnectorInterface>,
  context?: TestContext,
): MockedConnector =>
  Object.fromEntries([
    ...mockableWorkflowSteps.map((name) => [
      name,
      connector?.[name]
        ? (context?.mock ?? mock).fn(connector[name] as any)
        : undefined,
    ]),
    ...mockableOperations.map((name) => [
      name,
      (context?.mock ?? mock).fn(
        connector?.[name]
          ? (connector[name] as any)
          : async function notImplemented() {
              throw new Error(
                `The mocked connector does not implement the "${name}" operation`,
              );
            },
      ),
    ]),
  ]);

export function clearConnectorMockCalls(connector: MockedConnector): void {
  mockableWorkflowSteps.forEach((methodName) =>
    connector[methodName]?.mock.resetCalls(),
  );

  mockableOperations.forEach((methodName) => {
    connector[methodName].mock.resetCalls();
  });
}
