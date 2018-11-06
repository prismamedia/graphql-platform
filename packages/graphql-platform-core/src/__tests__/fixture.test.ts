import { graphqlPlatform } from '.';
import { Resource } from '../graphql-platform/resource';

describe('Fixture', () => {
  const fixturePath = `${__dirname}/fixtures`;
  const fixtures = graphqlPlatform.getFixtureGraph(fixturePath);

  it('gets sorted fixtures', () => {
    expect(fixtures.size()).toBe(23);
    expect(fixtures.overallOrder()).toEqual([
      'category_01',
      'category_02',
      'user_01',
      'article_01',
      'tag_03',
      'article_01_tag_03',
      'tag_04',
      'article_01_tag_04',
      'category_04',
      'user_02',
      'article_02',
      'article_02_tag_04',
      'tag_05',
      'article_02_tag_05',
      'tag_01',
      'article_01_tag_01',
      'article_01_tag_01_comment',
      'tag_02',
      'article_01_tag_02',
      'article_01_tag_02_comment',
      'article_01_url',
      'article_01_url_comment',
      'category_03',
    ]);
  });

  it('creates GraphQL mutations', () => {
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

          return fixtures.getNodeData(fixtureName).getCreateMutationSource();
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
      ]
    `);
  });
});
