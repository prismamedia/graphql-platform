import { getGraphQLEnumType } from '@prismamedia/graphql-platform-utils';
import { GraphQLBoolean, GraphQLNonNull, GraphQLString } from 'graphql';
import { GraphQLDate, GraphQLDateTime, GraphQLTime } from 'graphql-iso-date';
import slug from 'slug';
import { ManagementKind, ResourceHookKind } from '../..';
import { MyResourceConfig } from '../gp';

export enum ArticleFormat {
  Rich = 'RICH',
  Video = 'VIDEO',
}

export const ArticleFormatType = getGraphQLEnumType('ArticleFormat', ArticleFormat);

export enum ArticleQualifier {
  Hot = 'HOT',
  Cold = 'COLD',
  Slideshow = 'SLIDESHOW',
}

export const ArticleQualifierType = getGraphQLEnumType('ArticleQualifier', ArticleQualifier);

const resource: MyResourceConfig = {
  description: 'An article',
  uniques: [['category', 'slug']],
  fields: {
    format: {
      type: ArticleFormatType,
      nullable: false,
    },
    title: {
      type: GraphQLString,
      nullable: false,
      description: "The article's title",
    },
    slug: {
      type: GraphQLString,
      description: "The article's slug",
      nullable: false,
      immutable: true,
      managed: ManagementKind.Optional,
      hooks: {
        [ResourceHookKind.PreCreate]: event => {
          if (event.fieldValue == null) {
            const title = event.metas.create.title;

            event.fieldValue = typeof title === 'string' ? slug(title, { lower: true }) : null;
          }
        },
      },
    },
    // metas: {
    //   type: GraphQLString,
    //   // list: true,
    // },
    // qualifiers: {
    //   type: QualifierType,
    //   nullable: false,
    //   // list: true,
    // },
    body: {
      type: GraphQLString,
      description: "The article's body",
    },
    publishedAt: {
      type: GraphQLDateTime,
      description: "The date of the document's public release",
    },
    publicationDay: {
      type: GraphQLDate,
      description: "The day of the document's public release",
      nullable: true,
      immutable: true,
      managed: ManagementKind.Full,
      hooks: {
        [ResourceHookKind.PreCreate]: event => {
          event.fieldValue = event.metas.create.publishedAt instanceof Date ? event.fieldValue : null;
        },
      },
    },
    publicationTime: {
      type: GraphQLTime,
      description: "The time of the document's public release",
      nullable: true,
      immutable: true,
      managed: ManagementKind.Full,
      hooks: {
        [ResourceHookKind.PreCreate]: event => {
          event.fieldValue = event.metas.create.publishedAt instanceof Date ? event.fieldValue : null;
        },
      },
    },
    isPublished: {
      type: GraphQLBoolean,
      description: 'Either this article is published or not',
      managed: ManagementKind.Full,
      hooks: {
        [ResourceHookKind.PreCreate]: event => {
          event.fieldValue =
            event.metas.create.publishedAt instanceof Date && event.metas.create.publishedAt <= new Date();
        },
        [ResourceHookKind.PreUpdate]: event => {
          if (typeof event.metas.update.publishedAt !== 'undefined') {
            event.fieldValue =
              event.metas.update.publishedAt instanceof Date && event.metas.update.publishedAt <= new Date();
          }
        },
      },
    },
    isImportant: {
      type: GraphQLBoolean,
      description: 'Either this article is important or not',
    },
  },
  relations: {
    category: {
      description: "The article's category",
      to: 'Category',
      unique: 'parent-slug',
      nullable: false,
    },
    author: {
      to: 'User',
      unique: 'username',
      nullable: false,
      inversedBy: 'authorOfArticles',
    },
    moderator: {
      to: 'User',
      inversedBy: 'moderatorOfArticles',
    },
  },
  virtualFields: {
    lowerCasedTitle: {
      description: 'Exemple of virtual field dependant of the field "title".',
      type: GraphQLNonNull(GraphQLString),
      dependencies: ['title', 'category'],
      resolve: ({ title, category }, args, { debug, myService, api }) =>
        typeof title === 'string'
          ? `LowerCasedTitle: "${title.toLowerCase()}" in category "${JSON.stringify(category)}"`
          : '',
    },
  },
  filter: ({ debug, myService }) => ({
    format_in: [ArticleFormat.Rich, ArticleFormat.Video],
  }),
  hooks: {
    [ResourceHookKind.PreCreate]: ({
      metas: {
        context: { logger },
      },
      create,
    }) => {
      logger && logger.info(`Will create "${create.format}" article: ${create.title}`);
    },
    [ResourceHookKind.PostCreate]: ({
      metas: {
        context: { logger },
      },
      createdNode,
    }) => {
      logger && logger.info(`Created "${createdNode.format}" article: ${createdNode.title}`);
    },
  },
};

export default resource;
