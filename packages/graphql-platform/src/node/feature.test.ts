import { GraphQLString } from 'graphql';
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { GraphQLPlatform, Node } from '../index.js';

describe('Feature', () => {
  it('are sorted by priority', () => {
    const gp = new GraphQLPlatform<any>({
      nodes: {
        Article: {
          features: [
            {
              name: 'feature1',
              priority: -1,
            },
            {
              name: 'feature2',
              priority: 1,
            },
            {
              name: 'feature3',
              priority: 0,
            },
            {
              name: 'feature4',
              priority: 2,
            },
            {
              name: 'feature5',
              priority: -2,
            },
          ],
          components: {
            id: { type: 'UUIDv4', nullable: false, mutable: false },
          },
          uniques: [['id']],
          mutation: false,
        },
      },
    });

    const Article = gp.getNodeByName('Article');

    assert.deepStrictEqual(
      Article.features.map(({ name }) => name),
      ['feature4', 'feature2', 'feature3', 'Article', 'feature1', 'feature5'],
    );

    assert.deepStrictEqual(
      Array.from(Article.featuresByPriority, ([priority, features]) => [
        priority,
        features.map(({ name }) => name),
      ]),
      [
        [2, ['feature4']],
        [1, ['feature2']],
        [0, ['feature3', 'Article']],
        [-1, ['feature1']],
        [-2, ['feature5']],
      ],
    );

    const feature4 = Article.features.find(({ name }) => name === 'feature4');
    assert.strictEqual(feature4?.toString(), 'Article.feature.feature4');
  });

  it('can define components', () => {
    const gp = new GraphQLPlatform<any>({
      nodes: {
        Article: {
          features: [
            {
              name: 'feature1',

              components: {
                _id: {
                  kind: 'Leaf',
                  type: 'UnsignedInt',
                  nullable: false,
                  mutable: false,
                  public: false,
                  description: 'The private ID',
                  column: { name: 'intId', autoIncrement: true },

                  creation: { optional: true },
                },
                id: {
                  kind: 'Leaf',
                  type: 'UUIDv4',
                  nullable: false,
                  mutable: false,
                  description: 'The public ID',

                  creation: {
                    defaultValue: () => randomUUID(),
                    description:
                      'You can either provide an UUID or let one be generated for you',
                  },
                },
              },
              uniques: [['_id'], ['id']],
            },
          ],

          components: {
            title: { type: 'String' },
            body: { type: 'String' },
          },

          uniques: [['title']],

          mutation: {
            creation: {
              virtualFields: {
                virtualCreation: {
                  type: GraphQLString,
                },
              },

              preCreate() {},
            },
            update: {
              virtualFields: {
                virtualUpdate: {
                  type: GraphQLString,
                },
              },
            },
          },

          output: {
            virtualFields: (node) => ({
              [`virtual${node}Output`]: {
                type: GraphQLString,
                resolve(source, args, context) {
                  return 'Hello World!';
                },
              },
            }),
          },
        },
      },
    });

    const Article = gp.getNodeByName('Article');
    assert(Article instanceof Node);

    assert.deepStrictEqual(Array.from(Article.componentsByName.keys()), [
      '_id',
      'id',
      'title',
      'body',
    ]);

    assert.deepStrictEqual(Array.from(Article.uniqueConstraintsByName.keys()), [
      '_id',
      'id',
      'title',
    ]);

    assert.strictEqual(
      Article.creationInputType.fieldsByName.has('virtualCreation'),
      true,
    );

    assert.strictEqual(
      Article.updateInputType.fieldsByName.has('virtualUpdate'),
      true,
    );

    assert.strictEqual(
      Article.outputType.fieldsByName.has('virtualArticleOutput'),
      true,
    );
  });
});
