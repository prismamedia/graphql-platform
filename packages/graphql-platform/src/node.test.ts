import { GraphQLObjectType, printType } from 'graphql';
import { GraphQLPlatform } from '.';
import { Node } from './node';
import { nodeNames, nodes } from './__tests__/config';

describe('Node', () => {
  it('throws an Error on invalid name against GraphQL rules', () => {
    expect(
      () =>
        new Node(
          {} as GraphQLPlatform,
          '-InvalidName',
          // @ts-expect-error
          {},
        ),
    ).toThrowError(
      'Names must match /^[_a-zA-Z][_a-zA-Z0-9]*$/ but "-InvalidName" does not.',
    );
  });

  it('throws an Error if its name is not in PascalCase', () => {
    expect(
      () =>
        new Node(
          {} as GraphQLPlatform,
          'invalidName',
          // @ts-expect-error
          {},
        ),
    ).toThrowError(
      'A node definition expects a name in "PascalCase", got "invalidName" instead of "InvalidName"',
    );
  });

  it('throws an Error if its singular and plural forms are equal', () => {
    expect(
      () =>
        new Node(
          {} as GraphQLPlatform,
          'Data',
          // @ts-expect-error
          {},
        ),
    ).toThrowError(
      `A node definition expects its "singular" and "plural" forms to be different, got "Data" (you have to provide the node's "plural" parameter)`,
    );
  });

  it('throws an Error on empty components', () => {
    expect(
      () =>
        new Node(
          {} as GraphQLPlatform,
          'Article',
          // @ts-expect-error
          {
            components: {},
          },
        ),
    ).toThrowError(`The "Article" node expects at least one component`);
  });

  it('throws an Error on empty uniques', () => {
    expect(
      () =>
        new Node({} as GraphQLPlatform, 'Article', {
          components: { id: { type: 'ID' } },
          uniques: [],
        }),
    ).toThrowError(`The "Article" node expects at least one unique constraint`);
  });

  it('throws an Error on nullable unique constraint', () => {
    expect(
      () =>
        new Node({} as GraphQLPlatform, 'Article', {
          components: { id: { type: 'ID' } },
          uniques: [['id']],
        }),
    ).toThrowError(
      `The \"Article.id\" unique constraint expects at least one non-nullable component`,
    );
  });

  it('throws an Error on mutable identifier', () => {
    expect(
      () =>
        new Node({} as GraphQLPlatform, 'Article', {
          components: { id: { type: 'ID', nullable: false } },
          uniques: [['id']],
        }),
    ).toThrowError(
      `The "Article" node's identifier (= the first unique constraint) has to be immutable (= all its components has to be immutable)`,
    );
  });

  it.each(nodeNames)('%s has a node', (nodeName) => {
    const gp = new GraphQLPlatform({ nodes });
    const node = gp.getNode(nodeName);

    expect(node).toBeInstanceOf(Node);

    if (node.public) {
      expect(node.type).toBeInstanceOf(GraphQLObjectType);
      expect(
        printType(node.type, { commentDescriptions: true }),
      ).toMatchSnapshot(node.name);
    } else {
      expect(() => node.type).toThrowError(`"${nodeName}" is private`);
    }
  });
});
