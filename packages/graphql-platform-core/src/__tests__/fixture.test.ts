import { Resource } from '../graphql-platform/resource';
import { config, MyGP } from './gp';

describe('Fixture', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new MyGP(config);
  });

  it('gets sorted fixtures', () => {
    const fixtures = gp.getFixtureGraph();

    expect(fixtures.overallOrder()).toEqual([
      'category_0',
      'category_3',
      'category_1',
      'user_0',
      'user_3',
      'article_1',
      'user_4',
      'user_2',
      'article_8',
      'user_1',
      'article_2',
      'tag_4',
      'articleTag_article_2-tag_4',
      'tag_3',
      'articleTag_article_2-tag_3',
      'tag_2',
      'articleTag_article_2-tag_2',
      'article_3',
      'tag_0',
      'articleTag_article_3-tag_0',
      'category_2',
      'article_4',
      'articleTag_article_4-tag_3',
      'articleTag_article_4-tag_0',
      'article_5',
      'articleTag_article_5-tag_2',
      'article_7',
      'articleTag_article_7-tag_3',
      'articleTag_article_7-tag_2',
      'article_9',
      'articleTag_article_9-tag_4',
      'articleUrl_article_5',
      'article_0',
      'articleUrl_article_0',
      'articleUrlMeta_articleUrl_article_0',
      'articleUrl_article_9',
      'articleUrlMeta_articleUrl_article_9',
      'tag_1',
      'articleTag_article_0-tag_1',
      'articleTagComment_articleTag_article_0-tag_1',
      'articleTag_article_4-tag_1',
      'articleTagComment_articleTag_article_4-tag_1',
      'articleTag_article_5-tag_0',
      'articleTagComment_articleTag_article_5-tag_0',
      'category_4',
      'article_6',
      'articleTag_article_6-tag_3',
      'articleTagComment_articleTag_article_6-tag_3',
      'articleTag_article_6-tag_1',
      'articleTagComment_articleTag_article_6-tag_1',
      'articleTag_article_6-tag_2',
      'articleTagComment_articleTag_article_6-tag_2',
    ]);
  });

  it('creates GraphQL mutations', () => {
    const fixtures = gp.getFixtureGraph();
    const visitedResourceSet = new Set<Resource>();

    expect(
      fixtures
        .overallOrder()
        .map(fixtureName => {
          const fixture = fixtures.getNodeData(fixtureName);

          if (visitedResourceSet.has(fixture.resource)) {
            return null;
          } else {
            visitedResourceSet.add(fixture.resource);
          }

          return fixture.getCreateMutationSource();
        })
        .filter(Boolean),
    ).toMatchInlineSnapshot(`
      Array [
        "mutation ($data: CategoryCreateInput!) {
        id: createCategory(data: $data) {
          id
        }
      }",
        "mutation ($data: UserCreateInput!) {
        id: createUser(data: $data) {
          id
        }
      }",
        "mutation ($data: ArticleCreateInput!) {
        id: createArticle(data: $data) {
          id
        }
      }",
        "mutation ($data: TagCreateInput!) {
        id: createTag(data: $data) {
          id
        }
      }",
        "mutation ($data: ArticleTagCreateInput!) {
        id: createArticleTag(data: $data) {
          article {
            id
          }
          tag {
            id
          }
        }
      }",
        "mutation ($data: ArticleUrlCreateInput!) {
        id: createArticleUrl(data: $data) {
          article {
            id
          }
        }
      }",
        "mutation ($data: ArticleUrlMetaCreateInput!) {
        id: createArticleUrlMeta(data: $data) {
          url {
            article {
              id
            }
          }
        }
      }",
        "mutation ($data: ArticleTagCommentCreateInput!) {
        id: createArticleTagComment(data: $data) {
          articleTag {
            article {
              id
            }
            tag {
              id
            }
          }
        }
      }",
      ]
    `);
  });
});
