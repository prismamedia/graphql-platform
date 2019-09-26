import { GraphQLInputObjectType, printType } from 'graphql';
import { GraphQLPlatform } from '../../..';
import { MyGP, nodeNames, nodes } from '../../../__tests__/config';
import { TWhereUniqueNodeValue, WhereUniqueNodeInput } from './where-unique';

describe('WhereUniqueInput', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  it.each(nodeNames)('has a(n) %sWhereUniqueInput', (nodeName) => {
    const node = gp.getNode(nodeName);
    const whereUniqueInput = node.whereUniqueInput;

    expect(whereUniqueInput).toBeInstanceOf(WhereUniqueNodeInput);
    expect(whereUniqueInput.public).toEqual(node.public);

    if (whereUniqueInput.public) {
      expect(whereUniqueInput.type).toBeInstanceOf(GraphQLInputObjectType);
      expect(
        printType(whereUniqueInput.type, { commentDescriptions: true }),
      ).toMatchSnapshot(whereUniqueInput.name);
    } else {
      expect(() => whereUniqueInput.type).toThrowError(
        `"${nodeName}WhereUniqueInput" is private`,
      );
    }
  });

  it.each([
    ['Article', undefined, `Expects an object, got: undefined`],
    ['Article', null, `Expects an object, got: null`],
    [
      'Article',
      { id_is_null: true },
      `Expects an unique combination of value, got: {\"id_is_null\":true}`,
    ],
    [
      'Article',
      { id: null },
      `Expects an unique combination of value, got: {\"id\":null}`,
    ],
    [
      'Article',
      { id: 123 },
      `Expects an unique combination of value, got: {\"id\":123}`,
    ],
    [
      'Article',
      { category: { parent: { title: null } } },
      `Expects an unique combination of value, got: {\"category\":{\"parent\":{\"title\":null}}}`,
    ],
  ])(
    'throws an Error on %sWhereUniqueInput.assertValue(%p)',
    (nodeName, value, error) => {
      const node = gp.getNode(nodeName);
      const whereUniqueInput = node.whereUniqueInput;

      expect(() => whereUniqueInput.assertValue(value)).toThrowError(error);
    },
  );

  it.each<[string, TWhereUniqueNodeValue, TWhereUniqueNodeValue]>([
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
  ])('%sWhereInput.assertValue(%p) = %p', (nodeName, value, parsedValue) => {
    const node = gp.getNode(nodeName);
    const whereUniqueInput = node.whereUniqueInput;

    expect(whereUniqueInput.assertValue(value)).toEqual(parsedValue);
  });
});
