import { addPath } from '@prismamedia/graphql-platform-utils';
import { getNamedType, GraphQLInputObjectType, printType } from 'graphql';
import slugify from 'slug';
import { GraphQLPlatform } from '../../..';
import { Article, modelNames, models, MyGP } from '../../../__tests__/config';
import { OperationContext } from '../../operations';
import { CreationInput } from './creation';

describe('CreationInput', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({ models });
  });

  it.each(modelNames)('may have a "%sCreationInput" type', (modelName) => {
    const model = gp.getModel(modelName);
    const creationInput = model.creationInputType;

    expect(creationInput).toBeInstanceOf(CreationInput);
    expect(creationInput.public).toEqual(model.public);

    if (creationInput.public) {
      if (creationInput.type) {
        const namedType = getNamedType(creationInput.type);

        expect(namedType).toBeInstanceOf(GraphQLInputObjectType);
        expect(
          printType(namedType, { commentDescriptions: true }),
        ).toMatchSnapshot(creationInput.name);
      }
    } else {
      expect(() => creationInput.type).toThrowError(
        `"${modelName}CreationInput" is private`,
      );
    }
  });

  it('throws an Error on unknown dependency', () => {
    expect(
      () =>
        new GraphQLPlatform({
          models: {
            ...models,
            Article: {
              ...Article,
              components: {
                ...Article.components,
                fieldWithUnknownDependency: {
                  kind: 'Leaf',
                  type: 'String',
                  inputs: {
                    creation: {
                      dependsOnCreation: ['unknownDependency'],
                    },
                  },
                },
              },
            },
          },
        }),
    ).toThrowError(
      'An error has been found in the "Article.fieldWithUnknownDependency" component\'s definition - the unknown "unknownDependency" component used in the "creation" input\'s dependencies',
    );
  });

  it('throws an Error on circular dependency', () => {
    expect(
      () =>
        new GraphQLPlatform({
          models: {
            ...models,
            Article: {
              ...Article,
              components: {
                ...Article.components,
                firstInvalidDependency: {
                  kind: 'Leaf',
                  type: 'String',
                  inputs: {
                    creation: {
                      dependsOnCreation: ['secondInvalidDependency'],
                    },
                  },
                },
                secondInvalidDependency: {
                  kind: 'Leaf',
                  type: 'String',
                  inputs: {
                    creation: {
                      dependsOnCreation: ['firstInvalidDependency'],
                    },
                  },
                },
              },
            },
          },
        }),
    ).toThrowError(
      'An error has been found in the "Article" model\'s definition - the circular dependency in the "creation" input\'s dependencies: firstInvalidDependency -> secondInvalidDependency -> firstInvalidDependency',
    );
  });

  it('does not throw "unhandledRejection" on dependencies', async () => {
    const gp = new GraphQLPlatform({
      models: {
        Test: {
          components: {
            id: {
              kind: 'Leaf',
              type: 'UUID',
              nullable: false,

              inputs: {
                update: null,
              },
            },
            title: {
              kind: 'Leaf',
              type: 'NonEmptyTrimmedString',
              nullable: false,

              inputs: {
                creation: {
                  preCreate: () =>
                    new Promise<never>((resolve, reject) =>
                      setTimeout(
                        () =>
                          reject(
                            new Error('Whatever error happened in this parser'),
                          ),
                        50,
                      ),
                    ),
                },
              },
            },
            slug: {
              kind: 'Leaf',
              type: 'NonEmptyTrimmedString',
              nullable: false,

              inputs: {
                creation: {
                  optional: false,
                  dependsOnCreation: ['title'],
                  preCreate: ({ creation: { title } }) =>
                    slugify(title, slugify.defaults.modes.rfc3986),
                },
              },
            },
          },
          uniques: [['id']],
        },
      },
    });

    const creationInput = gp.getModel('Test').creationInputType;

    const data = Object.freeze(
      creationInput.assertValue(
        {
          id: '7e9f4c5a-8c7d-4e91-a9f5-dad4fa1b5fec',
          title: 'My title',
        },
        addPath(undefined, 'data'),
      ),
    );

    await expect(
      creationInput.parseValue(
        data,
        new OperationContext(gp, 'mutation', undefined),
        addPath(undefined, 'data'),
      ),
    ).rejects.toThrowError(
      'An error occurred at "data.title" - whatever error happened in this parser',
    );
  });
});
