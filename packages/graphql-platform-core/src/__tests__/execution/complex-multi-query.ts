import { Request } from '../../graphql-platform';

export const request: Request = {
  source: `
    query (
      $articleWhere: ArticleWhereInput!,
      $article_00: ArticleWhereUniqueInput!,
      $article_01: ArticleWhereUniqueInput!,
      $article_02: ArticleWhereUniqueInput!,
      $article_03: ArticleWhereUniqueInput!,
      $article_04: ArticleWhereUniqueInput!,
      $article_05: ArticleWhereUniqueInput!
    ) {
      articleCount(where: $articleWhere)

      articles(where: $articleWhere, orderBy: [createdAt_DESC], first: 25) {
        id
        format
        lowerCasedTitle
        mostImportantTags: tags(orderBy: [order_ASC], first: 5) {
          ...articleTag
        }
        leastImportantTags: tags(orderBy: [order_DESC], first: 5) {
          ...articleTag
        }
        leastImportantTagsLong: tags(where: { tag: { slug: "tv" } }, orderBy: [order_ASC], first: 10) {
          ...articleTag
        }
        category {
          id
          slug
          parent {
            id
            title
          }
        }
        sameCategoryWithDifferentFieldSelection: category {
          title
        }
      }

      article_00: article(where: $article_00) {
        id
      }

      article_01: article(where: $article_01) {
        id
      }

      article_02: article(where: $article_02) {
        id
      }

      article_03: article(where: $article_03) {
        id
      }

      article_04: article(where: $article_04) {
        id
      }

      article_05: article(where: $article_05) {
        id
      }
    }

    fragment articleTag on ArticleTag {
      tag {
        id
        title
        articleCount
        articles(orderBy: [createdAt_DESC], first: 5) {
          article {
            id
            slug
          }
        }
      }
      comment {
        body
      }
    }
  `,
  variableValues: {
    articleWhere: {
      format: 'Rich',
      createdAt_gte: '2000-01-01T00:00:00.000Z',
      OR: [
        { moderator_is_null: false },
        {
          category: null,
        },
        {
          category: {
            parent: null,
            slug: 'my-category-slug-with-null-parent',
          },
        },
        {
          category: {
            parent: {
              _id: 42,
            },
            slug: 'my-category-slug-with-defined-parent',
          },
        },
        {
          category: {
            parent: {
              id: '8fdec553-453e-442f-a710-c52ee4a23080',
            },
            slug: 'my-category-slug-with-defined-parent',
          },
        },
        {
          category: {
            OR: [{ parent: null }, { parent_is_null: null }, { parent_is_null: true }, { parent_is_null: false }],
            slug: 'news',
          },
        },
      ],
      tags_some: {
        tag: {
          NOT: { slug_in: ['tv', 'news'] },
          slug_in: ['space', 'geo'],
        },
      },
      author: {
        username: 'a-valid-username',
      },
    },
    article_00: {
      _id: 5,
    },
    article_01: {
      id: 'a3c2e74f-005e-471e-849c-b0025cb84a88',
    },
    article_02: {
      category: {
        _id: 10,
      },
      slug: 'a-valid-article-slug',
    },
    article_03: {
      category: {
        id: 'b2833d86-7f24-43f7-aebb-a7afc12805b9',
      },
      slug: 'a-valid-article-slug',
    },
    article_04: {
      category: {
        parent: {
          id: '640cebd6-1f97-403a-a246-c758d72f4b0e',
        },
        slug: 'a-valid-category-slug',
      },
      slug: 'a-valid-article-slug',
    },
    article_05: {
      category: {
        parent: null,
        slug: 'a-valid-category-slug',
      },
      slug: 'a-valid-article-slug',
    },
  },
};

export default request;
