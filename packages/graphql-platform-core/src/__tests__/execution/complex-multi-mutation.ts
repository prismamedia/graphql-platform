import { Request } from '../../graphql-platform';

export const request: Request = {
  source: `mutation (
      $user_01: UserCreateInput!,
      $category_00: CategoryCreateInput!,
      $category_01: CategoryCreateInput!,
      $category_02: CategoryCreateInput!,
      $category_03_to_be_deleted: CategoryCreateInput!,
      $category_03_id: CategoryWhereUniqueInput!,
      $tag_01: TagCreateInput!,
      $tag_02: TagCreateInput!,
      $tag_03: TagCreateInput!,
      $tag_04: TagCreateInput!,
      $article_01: ArticleCreateInput!,
      $article_tag_01: ArticleTagCreateInput!,
      $article_02: ArticleCreateInput!,
      $article_tag_02: ArticleTagCreateInput!,
      $article_tag_03: ArticleTagCreateInput!,
      $article_tag_04: ArticleTagCreateInput!,
      $article_tag_05: ArticleTagCreateInput!,
      $article_01_update_without_modification: ArticleUpdateInput!,
      $article_01_update: ArticleUpdateInput!,
      $article_01_id: ArticleWhereUniqueInput!,
      $article_02_update: ArticleUpdateInput!,
      $article_02_id: ArticleWhereUniqueInput!,
      $article_tag_comment_01: ArticleTagCommentCreateInput!,
    ) {
    user_01: createUser(data: $user_01) {
      id
      username
    }

    category_00: createCategory(data: $category_00) {
      id
      slug
    }

    category_01: createCategory(data: $category_01) {
      id
      slug
    }

    category_02: createCategory(data: $category_02) {
      id
      slug
    }

    category_03_to_be_deleted: createCategory(data: $category_03_to_be_deleted) {
      id
      slug
    }

    deleted_category_03: deleteCategory(where: $category_03_id) {
      title
    }

    tag_01: createTag(data: $tag_01) {
      id
      slug
    }

    tag_02: createTag(data: $tag_02) {
      id
      slug
    }

    tag_03: createTag(data: $tag_03) {
      id
      slug
    }

    tag_04: createTag(data: $tag_04) {
      id
      slug
    }

    article_01: createArticle(data: $article_01) {
      id
      slug
      publishedAt
      author {
        username
      }
      moderator {
        username
      }
      category {
        parent {
          id
        }
        slug
      }
      tagCount
      tags(first: 1) {
        tag {
          title
        }
      }
    }

    article_tag_01: createArticleTag(data: $article_tag_01) {
      article {
        title
        tagCount
      }
      tag {
        title
        articleCount
      }
      comment {
        body
      }
    }

    article_02: createArticle(data: $article_02) {
      id
      slug
      lowerCasedTitle
      author {
        username
      }
      moderator {
        username
      }
      category {
        parent {
          id
        }
        slug
      }
      tagCount
      tags(first: 5) {
        tag {
          slug
        }
      }
    }

    article_tag_02: createArticleTag(data: $article_tag_02) {
      article {
        title
        tagCount
      }
      tag {
        title
        articleCount
      }
      comment {
        body
      }
    }

    article_tag_03: createArticleTag(data: $article_tag_03) {
      article {
        title
        tagCount
      }
      tag {
        title
        articleCount
      }
    }

    article_tag_04: createArticleTag(data: $article_tag_04) {
      article {
        title
        tagCount
      }
      tag {
        title
        articleCount
      }
    }

    article_tag_05: createArticleTag(data: $article_tag_05) {
      article {
        title
        tagCount
      }
      tag {
        title
        articleCount
      }
    }

    not_updated_article_01: updateArticle(data: $article_01_update_without_modification, where: $article_01_id) {
      title
      body
    }

    updated_article_01: updateArticle(data: $article_01_update, where: $article_01_id) {
      title
      body
    }

    updated_article_02: updateArticle(data: $article_02_update, where: $article_02_id) {
      moderator {
        id
      }
    }

    article_tag_comment_01: createArticleTagComment(data: $article_tag_comment_01) {
      body
      articleTag {
        article {
          id
        }
        tag {
          id
        }
      }
    }
  }`,
  variableValues: {
    user_01: {
      id: '771ad98a-5b88-4d1d-a3f3-9133d367b708',
      username: 'user-01',
    },

    category_00: {
      id: '92dc645e-c5ee-46ac-8a24-53b1584e4c99',
      title: 'Root category',
    },

    category_01: {
      id: '8fdec553-453e-442f-a710-c52ee4a23080',
      title: 'First category',
      parent: {
        connect: {
          id: '92dc645e-c5ee-46ac-8a24-53b1584e4c99',
        },
      },
    },

    category_02: {
      id: 'e411a5dc-a14f-4d0d-ac54-d4c93c7c5b84',
      title: 'Second category',
      parent: {
        connect: {
          id: '92dc645e-c5ee-46ac-8a24-53b1584e4c99',
        },
      },
    },

    category_03_to_be_deleted: {
      id: 'da8d3a79-6161-46cd-a9fa-ae1382428d3c',
      title: 'Third category, to be deleted',
      parent: {
        connect: {
          id: '92dc645e-c5ee-46ac-8a24-53b1584e4c99',
        },
      },
    },

    category_03_id: {
      id: 'da8d3a79-6161-46cd-a9fa-ae1382428d3c',
    },

    tag_01: {
      id: '7636d577-397f-430c-8bed-bfe0d765af07',
      title: 'First tag',
    },

    tag_02: {
      id: '21b31331-c5cc-4426-b648-4b0f14232866',
      title: 'Second tag',
    },

    tag_03: {
      id: '810629d2-3391-480e-ba9a-5e77999f6c72',
      title: 'Third tag',
    },

    tag_04: {
      id: '6af9c25e-2072-468f-8190-3c205165fe38',
      title: 'Fourth tag',
    },

    article_01: {
      format: 'Rich',
      title: 'My first article title, RICH, authored by user-01, in the second category.',
      publishedAt: '2019-06-01T12:10:37.829Z',
      author: {
        connect: {
          id: '771ad98a-5b88-4d1d-a3f3-9133d367b708',
        },
      },
      category: {
        connect: {
          id: 'e411a5dc-a14f-4d0d-ac54-d4c93c7c5b84',
        },
      },
    },

    article_tag_01: {
      order: 0,
      article: {
        connect: {
          category: {
            id: 'e411a5dc-a14f-4d0d-ac54-d4c93c7c5b84',
          },
          slug: 'my-first-article-title-rich-authored-by-user-01-in-the-second-category',
        },
      },
      tag: {
        connect: {
          slug: 'first-tag',
        },
      },
    },

    article_02: {
      id: 'e672258b-0870-437b-b440-e62848b4f666',
      format: 'Video',
      title: 'My second article title, VIDEO, authored by user-01, in the first category.',
      author: {
        create: {
          id: 'ced8fc85-cd9f-4db7-abfb-546fa8c71cd7',
          username: 'a-new-user-created-in-the-nested-mutation',
        },
      },
      moderator: {
        connect: {
          id: '771ad98a-5b88-4d1d-a3f3-9133d367b708',
        },
      },
      category: {
        connect: {
          id: '8fdec553-453e-442f-a710-c52ee4a23080',
        },
      },
    },

    article_tag_02: {
      order: 0,
      article: {
        connect: {
          category: {
            id: '8fdec553-453e-442f-a710-c52ee4a23080',
          },
          slug: 'my-second-article-title-video-authored-by-user-01-in-the-first-category',
        },
      },
      tag: {
        connect: {
          slug: 'second-tag',
        },
      },
    },

    article_tag_03: {
      order: 1,
      article: {
        connect: {
          category: {
            id: '8fdec553-453e-442f-a710-c52ee4a23080',
          },
          slug: 'my-second-article-title-video-authored-by-user-01-in-the-first-category',
        },
      },
      tag: {
        connect: {
          slug: 'third-tag',
        },
      },
    },

    article_tag_04: {
      order: 2,
      article: {
        connect: {
          category: {
            id: '8fdec553-453e-442f-a710-c52ee4a23080',
          },
          slug: 'my-second-article-title-video-authored-by-user-01-in-the-first-category',
        },
      },
      tag: {
        connect: {
          slug: 'fourth-tag',
        },
      },
    },

    article_tag_05: {
      order: 3,
      article: {
        connect: {
          category: {
            id: '8fdec553-453e-442f-a710-c52ee4a23080',
          },
          slug: 'my-second-article-title-video-authored-by-user-01-in-the-first-category',
        },
      },
      tag: {
        connect: {
          slug: 'first-tag',
        },
      },
    },

    article_01_update_without_modification: {
      moderator: {
        disconnect: true,
      },
    },

    article_01_update: {
      title: "My new first article's title",
      body: "My new first article's body",
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

    article_02_update: {
      moderator: {
        disconnect: true,
      },
    },

    article_02_id: {
      category: {
        id: '8fdec553-453e-442f-a710-c52ee4a23080',
      },
      slug: 'my-second-article-title-video-authored-by-user-01-in-the-first-category',
    },

    article_tag_comment_01: {
      body: 'My first article tag comment, on first article & first tag',
      articleTag: {
        connect: {
          article: {
            category: {
              id: 'e411a5dc-a14f-4d0d-ac54-d4c93c7c5b84',
            },
            slug: 'my-first-article-title-rich-authored-by-user-01-in-the-second-category',
          },
          tag: {
            slug: 'first-tag',
          },
        },
      },
    },
  },
};

export default request;
