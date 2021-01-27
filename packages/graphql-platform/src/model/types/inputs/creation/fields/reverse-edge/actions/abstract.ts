import { Path } from '@prismamedia/graphql-platform-utils';
import { GraphQLInputFieldConfig } from 'graphql';
import { Referrer } from '../../../../../../../model';
import { OperationContext } from '../../../../../../operations';
import { NodeRecord } from '../../../../../node';

export abstract class AbstractReverseEdgeAction<TValue> {
  public constructor(public readonly reverseEdge: Referrer) {}

  public abstract get enabled(): boolean;

  public abstract get public(): boolean;

  public abstract get graphqlInputFieldConfig(): GraphQLInputFieldConfig;

  public abstract assertValue(maybeValue: unknown, path: Path): TValue;

  public abstract handle(
    record: Readonly<NodeRecord>,
    value: TValue,
    operationContext: OperationContext,
    path: Path,
  ): Promise<void>;
}
