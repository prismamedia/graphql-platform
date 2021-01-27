import { getNamedType, GraphQLEnumType, printType } from 'graphql';
import { GraphQLPlatform } from '../../..';
import { modelNames, models, MyGP } from '../../../__tests__/config';
import { OrderByInputType, OrderByInputValue } from './order-by';
import { SortDirection, SortValue } from './order-by/ast';

describe('OrderByInput', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({ models });
  });

  it.each(modelNames)('may have a "%sOrderByInput" type', (modelName) => {
    const node = gp.getModel(modelName);
    const orderByInput = node.orderByInputType;

    expect(orderByInput).toBeInstanceOf(OrderByInputType);
    expect(orderByInput.public).toEqual(node.public);

    if (orderByInput.public) {
      if (orderByInput.type) {
        const namedType = getNamedType(orderByInput.type);

        expect(namedType).toBeInstanceOf(GraphQLEnumType);
        expect(
          printType(namedType, { commentDescriptions: true }),
        ).toMatchSnapshot(orderByInput.name);
      }
    } else {
      expect(() => orderByInput.type).toThrowError(
        `"${modelName}OrderByInput" is private`,
      );
    }
  });

  it.each([
    [
      'Article',
      undefined,
      'Expects a list of non-null "ArticleOrderByInput", got: undefined',
    ],
    [
      'Article',
      null,
      'Expects a list of non-null "ArticleOrderByInput", got: null',
    ],
    [
      'Article',
      ['_id_DESC', '_id_DESCS'],
      'An error occurred at "1" - expects not to contain the unknown ordering expression "_id_DESCS", got: ["_id_DESC","_id_DESCS"]',
    ],
  ])(
    'throws an Error on %sOrderByInput.parseValue(%p)',
    (modelName, value, error) => {
      const model = gp.getModel(modelName);
      const orderByInput = model.orderByInputType;

      expect(
        // @ts-expect-error
        () => orderByInput.parseValue(value),
      ).toThrowError(error);
    },
  );

  it.each<[string, OrderByInputValue, SortValue[]]>([
    ['Article', [], []],
    [
      'Article',
      ['_id_DESC', 'createdAt_ASC'],
      [
        { kind: 'Leaf', leaf: '_id', direction: SortDirection.Descending },
        { kind: 'Leaf', leaf: 'createdAt', direction: SortDirection.Ascending },
      ],
    ],
  ])('%sOrderByInput.parseValue(%p) = %p', (modelName, value, parsedValue) => {
    const model = gp.getModel(modelName);
    const orderByInput = model.orderByInputType;

    expect(orderByInput.parseValue(value)).toEqual(parsedValue);
  });
});
