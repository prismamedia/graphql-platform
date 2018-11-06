import { GraphQLOperationType } from '@prismamedia/graphql-platform-utils';
import { GraphQLFieldConfigMap, GraphQLObjectType, GraphQLSchemaConfig as BaseGraphQLSchemaConfig } from 'graphql';
import { OperationType } from '../operation';
import { ResourceMap } from '../resource/map';

export interface GraphQLSchemaConfigConfig
  extends Omit<BaseGraphQLSchemaConfig, 'mutation' | 'query' | 'subscription'> {
  resourceMap: ResourceMap;
  queryMap: GraphQLFieldConfigMap<any, any>;
  mutationMap: GraphQLFieldConfigMap<any, any>;
}

export class GraphQLSchemaConfig implements BaseGraphQLSchemaConfig {
  public constructor(readonly config: GraphQLSchemaConfigConfig) {}

  public getOperationTypeFieldMap<TType extends OperationType>(type: TType): GraphQLFieldConfigMap<any, any> {
    const fields: GraphQLFieldConfigMap<any, any> = {};

    for (const resource of this.config.resourceMap.values()) {
      for (const operation of resource.getOperations(type)) {
        if (operation.isPublic()) {
          fields[operation.name] = operation.getGraphQLFieldConfig();
        }
      }
    }

    return fields;
  }

  public get mutation() {
    return new GraphQLObjectType({
      name: 'Mutation',
      fields: { ...this.getOperationTypeFieldMap(GraphQLOperationType.Mutation), ...this.config.mutationMap },
    });
  }

  public get query() {
    return new GraphQLObjectType({
      name: 'Query',
      fields: { ...this.getOperationTypeFieldMap(GraphQLOperationType.Query), ...this.config.queryMap },
    });
  }

  public get subscription() {
    return undefined;
  }
}
