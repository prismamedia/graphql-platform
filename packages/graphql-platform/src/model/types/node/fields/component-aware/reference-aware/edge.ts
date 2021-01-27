import {
  GraphQLNonNullDecorator,
  Path,
} from '@prismamedia/graphql-platform-utils';
import { FieldNode, GraphQLOutputType } from 'graphql';
import { Reference } from '../../../../../components';
import { ASTContext, NodeType } from '../../../../node';
import { NodeSelection } from '../../../selection';
import { AbstractSelection } from '../../abstract';
import {
  assertGraphQLFieldNodeWithoutArguments,
  assertGraphQLFieldNodeWithSelectionSet,
  assertHomogeneousSelections,
} from '../../assertions';
import { AbstractReferenceAwareField } from './abstract';

export class EdgeSelection extends AbstractSelection<EdgeField> {
  public constructor(field: EdgeField, public readonly head: NodeSelection) {
    super(field);
  }

  public mergeWith(...selections: EdgeSelection[]): EdgeSelection {
    assertHomogeneousSelections(this, selections);

    return this;
  }
}

export class EdgeField extends AbstractReferenceAwareField {
  public override readonly name: string;
  public override readonly description: string | undefined;

  public constructor(public readonly tail: NodeType, reference: Reference) {
    super(tail, reference);

    this.name = reference.name;
    this.description = reference.description;
  }

  public override get type(): GraphQLOutputType {
    return GraphQLNonNullDecorator(
      this.reference.referencedUniqueConstraint.model.nodeType.type,
      !this.reference.nullable,
    );
  }

  public override select(
    ast: FieldNode,
    path: Path,
    context: ASTContext,
  ): EdgeSelection {
    assertGraphQLFieldNodeWithoutArguments(ast.arguments, path);
    assertGraphQLFieldNodeWithSelectionSet(ast.selectionSet, path);

    return new EdgeSelection(
      this,
      this.reference.referencedUniqueConstraint.model.nodeType.select(
        ast.selectionSet,
        path,
        context,
      ),
    );
  }
}
