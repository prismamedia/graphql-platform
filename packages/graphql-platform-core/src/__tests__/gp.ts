import { mergeWith } from '@prismamedia/graphql-platform-utils';
import faker from 'faker/locale/en';
import { GraphQLID, GraphQLInt } from 'graphql';
import { GraphQLDateTime } from 'graphql-iso-date';
import {
  CustomContext,
  FieldConfig,
  GraphQLPlatform,
  GraphQLPlatformConfig,
  ManagementKind,
  ResourceConfig,
  ResourceHookKind,
} from '..';

export interface MyContext extends CustomContext {
  myService: boolean;
}

export type MyResourceConfig = ResourceConfig<MyContext>;

export type MyGPConfig = GraphQLPlatformConfig<{}, MyContext>;

export class MyGP extends GraphQLPlatform<{}, MyContext> {}

export const nonRelationTableResourceNames = ['Article', 'Category', 'Tag', 'User'];

let resourceIndex = 0;

export const config: MyGPConfig = {
  context: params => ({
    myService: true,
  }),

  default: resourceName => {
    const config: MyResourceConfig = {};

    const resourceIdIndex = {
      resourceIndex: ++resourceIndex * 1000000000,
      index: 0,
    };

    // Common fields for non-"relation table"
    if (nonRelationTableResourceNames.includes(resourceName)) {
      mergeWith(config, {
        uniques: ['_id', 'id'],

        fields: {
          _id: {
            description: 'The internal and private ID used to speed up some operations',
            type: GraphQLInt,
            managed: ManagementKind.Full,
            public: false,
          },
          id: <FieldConfig<MyContext>>{
            description: 'The public ID',
            type: GraphQLID,
            managed: ManagementKind.Optional,
            hooks: {
              [ResourceHookKind.PreCreate]: event => {
                if (event.fieldValue == null) {
                  // Fixed UUID instead of "uuid()" in order to have consistent test results
                  faker.seed(resourceIdIndex.resourceIndex + ++resourceIdIndex.index);

                  event.fieldValue = faker.random.uuid();
                }
              },
            },
          },
        },
      });
    }

    // Common fields
    mergeWith(config, {
      fields: {
        createdAt: {
          type: GraphQLDateTime,
          managed: ManagementKind.Full,
          immutable: true,
          description: "The date, fixed, of the document's creation",
        },
        updatedAt: {
          type: GraphQLDateTime,
          managed: ManagementKind.Full,
          description: "The date of the document's last update",
        },
      },
    });

    return config;
  },

  resources: `${__dirname}/resources`,

  mutations: `${__dirname}/mutations`,

  queries: `${__dirname}/queries`,
};

export const gp = new MyGP(config);
