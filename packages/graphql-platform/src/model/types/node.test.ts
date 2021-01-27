import {
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  printType,
} from 'graphql';
import { GraphQLPlatform } from '../../';
import { modelNames, models, MyGP } from '../../__tests__/config';
import { NodeType } from './node';

describe('Node', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({ models });
  });

  it.each(modelNames)('%s has a node', (modelName) => {
    const node = gp.getModel(modelName).nodeType;
    expect(node).toBeInstanceOf(NodeType);

    if (node.public) {
      expect(node.type).toBeInstanceOf(GraphQLObjectType);
      expect(
        printType(node.type, { commentDescriptions: true }),
      ).toMatchSnapshot(node.name);
    } else {
      expect(() => node.type).toThrowError(`"${modelName}" is private`);
    }
  });

  it('throws an Error on duplicate field name', () => {
    expect(
      () =>
        new GraphQLPlatform({
          models: {
            ...models,
            User: {
              ...models.User,
              node: {
                virtualFields: {
                  username: {
                    args: {},
                    type: GraphQLNonNull(GraphQLString),
                    resolve: () => 'MyUsername',
                  },
                },
              },
            },
          },
        }),
    ).toThrowError(
      'The "User" node contains at least 2 fields with the same name: username',
    );
  });
});
