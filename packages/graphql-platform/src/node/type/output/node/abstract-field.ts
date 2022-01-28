import {
  addPath,
  getGraphQLFieldConfigArgumentMap,
  Input,
  NestableError,
  parseGraphQLUntypedArgumentNodes,
  parseInputs,
  type Name,
  type Nillable,
  type OptionalDeprecation,
  type OptionalDescription,
  type Path,
  type PlainObject,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
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
  name: Name;
  public: boolean;
  description?: OptionalDescription;
  deprecated?: OptionalDeprecation;
}

export abstract class AbstractNodeFieldOutputType<
  TArgs extends Nillable<PlainObject>,
> {
  public abstract readonly name: Name;
  public abstract readonly description?: string;
  public abstract readonly deprecationReason?: string;
  public abstract readonly arguments?: ReadonlyArray<Input>;
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
        args: getGraphQLFieldConfigArgumentMap(this.arguments),
      }),
      type: this.type,
    };
  }

  @Memoize()
  public validate(): void {
    if (this.isPublic()) {
      this.getGraphQLFieldConfig();
    }
  }

  protected parseGraphQLFieldArguments(
    args: graphql.FieldNode['arguments'],
    context?: GraphQLSelectionContext,
    path?: Path,
  ): Exclude<TArgs, null> {
    if (!this.arguments?.length) {
      if (args?.length) {
        throw new NestableError(`Expects no arguments`, { path });
      }

      return undefined as any;
    }

    return Object.freeze<any>(
      parseInputs(
        this.arguments,
        args?.length
          ? parseGraphQLUntypedArgumentNodes(args, context?.variableValues)
          : undefined,
        addPath(path, argsPathKey),
      ),
    );
  }

  public abstract selectGraphQLField(
    ast: graphql.FieldNode,
    operationContext: OperationContext | undefined,
    selectionContext: GraphQLSelectionContext | undefined,
    path: Path,
  ): SelectionExpression;

  public abstract selectShape(
    value: unknown,
    operationContext: OperationContext | undefined,
    path: Path,
  ): SelectionExpression;
}
