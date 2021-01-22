import { getNamedType, GraphQLEnumType, printType } from 'graphql';
import { GraphQLPlatform } from '../../..';
import { MyGP, nodeNames, nodes } from '../../../__tests__/config';
import { OrderByNodeInput, TOrderByNodeValue } from './order-by';
import { TSortValue } from './order-by/ast';

describe('OrderByInput', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  it.each(nodeNames)('may have a "%sOrderByInput" type', (nodeName) => {
    const node = gp.getNode(nodeName);
    const orderByInput = node.orderByInput;

    expect(orderByInput).toBeInstanceOf(OrderByNodeInput);
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
        `"${nodeName}OrderByInput" is private`,
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
    (nodeName, value, error) => {
      const node = gp.getNode(nodeName);
      const orderByInput = node.orderByInput;

      expect(
        // @ts-expect-error
        () => orderByInput.parseValue(value),
      ).toThrowError(error);
    },
  );

  it.each<[string, TOrderByNodeValue, TSortValue[]]>([
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
