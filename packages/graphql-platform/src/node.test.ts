import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { inspect } from 'node:util';
import * as R from 'remeda';
import { Article, Category, nodes } from './__tests__/config.js';
import { GraphQLPlatform } from './index.js';
import {
  type ComponentConfig,
  Edge,
  MultipleReverseEdge,
  type NodeConfig,
  type NodeName,
  NodeSelection,
  OnEdgeHeadDeletion,
} from './node.js';

const hasEnabledMutationByType = (
  gp: GraphQLPlatform,
  type?: utils.MutationType,
): boolean =>
  gp.nodeOperationsByNameByType.mutation
    .values()
    .some(
      (mutation) =>
        mutation.isEnabled() &&
        (!type || mutation.mutationTypes.includes(type)),
    );

describe('Node', () => {
  describe('Fails', () => {
    describe('Invalid name', () => {
      [
        [
          '-InvalidName',
          `/GraphQLPlatformConfig/nodes/-InvalidName - Expects to be valid against the GraphQL "Names" specification (@see: https://spec.graphql.org/draft/#sec-Names), got: '-InvalidName'`,
        ],
        [
          'invalidName',
          `/GraphQLPlatformConfig/nodes/invalidName - Expects to be in "PascalCase", got: 'invalidName'`,
        ],
      ].forEach(([invalidName, expectedErrorMessage]) => {
        it(`throws an error on invalid name: ${invalidName}`, () => {
          assert.throws(
            () => new GraphQLPlatform({ nodes: { [invalidName]: {} } }),
            { message: expectedErrorMessage },
          );
        });
      });
    });

    describe('Invalid component(s)', () => {
      [
        [
          { features: [{ components: null }], components: null },
          `/GraphQLPlatformConfig/nodes/Test/components - Expects at least one component, got: null`,
        ],
        [
          { components: {} },
          `/GraphQLPlatformConfig/nodes/Test/components - Expects at least one component, got: {}`,
        ],
      ].forEach(([config, expectedErrorMessage]) => {
        it(`throws an error on invalid components: ${inspect(config, undefined, 5)}`, () => {
          assert.throws(
            () =>
              new GraphQLPlatform({
                nodes: {
                  // @ts-expect-error
                  Test: config,
                },
              }),
            { message: expectedErrorMessage },
          );
        });
      });
      it('throws an error on edge missing "head"', () => {
        assert.throws(
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
          {
            message: `/GraphQLPlatformConfig/nodes/Article/components/edgeToAMissingModel/head - Expects a node's name among "Article, ArticleExtension, Category, Tag, ArticleTag, ArticleTagModeration, User, UserProfile, Log", got: 'MissingModel'`,
          },
        );
      });

      it('throws an error on edge missing "head reference"', () => {
        assert.throws(
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
          {
            message: `/GraphQLPlatformConfig/nodes/Article/components/edgeToAMissingReference/head - Expects an "Article"'s unique-constraint among "_id, id, category-slug", got: 'missingUnique'`,
          },
        );
      });

      it('throws an error on edge referencing itself', () => {
        assert.throws(
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
          {
            message: `/GraphQLPlatformConfig/nodes/Category/components/parent/head - Expects a unique-constraint not refering itself, got: 'parent-slug'`,
          },
        );
      });

      it('throws an error on edge invalid "onHeadDeletion"', () => {
        assert.throws(
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
          {
            message: `/GraphQLPlatformConfig/nodes/Test/components - 2 errors:
└ ./parent/onHeadDeletion - Expects not to be "CASCADE" as the node "Test" cannot be deleted, got: 'CASCADE'
└ ./brother/onHeadDeletion - Expects not to be "SET_NULL" as the edge "Test.brother" is immutable, got: 'SET_NULL'`,
          },
        );
      });
    });

    describe('Invalid unique-constraint(s)', () => {
      it(`throws an error on empty config`, () => {
        assert.throws(
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
          {
            message: `/GraphQLPlatformConfig/nodes/Test/uniques - Expects at least one unique-constraint, got: []`,
          },
        );
      });

      it(`throws an error on nullable identifier`, () => {
        assert.throws(
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
          {
            message: `/GraphQLPlatformConfig/nodes/Test/uniques - Expects at least one identifier (= a non-nullable and immutable unique-constraint), got: [ [ '_id' ] ]`,
          },
        );
      });

      it(`throws an error on mutable identifier`, () => {
        assert.throws(
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
          {
            message: `/GraphQLPlatformConfig/nodes/Test/uniques - Expects at least one identifier (= a non-nullable and immutable unique-constraint), got: [ [ '_id' ] ]`,
          },
        );
      });

      it('throws an error on empty components', () => {
        assert.throws(
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
          {
            message: `/GraphQLPlatformConfig/nodes/Article/uniques/0 - Expects at least one component, got: []`,
          },
        );
      });

      it('throws an error on unknown component', () => {
        assert.throws(
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
          {
            message: `/GraphQLPlatformConfig/nodes/Article/uniques/0/0 - Expects an "Article"'s component among "_id, id, status, title, slug, body, category, createdBy, createdAt, updatedBy, updatedAt, metas, highlighted, sponsored, views, score, machineTags", got: 'missingComponent'`,
          },
        );
      });
    });

    describe('Invalid reverse-edge(s)', () => {
      it('throws an error on provided configuration when no referrers have been found', () => {
        assert.throws(
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
          {
            message: `/GraphQLPlatformConfig/nodes/Log/reverseEdges - Expects no configuration as there is no node heading to this "Log" node, got: { myExtraReverseEdge: {} }`,
          },
        );
      });

      it('throws an error on unknown head', () => {
        assert.throws(
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
          {
            message: `/GraphQLPlatformConfig/nodes/User/reverseEdges/invalidEdge/originalEdge - Expects a node heading to this "User" node, got: 'UnknownModel'`,
          },
        );
      });

      it('throws an error on extra configuration', () => {
        assert.throws(
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
          {
            message: `/GraphQLPlatformConfig/nodes/User/reverseEdges/invalidEdge/originalEdge - Expects an edge heading to this "User" node, got: 'Article.unknownEdgeName'`,
          },
        );
      });

      it('throws an error on unknown edge', () => {
        assert.throws(
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
          {
            message: `/GraphQLPlatformConfig/nodes/User/reverseEdges/invalidEdge/originalEdge - Expects an edge heading to this "User" node, got: 'Article.unknownEdgeName'`,
          },
        );
      });

      it('throws an error on invalid edge', () => {
        assert.throws(
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
          {
            message: `/GraphQLPlatformConfig/nodes/User/reverseEdges/invalidEdge/originalEdge - Expects an edge heading to this "User" node, got: 'Article.category'`,
          },
        );
      });
    });

    describe('Invalid output', () => {
      it("throws an error on invalid virtual-field's dependsOn", () => {
        assert.throws(
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
                        type: graphql.GraphQLString,
                        dependsOn: '{ unknownField }',
                        resolve: () => 'Hello World!',
                      },
                    },
                  },
                },
              },
            })
              .getNodeByName('Article')
              .outputType.select(`{ myInvalidField }`),
          {
            message: new RegExp(
              `^/GraphQLPlatformConfig/nodes/Article/output/virtualFields/myInvalidField/dependsOn - Expects an "Article"'s field among`,
            ),
          },
        );
      });
    });

    describe('Invalid mutation', () => {
      it('throws an error on update-able node without update-able component', () => {
        assert.throws(
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
          {
            message: `/GraphQLPlatformConfig/nodes/Hit - Expects at least one mutable component as it is mutable`,
          },
        );
      });

      it('throws an error on publicly update-able node without publicly update-able component', () => {
        assert.throws(
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
          {
            message: `/GraphQLPlatformConfig/nodes/Test - Expects at least one publicly mutable component as it is publicly updatable`,
          },
        );
      });
    });
  });

  describe('Works', () => {
    const gp = new GraphQLPlatform({ nodes });

    (
      [
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
      ] as const
    ).forEach(
      ([nodeName, componentNames, uniqueConstraintNames, reverseEdgeNames]) => {
        it(`"${nodeName}" has valid definition`, () => {
          const node = gp.getNodeByName(nodeName);

          assert.strictEqual(node.name, nodeName);
          assert.deepStrictEqual(
            [...node.componentsByName.keys()],
            componentNames,
          );
          assert.deepStrictEqual(
            [...node.uniqueConstraintsByName.keys()],
            uniqueConstraintNames,
          );
          assert.deepStrictEqual(
            [...node.reverseEdgesByName.keys()],
            reverseEdgeNames,
          );
          assert(node.selection instanceof NodeSelection);
        });
      },
    );

    (
      [
        ['Article', ['_id'], [], ['_id', 'category-slug']],
        ['Category', ['_id'], [], ['_id', 'parent-slug', 'parent-order']],
        ['Tag', [], [], []],
        ['ArticleTag', [], [], ['article-tag', 'article-order']],
        ['User', ['createdAt', 'lastLoggedInAt'], [], []],
        ['UserProfile', [], [], []],
      ] as const
    ).forEach(
      ([
        nodeName,
        privateComponentNames,
        privateReverseEdgeNames,
        privateUniqueConstraintNames,
      ]) => {
        it(`"${nodeName}" is public but has private component(s) / reverse-edge(s) / unique-constraint(s)`, () => {
          const node = gp.getNodeByName(nodeName);

          assert(node.isPublic());

          assert.deepStrictEqual(
            Array.from(node.componentsByName.values())
              .filter((component) => !component.isPublic())
              .map(({ name }) => name),
            privateComponentNames,
          );

          assert.deepStrictEqual(
            Array.from(node.reverseEdgesByName.values())
              .filter((reverseEdge) => !reverseEdge.isPublic())
              .map(({ name }) => name),
            privateReverseEdgeNames,
          );

          assert.deepStrictEqual(
            Array.from(node.uniqueConstraintsByName.values())
              .filter((uniqueConstraint) => !uniqueConstraint.isPublic())
              .map(({ name }) => name),
            privateUniqueConstraintNames,
          );
        });
      },
    );

    ['Log'].forEach((nodeName) => {
      it(`"${nodeName}" is private so cannot have public component(s) / reverse-edge(s) / unique-constraint(s)`, () => {
        const node = gp.getNodeByName(nodeName);

        assert(!node.isPublic());

        assert(
          Array.from(node.componentsByName.values()).every(
            (component) => !component.isPublic(),
          ),
        );

        assert(
          Array.from(node.reverseEdgesByName.values()).every(
            (reverseEdge) => !reverseEdge.isPublic(),
          ),
        );

        assert(
          Array.from(node.uniqueConstraintsByName.values()).every(
            (uniqueConstraint) => !uniqueConstraint.isPublic(),
          ),
        );
      });
    });

    it(`can have (reverse-)edge heading to itself`, () => {
      const Category = gp.getNodeByName('Category');

      const parent = Category.getEdgeByName('parent');
      assert(parent instanceof Edge);
      assert.strictEqual(parent.head, Category);
      assert.strictEqual(parent.referencedUniqueConstraint.name, '_id');

      const children = Category.getReverseEdgeByName('children');
      assert(children instanceof MultipleReverseEdge);
      assert.strictEqual(children.head, Category);
      assert.strictEqual(children.originalEdge, parent);
    });

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

      assert(!hasEnabledMutationByType(gp));
    });

    utils.mutationTypes.forEach((mutationType) => {
      it(`${mutationType} can be configured`, () => {
        [
          { [mutationType]: false },
          { [mutationType]: { enabled: false } },
        ].forEach((mutationConfig) => {
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

          assert(!hasEnabledMutationByType(gp, mutationType));
        });
      });
    });
  });
});
