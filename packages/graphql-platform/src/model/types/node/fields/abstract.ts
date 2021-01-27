import { Path } from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { strict as assert } from 'assert';
import {
  FieldNode,
  GraphQLFieldConfig,
  GraphQLFieldConfigArgumentMap,
  GraphQLOutputType,
} from 'graphql';
import { NodeType } from '../../node';
import { ASTContext } from '../selection';

export abstract class AbstractSelection<TField extends AbstractField = any> {
  public constructor(public readonly field: TField) {}

  @Memoize()
  public get key(): string {
    return this.field.name;
  }

  public abstract mergeWith(
    ...selections: ReadonlyArray<AbstractSelection>
  ): AbstractSelection;
}

export abstract class AbstractField {
  public abstract readonly name: string;
  public abstract readonly public: boolean;
  public abstract readonly description: string | undefined;
  public abstract readonly deprecationReason: string | undefined;
  public abstract readonly type: GraphQLOutputType;
  public readonly args?: GraphQLFieldConfigArgumentMap;

  public constructor(public readonly node: NodeType) {}

  @Memoize()
  public toString(): string {
    return `${this.node.name}.${this.name}`;
  }

  public get graphql(): GraphQLFieldConfig<any, any, any> {
    assert(this.public, `The "${this}" field is private`);

    return {
      description: this.description,
      type: this.type,
      args: this.args,
      deprecationReason: this.deprecationReason,
    };
  }

  public abstract select(
    ast: FieldNode,
    path: Path,
    context: ASTContext,
  ): AbstractSelection;
}
