import {
  isPlainObject,
  MutationType,
  mutationTypes,
  type Name,
} from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import _ from 'lodash';
import { GraphQLPlatform } from './index.js';
import {
  ComponentConfig,
  Edge,
  NodeConfig,
  NodeName,
  NodeSelection,
  OnHeadDeletion,
  ReverseEdgeMultiple,
} from './node.js';
import { Article, Category, nodes } from './__tests__/config.js';

const hasEnabledMutationByType = (
  gp: GraphQLPlatform,
  type?: MutationType,
): boolean =>
  [...gp.operationsByNameByType.mutation.values()].some(
    (mutation) =>
      mutation.isEnabled() && (!type || mutation.mutationTypes.includes(type)),
  );

const hasPublicMutationByType = (
  gp: GraphQLPlatform,
  type?: MutationType,
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
          `\"GraphQLPlatformConfig.nodes.-InvalidName\" - Expects to be valid against the GraphQL \"Names\" specification (@see: https://spec.graphql.org/draft/#sec-Names), got: '-InvalidName'
└ Cause: Names must start with [_a-zA-Z] but \"-InvalidName\" does not.`,
        ],
        [
          'invalidName',
          `\"GraphQLPlatformConfig.nodes.invalidName\" - Expects to be in PascalCase (= \"InvalidName\"), got: 'invalidName'`,
        ],
      ])(
        `throws an Error on invalid name: %s`,
        (invalidName, expectedError) => {
          expect(
            () =>
              new GraphQLPlatform({
                // @ts-expect-error
                nodes: { [invalidName]: {} },
              }),
          ).toThrowError(expectedError);
        },
      );
    });

    describe('Invalid component(s)', () => {
      it.each([
        [
          {},
          `"GraphQLPlatformConfig.nodes.Test.components" - Expects at least one "component", got: undefined`,
        ],
        [
          { components: undefined },
          `"GraphQLPlatformConfig.nodes.Test.components" - Expects at least one "component", got: undefined`,
        ],
        [
          { components: null },
          `"GraphQLPlatformConfig.nodes.Test.components" - Expects at least one "component", got: null`,
        ],
        [
          { components: {} },
          `"GraphQLPlatformConfig.nodes.Test.components" - Expects at least one "component", got: {}`,
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
          ).toThrowError(expectedError);
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
          ).toThrowError(
            '"GraphQLPlatformConfig.nodes.Article.components.edgeToAMissingModel.head" - Expects a "node"\'s name among "Article, Category, Tag, ArticleTag, User, UserProfile, Log", got: \'MissingModel\'',
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
          ).toThrowError(
            '"GraphQLPlatformConfig.nodes.Article.components.edgeToAMissingReference.head" - Expects a "unique-constraint"\'s name among "_id, id, category_slug", got: \'missingUnique\'',
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
                        head: 'Category.parent_slug',
                      },
                    },
                  },
                },
              }),
          ).toThrowError(
            '"GraphQLPlatformConfig.nodes.Category.components.parent.head" - Expects a "unique-constraint" not refering itself, got: \'parent_slug\'',
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
                        onHeadDeletion: OnHeadDeletion.CASCADE,
                      },
                      brother: {
                        kind: 'Edge',
                        head: 'Test',
                        onHeadDeletion: OnHeadDeletion.SET_NULL,
                      },
                    },

                    uniques: [['id']],
                  },
                },
              }),
          )
            .toThrowError(`"GraphQLPlatformConfig.nodes.Test.components" - 2 errors:
└ "parent.onHeadDeletion" - Expects not to be "CASCADE" as the node "Test" cannot be deleted, got: 'CASCADE'
└ "brother.onHeadDeletion" - Expects not to be "SET_NULL" as the edge "Test.brother" is immutable, got: 'SET_NULL'`);
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
        ).toThrowError(
          `"GraphQLPlatformConfig.nodes.Test.uniques" - Expects at least one "unique-constraint", got: []`,
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
        ).toThrowError(
          '"GraphQLPlatformConfig.nodes.Test.uniques.0" - Expects its identifier (= the first unique constraint, composed of the component "_id") to be non-nullable (= at least one of its components being non-nullable)',
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
        ).toThrowError(
          '"GraphQLPlatformConfig.nodes.Test.uniques.0" - Expects its identifier (= the first unique constraint, composed of the component "_id") to be immutable (= all its components being immutable)',
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
        ).toThrowError(
          '"GraphQLPlatformConfig.nodes.Article.uniques.0" - Expects at least one "component", got: []',
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
        ).toThrowError(
          `\"GraphQLPlatformConfig.nodes.Article.uniques.0.0\" - Expects a \"component\"'s name among \"_id, id, status, title, slug, body, category, createdBy, createdAt, updatedBy, updatedAt, metas, highlighted, sponsored\", got: 'missingComponent'`,
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
        ).toThrowError(
          `\"GraphQLPlatformConfig.nodes.Log.reverseEdges\" - Expects no configuration as there is no node having an edge heading to the \"Log\" node, got: { myExtraReverseEdge: {} }`,
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
        ).toThrowError(
          `\"GraphQLPlatformConfig.nodes.User.reverseEdges.invalidEdge.originalEdge\" - Expects a node having an edge heading to the \"User\" node (= a value among \"Article, UserProfile\"), got: 'UnknownModel'`,
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
        ).toThrowError(
          `\"GraphQLPlatformConfig.nodes.User.reverseEdges.invalidEdge.originalEdge\" - Expects no more configuration for \"Article\"'s edge as there is no more edge heading to the \"User\" node`,
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
        ).toThrowError(
          `\"GraphQLPlatformConfig.nodes.User.reverseEdges.invalidEdge.originalEdge\" - Expects an edge heading to the \"User\" node (= a value among \"createdBy, updatedBy\"), got: 'unknownEdgeName'`,
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
        ).toThrowError(
          `\"GraphQLPlatformConfig.nodes.User.reverseEdges.invalidEdge.originalEdge\" - Expects an edge heading to the \"User\" node (= a value among \"createdBy, updatedBy\"), got: 'category'`,
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
                      },
                    },
                  },
                },
              },
            }),
        )
          .toThrowError(`\"GraphQLPlatformConfig.nodes.Article.output.virtualFields.myInvalidField.dependsOn\" - Expects a valid fragment, got: '{ unknownField }'
└ Cause: Expects an \"Article\"'s field, got: 'unknownField'`);
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
        ).toThrowError(
          `\"GraphQLPlatformConfig.nodes.Hit\" - Expects at least one mutable component as it is mutable: either disable the \"update\" or enable it on one of its components`,
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
        ],
        ['_id', 'id', 'category_slug'],
        ['tags'],
      ],
      [
        'Category',
        ['_id', 'id', 'title', 'slug', 'parent', 'order'],
        ['_id', 'id', 'parent_slug', 'parent_order'],
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
        ['article_tag', 'article_order'],
        [],
      ],
      [
        'User',
        ['id', 'username', 'createdAt', 'lastLoggedInAt'],
        ['id', 'username'],
        ['createdArticles', 'updatedArticles', 'profile'],
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
        const node = gp.getNode(nodeName);

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
      ['Article', ['_id'], ['_id'], []],
      ['Category', ['_id'], ['_id'], []],
      ['Tag', [], [], []],
      ['ArticleTag', [], [], []],
      ['User', ['createdAt', 'lastLoggedInAt'], [], []],
      ['UserProfile', [], [], []],
    ])(
      '"%s" is public but has private component(s) / unique-constraint(s) / reverse-edge(s)',
      (
        nodeName,
        privateComponentNames,
        privateUniqueConstraintNames,
        privateReverseEdgeNames,
      ) => {
        const node = gp.getNode(nodeName);

        expect(node.isPublic()).toBeTruthy();

        expect(
          [...node.componentsByName.values()]
            .filter((component) => !component.isPublic())
            .map((component) => component.name),
        ).toEqual(privateComponentNames);

        expect(
          [...node.uniqueConstraintsByName.values()]
            .filter((uniqueConstraint) => !uniqueConstraint.isPublic())
            .map((uniqueConstraint) => uniqueConstraint.name),
        ).toEqual(privateUniqueConstraintNames);

        expect(
          [...node.reverseEdgesByName.values()]
            .filter((reverseEdge) => !reverseEdge.isPublic())
            .map((reverseEdge) => reverseEdge.name),
        ).toEqual(privateReverseEdgeNames);
      },
    );

    it.each(['Log'])(
      '"%s" is private so cannot have public component(s) / unique-constraint(s) / reverse-edge(s)',
      (nodeName) => {
        const node = gp.getNode(nodeName);

        expect(node.isPublic()).toBeFalsy();

        expect(
          [...node.componentsByName.values()].some((component) =>
            component.isPublic(),
          ),
        ).toBeFalsy();

        expect(
          [...node.uniqueConstraintsByName.values()].some((uniqueConstraint) =>
            uniqueConstraint.isPublic(),
          ),
        ).toBeFalsy();

        expect(
          [...node.reverseEdgesByName.values()].some((reverseEdge) =>
            reverseEdge.isPublic(),
          ),
        ).toBeFalsy();
      },
    );

    it(`can have (reverse-)edge heading to itself`, () => {
      const Category = gp.getNode('Category');

      const parent = Category.getEdge('parent');
      expect(parent).toBeInstanceOf(Edge);
      expect(parent.head).toBe(Category);
      expect(parent.referencedUniqueConstraint.name).toEqual('_id');

      const children = Category.getReverseEdge('children');
      expect(children).toBeInstanceOf(ReverseEdgeMultiple);
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
                      [Name, ComponentConfig<any, any>]
                    >(([name, config]) => [
                      name,
                      (config.kind === 'Edge'
                        ? _.omit(config, ['onHeadDeletion'])
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

    describe.each(mutationTypes)('%s can be configured', (mutationType) => {
      it.each([
        { [mutationType]: false },
        { [mutationType]: { enabled: false } },
      ])(
        'can be disabled using the following configuration: %p',
        (mutationConfig) => {
          const gp = new GraphQLPlatform({
            nodes: Object.fromEntries(
              Object.entries(nodes).map<[Name, NodeConfig]>(
                ([name, config]) => [
                  name,
                  {
                    ...config,
                    mutation: {
                      ...(isPlainObject(config.mutation)
                        ? config.mutation
                        : {}),
                      ...mutationConfig,
                    },
                    components: Object.fromEntries(
                      Object.entries(config.components).map<
                        [Name, ComponentConfig<any, any>]
                      >(([name, config]) => [
                        name,
                        (config.kind === 'Edge'
                          ? _.omit(config, ['onHeadDeletion'])
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
    });
  });
});
