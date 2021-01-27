import { GraphQLInputObjectType, printType } from 'graphql';
import { GraphQLPlatform } from '../../..';
import { modelNames, models, MyGP } from '../../../__tests__/config';
import { WhereUniqueInput, WhereUniqueInputValue } from './where-unique';

describe('WhereUniqueInput', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({ models });
  });

  it.each(modelNames)('has a(n) %sWhereUniqueInput', (modelName) => {
    const model = gp.getModel(modelName);
    const whereUniqueInput = model.whereUniqueInputType;

    expect(whereUniqueInput).toBeInstanceOf(WhereUniqueInput);
    expect(whereUniqueInput.public).toEqual(model.public);

    if (whereUniqueInput.public) {
      expect(whereUniqueInput.type).toBeInstanceOf(GraphQLInputObjectType);
      expect(
        printType(whereUniqueInput.type, { commentDescriptions: true }),
      ).toMatchSnapshot(whereUniqueInput.name);
    } else {
      expect(() => whereUniqueInput.type).toThrowError(
        `"${modelName}WhereUniqueInput" is private`,
      );
    }
  });

  it.each([
    ['Article', undefined, `Expects a plain object, got: undefined`],
    ['Article', null, `Expects a plain object, got: null`],
    [
      'Article',
      { id_is_null: true },
      `Expects an \"Article\" identifier, got: {\"id_is_null\":true}`,
    ],
    [
      'Article',
      { id: null },
      `Expects an \"Article\" identifier, got: {\"id\":null}`,
    ],
    [
      'Article',
      { id: 123 },
      `Expects an \"Article\" identifier, got: {\"id\":123}`,
    ],
    [
      'Article',
      { category: { parent: { title: null } } },
      `Expects an \"Article\" identifier, got: {\"category\":{\"parent\":{\"title\":null}}}`,
    ],
  ])(
    'throws an Error on %sWhereUniqueInput.assertValue(%p)',
    (modelName, value, error) => {
      const model = gp.getModel(modelName);
      const whereUniqueInput = model.whereUniqueInputType;

      expect(() => whereUniqueInput.assertValue(value)).toThrowError(error);
    },
  );

  it.each<[string, WhereUniqueInputValue, WhereUniqueInputValue]>([
    ['Article', { _id: 123 }, { _id: 123 }],
    [
      'Article',
      { id: 'e22205cc-7d8e-4772-a46d-528a29fb81f2' },
      { id: 'e22205cc-7d8e-4772-a46d-528a29fb81f2' },
    ],
    [
      'Article',
      { id: '3874e4bd-3b2b-456e-a811-7dd40b979f42', extraField: 'extraValue' },
      { id: '3874e4bd-3b2b-456e-a811-7dd40b979f42' },
    ],
    ['Category', { parent: null, order: 123 }, { parent: null, order: 123 }],
    [
      'Category',
      { parent: { parent: null, slug: 'root' }, order: 456 },
      { parent: { parent: null, slug: 'root' }, order: 456 },
    ],
    [
      'Category',
      { parent: { id: '6684d029-0016-4615-b1e7-f7f0087dbf11' }, order: 789 },
      { parent: { id: '6684d029-0016-4615-b1e7-f7f0087dbf11' }, order: 789 },
    ],
    [
      'Category',
      {
        parent: {
          parent: null,
          _id: 999,
          slug: 'root',
          id: 'd038d5cf-815e-4f8d-8099-1def0bdec246',
        },
        order: 789,
      },
      {
        parent: {
          _id: 999,
        },
        order: 789,
      },
    ],
  ])('%sWhereInput.assertValue(%p) = %p', (modelName, value, parsedValue) => {
    const model = gp.getModel(modelName);
    const whereUniqueInput = model.whereUniqueInputType;

    expect(whereUniqueInput.assertValue(value)).toEqual(parsedValue);
  });
});
