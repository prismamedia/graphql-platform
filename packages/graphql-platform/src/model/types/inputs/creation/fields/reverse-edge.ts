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
import { Referrer } from '../../../../../model';
import { OperationContext } from '../../../../operations';
import { NodeRecord } from '../../../node';
import {
  ReverseEdgeInputActionName,
  ReverseEdgeInputActions,
  reverseEdgeInputActions,
  ReverseEdgeInputFieldValue,
} from './reverse-edge/actions';

export * from './reverse-edge/actions';

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
            'Create',
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
            `an object containing action(s) among "${Object.keys(
              this.actions,
            ).join(', ')}"`,
            path,
          );
        }

        const actions = Object.keys(value) as ReverseEdgeInputActionName[];

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
    await Promise.all(
      getObjectKeys(inputValue).map((action) =>
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
