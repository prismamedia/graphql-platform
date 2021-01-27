import {
  addPath,
  didYouMean,
  isGraphQLResolveInfo,
  isIterable,
  MaybePathAwareError,
  Path,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'assert';
import {
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLResolveInfo,
} from 'graphql';
import { ConnectorInterface } from '../../connector';
import { Leaf, Model } from '../../model';
import {
  EdgeExistenceField,
  EdgeField,
  Field,
  getVirtualFieldConfigs,
  LeafField,
  ReverseEdgeCountField,
  ReverseEdgeExistenceField,
  ReverseEdgeField,
  ReverseEdgesField,
  VirtualField,
  VirtualFieldConfigMap,
} from './node/fields';
import {
  ASTContext,
  ASTSelectionSet,
  ComponentNames,
  Fragment,
  NodeSelection,
  parseASTSelectionSet,
  parseComponentNames,
  parseFragment,
  parseResolveInfo,
} from './node/selection';
import { NodeValue } from './node/values';

export * from './node/fields';
export * from './node/selection';
export * from './node/values';

export type RawNodeSelection =
  | NodeSelection
  | Fragment
  | ComponentNames
  | ASTSelectionSet
  | GraphQLResolveInfo;

export interface NodeTypeConfig<
  TRequestContext = any,
  TConnector extends ConnectorInterface = any,
> {
  /**
   * Optional, implement some GraphQL interfaces
   */
  interfaces?: GraphQLInterfaceType[];

  /**
   * Optional, add some "virtual" fields whose value is computed from the other fields' value
   */
  virtualFields?: VirtualFieldConfigMap<TRequestContext, TConnector>;
}

export class NodeType {
  public readonly name: string;
  public readonly public: boolean;
  protected readonly config?: NodeTypeConfig = this.model.config.node;

  public constructor(public readonly model: Model) {
    this.name = model.name;
    this.public = model.public;
  }

  public toString(): string {
    return this.name;
  }

  @Memoize()
  public get fieldMap(): ReadonlyMap<Field['name'], Field> {
    const fields: Field[] = [];

    for (const component of this.model.componentMap.values()) {
      if (component instanceof Leaf) {
        fields.push(new LeafField(this, component));
      } else {
        fields.push(new EdgeField(this, component));
        if (component.nullable) {
          fields.push(new EdgeExistenceField(this, component));
        }
      }
    }

    for (const referrer of this.model.referrerMap.values()) {
      if (referrer.unique) {
        fields.push(
          new ReverseEdgeField(this, referrer),
          new ReverseEdgeExistenceField(this, referrer),
        );
      } else {
        fields.push(
          new ReverseEdgesField(this, referrer),
          new ReverseEdgeCountField(this, referrer),
        );
      }
    }

    if (this.config?.virtualFields) {
      for (const virtualFieldConfig of getVirtualFieldConfigs(
        this.model,
        this.config.virtualFields,
      )) {
        fields.push(new VirtualField(this, virtualFieldConfig));
      }
    }

    const fieldMap = new Map<Field['name'], Field>();

    for (const field of fields) {
      if (fieldMap.has(field.name)) {
        throw new Error(
          `The "${this}" node contains at least 2 fields with the same name: ${field.name}`,
        );
      }

      fieldMap.set(field.name, field);
    }

    return fieldMap;
  }

  public getField(name: string, path?: Path): Field {
    const field = this.fieldMap.get(name);
    if (!field) {
      throw new MaybePathAwareError(
        `The "${this}" node does not contain the field "${name}", did you mean: ${didYouMean(
          name,
          this.fieldMap.keys(),
        )}`,
        path,
      );
    }

    return field;
  }

  @Memoize()
  public get publicFieldMap(): ReadonlyMap<Field['name'], Field> {
    assert(this.public, `"${this.name}" is private`);

    return new Map([...this.fieldMap].filter(([, field]) => field.public));
  }

  @Memoize()
  public get type(): GraphQLObjectType {
    assert(this.public, `"${this.name}" is private`);
    assert(
      this.publicFieldMap.size > 0,
      `"${this}" expects at least one public field`,
    );

    return new GraphQLObjectType({
      name: this.name,
      description: this.model.description,
      interfaces: this.config?.interfaces,
      fields: () =>
        Object.fromEntries(
          [...this.publicFieldMap.values()].map((field) => [
            field.name,
            field.graphqlFieldConfig,
          ]),
        ),
    });
  }

  public select(
    rawSelection: RawNodeSelection,
    path: Path = addPath(undefined, this.name),
    context?: ASTContext,
  ): NodeSelection {
    if (rawSelection == null) {
      throw new UnexpectedValueError(
        rawSelection,
        `a "RawNodeSelection"`,
        path,
      );
    }

    return rawSelection instanceof NodeSelection
      ? rawSelection
      : typeof rawSelection === 'string'
      ? parseFragment(this, rawSelection, path, context)
      : isIterable(rawSelection)
      ? parseComponentNames(this, rawSelection, path)
      : isGraphQLResolveInfo(rawSelection)
      ? parseResolveInfo(this, rawSelection, path)
      : parseASTSelectionSet(this, rawSelection, path, context);
  }

  public isValue(
    maybeValue: unknown,
    rawSelection: RawNodeSelection,
  ): maybeValue is NodeValue {
    return this.select(rawSelection).isValue(maybeValue);
  }

  public assertValue(
    maybeValue: unknown,
    path: Path = addPath(undefined, this.name),
    rawSelection: RawNodeSelection,
  ): NodeValue {
    return this.select(rawSelection, path).assertValue(maybeValue, path);
  }
}
