import {
  GraphQLEnumType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  graphqlSync,
} from 'graphql';
import { POJO } from '../../../types/pojo';
import {
  GraphQLSelectionNode,
  parseGraphQLResolveInfo,
} from '../parse-resolver-info';

function query(document: string, variables: POJO = {}) {
  const UserProfileType = new GraphQLObjectType({
    name: 'UserProfile',
    fields: {
      pseudo: {
        type: GraphQLNonNull(GraphQLString),
      },
      email: {
        type: GraphQLNonNull(GraphQLString),
      },
    },
  });

  const infos: Partial<{
    me: GraphQLSelectionNode;
    users: GraphQLSelectionNode;
    viewer: GraphQLSelectionNode;
  }> = {};

  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        viewer: {
          type: GraphQLNonNull(
            new GraphQLObjectType({
              name: 'Viewer',
              fields: {
                me: {
                  args: {
                    urgency: {
                      type: GraphQLInt,
                    },
                  },
                  type: GraphQLNonNull(UserProfileType),
                  resolve: (source, args, ctx, info) => {
                    infos.me = parseGraphQLResolveInfo(info);

                    return { pseudo: 'test', email: 'test@test.tst' };
                  },
                },
                users: {
                  args: {
                    orderBy: {
                      type: GraphQLList(
                        GraphQLNonNull(
                          new GraphQLEnumType({
                            name: 'UserOrderByInput',
                            values: {
                              createdAt_ASC: {},
                              createdAt_DESC: {},
                            },
                          }),
                        ),
                      ),
                    },
                  },
                  type: GraphQLNonNull(
                    GraphQLList(GraphQLNonNull(UserProfileType)),
                  ),
                  resolve: (source, args, ctx, info) => {
                    infos.users = parseGraphQLResolveInfo(info);

                    return [];
                  },
                },
              },
            }),
          ),
          resolve: (source, args, ctx, info) => {
            infos.viewer = parseGraphQLResolveInfo(info);

            return {};
          },
        },
      },
    }),
  });

  const result = graphqlSync(schema, document, undefined, undefined, variables);

  return { infos, result };
}

describe('parseResolverInfo', () => {
  it('gets a field tree', () => {
    const document = `
      query Test($withVariableValue: [UserOrderByInput!]) {
        myViewer: viewer {
          me(urgency: 10) {
            pseudo
            ...A
          }
          less: me(urgency: 5) {
            pseudo
          }
          users (orderBy: $withVariableValue) {
            email
            ...B
          }
        }
      }
      

      fragment A on UserProfile {
        pseudo
        ...B
      }

      fragment B on UserProfile {
        email
        hisEmail: email
      }
    `;

    const variables = {
      withVariableValue: ['createdAt_DESC'],
    };

    const {
      infos: { viewer, me, users },
      result,
    } = query(document, variables);

    expect(result).toMatchSnapshot();

    if (viewer) {
      expect(viewer.isRoot()).toBeTruthy();

      expect(viewer.key).toEqual('myViewer');
      expect(viewer.name).toEqual('viewer');
      expect(viewer.path).toEqual('myViewer');
      expect(viewer.args).toEqual({});
    }

    if (me) {
      expect(me.isRoot()).toBeFalsy();
      expect(me.name).toEqual('me');

      if (me.key === 'me') {
        expect(me.path).toEqual('myViewer/me');
        expect(me.args).toEqual({ urgency: 10 });
      } else {
        expect(me.path).toEqual('myViewer/less');
        expect(me.args).toEqual({ urgency: 5 });

        const clone = me.clone();

        expect(clone.path).toEqual('myViewer/less');
        expect(clone.args).toEqual({ urgency: 5 });

        const cloneWithoutArgs = me.clone({});

        expect(cloneWithoutArgs.path).toEqual('myViewer/less');
        expect(cloneWithoutArgs.args).toEqual({});
      }
    }

    if (users) {
      expect(users.isRoot()).toBeFalsy();
      expect(users.name).toEqual('users');

      expect(users.path).toEqual('myViewer/users');
      expect(users.args).toEqual({ orderBy: ['createdAt_DESC'] });

      const clone = users.clone();

      expect(clone.path).toEqual('myViewer/users');
      expect(clone.args).toEqual({ orderBy: ['createdAt_DESC'] });

      const cloneWithoutArgs = users.clone({});

      expect(cloneWithoutArgs.path).toEqual('myViewer/users');
      expect(cloneWithoutArgs.args).toEqual({});
    }
  });

  it('computes a diff', () => {
    const selectionNode = new GraphQLSelectionNode('article', {}, [
      new GraphQLSelectionNode('id', {}, [], 'myId'),
      'title',
      new GraphQLSelectionNode('category', {}, [
        'id',
        'slug',
        new GraphQLSelectionNode('parent', {}, [
          'createdAt',
          'updatedAt',
          new GraphQLSelectionNode('children', { first: 5 }, ['id', 'slug']),
        ]),
      ]),
    ]);

    expect(String(selectionNode)).toMatchInlineSnapshot(`
      "{
        myId: id
        title
        category {
          id
          slug
          parent {
            createdAt
            updatedAt
            children {
              id
              slug
            }
          }
        }
      }"
    `);

    expect(selectionNode.toPlainObject()).toEqual({
      category: {
        children: {
          id: {
            name: 'id',
          },
          parent: {
            children: {
              children: {
                args: {
                  first: 5,
                },
                children: {
                  id: {
                    name: 'id',
                  },
                  slug: {
                    name: 'slug',
                  },
                },
                name: 'children',
              },
              createdAt: {
                name: 'createdAt',
              },
              updatedAt: {
                name: 'updatedAt',
              },
            },
            name: 'parent',
          },
          slug: {
            name: 'slug',
          },
        },
        name: 'category',
      },
      myId: {
        name: 'id',
      },
      title: {
        name: 'title',
      },
    });

    expect(
      selectionNode
        .diff({
          id: 'my-article-id',
          category: {
            parent: { createdAt: null, children: [{ id: 'my-category-id' }] },
          },
        })
        .toPlainObject(),
    ).toEqual({
      category: {
        children: {
          id: {
            name: 'id',
          },
          parent: {
            children: {
              children: {
                args: {
                  first: 5,
                },
                children: {
                  slug: {
                    name: 'slug',
                  },
                },
                name: 'children',
              },
              updatedAt: {
                name: 'updatedAt',
              },
            },
            name: 'parent',
          },
          slug: {
            name: 'slug',
          },
        },
        name: 'category',
      },
      title: {
        name: 'title',
      },
    });
  });

  it('merge selections', () => {
    const a = new GraphQLSelectionNode('article', {}, [
      new GraphQLSelectionNode('id', {}, [], 'myId'),
      'title',
      new GraphQLSelectionNode('category', {}, [
        'slug',
        new GraphQLSelectionNode('parent', {}, ['updatedAt']),
      ]),
    ]);

    const b = new GraphQLSelectionNode('article', {}, [
      new GraphQLSelectionNode('category', {}, [
        new GraphQLSelectionNode('parent', {}, ['title']),
      ]),
    ]);

    a.setChildren(b.getChildren());

    expect(a.toPlainObject()).toEqual({
      category: {
        children: {
          parent: {
            children: {
              title: {
                name: 'title',
              },
              updatedAt: {
                name: 'updatedAt',
              },
            },
            name: 'parent',
          },
          slug: {
            name: 'slug',
          },
        },
        name: 'category',
      },
      myId: {
        name: 'id',
      },
      title: {
        name: 'title',
      },
    });
  });
});
