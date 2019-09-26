import { Memoize } from '@prismamedia/ts-memoize';
import { Leaf, Node } from '../../node';
import {
  CustomField,
  getCustomFieldConfigMap,
  NodeOutputEdgeExistenceField,
  NodeOutputEdgeField,
  NodeOutputLeafField,
  ReverseEdgeCountField,
  ReverseEdgeField,
  TNodeOutputField,
  UniqueReverseEdgeExistenceField,
  UniqueReverseEdgeField,
} from './output/fields';

export * from './output/fields';

export class NodeOutput {
  public readonly public: boolean;
  public readonly name: string;
  public readonly description: string | undefined;

  public constructor(public readonly node: Node) {
    this.public = node.public;
    this.name = node.name;
    this.description = node.description;
  }

  @Memoize()
  public get fieldMap(): ReadonlyMap<string, TNodeOutputField> {
    const fields: TNodeOutputField[] = [];

    for (const component of this.node.componentMap.values()) {
      if (component instanceof Leaf) {
        fields.push(new NodeOutputLeafField(this, component));
      } else {
        fields.push(new NodeOutputEdgeField(this, component));
        if (component.nullable) {
          fields.push(new NodeOutputEdgeExistenceField(this, component));
        }
      }
    }

    for (const reverseEdge of this.reverseEdgeMap.values()) {
      if (reverseEdge.unique) {
        fields.push(
          new UniqueReverseEdgeField(this, reverseEdge),
          new UniqueReverseEdgeExistenceField(this, reverseEdge),
        );
      } else {
        fields.push(
          new ReverseEdgeField(this, reverseEdge),
          new ReverseEdgeCountField(this, reverseEdge),
        );
      }
    }

    for (const [name, config] of Object.entries(
      getCustomFieldConfigMap(this, this.config?.customFields),
    )) {
      fields.push(new CustomField(this, name, config));
    }

    const fieldMap = new Map<string, TNodeOutputField>();

    for (const field of fields) {
      if (fieldMap.has(field.name)) {
        throw new Error(
          `The "${this.name}" node contains at least 2 fields with the same name: ${field.name}`,
        );
      }

      fieldMap.set(field.name, field);
    }

    return fieldMap;
  }

  public getField(name: string, path?: Path): TNodeOutputField {
    const field = this.fieldMap.get(name);
    if (!field) {
      throw new MaybePathAwareError(
        `The "${
          this.name
        }" node does not contain the field "${name}", did you mean: ${didYouMean(
          name,
          this.fieldMap.keys(),
        )}`,
        path,
      );
    }

    return field;
  }

  @Memoize()
  public get publicFieldMap(): ReadonlyMap<string, Public<TNodeOutputField>> {
    return new Map([...this.fieldMap].filter(isPublicEntry));
  }

  @Memoize()
  public get type(): GraphQLObjectType {
    assert(this.public, `"${this.name}" is private`);

    assert(
      this.publicFieldMap.size,
      `"${this.name}" expects at least one public field`,
    );

    return new GraphQLObjectType({
      name: this.name,
      description: this.description,
      interfaces: this.config?.interfaces,
      fields: () =>
        Object.fromEntries(
          Array.from(this.publicFieldMap.values(), (field) => [
            field.name,
            field.graphqlFieldConfig,
          ]),
        ),
    });
  }
}
