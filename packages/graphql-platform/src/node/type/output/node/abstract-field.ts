import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import { argsPathKey } from '../../../abstract-operation.js';
import type { OperationContext } from '../../../operation/context.js';
import type {
  NodeSelectedValue,
  SelectionExpression,
} from '../../../statement/selection.js';
import type { GraphQLSelectionContext } from '../node.js';

export interface AbstractNodeFieldOutputTypeConfig {
  name: utils.Name;
  public: boolean;
  description?: utils.OptionalDescription;
  deprecated?: utils.OptionalDeprecation;
}

export abstract class AbstractNodeFieldOutputType<
  TArgs extends utils.Nillable<utils.PlainObject>,
> {
  public abstract readonly name: utils.Name;
  public abstract readonly description?: string;
  public abstract readonly deprecationReason?: string;
  public abstract readonly arguments?: ReadonlyArray<utils.Input>;
  public abstract readonly type: graphql.GraphQLOutputType;

  public abstract isPublic(): boolean;

  @Memoize()
  public getGraphQLFieldConfig(): graphql.GraphQLFieldConfig<
    NodeSelectedValue,
    any,
    any
  > {
    assert(this.isPublic(), `The "${this}" field is private`);

    return {
      ...(this.description && { description: this.description }),
      ...(this.deprecationReason && {
        deprecationReason: this.deprecationReason,
      }),
      ...(this.arguments?.length && {
        args: utils.getGraphQLFieldConfigArgumentMap(this.arguments),
      }),
      type: this.type,
      resolve: (source, _args, _context, info) => source[info.path.key],
    };
  }

  @Memoize()
  public validate(): void {
    if (this.isPublic()) {
      this.getGraphQLFieldConfig();
    }
  }

  protected parseGraphQLArgumentNodes(
    argumentNodes: graphql.FieldNode['arguments'],
    context: GraphQLSelectionContext | undefined,
    path: utils.Path,
  ): Exclude<TArgs, null> {
    if (!this.arguments?.length) {
      if (argumentNodes?.length) {
        throw new utils.GraphError(`Expects no arguments`, { path });
      }

      return undefined as any;
    }

    return utils.parseInputLiterals(
      this.arguments,
      argumentNodes,
      context?.variableValues,
      utils.addPath(path, argsPathKey),
    ) as any;
  }

  public abstract selectGraphQLFieldNode(
    fieldNode: graphql.FieldNode,
    operationContext: OperationContext | undefined,
    selectionContext: GraphQLSelectionContext | undefined,
    path: utils.Path,
  ): SelectionExpression;

  public abstract selectShape(
    value: unknown,
    operationContext: OperationContext | undefined,
    path: utils.Path,
  ): SelectionExpression;
}
