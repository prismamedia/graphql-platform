import {
  Input,
  MutationType,
  nonNillableInputType,
  NonNullableInputType,
  type NonNillable,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type {
  NodeSelectionAwareArgs,
  RawNodeSelectionAwareArgs,
} from '../../abstract-operation.js';
import type { NodeSelectedValue } from '../../statement/selection.js';
import type { NodeCreationInputValue } from '../../type/input/creation.js';
import type { NodeUniqueFilterInputValue } from '../../type/input/unique-filter.js';
import type { NodeUpdateInputValue } from '../../type/input/update.js';
import { AbstractMutation } from '../abstract-mutation.js';
import type { MutationContext } from './context.js';

export type UpsertMutationArgs = RawNodeSelectionAwareArgs<{
  where: NonNillable<NodeUniqueFilterInputValue>;
  create: NonNillable<NodeCreationInputValue>;
  update?: Exclude<NodeUpdateInputValue, null>;
}>;

export type UpsertMutationResult = NodeSelectedValue;

export class UpsertMutation<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> extends AbstractMutation<
  TRequestContext,
  TConnector,
  UpsertMutationArgs,
  UpsertMutationResult
> {
  public override readonly mutationTypes = [
    MutationType.CREATION,
    MutationType.UPDATE,
  ] as const;

  protected override readonly selectionAware = true;
  public override readonly name = `upsert${this.node.name}`;
  public override readonly description = `Updates an existing "${this.node.name}" or creates a new one`;

  @Memoize()
  public override get arguments() {
    return [
      new Input({
        name: 'where',
        type: nonNillableInputType(this.node.uniqueFilterInputType),
      }),
      new Input({
        name: 'create',
        type: nonNillableInputType(this.node.creationInputType),
      }),
      new Input({
        name: 'update',
        type: new NonNullableInputType(this.node.updateInputType),
      }),
    ];
  }

  @Memoize()
  public override getGraphQLOutputType() {
    return new graphql.GraphQLNonNull(
      this.node.outputType.getGraphQLObjectType(),
    );
  }

  protected override async executeWithValidArgumentsAndContext(
    args: NodeSelectionAwareArgs<UpsertMutationArgs>,
    context: MutationContext<TRequestContext, TConnector>,
    path: Path,
  ): Promise<UpsertMutationResult> {
    return {};
  }
}
