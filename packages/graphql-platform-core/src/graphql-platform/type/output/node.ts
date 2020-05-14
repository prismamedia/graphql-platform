import {
  GraphQLFieldConfig,
  GraphQLNonNullDecorator,
  GraphQLSelectionNode,
  MaybePromise,
  parseGraphQLResolveInfo,
  POJO,
  SuperMapOfNamedObject,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import {
  GraphQLFieldConfigMap,
  GraphQLObjectType,
  GraphQLResolveInfo,
} from 'graphql';
import { AnyBaseContext, BaseContext } from '../../../graphql-platform';
import {
  Field,
  FieldValue,
  InverseRelation,
  Relation,
  VirtualField,
} from '../../resource';
import { AbstractOutputType } from '../abstract-type';

export enum NodeFieldKind {
  Field,
  Relation,
  InverseRelation,
  InverseRelationCount,
  VirtualField,
}

export type NodeField = {
  name: string;
  public: boolean;
  config: GraphQLFieldConfig;
} & (
  | {
      kind: NodeFieldKind.Field;
      field: Field;
    }
  | {
      kind: NodeFieldKind.Relation;
      relation: Relation;
    }
  | {
      kind: NodeFieldKind.InverseRelation;
      inverseRelation: InverseRelation;
    }
  | {
      kind: NodeFieldKind.InverseRelationCount;
      inverseRelation: InverseRelation;
    }
  | {
      kind: NodeFieldKind.VirtualField;
      virtualField: VirtualField;
    }
);

export class NodeFieldMap extends SuperMapOfNamedObject<NodeField> {}

export type NodeSourceFieldValue =
  | FieldValue
  | NodeSource
  | NodeSource[]
  | number;

export type NodeSourceFieldResolverParams<
  TArgs extends POJO = any,
  TContext extends AnyBaseContext = any
> = Readonly<{
  args: TArgs;
  context: TContext;
  selectionNode: GraphQLSelectionNode;
}>;

export type NodeSourceFieldResolver<
  TArgs extends POJO = any,
  TContext extends AnyBaseContext = any
> = (
  params: NodeSourceFieldResolverParams<TArgs, TContext>,
) => MaybePromise<NodeSourceFieldValue>;

export type NodeSourceField = NodeSourceFieldValue | NodeSourceFieldResolver;

export type NodeSource = {
  [fieldName: string]: NodeSourceField;
};

export class NodeType extends AbstractOutputType {
  @Memoize()
  public get name() {
    return this.resource.name;
  }

  @Memoize()
  public get description() {
    return this.resource.description || `"${this.resource}" resource's node`;
  }

  protected async getSourceFieldValue(
    source: NodeSource,
    args: POJO,
    context: BaseContext,
    info: GraphQLResolveInfo,
  ): Promise<NodeSourceFieldValue> {
    const selectionNode = parseGraphQLResolveInfo(info);
    const fieldValue = source[selectionNode.name];

    return typeof fieldValue === 'function'
      ? fieldValue({ args, context, selectionNode })
      : fieldValue;
  }

  @Memoize()
  public getFieldMap(): NodeFieldMap {
    const nodeFieldMap = new NodeFieldMap();

    for (const field of this.resource.getFieldSet()) {
      const nodeField: NodeField = {
        name: field.name,
        public: field.isPublic(),
        kind: NodeFieldKind.Field,
        field,
        config: {
          description: field.description,
          type: GraphQLNonNullDecorator(field.getType(), !field.isNullable()),
          resolve: this.getSourceFieldValue,
        },
      };

      nodeFieldMap.set(nodeField.name, nodeField);
    }

    for (const relation of this.resource.getRelationSet()) {
      const findOne = relation.getTo().getQuery('FindOne');

      const nodeField: NodeField = {
        name: relation.name,
        public: relation.isPublic() && findOne.isPublic(),
        kind: NodeFieldKind.Relation,
        relation,
        config: {
          description: relation.description,
          type: GraphQLNonNullDecorator(
            findOne.getGraphQLFieldConfigType(),
            !relation.isNullable(),
          ),
          resolve: this.getSourceFieldValue,
        },
      };

      nodeFieldMap.set(nodeField.name, nodeField);
    }

    for (const inverseRelation of this.resource.getInverseRelationSet()) {
      if (inverseRelation.isToOne()) {
        // Find one
        const findOne = inverseRelation.getTo().getQuery('FindOne');

        const nodeField: NodeField = {
          name: inverseRelation.name,
          public: inverseRelation.relation.isPublic() && findOne.isPublic(),
          kind: NodeFieldKind.InverseRelation,
          inverseRelation,
          config: {
            description: inverseRelation.description,
            type: findOne.getGraphQLFieldConfigType(),
            resolve: this.getSourceFieldValue,
          },
        };

        nodeFieldMap.set(nodeField.name, nodeField);
      } else {
        {
          // Find many
          const findMany = inverseRelation.getTo().getQuery('FindMany');

          const nodeField: NodeField = {
            name: inverseRelation.name,
            public: inverseRelation.relation.isPublic() && findMany.isPublic(),
            kind: NodeFieldKind.InverseRelation,
            inverseRelation,
            config: {
              description: inverseRelation.description,
              args: findMany.getGraphQLFieldConfigArgs(),
              type: findMany.getGraphQLFieldConfigType(),
              resolve: this.getSourceFieldValue,
            },
          };

          nodeFieldMap.set(nodeField.name, nodeField);
        }

        {
          // Count
          const count = inverseRelation.getTo().getQuery('Count');

          const nodeField: NodeField = {
            name: inverseRelation.countName,
            public: inverseRelation.relation.isPublic() && count.isPublic(),
            kind: NodeFieldKind.InverseRelationCount,
            inverseRelation,
            config: {
              description: inverseRelation.countDescription,
              args: count.getGraphQLFieldConfigArgs(),
              type: count.getGraphQLFieldConfigType(),
              resolve: this.getSourceFieldValue,
            },
          };

          nodeFieldMap.set(nodeField.name, nodeField);
        }
      }
    }

    for (const virtualField of this.resource.getVirtualFieldSet()) {
      const nodeField: NodeField = {
        name: virtualField.name,
        public: true,
        kind: NodeFieldKind.VirtualField,
        virtualField,
        config: virtualField.config,
      };

      nodeFieldMap.set(nodeField.name, nodeField);
    }

    return nodeFieldMap;
  }

  @Memoize()
  public getGraphQLType() {
    return new GraphQLObjectType({
      name: this.name,
      description: this.description,
      fields: () => {
        const fields: GraphQLFieldConfigMap<NodeSource, BaseContext> = {};

        for (const field of this.getFieldMap().values()) {
          if (field.public) {
            fields[field.name] = field.config;
          }
        }

        return fields;
      },
    });
  }
}
