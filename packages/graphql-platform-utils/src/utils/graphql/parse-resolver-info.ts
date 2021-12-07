import { Memoize } from '@prismamedia/ts-memoize';
import {
  FieldNode,
  getNamedType,
  GraphQLObjectType,
  GraphQLResolveInfo,
  print,
  ResponsePath,
  responsePathAsArray,
  SelectionNode,
  SelectionSetNode,
} from 'graphql';
import { getArgumentValues } from 'graphql/execution/values';
import { POJO } from '../../types/pojo';
import { isPlainObject } from '../is-plain-object';
import { SuperMap } from '../super-map';

export class GraphQLSelectionNode {
  readonly children = new SuperMap<
    GraphQLSelectionNode['key'],
    GraphQLSelectionNode
  >();

  public constructor(
    readonly name: string,
    readonly args: POJO,
    children: Array<GraphQLSelectionNode | GraphQLSelectionNode['name']> = [],
    readonly alias: string | undefined = undefined,
    protected parent: GraphQLSelectionNode | undefined = undefined,
    protected rootPath: ReadonlyArray<string | number> | undefined = undefined,
  ) {
    this.setChildren(children);
  }

  public toAST(): SelectionSetNode {
    const selectionSetNode: SelectionSetNode = {
      kind: 'SelectionSet',
      selections: [...this.children].map(
        ([, selectionNode]): FieldNode => ({
          kind: 'Field',
          name: {
            kind: 'Name',
            value: selectionNode.name,
          },
          ...(selectionNode.alias
            ? {
                alias: {
                  kind: 'Name',
                  value: selectionNode.alias,
                },
              }
            : undefined),
          ...(!selectionNode.isLeaf()
            ? {
                selectionSet: selectionNode.toAST(),
              }
            : undefined),
        }),
      ),
    };

    return selectionSetNode;
  }

  public toString(): string {
    return print(this.toAST());
  }

  public setParent(parent: GraphQLSelectionNode): void {
    this.parent = parent;
  }

  public getChildren(): GraphQLSelectionNode[] {
    return [...this.children.values()];
  }

  public setChildren(
    children: Array<GraphQLSelectionNode | GraphQLSelectionNode['name']>,
  ): void {
    (children instanceof GraphQLSelectionNode
      ? children.getChildren()
      : children
    ).forEach((child) => this.setChild(child));
  }

  public setChild(
    nodeOrNodeName: GraphQLSelectionNode | GraphQLSelectionNode['name'],
  ): void {
    const node =
      typeof nodeOrNodeName === 'string'
        ? new GraphQLSelectionNode(nodeOrNodeName, {})
        : nodeOrNodeName.clone();

    node.setParent(this);

    const currentNode = this.children.get(node.key);
    if (currentNode) {
      currentNode.setChildren(node.getChildren());
    } else {
      this.children.set(node.key, node);
    }
  }

  @Memoize()
  public isRoot(): boolean {
    return !this.parent && (!this.rootPath || this.rootPath.length === 0);
  }

  public isLeaf(): boolean {
    return this.children.size === 0;
  }

  @Memoize()
  public get key(): string {
    return this.alias || this.name;
  }

  @Memoize()
  public get pathAsArray(): string[] {
    return [
      ...(this.parent ? [this.parent.path] : (this.rootPath || []).map(String)),
      this.key,
    ].filter(Boolean);
  }

  @Memoize()
  public get path(): string {
    return this.pathAsArray.join('/');
  }

  public clone(args: POJO = this.args): GraphQLSelectionNode {
    return new GraphQLSelectionNode(
      this.name,
      args,
      this.getChildren(),
      this.alias,
      this.parent,
      this.rootPath,
    );
  }

  public diff(node: unknown): GraphQLSelectionNode {
    const diff = new GraphQLSelectionNode(this.name, this.args);

    if (!isPlainObject(node)) {
      throw new Error(
        `The "${this.name}.diff()" function has to be called with a plain object.`,
      );
    }

    for (const child of this.children.values()) {
      const childValue = node[child.name];

      if (typeof childValue === 'undefined') {
        diff.setChild(child);
      } else if (childValue !== null) {
        if (!child.isLeaf()) {
          const childNode: POJO | undefined = isPlainObject(childValue)
            ? childValue
            : Array.isArray(childValue)
            ? childValue.find(isPlainObject)
            : undefined;

          if (childNode) {
            const childDiff = child.diff(childNode);
            if (childDiff.children.size > 0) {
              diff.setChild(childDiff);
            }
          }
        }
      }
    }

    return diff;
  }

  public hasDiff(node: unknown): boolean {
    return this.diff(node).children.size > 0;
  }

  public toPlainObject(): POJO {
    const pojo: POJO = {};

    for (const child of this.children.values()) {
      pojo[child.key] = {
        name: child.name,
        ...(Object.keys(child.args).length > 0 ? { args: child.args } : {}),
        ...(!child.isLeaf() ? { children: child.toPlainObject() } : {}),
      };
    }

    return pojo;
  }
}

export function appendNodeChild(
  node: GraphQLSelectionNode,
  selection: SelectionNode,
  fragments: GraphQLResolveInfo['fragments'],
  variableValues: GraphQLResolveInfo['variableValues'],
  parentType: GraphQLObjectType,
): void {
  switch (selection.kind) {
    case 'Field':
      node.setChild(
        parseGraphQLSelectionNode(
          selection,
          fragments,
          variableValues,
          parentType,
        ),
      );
      break;

    case 'InlineFragment':
    case 'FragmentSpread':
      const fragment =
        selection.kind === 'FragmentSpread'
          ? fragments[selection.name.value]
          : selection;

      fragment.selectionSet.selections.forEach((selection) =>
        appendNodeChild(node, selection, fragments, variableValues, parentType),
      );
      break;
  }
}

export function parseGraphQLSelectionNode(
  field: FieldNode,
  fragments: GraphQLResolveInfo['fragments'],
  variableValues: GraphQLResolveInfo['variableValues'],
  parentType: GraphQLObjectType,
  path?: ResponsePath,
): GraphQLSelectionNode {
  const name = field.name?.value;
  const alias = field.alias?.value;
  const fieldDef = parentType.getFields()[name];
  const fieldType = fieldDef ? getNamedType(fieldDef.type) : null;

  const node = new GraphQLSelectionNode(
    name,
    fieldDef ? getArgumentValues(fieldDef, field, variableValues) : {},
    undefined,
    alias,
    undefined,
    path ? responsePathAsArray(path) : undefined,
  );

  if (
    fieldType &&
    field.selectionSet &&
    fieldType instanceof GraphQLObjectType
  ) {
    field.selectionSet.selections.forEach((selection) =>
      appendNodeChild(node, selection, fragments, variableValues, fieldType),
    );
  }

  return node;
}

export function parseGraphQLResolveInfo(
  info: GraphQLResolveInfo,
): GraphQLSelectionNode {
  return parseGraphQLSelectionNode(
    info.fieldNodes[0],
    info.fragments,
    info.variableValues,
    info.parentType,
    info.path.prev,
  );
}
