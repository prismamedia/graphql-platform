import { mergeWith } from '@prismamedia/graphql-platform-utils';
import faker from 'faker';
import { GraphQLID, GraphQLInt } from 'graphql';
import { GraphQLDateTime } from 'graphql-iso-date';
import { createLogger, format, transports } from 'winston';
import {
  CustomContext,
  FieldConfig,
  GraphQLPlatform,
  GraphQLPlatformConfig,
  ManagementKind,
  ResourceConfig,
  ResourceHookKind,
} from '..';
import { fixtures } from './fixtures';

export interface MyContext extends CustomContext {
  myService: boolean;
}

export type MyResourceConfig = ResourceConfig<MyContext>;

export type MyGPConfig = GraphQLPlatformConfig<{}, MyContext>;

export class MyGP extends GraphQLPlatform<{}, MyContext> {}

export const nonRelationTableResourceNames = ['Article', 'Category', 'Tag', 'User'];

export const config: MyGPConfig = {
  logger: createLogger({
    format: format.combine(format.colorize(), format.errors({ stack: false }), format.simple()),
    transports: [new transports.Console()],
    // level: 'debug',
    level: 'error',
    silent: process.env.NODE_ENV === 'test',
  }),

  context: params => ({
    myService: true,
  }),

  default: resourceName => {
    const config: MyResourceConfig = {};

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

    if (resourceName === 'Article') {
      // A hook is defined to test the returned event object
      config.hooks = {
        [ResourceHookKind.PostCreate]: () => {},
      };
    }

    return config;
  },

  resources: `${__dirname}/resources`,

  mutations: `${__dirname}/mutations`,

  queries: `${__dirname}/queries`,

  fixtures,
};
