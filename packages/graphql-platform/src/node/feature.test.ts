import { GraphQLString } from 'graphql';
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { GraphQLPlatform, Node } from '../index.js';

describe('Feature', () => {
  it('can define components', () => {
    const gp = new GraphQLPlatform<any>({
      nodes: {
        Article: {
          features: [
            {
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
