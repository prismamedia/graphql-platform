import { Resource } from '../graphql-platform/resource';
import { config, MyGP } from './gp';

describe('Fixture', () => {
  let gp: MyGP;
  const fixturePath = `${__dirname}/fixtures`;

  beforeAll(() => {
    gp = new MyGP(config);
  });

  it('gets sorted fixtures', () => {
    const fixtures = gp.getFixtureGraph(fixturePath);

    expect(fixtures.size()).toBe(24);
    expect(fixtures.overallOrder()).toEqual([
      'category_01',
      'category_03',
      'user_01',
      'article_03',
      'category_02',
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
    ]);
  });

  it('creates GraphQL mutations', () => {
    const fixtures = gp.getFixtureGraph(fixturePath);
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
