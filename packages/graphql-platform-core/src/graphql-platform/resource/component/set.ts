import { GraphQLSelectionNode, SuperSetOfNamedObject } from '@prismamedia/graphql-platform-utils';
import { Memoize } from 'typescript-memoize';
import { TypeKind } from '../../type';
import { Component } from './types';

export class ComponentSet<TComponent extends Component = Component> extends SuperSetOfNamedObject<TComponent> {
  @Memoize((use: TypeKind = TypeKind.Output) => use)
  public getSelectionNodeChildren(use: TypeKind = TypeKind.Output): GraphQLSelectionNode[] {
    const children: GraphQLSelectionNode[] = [];

    for (const component of this) {
      if (use === TypeKind.Output && !component.isPublic()) {
        throw new Error(`As the component "${this}" is not public, it can't be selectionned.`);
      }

      children.push(
        new GraphQLSelectionNode(
          component.name,
          {},
          component.isRelation()
            ? (use === TypeKind.Output && !component.getToUnique().isPublic()
                ? component.getTo().getFirstPublicUnique()
                : component.getToUnique()
              )
                .getSelectionNode(use)
                .getChildren()
            : undefined,
        ),
      );
    }

    return children;
  }
}
