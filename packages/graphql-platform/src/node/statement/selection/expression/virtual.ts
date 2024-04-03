import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import type { NodeSelectedValue, NodeValue } from '../../../../node.js';
import type { NodeChange, NodeUpdate } from '../../../change.js';
import type { OperationContext } from '../../../operation.js';
import type {
  PartialGraphQLResolveInfo,
  VirtualOutputType,
} from '../../../type.js';
import { type BooleanFilter } from '../../filter.js';
import type { SelectionExpressionInterface } from '../expression-interface.js';

export type VirtualSelectionInfo = {};

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
    public readonly info: PartialGraphQLResolveInfo,
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
      this.isAkinTo(expression) && isDeepStrictEqual(expression.info, this.info)
    );
  }

  public isSupersetOf(expression: unknown): boolean {
    if (this.isAkinTo(expression)) {
      assert.equal(expression.info, undefined, 'Not implemented yet');
      assert.equal(this.info, undefined, 'Not implemented yet');

      return true;
    }

    return false;
  }

  public mergeWith(expression: VirtualSelection, _path?: utils.Path): this {
    assert(this.isAkinTo(expression));

    assert.deepEqual(
      expression.info,
      this.info,
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
  ): BooleanFilter | null {
    return (
      this.type.dependencies?.getAffectedGraphByNodeChange(
        change,
        visitedRootNodes,
      )?.filter ?? null
    );
  }

  public toGraphQLFieldNode(): graphql.FieldNode {
    return this.info.fieldNodes[0];
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
      return await this.type.resolve(source, this.args, context, this.info);
    } catch (error) {
      throw utils.isGraphErrorWithPathEqualOrDescendantOf(error, path)
        ? error
        : new utils.GraphError(utils.castToError(error).message, {
            cause: error,
            path,
          });
    }
  }

  public pickValue(superSetOfValue: TValue, _path?: utils.Path): TValue {
    return superSetOfValue;
  }

  public areValuesEqual(a: unknown, b: unknown): boolean {
    return isDeepStrictEqual(a, b);
  }
}
