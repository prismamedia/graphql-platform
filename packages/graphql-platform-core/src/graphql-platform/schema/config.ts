import { GraphQLOperationType } from '@prismamedia/graphql-platform-utils';
import {
  GraphQLFieldConfigMap,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLSchemaConfig as BaseGraphQLSchemaConfig,
} from 'graphql';
import { OperationType } from '../operation';
import { ResourceMap } from '../resource/map';

export interface GraphQLSchemaConfigConfig
  extends Omit<BaseGraphQLSchemaConfig, 'mutation' | 'query' | 'subscription'> {
  resourceMap: ResourceMap;
  queryMap: GraphQLFieldConfigMap<any, any>;
  mutationMap: GraphQLFieldConfigMap<any, any>;
  types: GraphQLNamedType[];
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
    const fields: GraphQLFieldConfigMap<any, any> = {
      ...this.getOperationTypeFieldMap(GraphQLOperationType.Mutation),
      ...this.config.mutationMap,
    };

    return Object.keys(fields).length > 0
      ? new GraphQLObjectType({
          name: 'Mutation',
          fields,
        })
      : undefined;
  }

  public get query() {
    const fields: GraphQLFieldConfigMap<any, any> = {
      ...this.getOperationTypeFieldMap(GraphQLOperationType.Query),
      ...this.config.queryMap,
    };

    return Object.keys(fields).length > 0
      ? new GraphQLObjectType({
          name: 'Query',
          fields,
        })
      : undefined;
  }

  public get subscription() {
    const fields: GraphQLFieldConfigMap<any, any> = {};

    return Object.keys(fields).length > 0
      ? new GraphQLObjectType({
          name: 'Subscription',
          fields,
        })
      : undefined;
  }

  public get types() {
    return this.config.types;
  }
}
