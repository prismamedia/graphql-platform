import { GraphQLInputType, GraphQLOutputType } from 'graphql';
import { Resource } from '../resource';
import { InputType, OutputType, TypeKind } from '../type';

abstract class AbstractType<
  TType extends GraphQLInputType | GraphQLOutputType,
> {
  public constructor(readonly id: string, readonly resource: Resource) {}

  public isSupported(): boolean {
    return true;
  }

  public abstract getGraphQLType(): TType;
}

export abstract class AbstractInputType
  extends AbstractType<GraphQLInputType>
  implements InputType
{
  readonly kind = TypeKind.Input;
}

export abstract class AbstractOutputType
  extends AbstractType<GraphQLOutputType>
  implements OutputType
{
  readonly kind = TypeKind.Output;
}
