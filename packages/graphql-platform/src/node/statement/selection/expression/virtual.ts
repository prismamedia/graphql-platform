import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import type { NodeSelectedValue, NodeValue } from '../../../../node.js';
import type { NodeChange, NodeUpdate } from '../../../change.js';
import type { OperationContext } from '../../../operation.js';
import type { VirtualOutputType } from '../../../type.js';
import { FalseValue, type BooleanFilter } from '../../filter.js';
import type { SelectionExpressionInterface } from '../expression-interface.js';

export class VirtualSelection<
  TSource extends NodeSelectedValue | undefined = any,
  TArgs extends utils.Nillable<utils.PlainObject> = any,
  TValue = any,
> implements SelectionExpressionInterface<TSource, TValue>
{
  public readonly name: string;
  public readonly key: string;

  public constructor(
    public readonly type: VirtualOutputType<TSource, TArgs, TValue>,
    public readonly alias: string | undefined,
    public readonly args: TArgs,
    public readonly selectionSet: graphql.FieldNode['selectionSet'],
  ) {
    this.name = type.name;
    this.key = this.alias ?? this.name;
  }

  public get hasVirtualSelection(): boolean {
    return false;
  }

  public isAkinTo(expression: unknown): expression is VirtualSelection {
    return (
      expression instanceof VirtualSelection &&
      expression.type === this.type &&
      expression.alias === this.alias &&
      isDeepStrictEqual(expression.args, this.args)
    );
  }

  public equals(expression: unknown): expression is VirtualSelection {
    return (
      this.isAkinTo(expression) &&
      isDeepStrictEqual(expression.selectionSet, this.selectionSet)
    );
  }

  public isSupersetOf(expression: unknown): boolean {
    if (this.isAkinTo(expression)) {
      assert.equal(expression.selectionSet, undefined, 'Not implemented yet');
      assert.equal(this.selectionSet, undefined, 'Not implemented yet');

      return true;
    }

    return false;
  }

  public mergeWith(expression: VirtualSelection, _path?: utils.Path): this {
    assert(this.isAkinTo(expression));

    assert.deepEqual(
      expression.selectionSet,
      this.selectionSet,
      `Cannot merge two different selection-sets, yet`,
    );

    return this;
  }

  public isAffectedByNodeUpdate(update: NodeUpdate): boolean {
    return this.type.dependencies?.isAffectedByNodeUpdate(update) ?? false;
  }

  public getAffectedGraphByNodeChange(
    change: NodeChange,
    visitedRootNodes?: NodeValue[],
  ): BooleanFilter {
    return (
      this.type.dependencies?.getAffectedGraphByNodeChange(
        change,
        visitedRootNodes,
      ).filter ?? FalseValue
    );
  }

  public toGraphQLFieldNode(): graphql.FieldNode {
    return {
      kind: graphql.Kind.FIELD,
      ...(this.alias && {
        alias: {
          kind: graphql.Kind.NAME,
          value: this.alias,
        },
      }),
      name: {
        kind: graphql.Kind.NAME,
        value: this.name,
      },
      ...(this.selectionSet && { selectionSet: this.selectionSet }),
    };
  }

  public parseSource(maybeSource: unknown, path?: utils.Path): TSource {
    return this.type.dependencies?.parseSource(maybeSource, path);
  }

  public async resolveValue(
    source: TSource,
    context: OperationContext,
    path: utils.Path,
  ): Promise<TValue> {
    try {
      return await this.type.resolve(
        source,
        this.args,
        context,
        this.selectionSet,
      );
    } catch (error) {
      throw utils.isGraphErrorWithPathEqualOrDescendantOf(error, path)
        ? error
        : new utils.GraphError(utils.castToError(error).message, {
            cause: error,
            path,
          });
    }
  }

  public pickValue(superSetOfValue: TValue): TValue {
    return superSetOfValue;
  }

  public areValuesEqual(a: unknown, b: unknown): boolean {
    return isDeepStrictEqual(a, b);
  }
}
