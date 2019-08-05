import { GraphQLRequest } from '../../graphql-platform';

export const request: GraphQLRequest = {
  source: `
    mutation (
      $deleted_category_03_id: CategoryWhereUniqueInput!,
      $article_01_update_without_modification: ArticleUpdateInput!,

      $article_01_id: ArticleWhereUniqueInput!,
      $article_01_update: ArticleUpdateInput!,

      $article_02_id: ArticleWhereUniqueInput!,
      $article_02_update: ArticleUpdateInput!,

      $article_tag_comment_01: ArticleTagCommentCreateInput!,

      $user_02_id: UserWhereUniqueInput!,
      $user_02_update: UserUpdateInput!,
    ) {
      # We can delete a node ...
      deleted_category_03: deleteCategory(where: $deleted_category_03_id) { title }
      # ... only once
      post_delete_category_03: deleteCategory(where: $deleted_category_03_id) { title }

      # We can update a node without modification
      not_updated_article_01: updateArticle(data: $article_01_update_without_modification, where: $article_01_id) {
        moderator {
          id
        }
      }

      # We can update regular fields
      updated_article_01: updateArticle(data: $article_01_update, where: $article_01_id) {
        title
        body
      }

      # We can disconnect a related node
      updated_article_02: updateArticle(data: $article_02_update, where: $article_02_id) {
        publishedAt
        isPublished
        moderator {
          id
        }
      }

      updated_user_02: updateUser(data: $user_02_update, where: $user_02_id) {
        moderatorOfArticles(first: 5) {
          slug
        }
      }
    }
  `,
  variableValues: {
    deleted_category_03_id: {
      id: 'da8d3a79-6161-46cd-a9fa-ae1382428d3c',
    },

    article_01_update_without_modification: {
      moderator: {
        disconnect: true,
      },
    },

    article_01_id: {
      category: {
        id: 'e411a5dc-a14f-4d0d-ac54-d4c93c7c5b84',
      },
      slug: 'my-first-article-title-rich-authored-by-user-01-in-the-second-category',
    },

    article_01_update: {
      title: "My new first article's title",
      body: "My new first article's body",
    },

    article_02_id: {
      category: {
        id: '8fdec553-453e-442f-a710-c52ee4a23080',
      },
      slug: 'my-second-article-title-video-authored-by-user-01-in-the-first-category',
    },

    article_02_update: {
      publishedAt: '2019-06-10T12:10:37.000Z',
      moderator: {
        disconnect: true,
      },
    },

    category_02_id: {
      id: 'e411a5dc-a14f-4d0d-ac54-d4c93c7c5b84',
    },

    user_02_id: {
      id: '3f0db991-e57c-4bf0-ac65-ca5a9d024ac5',
    },

    user_02_update: {
      moderatorOfArticles: {
        disconnect: [
          {
            id: '06bd57da-24f6-488a-a1b1-2435bd7c8d6e',
          },
        ],
      },
    },
  },
};

export const response = {
  deleted_category_03: {
    title: 'Third category',
  },
  post_delete_category_03: null,

  not_updated_article_01: {
    moderator: null,
  },
  updated_article_01: {
    title: "My new first article's title",
    body: "My new first article's body",
  },

  updated_article_02: {
    publishedAt: '2019-06-10T12:10:37.000Z',
    isPublished: true,
    moderator: null,
  },

  article_tag_comment_01: {
    body: 'My first article tag comment, on first article & first tag',
    articleTag: {
      article: {
        id: '955b343b-a6f5-4ca7-b19d-a643e2b40439',
      },
      tag: {
        id: '7636d577-397f-430c-8bed-bfe0d765af07',
      },
    },
  },

  updated_user_02: {
    moderatorOfArticles: [],
  },
};
