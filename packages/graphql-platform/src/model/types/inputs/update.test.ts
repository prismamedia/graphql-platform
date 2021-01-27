import { addPath } from '@prismamedia/graphql-platform-utils';
import { getNamedType, GraphQLInputObjectType, printType } from 'graphql';
import slugify from 'slug';
import { GraphQLPlatform } from '../../../..';
import {
  Article,
  modelNames,
  models,
  MyGP,
} from '../../../../__tests__/config';
import { OperationContext } from '../../context';
import { UpdateInput } from './update';

describe('UpdateInput', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({ models });
  });

  it.each(modelNames)('may have a "%sUpdateInput" type', (modelName) => {
    const model = gp.getModel(modelName);
    const updateInput = model.updateInput;

    expect(updateInput).toBeInstanceOf(UpdateInput);
    expect(updateInput.public).toEqual(model.public);

    if (updateInput.type) {
      const namedType = getNamedType(updateInput.type);

      expect(namedType).toBeInstanceOf(GraphQLInputObjectType);
      expect(
        printType(namedType, { commentDescriptions: true }),
      ).toMatchSnapshot(updateInput.name);
    } else {
      expect(() => updateInput.type).toThrowError(
        `"${modelName}UpdateInput" is private`,
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
      'An error has been found in the "Article.fieldWithUnknownDependency" component\'s definition - the unknown "unknownDependency" component used in the "create" input\'s dependencies',
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
      'An error has been found in the "Article" model\'s definition - the circular dependency in the "create" input\'s dependencies: firstInvalidDependency -> secondInvalidDependency -> firstInvalidDependency',
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
              immutable: true,
            },
            title: {
              kind: 'Leaf',
              type: 'NonEmptyTrimmedString',
              nullable: false,

              inputs: {
                creation: {
                  parser: () =>
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
                  nullable: true,
                  dependsOnCreation: ['title'],
                  parser: ({ creation: { title } }) =>
                    slugify(title, slugify.defaults.modes.rfc3986),
                },
              },
            },
          },
          uniques: [['id']],
        },
      },
    });

    const createInput = gp.getModel('Test').creationInput;

    const data = Object.freeze(
      createInput.assertValue(
        {
          id: '7e9f4c5a-8c7d-4e91-a9f5-dad4fa1b5fec',
          title: 'My title',
        },
        addPath(undefined, 'data'),
      ),
    );

    await expect(
      createInput.parseValue(
        data,
        new OperationContext(gp, 'mutation', undefined),
        addPath(undefined, 'data'),
      ),
    ).rejects.toThrowError(
      'An error occurred at "data.title" - whatever error happened in this parser',
    );
  });
});
