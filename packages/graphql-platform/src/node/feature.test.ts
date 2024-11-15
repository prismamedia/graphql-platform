import { describe, expect, it } from '@jest/globals';
import { GraphQLString } from 'graphql';
import { randomUUID } from 'node:crypto';
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
    expect(Article).toBeInstanceOf(Node);

    expect(Array.from(Article.componentsByName.keys())).toEqual([
      '_id',
      'id',
      'title',
      'body',
    ]);

    expect(Array.from(Article.uniqueConstraintsByName.keys())).toEqual([
      '_id',
      'id',
      'title',
    ]);

    expect(Article.creationInputType.fieldsByName.has('virtualCreation')).toBe(
      true,
    );

    expect(Article.updateInputType.fieldsByName.has('virtualUpdate')).toBe(
      true,
    );

    expect(Article.outputType.fieldsByName.has('virtualArticleOutput')).toBe(
      true,
    );
  });
});
