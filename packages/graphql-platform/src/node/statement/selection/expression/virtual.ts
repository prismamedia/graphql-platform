import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import assert from 'node:assert';
import { isDeepStrictEqual } from 'node:util';
import type { JsonValue } from 'type-fest';
import type { NodeSelectedValue, NodeSelection } from '../../../../node.js';
import type { OperationContext } from '../../../operation.js';
import type {
  PartialGraphQLResolveInfo,
  VirtualOutputType,
} from '../../../type.js';
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
  public readonly ast: graphql.FieldNode;

  public constructor(
    public readonly type: VirtualOutputType<TSource, TArgs, TValue>,
    public readonly alias: string | undefined,
    public readonly args: TArgs,
    public readonly info: PartialGraphQLResolveInfo,
    public readonly sourceSelection: NodeSelection | undefined,
  ) {
    this.name = type.name;
    this.key = alias ?? this.name;
    this.ast = info.fieldNodes[0];
  }

  public get hasVirtualSelection(): boolean {
    return false;
  }

  public isAkinTo(expression: unknown): expression is VirtualSelection {
    return (
      expression instanceof VirtualSelection &&
      expression.type === this.type &&
      expression.alias === this.alias &&
      (!this.type.args?.length ||
        utils.areInputsEqual(this.type.args, expression.args, this.args))
    );
  }

  public equals(expression: unknown): expression is VirtualSelection {
    return (
      this.isAkinTo(expression) && isDeepStrictEqual(expression.info, this.info)
    );
  }

  public isSupersetOf(expression: unknown): boolean {
    if (this.isAkinTo(expression)) {
      assert.strictEqual(expression.info, undefined, 'Not implemented yet');
      assert.strictEqual(this.info, undefined, 'Not implemented yet');

      return true;
    }

    return false;
  }

  public mergeWith(expression: VirtualSelection, _path?: utils.Path): this {
    assert(this.isAkinTo(expression));

    assert.deepStrictEqual(
      expression.info,
      this.info,
      `Cannot merge two different selection-sets, yet`,
    );

    return this;
  }

  public parseSource(maybeSource: unknown, path?: utils.Path): TSource {
    return this.sourceSelection?.parseSource(maybeSource, path);
  }

  public async resolveValue(
    source: TSource,
    context: OperationContext,
    path: utils.Path,
  ): Promise<TValue> {
    try {
      return await this.type.resolve(
        await this.sourceSelection?.resolveValue(source, context, path),
        this.args,
        context,
        this.info,
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

  public pickValue(superSetOfValue: TValue, _path?: utils.Path): TValue {
    return superSetOfValue;
  }

  public areValuesEqual(a: unknown, b: unknown): boolean {
    return isDeepStrictEqual(a, b);
  }

  public serialize(value: TValue, path: utils.Path): JsonValue {
    return utils.serializeGraphQLOutputType(this.type.type, value, path);
  }

  public unserialize(_value: JsonValue | undefined, path: utils.Path): TValue {
    throw new utils.GraphError('Cannot be unserialized', { path });
  }
}
