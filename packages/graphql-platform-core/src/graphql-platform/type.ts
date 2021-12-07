import { GraphQLInputType, GraphQLOutputType } from 'graphql';
import { Resource } from './resource';

export * from './type/input';
export * from './type/output';

export enum TypeKind {
  Input,
  Output,
}

interface Type<
  TTypeKind extends TypeKind,
  TType extends GraphQLInputType | GraphQLOutputType,
> {
  kind: TTypeKind;
  id: string;
  resource: Resource;
  isSupported(): boolean;
  getGraphQLType(): TType;
}

export interface InputType extends Type<TypeKind.Input, GraphQLInputType> {}

export interface OutputType extends Type<TypeKind.Output, GraphQLOutputType> {}
