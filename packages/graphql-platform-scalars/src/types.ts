import {
  GraphQLScalarType as BaseGraphQLScalarType,
  GraphQLScalarTypeConfig as BaseGraphQLScalarTypeConfig,
  ValueNode,
} from 'graphql';
import { Maybe } from 'graphql/jsutils/Maybe';

export type TypedGraphQLScalarType<
  TName extends string,
  TInternal,
  TExternal = TInternal,
> = BaseGraphQLScalarType & {
  name: TName;
  serialize: (value: any) => TExternal;
  parseValue: (value: any) => TInternal;
  parseLiteral: (
    valueNode: ValueNode,
    variables: Maybe<{ [key: string]: any }>,
  ) => TInternal;
};

interface GraphQLScalarTypeConfig<TName extends string, TInternal, TExternal>
  extends BaseGraphQLScalarTypeConfig<TInternal, TExternal> {
  name: TName;
  serialize: (value: any) => TExternal;
  parseValue: (value: any) => TInternal;
  parseLiteral: (
    valueNode: ValueNode,
    variables: Maybe<{ [key: string]: any }>,
  ) => TInternal;
}

export class GraphQLScalarType<
    TName extends string,
    TInternal,
    TExternal = TInternal,
  >
  extends BaseGraphQLScalarType
  implements TypedGraphQLScalarType<TName, TInternal, TExternal>
{
  public readonly name: TName;
  public readonly serialize: (value: any) => TExternal;
  public readonly parseValue: (value: any) => TInternal;
  public readonly parseLiteral: (
    valueNode: ValueNode,
    variables: Maybe<{ [key: string]: any }>,
  ) => TInternal;

  public constructor(
    config: GraphQLScalarTypeConfig<TName, TInternal, TExternal>,
  ) {
    super(config);

    this.name = config.name;
    this.serialize = config.serialize;
    this.parseValue = config.parseValue;
    this.parseLiteral = config.parseLiteral;
  }
}
