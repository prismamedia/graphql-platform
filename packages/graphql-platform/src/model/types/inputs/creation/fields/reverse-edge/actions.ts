import { RequireAtLeastOne, RequireExactlyOne } from 'type-fest';
import { CreationInputValue } from '../../../creation';
import { WhereUniqueInputValue } from '../../../where-unique';
import { ConnectReverseEdgeAction } from './actions/connect';
import { ConnectIfExistsReverseEdgeAction } from './actions/connect-if-exists';
import {
  ConnectManyReverseEdgeAction,
  ConnectManyReverseEdgeActionValue,
} from './actions/connect-many';
import { CreateReverseEdgeAction } from './actions/create';

export * from './actions/connect';
export * from './actions/connect-if-exists';
export * from './actions/connect-many';
export * from './actions/create';

export type UniqueReverseEdgeInputFieldValue = RequireExactlyOne<{
  connect: WhereUniqueInputValue;
  connectIfExists: WhereUniqueInputValue;
  create: CreationInputValue;
}>;

export type MultipleReverseEdgesInputFieldValue = RequireAtLeastOne<{
  connect: WhereUniqueInputValue[];
  connectIfExists: WhereUniqueInputValue[];
  connectMany: ConnectManyReverseEdgeActionValue;
  create: CreationInputValue[];
}>;

export type ReverseEdgeInputFieldValue =
  | UniqueReverseEdgeInputFieldValue
  | MultipleReverseEdgesInputFieldValue;

export const reverseEdgeInputActions = Object.freeze({
  connect: ConnectReverseEdgeAction,
  connectIfExists: ConnectIfExistsReverseEdgeAction,
  connectMany: ConnectManyReverseEdgeAction,
  create: CreateReverseEdgeAction,
});

export type ReverseEdgeInputActions = {
  [TName in keyof typeof reverseEdgeInputActions]?: InstanceType<
    typeof reverseEdgeInputActions[TName]
  >;
};

export type ReverseEdgeInputActionName = keyof ReverseEdgeInputActions;

export const reverseEdgeInputActionNames = Object.freeze(
  Object.keys(reverseEdgeInputActions) as ReverseEdgeInputActionName[],
);
