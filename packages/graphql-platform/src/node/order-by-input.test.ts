import { GraphQLEnumType, printType } from 'graphql';
import { GraphQLPlatform } from '..';
import { MyGP, nodeNames, nodes } from '../__tests__/config';
import {
  OrderByInput,
  TOrderByInputValue,
  TParsedOrderByInputValue,
} from './order-by-input';

describe('OrderByInput', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  it.each(nodeNames)('has a(n) %sOrderByInput', (nodeName) => {
    const node = gp.getNode(nodeName);
    const orderByInput = node.orderByInput;

    expect(orderByInput).toBeInstanceOf(OrderByInput);
    expect(orderByInput.public).toEqual(node.public);

    if (orderByInput.public) {
      if (orderByInput.type) {
        expect(orderByInput.type).toBeInstanceOf(GraphQLEnumType);
        expect(
          printType(orderByInput.type, { commentDescriptions: true }),
        ).toMatchSnapshot(orderByInput.name);
      }
    } else {
      expect(() => orderByInput.type).toThrowError(
        `"${nodeName}OrderByInput" is private`,
      );
    }
  });

  it.each([
    [
      'Article',
      undefined,
      `An error has occurred at ArticleOrderByInput - expects an array, got: undefined`,
    ],
    [
      'Article',
      null,
      `An error has occurred at ArticleOrderByInput - expects an array, got: null`,
    ],
    [
      'Article',
      ['_id_DESC', '_id_DESCS'],
      'An error has occurred at ArticleOrderByInput.1 - expects not to contain the unknown ordering expression "_id_DESCS", got: ["_id_DESC","_id_DESCS"]',
    ],
  ])(
    'throws an Error on %sOrderByInput.parseValue(%p)',
    (nodeName, value, error) => {
      const node = gp.getNode(nodeName);
      const orderByInput = node.orderByInput;

      expect(
        // @ts-expect-error
        () => orderByInput.parseValue(value),
      ).toThrowError(error);
    },
  );

  it.each<[string, TOrderByInputValue, TParsedOrderByInputValue]>([
    ['Article', [], []],
    [
      'Article',
      ['_id_DESC', 'createdAt_ASC'],
      [
        { kind: 'Leaf', leaf: '_id', direction: 'DESC' },
        { kind: 'Leaf', leaf: 'createdAt', direction: 'ASC' },
      ],
    ],
  ])('%sOrderByInput.parseValue(%p) = %p', (nodeName, value, parsedValue) => {
    const node = gp.getNode(nodeName);
    const orderByInput = node.orderByInput;

    expect(orderByInput.parseValue(value)).toEqual(parsedValue);
  });
});
