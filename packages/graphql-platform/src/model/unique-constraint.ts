import { isNonEmptyArray } from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { assertValidName } from 'graphql';
import {
  ConnectorConfigOverride,
  ConnectorConfigOverrideKind,
  ConnectorInterface,
} from '../connector';
import {
  catchDefinitionError,
  UniqueConstraintDefinitionError,
} from '../errors';
import { Model } from '../model';
import { Component } from './components';
import { NodeSelection } from './types/node';

type FullUniqueConstraintConfig<
  TRequestContext = any,
  TConnector extends ConnectorInterface = any,
> = {
  components: Component['name'][];
  name?: string;
} & ConnectorConfigOverride<
  TConnector,
  ConnectorConfigOverrideKind.UniqueConstraint
>;

type ShortUniqueConstraintConfig<
  TRequestContext = any,
  TConnector extends ConnectorInterface = any,
> = Component['name'][];

export type UniqueConstraintConfig<
  TRequestContext = any,
  TConnector extends ConnectorInterface = any,
> =
  | FullUniqueConstraintConfig<TRequestContext, TConnector>
  | ShortUniqueConstraintConfig<TRequestContext, TConnector>;

const isShortConfig = <TRequestContext, TConnector extends ConnectorInterface>(
  config: UniqueConstraintConfig<TRequestContext, TConnector>,
): config is ShortUniqueConstraintConfig<TRequestContext, TConnector> =>
  Array.isArray(config);

export class UniqueConstraint<
  TRequestContext = any,
  TConnector extends ConnectorInterface = any,
> {
  public readonly config: FullUniqueConstraintConfig<
    TRequestContext,
    TConnector
  >;
  public readonly name: string;
  public readonly id: string;
  public readonly componentSet: ReadonlySet<
    Component<TRequestContext, TConnector>
  >;
  public readonly public: boolean;
  public readonly nullable: boolean;
  public readonly immutable: boolean;

  public constructor(
    public readonly model: Model<TRequestContext, TConnector>,
    config: UniqueConstraintConfig<TRequestContext, TConnector>,
  ) {
    // config
    this.config = isShortConfig(config) ? { components: config } : config;

    if (!isNonEmptyArray(this.config.components)) {
      throw new Error(`expects at least one "component" to be provided`);
    }

    // name
    {
      const name = this.config.name || this.config.components.join('-');

      this.name = catchDefinitionError(
        () => assertValidName(name),
        (error) =>
          new UniqueConstraintDefinitionError(
            `${model.name}.${name}`,
            `expects a "name" valid against the GraphQL rules`,
            error,
          ),
      );
    }

    // id
    this.id = `${model.name}.${this.name}`;

    // component set
    this.componentSet = new Set(
      this.config.components.map((componentName) =>
        catchDefinitionError(
          () => model.getComponent(componentName),
          () =>
            new UniqueConstraintDefinitionError(
              this,
              `expects "component" among "${[...model.componentMap.keys()].join(
                ', ',
              )}", got "${componentName}"`,
            ),
        ),
      ),
    );

    this.public = [...this.componentSet].every((component) => component.public);

    this.nullable = [...this.componentSet].every(
      (component) => component.nullable,
    );

    this.immutable = [...this.componentSet].every(
      (component) => component.immutable,
    );
  }

  public toString(): string {
    return this.id;
  }

  @Memoize()
  public get selection(): NodeSelection {
    return new NodeSelection(
      this.model.nodeType,
      Array.from(this.componentSet, ({ selection }) => selection),
    );
  }

  public validate(): void {
    // Resolves the "lazy" properties
    this.selection;
  }
}
