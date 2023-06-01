import type { PartialDeep } from 'type-fest';
import { NodeFixtureData } from '../../node/fixture.js';
import type { NodeFixtureDataByReferenceByNodeName } from '../../seeding.js';
import { ArticleStatus, ArticleStatusUtils } from '../config.js';

const getRandomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const getRandomBoolean = (ratio: number = 0.5) => Math.random() <= ratio;

const getRandomArrayValue = <T>(values: ReadonlyArray<T>): T =>
  values[getRandomInt(0, values.length - 1)];

export type RandomFixtureConfig = {
  Category: { count: number };
  Tag: { count: number };
  User: { count: number };
  Article: {
    count: number;
    category: number;
    tags: { count: { min: number; max: number } };
    extension: number;
  };
};

export type RandomFixtureOptions = PartialDeep<RandomFixtureConfig>;

const defaultConfig = {
  Category: { count: 25 },
  Tag: { count: 50 },
  User: { count: 10 },
  Article: {
    count: 100,
    category: 4 / 5,
    tags: { count: { min: 0, max: 5 } },
    extension: 1 / 10,
  },
} satisfies RandomFixtureConfig;

export default function (
  options?: RandomFixtureOptions,
): NodeFixtureDataByReferenceByNodeName {
  const config: RandomFixtureConfig = {
    Category: {
      count: options?.Category?.count ?? defaultConfig.Category.count,
    },
    Tag: {
      count: options?.Tag?.count ?? defaultConfig.Tag.count,
    },
    User: {
      count: options?.User?.count ?? defaultConfig.User.count,
    },
    Article: {
      count: options?.Article?.count ?? defaultConfig.Article.count,
      category: options?.Article?.category ?? defaultConfig.Article.category,
      tags: {
        count: {
          min:
            options?.Article?.tags?.count?.min ??
            defaultConfig.Article.tags.count.min,
          max:
            options?.Article?.tags?.count?.max ??
            defaultConfig.Article.tags.count.max,
        },
      },
      extension: options?.Article?.extension ?? defaultConfig.Article.extension,
    },
  };

  return {
    Category: Object.fromEntries(
      Array.from(new Array(config.Category.count), (_, index) => [
        `category_${index}`,
        {
          parent: index === 0 ? null : `category_0`,
          order: index === 0 ? 0 : index - 1,
          title: `My category #${index}`,
        },
      ]),
    ),
    Tag: Object.fromEntries(
      Array.from(new Array(config.Tag.count), (_, index) => [
        `tag_${index}`,
        {
          title: `My tag #${index}`,
        },
      ]),
    ),
    User: Object.fromEntries(
      Array.from(new Array(config.User.count), (_, index) => [
        `user_${index}`,
        {
          username: `my_username_#${index}`,
        },
      ]),
    ),
    Article: Object.fromEntries(
      Array.from(new Array(config.Article.count), (_, index) => [
        `article_${index}`,
        {
          title: `My article #${index}`,
          ...(getRandomBoolean(config.Article.category)
            ? {
                category: `category_${getRandomInt(
                  0,
                  config.Category.count - 1,
                )}`,
                status: getRandomArrayValue(ArticleStatusUtils.values),
              }
            : {
                // Without a category, the article cannot be published
                status: getRandomArrayValue(
                  ArticleStatusUtils.values.filter(
                    (status) => status !== ArticleStatus.PUBLISHED,
                  ),
                ),
              }),
          tags: Array.from(
            new Array(
              getRandomInt(
                config.Article.tags.count.min,
                config.Article.tags.count.max,
              ),
            ),
            (_, index): NodeFixtureData => ({
              tag: `tag_${index}`,
              order: index,
            }),
          ),
          ...(getRandomBoolean(config.Article.extension) && {
            extension: { source: `My article #${index}'s source` },
          }),
        },
      ]),
    ),
  };
}
