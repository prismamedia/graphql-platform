import { describe, expect, it } from '@jest/globals';
import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import * as R from 'remeda';
import { Article, Category, nodes } from './__tests__/config.js';
import { GraphQLPlatform } from './index.js';
import {
  ComponentConfig,
  Edge,
  MultipleReverseEdge,
  NodeConfig,
  NodeName,
  NodeSelection,
  OnEdgeHeadDeletion,
} from './node.js';

const hasEnabledMutationByType = (
  gp: GraphQLPlatform,
  type?: utils.MutationType,
): boolean =>
  [...gp.operationsByNameByType.mutation.values()].some(
    (mutation) =>
      mutation.isEnabled() && (!type || mutation.mutationTypes.includes(type)),
  );

const hasPublicMutationByType = (
  gp: GraphQLPlatform,
  type?: utils.MutationType,
): boolean =>
  [...gp.operationsByNameByType.mutation.values()].some(
    (mutation) =>
      mutation.isPublic() && (!type || mutation.mutationTypes.includes(type)),
  );

describe('Node', () => {
  describe('Fails', () => {
    describe('Invalid name', () => {
      it.each([
        [
          '-InvalidName',
          `/GraphQLPlatformConfig/nodes/-InvalidName - Expects to be valid against the GraphQL "Names" specification (@see: https://spec.graphql.org/draft/#sec-Names), got: '-InvalidName'`,
        ],
        [
          'invalidName',
          `/GraphQLPlatformConfig/nodes/invalidName - Expects to be in "PascalCase", got: 'invalidName'`,
        ],
      ])(
        `throws an Error on invalid name: %s`,
        (invalidName, expectedError) => {
          expect(
            () => new GraphQLPlatform({ nodes: { [invalidName]: {} } }),
          ).toThrow(expectedError);
        },
      );
    });

    describe('Invalid component(s)', () => {
      it.each([
        [
          { features: [{ components: null }], components: null },
          `/GraphQLPlatformConfig/nodes/Test/components - Expects at least one component, got: null`,
        ],
        [
          { components: {} },
          `/GraphQLPlatformConfig/nodes/Test/components - Expects at least one component, got: {}`,
        ],
      ])(
        `throws an Error on invalid components: %p`,
        (config, expectedError) => {
          expect(
            () =>
              new GraphQLPlatform({
                nodes: {
                  // @ts-expect-error
                  Test: config,
                },
              }),
          ).toThrow(expectedError);
        },
      );

      describe('Invalid leaf(s)', () => {});

      describe('Invalid edge(s)', () => {
        it('throws an Error on missing "head"', () => {
          expect(
            () =>
              new GraphQLPlatform({
                nodes: {
                  ...nodes,
                  Article: {
                    ...Article,
                    components: {
                      ...Article.components,
                      edgeToAMissingModel: {
                        kind: 'Edge',
                        head: 'MissingModel',
                      },
                    },
                  },
                },
              }),
          ).toThrow(
            "/GraphQLPlatformConfig/nodes/Article/components/edgeToAMissingModel/head - Expects a node's name among \"Article, ArticleExtension, Category, Tag, ArticleTag, ArticleTagModeration, User, UserProfile, Log\", got: 'MissingModel'",
          );
        });

        it('throws an Error on missing "head reference"', () => {
          expect(
            () =>
              new GraphQLPlatform({
                nodes: {
                  ...nodes,
                  Article: {
                    ...Article,
                    components: {
                      ...Article.components,
                      edgeToAMissingReference: {
                        kind: 'Edge',
                        head: 'Article.missingUnique',
                      },
                    },
                  },
                },
              }),
          ).toThrow(
            `/GraphQLPlatformConfig/nodes/Article/components/edgeToAMissingReference/head - Expects an "Article"'s unique-constraint among "_id, id, category-slug", got: 'missingUnique'`,
          );
        });

        it('throws an Error on referencing itself', () => {
          expect(
            () =>
              new GraphQLPlatform({
                nodes: {
                  Category: {
                    ...Category,
                    components: {
                      ...Category.components,
                      parent: {
                        kind: 'Edge',
                        head: 'Category.parent-slug',
                      },
                    },
                  },
                },
              }),
          ).toThrow(
            "/GraphQLPlatformConfig/nodes/Category/components/parent/head - Expects a unique-constraint not refering itself, got: 'parent-slug'",
          );
        });

        it('throws an Error on invalid "onHeadDeletion"', () => {
          expect(
            () =>
              new GraphQLPlatform({
                nodes: {
                  Test: {
                    mutation: false,

                    components: {
                      id: {
                        kind: 'Leaf',
                        type: 'UUIDv4',
                        nullable: false,
                        mutable: false,
                      },
                      parent: {
                        kind: 'Edge',
                        head: 'Test',
                        onHeadDeletion: OnEdgeHeadDeletion.CASCADE,
                      },
                      brother: {
                        kind: 'Edge',
                        head: 'Test',
                        onHeadDeletion: OnEdgeHeadDeletion.SET_NULL,
                      },
                    },

                    uniques: [['id']],
                  },
                },
              }),
          ).toThrow(`/GraphQLPlatformConfig/nodes/Test/components - 2 errors:
└ ./parent/onHeadDeletion - Expects not to be "CASCADE" as the node "Test" cannot be deleted, got: 'CASCADE'
└ ./brother/onHeadDeletion - Expects not to be "SET_NULL" as the edge "Test.brother" is immutable, got: 'SET_NULL'`);
        });
      });
    });

    describe('Invalid unique-constraint(s)', () => {
      it(`throws an Error on empty config`, () => {
        expect(
          () =>
            new GraphQLPlatform({
              nodes: {
                Test: {
                  components: {
                    _id: { kind: 'Leaf', type: 'UnsignedInt' },
                  },
                  uniques: [],
                },
              },
            }),
        ).toThrow(
          `/GraphQLPlatformConfig/nodes/Test/uniques - Expects at least one unique-constraint, got: []`,
        );
      });

      it(`throws an Error on nullable identifier`, () => {
        expect(
          () =>
            new GraphQLPlatform({
              nodes: {
                Test: {
                  components: {
                    _id: { kind: 'Leaf', type: 'UnsignedInt' },
                  },
                  uniques: [['_id']],
                },
              },
            }),
        ).toThrow(
          "/GraphQLPlatformConfig/nodes/Test/uniques - Expects at least one identifier (= a non-nullable and immutable unique-constraint), got: [ [ '_id' ] ]",
        );
      });

      it(`throws an Error on mutable identifier`, () => {
        expect(
          () =>
            new GraphQLPlatform({
              nodes: {
                Test: {
                  components: {
                    _id: { kind: 'Leaf', type: 'UnsignedInt', nullable: false },
                  },
                  uniques: [['_id']],
                },
              },
            }),
        ).toThrow(
          "/GraphQLPlatformConfig/nodes/Test/uniques - Expects at least one identifier (= a non-nullable and immutable unique-constraint), got: [ [ '_id' ] ]",
        );
      });

      it('throws an Error on empty components', () => {
        expect(
          () =>
            new GraphQLPlatform({
              nodes: {
                ...nodes,
                Article: {
                  ...Article,
                  uniques: [[]],
                },
              },
            }),
        ).toThrow(
          '/GraphQLPlatformConfig/nodes/Article/uniques/0 - Expects at least one component, got: []',
        );
      });

      it('throws an Error on unknown component', () => {
        expect(
          () =>
            new GraphQLPlatform({
              nodes: {
                ...nodes,
                Article: {
                  ...Article,
                  uniques: [['missingComponent']],
                },
              },
            }),
        ).toThrow(
          `/GraphQLPlatformConfig/nodes/Article/uniques/0/0 - Expects an "Article"'s component among "_id, id, status, title, slug, body, category, createdBy, createdAt, updatedBy, updatedAt, metas, highlighted, sponsored, views, score, machineTags", got: 'missingComponent'`,
        );
      });
    });

    describe('Invalid reverse-edge(s)', () => {
      it('throws an Error on provided configuration when no referrers have been found', () => {
        expect(
          () =>
            new GraphQLPlatform({
              nodes: {
                ...nodes,
                Log: {
                  ...nodes.Log,
                  reverseEdges: {
                    // @ts-expect-error
                    myExtraReverseEdge: {},
                  },
                },
              },
            }),
        ).toThrow(
          `/GraphQLPlatformConfig/nodes/Log/reverseEdges - Expects no configuration as there is no node heading to this \"Log\" node, got: { myExtraReverseEdge: {} }`,
        );
      });

      it('throws an Error on unknown head', () => {
        expect(
          () =>
            new GraphQLPlatform({
              nodes: {
                ...nodes,
                User: {
                  ...nodes.User,
                  reverseEdges: {
                    ...nodes.User.reverseEdges,
                    invalidEdge: { originalEdge: 'UnknownModel' },
                  },
                },
              },
            }),
        ).toThrow(
          `/GraphQLPlatformConfig/nodes/User/reverseEdges/invalidEdge/originalEdge - Expects a node heading to this "User" node, got: 'UnknownModel'`,
        );
      });

      it('throws an Error on extra configuration', () => {
        expect(
          () =>
            new GraphQLPlatform({
              nodes: {
                ...nodes,
                User: {
                  ...nodes.User,
                  reverseEdges: {
                    ...nodes.User.reverseEdges,
                    invalidEdge: { originalEdge: 'Article.unknownEdgeName' },
                  },
                },
              },
            }),
        ).toThrow(
          `/GraphQLPlatformConfig/nodes/User/reverseEdges/invalidEdge/originalEdge - Expects an edge heading to this "User" node, got: 'Article.unknownEdgeName'`,
        );
      });

      it('throws an Error on unknown edge', () => {
        expect(
          () =>
            new GraphQLPlatform({
              nodes: {
                ...nodes,
                User: {
                  ...nodes.User,
                  reverseEdges: {
                    invalidEdge: { originalEdge: 'Article.unknownEdgeName' },
                  },
                },
              },
            }),
        ).toThrow(
          `/GraphQLPlatformConfig/nodes/User/reverseEdges/invalidEdge/originalEdge - Expects an edge heading to this "User" node, got: 'Article.unknownEdgeName'`,
        );
      });

      it('throws an Error on invalid edge', () => {
        expect(
          () =>
            new GraphQLPlatform({
              nodes: {
                ...nodes,
                User: {
                  ...nodes.User,
                  reverseEdges: {
                    invalidEdge: { originalEdge: 'Article.category' },
                  },
                },
              },
            }),
        ).toThrow(
          `/GraphQLPlatformConfig/nodes/User/reverseEdges/invalidEdge/originalEdge - Expects an edge heading to this "User" node, got: 'Article.category'`,
        );
      });
    });

    describe('Invalid output', () => {
      it("throws an Error on invalid virtual-field's dependsOn", () => {
        expect(
          () =>
            new GraphQLPlatform({
              nodes: {
                ...nodes,
                Article: {
                  ...nodes.Article,
                  output: {
                    ...nodes.Article.output,
                    virtualFields: {
                      myInvalidField: {
                        dependsOn: '{ unknownField }',
                        type: graphql.GraphQLString,
                        resolve: () => 'Hello World!',
                      },
                    },
                  },
                },
              },
            }),
        ).toThrow(
          `/GraphQLPlatformConfig/nodes/Article/output/virtualFields/myInvalidField/dependsOn - Expects an \"Article\"'s field among`,
        );
      });
    });

    describe('Invalid mutation', () => {
      it('throws an Error on update-able node without update-able component', () => {
        expect(
          () =>
            new GraphQLPlatform({
              nodes: {
                Hit: {
                  components: {
                    id: {
                      kind: 'Leaf',
                      type: 'UUIDv4',
                      nullable: false,
                      mutable: false,
                    },
                  },
                  uniques: [['id']],
                },
              },
            }),
        ).toThrow(
          '/GraphQLPlatformConfig/nodes/Hit - Expects at least one mutable component as it is mutable',
        );
      });

      it('throws an Error on publicly update-able node without publicly update-able component', () => {
        expect(
          () =>
            new GraphQLPlatform({
              nodes: {
                Test: {
                  components: {
                    id: { type: 'UUIDv4', nullable: false, mutable: false },
                    updatedAt: {
                      type: 'DateTime',
                      nullable: false,

                      creation: {
                        public: false,
                        defaultValue: () => new Date(),
                      },

                      update: {
                        public: false,
                        defaultValue: () => new Date(),
                      },
                    },
                  },
                  uniques: [['id']],
                },
              },
            }),
        ).toThrow(
          '/GraphQLPlatformConfig/nodes/Test - Expects at least one publicly mutable component as it is publicly updatable',
        );
      });
    });
  });

  describe('Works', () => {
    const gp = new GraphQLPlatform({ nodes });

    it.each([
      [
        'Article',
        [
          '_id',
          'id',
          'status',
          'title',
          'slug',
          'body',
          'category',
          'createdBy',
          'createdAt',
          'updatedBy',
          'updatedAt',
          'metas',
          'highlighted',
          'sponsored',
          'views',
          'score',
          'machineTags',
        ],
        ['_id', 'id', 'category-slug'],
        ['tags', 'extension'],
      ],
      [
        'Category',
        ['_id', 'id', 'title', 'slug', 'parent', 'order'],
        ['_id', 'id', 'parent-slug', 'parent-order'],
        ['children', 'articles'],
      ],
      [
        'Tag',
        ['id', 'deprecated', 'title', 'slug', 'createdAt', 'updatedAt'],
        ['id', 'slug'],
        ['articles'],
      ],
      [
        'ArticleTag',
        ['article', 'tag', 'order'],
        ['article-tag', 'article-order'],
        ['moderations'],
      ],
      [
        'User',
        ['id', 'username', 'createdAt', 'lastLoggedInAt'],
        ['id', 'username'],
        [
          'createdArticles',
          'updatedArticles',
          'profile',
          'articleTagModerations',
        ],
      ],
      [
        'UserProfile',
        ['user', 'birthday', 'facebookId', 'googleId', 'twitterHandle'],
        ['user'],
        [],
      ],
      ['Log', ['_id', 'message', 'createdAt'], ['_id'], []],
    ])(
      '"%s" has valid definition',
      (nodeName, componentNames, uniqueConstraintNames, reverseEdgeNames) => {
        const node = gp.getNodeByName(nodeName);

        expect(node.name).toBe(nodeName);
        expect([...node.componentsByName.keys()]).toEqual(componentNames);
        expect([...node.uniqueConstraintsByName.keys()]).toEqual(
          uniqueConstraintNames,
        );
        expect([...node.reverseEdgesByName.keys()]).toEqual(reverseEdgeNames);
        expect(node.selection).toBeInstanceOf(NodeSelection);
      },
    );

    it.each([
      ['Article', ['_id'], [], ['_id', 'category-slug']],
      ['Category', ['_id'], [], ['_id', 'parent-slug', 'parent-order']],
      ['Tag', [], [], []],
      ['ArticleTag', [], [], ['article-tag', 'article-order']],
      ['User', ['createdAt', 'lastLoggedInAt'], [], []],
      ['UserProfile', [], [], []],
    ])(
      '"%s" is public but has private component(s) / reverse-edge(s) / unique-constraint(s)',
      (
        nodeName,
        privateComponentNames,
        privateReverseEdgeNames,
        privateUniqueConstraintNames,
      ) => {
        const node = gp.getNodeByName(nodeName);

        expect(node.isPublic()).toBeTruthy();

        expect(
          Array.from(node.componentsByName.values())
            .filter((component) => !component.isPublic())
            .map(({ name }) => name),
        ).toEqual(privateComponentNames);

        expect(
          Array.from(node.reverseEdgesByName.values())
            .filter((reverseEdge) => !reverseEdge.isPublic())
            .map(({ name }) => name),
        ).toEqual(privateReverseEdgeNames);

        expect(
          Array.from(node.uniqueConstraintsByName.values())
            .filter((uniqueConstraint) => !uniqueConstraint.isPublic())
            .map(({ name }) => name),
        ).toEqual(privateUniqueConstraintNames);
      },
    );

    it.each(['Log'])(
      '"%s" is private so cannot have public component(s) / reverse-edge(s) / unique-constraint(s)',
      (nodeName) => {
        const node = gp.getNodeByName(nodeName);

        expect(node.isPublic()).toBeFalsy();

        expect(
          Array.from(node.componentsByName.values()).some((component) =>
            component.isPublic(),
          ),
        ).toBeFalsy();

        expect(
          Array.from(node.reverseEdgesByName.values()).some((reverseEdge) =>
            reverseEdge.isPublic(),
          ),
        ).toBeFalsy();

        expect(
          Array.from(node.uniqueConstraintsByName.values()).some(
            (uniqueConstraint) => uniqueConstraint.isPublic(),
          ),
        ).toBeFalsy();
      },
    );

    it(`can have (reverse-)edge heading to itself`, () => {
      const Category = gp.getNodeByName('Category');

      const parent = Category.getEdgeByName('parent');
      expect(parent).toBeInstanceOf(Edge);
      expect(parent.head).toBe(Category);
      expect(parent.referencedUniqueConstraint.name).toEqual('_id');

      const children = Category.getReverseEdgeByName('children');
      expect(children).toBeInstanceOf(MultipleReverseEdge);
      expect(children.head).toBe(Category);

      expect(children.originalEdge).toBe(parent);
    });

    describe('mutation can be configured', () => {
      it('can be disabled all at once', () => {
        const gp = new GraphQLPlatform({
          nodes: Object.fromEntries(
            Object.entries(nodes).map<[NodeName, NodeConfig]>(
              ([name, config]) => [
                name,
                {
                  ...config,
                  mutation: false,
                  components: Object.fromEntries(
                    Object.entries(config.components).map<
                      [utils.Name, ComponentConfig]
                    >(([name, config]) => [
                      name,
                      (config.kind === 'Edge'
                        ? R.omit(config, ['onHeadDeletion'])
                        : config) as any,
                    ]),
                  ),
                },
              ],
            ),
          ),
        });

        expect(hasEnabledMutationByType(gp)).toBeFalsy();
      });
    });

    describe.each(utils.mutationTypes)(
      '%s can be configured',
      (mutationType) => {
        it.each([
          { [mutationType]: false },
          { [mutationType]: { enabled: false } },
        ])(
          'can be disabled using the following configuration: %p',
          (mutationConfig) => {
            const gp = new GraphQLPlatform({
              nodes: Object.fromEntries(
                Object.entries<NodeConfig>(nodes).map<[utils.Name, NodeConfig]>(
                  ([name, config]) => [
                    name,
                    {
                      ...config,
                      mutation: {
                        ...(utils.isPlainObject(config.mutation)
                          ? config.mutation
                          : {}),
                        ...mutationConfig,
                      },
                      components:
                        config.components &&
                        Object.fromEntries(
                          Object.entries(config.components).map<
                            [utils.Name, ComponentConfig]
                          >(([name, config]) => [
                            name,
                            (config.kind === 'Edge'
                              ? R.omit(config, ['onHeadDeletion'])
                              : config) as any,
                          ]),
                        ),
                    },
                  ],
                ),
              ),
            });

            expect(hasEnabledMutationByType(gp, mutationType)).toBeFalsy();
          },
        );
      },
    );
  });
});
