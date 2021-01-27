import {
  addPath,
  getObjectKeys,
  Input,
  InputConfig,
  isNonEmptyPlainObject,
  Path,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { GraphQLInputObjectType } from 'graphql';
import { camelize } from 'inflection';
import { pick } from 'lodash';
import { RequireAtLeastOne } from 'type-fest';
import { Referrer } from '../../../../../model';
import { OperationContext } from '../../../../operations';
import { NodeRecord } from '../../../node';
import {
  reverseEdgeInputActionNames as creativeReverseEdgeInputActionNames,
  reverseEdgeInputActions as creativeReverseEdgeInputActions,
} from '../../creation/fields/reverse-edge';
import { UpdateInputValue } from '../../update';
import { WhereInputValue } from '../../where';
import { WhereUniqueInputValue } from '../../where-unique';
import {
  DeleteIfExistsReverseEdgeAction,
  DeleteManyReverseEdgeAction,
  DeleteReverseEdgeAction,
  DisconnectIfExistsReverseEdgeAction,
  DisconnectManyReverseEdgeAction,
  DisconnectReverseEdgeAction,
} from './reverse-edge/actions';

export * from './reverse-edge/actions';

export type UniqueReverseEdgeInputFieldValue = RequireAtLeastOne<{
  // Destructive actions
  delete: true;
  deleteIfExists: true;
  disconnect: true;
  disconnectIfExists: true;

  // Creative actions
  connect: WhereUniqueInputValue;
  connectIfExists: WhereUniqueInputValue;
  create: UpdateInputValue;
}>;

export type MultipleReverseEdgesInputFieldValue = RequireAtLeastOne<{
  // Destructive actions
  delete: WhereUniqueInputValue[];
  deleteMany: NonNullable<WhereInputValue>;
  disconnect: WhereUniqueInputValue[];
  disconnectMany: NonNullable<WhereInputValue>;

  // Creative actions
  connect: WhereUniqueInputValue[];
  connectIfExists: WhereUniqueInputValue[];
  create: UpdateInputValue[];
}>;

export type ReverseEdgeInputFieldValue =
  | UniqueReverseEdgeInputFieldValue
  | MultipleReverseEdgesInputFieldValue;

type UpdateInputReverseEdgeAction = keyof ReverseEdgeInputFieldValue;

const destructiveReverseEdgeInputActions = Object.freeze({
  delete: DeleteReverseEdgeAction,
  deleteIfExists: DeleteIfExistsReverseEdgeAction,
  deleteMany: DeleteManyReverseEdgeAction,
  disconnect: DisconnectReverseEdgeAction,
  disconnectIfExists: DisconnectIfExistsReverseEdgeAction,
  disconnectMany: DisconnectManyReverseEdgeAction,
});

const destructiveReverseEdgeInputActionNames = Object.freeze(
  Object.keys(destructiveReverseEdgeInputActions),
);

const reverseEdgeInputActions = Object.freeze({
  ...destructiveReverseEdgeInputActions,
  ...creativeReverseEdgeInputActions,
});

type ReverseEdgeInputActions = {
  [TName in keyof typeof reverseEdgeInputActions]?: InstanceType<
    typeof reverseEdgeInputActions[TName]
  >;
};

export type ReverseEdgeInputFieldConfig = Pick<
  InputConfig,
  'description' | 'required'
>;

export class ReverseEdgeInputField extends Input<
  ReverseEdgeInputFieldValue | undefined
> {
  protected readonly actions: Readonly<ReverseEdgeInputActions>;
  public readonly managed: boolean;
  public readonly public: boolean;

  public constructor(
    public readonly reverseEdge: Referrer,
    config?: ReverseEdgeInputFieldConfig,
  ) {
    super(reverseEdge.name, {
      // defaults
      description: reverseEdge.description,
      required: false,

      type: () =>
        new GraphQLInputObjectType({
          name: [
            reverseEdge.model.name,
            'Update',
            camelize(reverseEdge.name, false),
            'ReverseEdgeInput',
          ].join(''),
          fields: () =>
            Object.fromEntries(
              Object.entries(this.actions)
                .filter(([, action]) => action?.public)
                .map(([name, action]) => [
                  name,
                  action!.graphqlInputFieldConfig,
                ]),
            ),
        }),

      assertValue: (value, path) => {
        if (
          !isNonEmptyPlainObject(value) ||
          Object.keys(value).some(
            (key: any) => !Object.keys(this.actions).includes(key),
          )
        ) {
          throw new UnexpectedValueError(
            value,
            `an object containing actions among "${Object.keys(
              this.actions,
            ).join(', ')}"`,
            path,
          );
        }

        const actions = Object.keys(value) as UpdateInputReverseEdgeAction[];

        if (reverseEdge.unique && actions.length !== 1) {
          throw new UnexpectedValueError(value, `exactly one action`, path);
        }

        return Object.fromEntries(
          actions.map((action) => [
            action,
            this.actions[action]!.assertValue(
              value[action],
              addPath(path, action),
            ),
          ]),
        ) as ReverseEdgeInputFieldValue;
      },

      // config
      ...config,

      // cannot be overridden
      nullable: false,
    });

    this.actions = Object.freeze(
      Object.entries(reverseEdgeInputActions).reduce<ReverseEdgeInputActions>(
        (actions, [name, ActionConstructor]) => {
          const action = new ActionConstructor(reverseEdge);
          if (action.enabled) {
            Object.assign(actions, { [name]: action });
          }

          return actions;
        },
        {},
      ),
    );

    this.managed = Object.values(this.actions).some(
      (action) => action?.enabled,
    );

    this.public =
      reverseEdge.public &&
      Object.values(this.actions).some((action) => action?.public);
  }

  public async handle(
    inputValue: ReverseEdgeInputFieldValue,
    record: Readonly<NodeRecord>,
    operationContext: OperationContext,
    path: Path,
  ): Promise<void> {
    const [destructiveActionNames, creativeActionNames] = [
      pick(inputValue, destructiveReverseEdgeInputActionNames),
      pick(inputValue, creativeReverseEdgeInputActionNames),
    ];

    // We first execute the "destructive" actions...
    if (Object.keys(destructiveActionNames).length > 0) {
      await Promise.all(
        getObjectKeys(destructiveActionNames).map((action) =>
          this.actions[action]!.handle(
            record,
            inputValue[action] as any,
            operationContext,
            addPath(path, action),
          ),
        ),
      );
    }

    // ... then the "creative" ones
    if (Object.keys(creativeActionNames).length > 0) {
      await Promise.all(
        getObjectKeys(creativeActionNames).map((action) =>
          this.actions[action]!.handle(
            record,
            inputValue[action] as any,
            operationContext,
            addPath(path, action),
          ),
        ),
      );
    }
  }
}
