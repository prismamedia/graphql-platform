import { graphqlPlatform } from '.';

describe('ResourceMap', () => {
  const resourceGraph = graphqlPlatform.getResourceGraph();
  const resourceMap = graphqlPlatform.getResourceMap();

  it('creates a resource map', () => {
    expect(resourceGraph.overallOrder()).toEqual([
      'Category',
      'User',
      'Article',
      'Tag',
      'ArticleTag',
      'ArticleTagComment',
      'ArticleUrl',
      'ArticleUrlMeta',
    ]);

    expect(
      [...resourceMap].map(([, resource]) => ({
        name: resource.name,
        plural: resource.plural,
        description: resource.description,
        fieldMap: [...resource.getFieldSet()].map(field => ({
          name: field.name,
          description: field.description,
          immutable: field.isImmutable(),
        })),
        relationMap: [...resource.getRelationSet()].map(relation => ({
          name: relation.name,
          description: relation.description,
          immutable: relation.isImmutable(),
          targetedResource: relation.getTo().name,
          targetedUniqueName: relation.getToUnique().name,
        })),
        inverseRelationMap: [...resource.getInverseRelationSet()].map(inverseRelation => ({
          name: inverseRelation.name,
          description: inverseRelation.description,
        })),
        uniqueSet: [...resource.getUniqueSet()].map(unique => ({
          name: unique.name,
        })),
        identifier: {
          name: resource.getIdentifier().name,
        },
      })),
    ).toMatchInlineSnapshot(`
      Array [
        Object {
          "description": "An article",
          "fieldMap": Array [
            Object {
              "description": "The internal and private ID used to speed up some operations",
              "immutable": true,
              "name": "_id",
            },
            Object {
              "description": "The public ID",
              "immutable": false,
              "name": "id",
            },
            Object {
              "description": "The date, fixed, of the document's creation",
              "immutable": true,
              "name": "createdAt",
            },
            Object {
              "description": "The date of the document's last update",
              "immutable": false,
              "name": "updatedAt",
            },
            Object {
              "description": undefined,
              "immutable": false,
              "name": "format",
            },
            Object {
              "description": "The article's title",
              "immutable": false,
              "name": "title",
            },
            Object {
              "description": "The article's slug",
              "immutable": true,
              "name": "slug",
            },
            Object {
              "description": "The article's body",
              "immutable": false,
              "name": "body",
            },
          ],
          "identifier": Object {
            "name": "_id",
          },
          "inverseRelationMap": Array [
            Object {
              "description": "\\"ArticleTag.article\\"'s inverse relation",
              "name": "tags",
            },
            Object {
              "description": "\\"ArticleUrl.article\\"'s inverse relation",
              "name": "url",
            },
          ],
          "name": "Article",
          "plural": "Articles",
          "relationMap": Array [
            Object {
              "description": undefined,
              "immutable": false,
              "name": "category",
              "targetedResource": "Category",
              "targetedUniqueName": "parent-slug",
            },
            Object {
              "description": undefined,
              "immutable": false,
              "name": "author",
              "targetedResource": "User",
              "targetedUniqueName": "username",
            },
            Object {
              "description": undefined,
              "immutable": false,
              "name": "moderator",
              "targetedResource": "User",
              "targetedUniqueName": "_id",
            },
          ],
          "uniqueSet": Array [
            Object {
              "name": "_id",
            },
            Object {
              "name": "id",
            },
            Object {
              "name": "category-slug",
            },
          ],
        },
        Object {
          "description": undefined,
          "fieldMap": Array [
            Object {
              "description": "The date, fixed, of the document's creation",
              "immutable": true,
              "name": "createdAt",
            },
            Object {
              "description": "The date of the document's last update",
              "immutable": false,
              "name": "updatedAt",
            },
            Object {
              "description": undefined,
              "immutable": false,
              "name": "order",
            },
          ],
          "identifier": Object {
            "name": "article-tag",
          },
          "inverseRelationMap": Array [
            Object {
              "description": "\\"ArticleTagComment.articleTag\\"'s inverse relation",
              "name": "comment",
            },
          ],
          "name": "ArticleTag",
          "plural": "ArticleTags",
          "relationMap": Array [
            Object {
              "description": undefined,
              "immutable": true,
              "name": "article",
              "targetedResource": "Article",
              "targetedUniqueName": "_id",
            },
            Object {
              "description": undefined,
              "immutable": true,
              "name": "tag",
              "targetedResource": "Tag",
              "targetedUniqueName": "_id",
            },
          ],
          "uniqueSet": Array [
            Object {
              "name": "article-tag",
            },
            Object {
              "name": "article/order",
            },
          ],
        },
        Object {
          "description": undefined,
          "fieldMap": Array [
            Object {
              "description": "The date, fixed, of the document's creation",
              "immutable": true,
              "name": "createdAt",
            },
            Object {
              "description": "The date of the document's last update",
              "immutable": false,
              "name": "updatedAt",
            },
            Object {
              "description": undefined,
              "immutable": false,
              "name": "body",
            },
          ],
          "identifier": Object {
            "name": "articleTag",
          },
          "inverseRelationMap": Array [],
          "name": "ArticleTagComment",
          "plural": "ArticleTagComments",
          "relationMap": Array [
            Object {
              "description": undefined,
              "immutable": true,
              "name": "articleTag",
              "targetedResource": "ArticleTag",
              "targetedUniqueName": "article-tag",
            },
          ],
          "uniqueSet": Array [
            Object {
              "name": "articleTag",
            },
          ],
        },
        Object {
          "description": undefined,
          "fieldMap": Array [
            Object {
              "description": "The date, fixed, of the document's creation",
              "immutable": true,
              "name": "createdAt",
            },
            Object {
              "description": "The date of the document's last update",
              "immutable": false,
              "name": "updatedAt",
            },
            Object {
              "description": undefined,
              "immutable": false,
              "name": "path",
            },
          ],
          "identifier": Object {
            "name": "article",
          },
          "inverseRelationMap": Array [
            Object {
              "description": "\\"ArticleUrlMeta.url\\"'s inverse relation",
              "name": "meta",
            },
          ],
          "name": "ArticleUrl",
          "plural": "ArticleUrls",
          "relationMap": Array [
            Object {
              "description": undefined,
              "immutable": true,
              "name": "article",
              "targetedResource": "Article",
              "targetedUniqueName": "_id",
            },
          ],
          "uniqueSet": Array [
            Object {
              "name": "article",
            },
          ],
        },
        Object {
          "description": undefined,
          "fieldMap": Array [
            Object {
              "description": "The date, fixed, of the document's creation",
              "immutable": true,
              "name": "createdAt",
            },
            Object {
              "description": "The date of the document's last update",
              "immutable": false,
              "name": "updatedAt",
            },
          ],
          "identifier": Object {
            "name": "url",
          },
          "inverseRelationMap": Array [],
          "name": "ArticleUrlMeta",
          "plural": "ArticleUrlMetas",
          "relationMap": Array [
            Object {
              "description": undefined,
              "immutable": true,
              "name": "url",
              "targetedResource": "ArticleUrl",
              "targetedUniqueName": "article",
            },
          ],
          "uniqueSet": Array [
            Object {
              "name": "url",
            },
          ],
        },
        Object {
          "description": undefined,
          "fieldMap": Array [
            Object {
              "description": "The internal and private ID used to speed up some operations",
              "immutable": true,
              "name": "_id",
            },
            Object {
              "description": "The public ID",
              "immutable": false,
              "name": "id",
            },
            Object {
              "description": "The date, fixed, of the document's creation",
              "immutable": true,
              "name": "createdAt",
            },
            Object {
              "description": "The date of the document's last update",
              "immutable": false,
              "name": "updatedAt",
            },
            Object {
              "description": undefined,
              "immutable": false,
              "name": "title",
            },
            Object {
              "description": "The category's slug",
              "immutable": true,
              "name": "slug",
            },
          ],
          "identifier": Object {
            "name": "_id",
          },
          "inverseRelationMap": Array [
            Object {
              "description": "\\"Article.category\\"'s inverse relation",
              "name": "articles",
            },
            Object {
              "description": "\\"Category.parent\\"'s inverse relation",
              "name": "children",
            },
          ],
          "name": "Category",
          "plural": "Categories",
          "relationMap": Array [
            Object {
              "description": undefined,
              "immutable": false,
              "name": "parent",
              "targetedResource": "Category",
              "targetedUniqueName": "id",
            },
          ],
          "uniqueSet": Array [
            Object {
              "name": "_id",
            },
            Object {
              "name": "id",
            },
            Object {
              "name": "parent-slug",
            },
          ],
        },
        Object {
          "description": undefined,
          "fieldMap": Array [
            Object {
              "description": "The internal and private ID used to speed up some operations",
              "immutable": true,
              "name": "_id",
            },
            Object {
              "description": "The public ID",
              "immutable": true,
              "name": "id",
            },
            Object {
              "description": "The date, fixed, of the document's creation",
              "immutable": true,
              "name": "createdAt",
            },
            Object {
              "description": "The date of the document's last update",
              "immutable": true,
              "name": "updatedAt",
            },
            Object {
              "description": undefined,
              "immutable": true,
              "name": "title",
            },
            Object {
              "description": "The tag's slug",
              "immutable": true,
              "name": "slug",
            },
          ],
          "identifier": Object {
            "name": "_id",
          },
          "inverseRelationMap": Array [
            Object {
              "description": "\\"ArticleTag.tag\\"'s inverse relation",
              "name": "articles",
            },
          ],
          "name": "Tag",
          "plural": "Tags",
          "relationMap": Array [],
          "uniqueSet": Array [
            Object {
              "name": "_id",
            },
            Object {
              "name": "id",
            },
            Object {
              "name": "slug",
            },
          ],
        },
        Object {
          "description": undefined,
          "fieldMap": Array [
            Object {
              "description": "The internal and private ID used to speed up some operations",
              "immutable": true,
              "name": "_id",
            },
            Object {
              "description": "The public ID",
              "immutable": false,
              "name": "id",
            },
            Object {
              "description": "The date, fixed, of the document's creation",
              "immutable": true,
              "name": "createdAt",
            },
            Object {
              "description": "The date of the document's last update",
              "immutable": false,
              "name": "updatedAt",
            },
            Object {
              "description": "The user's username",
              "immutable": true,
              "name": "username",
            },
          ],
          "identifier": Object {
            "name": "_id",
          },
          "inverseRelationMap": Array [
            Object {
              "description": "\\"Article.moderator\\"'s inverse relation",
              "name": "articles",
            },
          ],
          "name": "User",
          "plural": "Users",
          "relationMap": Array [],
          "uniqueSet": Array [
            Object {
              "name": "_id",
            },
            Object {
              "name": "id",
            },
            Object {
              "name": "username",
            },
          ],
        },
      ]
    `);
  });
});
