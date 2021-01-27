import { Path } from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { strict as assert } from 'assert';
import {
  FieldNode,
  GraphQLList,
  GraphQLNonNull,
  GraphQLOutputType,
} from 'graphql';
import { Referrer } from '../../../../referrer';
import { NodeType } from '../../../node';
import { ASTContext, NodeSelection } from '../../selection';
import { AbstractSelection } from '../abstract';
import {
  assertGraphQLFieldNodeWithArguments,
  assertGraphQLFieldNodeWithSelectionSet,
} from '../assertions';
import { AbstractReferrerAwareField } from './abstract';

export class ReverseEdgesSelection extends AbstractSelection<ReverseEdgesField> {
  public constructor(
    field: ReverseEdgesField,
    public readonly args: string,
    public readonly head: NodeSelection,
    public readonly alias?: string,
  ) {
    super(field);
  }

  @Memoize()
  public get key(): string {
    return this.alias ?? this.field.name;
  }

  public mergeWith(
    ...selections: ReverseEdgesSelection[]
  ): ReverseEdgesSelection {
    return selections.length === 0
      ? this
      : new ReverseEdgesSelection(
          this.field,
          this.args,
          this.head.mergeWith(),
          this.alias,
        );
  }
}

export class ReverseEdgesField extends AbstractReferrerAwareField {
  public override readonly name: string;
  public override readonly description: string | undefined;

  public constructor(node: NodeType, referrer: Referrer) {
    assert(!referrer.unique, `The "${referrer}" referrer is unique`);
    super(node, referrer);

    this.name = referrer.name;
    this.description = referrer.description;
  }

  public override get type(): GraphQLOutputType {
    return GraphQLNonNull(
      GraphQLList(
        GraphQLNonNull(this.referrer.originalReference.model.nodeType.type),
      ),
    );
  }

  public override select(
    ast: FieldNode,
    path: Path,
    context: ASTContext,
  ): ReverseEdgesSelection {
    assertGraphQLFieldNodeWithArguments(ast.arguments, path);
    assertGraphQLFieldNodeWithSelectionSet(ast.selectionSet, path);

    return new ReverseEdgesSelection(
      this,
      this.referrer.originalReference.model.nodeType.select(
        ast.selectionSet,
        path,
        context,
      ),
    );
  }
}
