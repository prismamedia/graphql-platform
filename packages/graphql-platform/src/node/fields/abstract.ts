import {
  AbstractField,
  AbstractFieldConfig,
  assertWrappedLeafValue,
  GraphQLArgumentConfigMap,
  isWrappedLeafType,
  Path,
  PlainObject,
  resolveThunkOrValue,
  ThunkOrValue,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'assert';
import { FieldNode, GraphQLFieldConfig, GraphQLOutputType } from 'graphql';
import { Node } from '../../node';
import { TFieldSelection } from '../fields';
import { TASTContext } from '../selection';

export interface IFieldSelection<TKind extends string = any> {
  readonly kind: TKind;
  readonly name: string;
}

export interface IFieldSelectionWithSelections {
  readonly selections: ReadonlyArray<TFieldSelection>;
}

export interface IFieldSelectionWithOptionalArgs<
  TArgs extends PlainObject = any
> {
  readonly alias?: string;
  readonly args?: Partial<TArgs>;
}

export interface IFieldSelectionWithRequiredArgs<
  TArgs extends PlainObject = any
> {
  readonly alias?: string;
  readonly args: TArgs;
}

export interface AbstractOutputFieldConfig<
  TArgs extends PlainObject | undefined,
  TValue,
  TSelection extends IFieldSelection
> extends AbstractFieldConfig {
  readonly type: ThunkOrValue<GraphQLOutputType>;
  readonly args?: ThunkOrValue<GraphQLArgumentConfigMap<TArgs>>;
  assertValue?(value: unknown, selection: TSelection, path: Path): TValue;
}

export abstract class AbstractOutputField<
  TArgs extends PlainObject | undefined,
  TValue,
  TSelection extends IFieldSelection
> extends AbstractField {
  readonly #type: AbstractOutputFieldConfig<TArgs, TValue, TSelection>['type'];
  readonly #args: AbstractOutputFieldConfig<TArgs, TValue, TSelection>['args'];
  readonly assertValue: NonNullable<
    AbstractOutputFieldConfig<TArgs, TValue, TSelection>['assertValue']
  >;

  public constructor(
    public readonly node: Node,
    name: string,
    {
      type,
      args,
      assertValue,
      ...config
    }: AbstractOutputFieldConfig<TArgs, TValue, TSelection>,
  ) {
    super(node, name, config);

    this.#type = type;
    this.#args = args;

    if (assertValue) {
      this.assertValue = assertValue;
    } else if (isWrappedLeafType(type)) {
      this.assertValue = (value: unknown, selection: TSelection, path: Path) =>
        assertWrappedLeafValue(type, value, path);
    } else {
      throw new Error(`The "${this.id}" field misses its "assertValue"`);
    }
  }

  public abstract parseFieldNode(
    field: FieldNode,
    path: Path,
    context?: TASTContext,
  ): TSelection;

  @Memoize()
  public get graphqlFieldConfig(): GraphQLFieldConfig<any, any, any> {
    assert(this.public, `"${this.id}" is private`);

    return {
      description: this.description,
      args: resolveThunkOrValue(this.#args),
      type: resolveThunkOrValue(this.#type),
    };
  }
}
