import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import { randomUUID } from 'node:crypto';
import type { Except } from 'type-fest';
import {
  AbstractDeletion,
  AbstractQuery,
  GraphQLPlatform,
  OnEdgeHeadDeletion,
  type BrokerInterface,
  type ConnectorConfigOverride,
  type ConnectorConfigOverrideKind,
  type ConnectorInterface,
  type CustomOperationsByNameByTypeConfig,
  type Edge,
  type FullUniqueConstraintConfig,
  type GraphQLPlatformConfig,
  type Leaf,
  type Node,
  type NodeConfig,
  type UniqueConstraint,
  type UniqueConstraintConfig,
} from '../index.js';

export const slugify = (input: string, separator: string = '-'): string =>
  input
    .normalize('NFD') // split an accented letter in the base letter and the acent
    .replace(/[\u0300-\u036f]/g, '') // remove all previously split accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]/g, separator) // remove all chars not letters, numbers and spaces (to be replaced)
    .replace(/\s+/g, separator)
    .replace(new RegExp(`${separator}{2,}`, 'g'), separator);

export type MyUser = {
  id: string;
  name: string;
  role?: 'ADMIN' | 'JOURNALIST';
};

export interface MyContext {
  user?: MyUser;
}

export const myAdminContext = Object.freeze<MyContext>({
  user: Object.freeze<MyUser>({
    id: '4e08b305-7e81-4a67-9377-b06d5b900b55',
    name: 'My admin',
    role: 'ADMIN',
  }),
});

export const myJournalistContext = Object.freeze<MyContext>({
  user: Object.freeze<MyUser>({
    id: '5ff01840-8e75-4b18-baa1-90b51e7318cd',
    name: 'My journalist',
    role: 'JOURNALIST',
  }),
});

export const myUserContext = Object.freeze<MyContext>({
  user: Object.freeze<MyUser>({
    id: '247c2b6e-c1fe-443a-b40c-8f73dd9f1ed7',
    name: 'My simple user',
  }),
});

export const myVisitorContext = Object.freeze<MyContext>({});

export const PublicNodeInterfaceType = new graphql.GraphQLInterfaceType({
  name: 'PublicNodeInterface',
  description: 'Exemple of interface',
  fields: {
    id: {
      type: new graphql.GraphQLNonNull(scalars.typesByName.UUIDv4),
      description: 'Every public node have a public id',
    },
  },
});

export enum ArticleStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  DELETED = 'deleted',
}

export const ArticleStatusUtils = utils.createEnumUtils(ArticleStatus);

export const ArticleStatusType = utils.createGraphQLEnumType(
  'ArticleStatus',
  ArticleStatus,
);

class MyCustomQuery extends AbstractQuery<undefined, number> {
  readonly key = 'custom';
  readonly name = 'customArticles';
  override readonly description = 'Custom query to get articles';
  readonly selectionAware = false;

  async executeWithValidArgumentsAndContext() {
    return 0;
  }

  getGraphQLFieldConfigType() {
    return new graphql.GraphQLNonNull(scalars.typesByName.UnsignedInt);
  }
}

class MyCustomPrivateQuery extends AbstractQuery<undefined, number> {
  readonly key = 'customPrivate';
  readonly name = 'customPrivateArticles';
  override readonly description = 'Custom query, private, to get articles';
  readonly selectionAware = false;

  override isPublic() {
    return false;
  }

  async executeWithValidArgumentsAndContext() {
    return 0;
  }

  getGraphQLFieldConfigType() {
    return scalars.typesByName.UnsignedInt;
  }
}

class MyCustomDeletion extends AbstractDeletion<undefined, number> {
  readonly key = 'customDeletion';
  readonly name = 'customDeletionArticles';
  override readonly description = 'Custom deletion';
  readonly selectionAware = false;

  async executeWithValidArgumentsAndContext() {
    return 0;
  }

  getGraphQLFieldConfigType() {
    return scalars.typesByName.UnsignedInt;
  }
}

export const Article = {
  authorization({ user }, mutationType) {
    if (user) {
      switch (user.role) {
        case 'ADMIN':
          // They can do as they please
          return true;

        case 'JOURNALIST':
          return mutationType
            ? mutationType === utils.MutationType.CREATION
              ? // They can "create" new articles
                true
              : mutationType === utils.MutationType.UPDATE
                ? // They can "update" the articles they have created
                  { createdBy: { id: user.id } }
                : // They cannot "delete" articles
                  false
            : // They can "query" all the articles
              true;

        default:
          // The authenticated users can "query" the published articles but cannot mutate anything
          return mutationType ? false : { status: ArticleStatus.PUBLISHED };
      }
    }

    // Un-authenticated users cannot access articles at all
    return false;
  },

  description: `The article is the main resource, written by the journalists`,

  components: {
    _id: {
      kind: 'Leaf',
      type: 'UnsignedInt',
      description: 'This id is used to identify an Article internally',
      public: false,
      nullable: false,
      mutable: false,

      creation: {
        optional: true,
      },
    },
    id: {
      kind: 'Leaf',
      type: 'UUIDv4',
      description: 'This UUID identifies an Article publicly',
      nullable: false,
      mutable: false,

      creation: {
        defaultValue: () => randomUUID(),
        description:
          'You can either provide an UUID or let one be generated for you',
      },
    },
    status: {
      kind: 'Leaf',
      type: ArticleStatusType,
      nullable: false,

      creation: {
        defaultValue: ArticleStatus.DRAFT,
      },
    },
    title: {
      kind: 'Leaf',
      type: 'NonEmptySanitizedString',
      nullable: false,
    },
    slug: {
      kind: 'Leaf',
      type: 'Slug',
      nullable: false,

      creation: {
        description: `You can either provide a slug or let the title be "slugified" for you`,
        optional: true,
      },
    },
    body: {
      kind: 'Leaf',
      type: 'DraftJS',
      description: `The article's body`,
    },
    category: {
      kind: 'Edge',
      head: 'Category',
      onHeadDeletion: OnEdgeHeadDeletion.SET_NULL,
    },
    createdBy: {
      kind: 'Edge',
      head: 'User',
      mutable: false,

      creation: {
        public: false,
      },
    },
    createdAt: {
      kind: 'Leaf',
      type: 'DateTime',
      nullable: false,
      mutable: false,

      creation: {
        public: false,
        defaultValue: () => new Date(),
      },
    },
    updatedBy: {
      kind: 'Edge',
      head: 'User.username',

      creation: {
        public: false,
      },
    },
    updatedAt: {
      kind: 'Leaf',
      type: 'DateTime',
      nullable: false,

      creation: {
        public: false,
        defaultValue: () => new Date(),
      },

      update: {
        public: false,
        defaultValue: () => new Date(),
      },
    },
    metas: {
      kind: 'Leaf',
      type: 'JSONObject',
      description:
        'Contains any arbitrary data you want to store alongside the article',
    },
    highlighted: {
      kind: 'Leaf',
      type: 'Boolean',
      description: 'Is the article highlighted?',
    },
    sponsored: {
      kind: 'Leaf',
      type: 'Boolean',
      description: 'Is the article a partnership?',
    },
    views: {
      kind: 'Leaf',
      type: 'UnsignedBigInt',
      nullable: false,

      creation: {
        public: false,
        defaultValue: 0,
      },
    },
    score: {
      kind: 'Leaf',
      type: 'UnsignedFloat',
      nullable: false,

      creation: {
        public: false,
        defaultValue: 0.5,
      },
    },
    machineTags: {
      kind: 'Leaf',
      type: 'JSONArray',
    },
  },

  uniques: [['_id'], ['id'], ['category', 'slug']],

  reverseEdges: {
    tags: {
      originalEdge: 'ArticleTag.article',
      output: { defaultArgs: { orderBy: ['order_ASC'] } },
    },
    extension: {
      originalEdge: 'ArticleExtension.article',
    },
  },

  query: {
    customs: [(node) => new MyCustomQuery(node), MyCustomPrivateQuery],
  },

  mutation: {
    creation: {
      virtualFields: {
        htmlBody: {
          type: graphql.GraphQLString,
          description: `It is possible to provide the article's body as raw HTML`,
        },
      },

      async preCreate({ node, context: { request }, api, data, creation }) {
        if (!request.user) {
          throw new Error(`Must be logged-in`);
        }

        if (data['htmlBody']) {
          if (data['body']) {
            throw new Error(
              `Cannot provide both the 'htmlBody' and the 'body'`,
            );
          }

          // Custom logic with this field's value
          // creation['body'] = myHtmlToDraftService(data['htmlBody']);
        }

        creation['slug'] ??= slugify(creation['title'] as string);

        if (!creation['createdBy'] || !creation['updatedBy']) {
          const createdByEdge = node.getEdgeByName('createdBy');
          const updatedByEdge = node.getEdgeByName('updatedBy');

          const currentUser = await api.User.getOneIfExists({
            where: { id: request.user.id },
            selection:
              createdByEdge.referencedUniqueConstraint.selection.mergeWith(
                updatedByEdge.referencedUniqueConstraint.selection,
              ),
          });

          creation['createdBy'] ??= currentUser;
          creation['updatedBy'] ??= currentUser;
        }
      },

      postCreate({ change }) {},
    },

    update: {
      virtualFields: {
        htmlBody: {
          type: graphql.GraphQLString,
          description: `It is possible to provide the article's body as raw HTML`,
        },
      },

      async preUpdate({
        node,
        context: { request },
        api,
        data,
        current,
        update,
      }) {
        if (!request.user) {
          throw new Error(`Must be logged-in`);
        }

        if (data['htmlBody'] !== undefined) {
          if (data['body'] !== undefined) {
            throw new Error(
              `Cannot provide both the 'htmlBody' and the 'body'`,
            );
          }

          // Custom logic with this field's value
          // update['body'] = myHtmlToDraftService(data['htmlBody']);
        }

        if (current['status'] === ArticleStatus.DELETED) {
          throw new Error(`Cannot update a deleted article`);
        }

        if (update['title'] !== undefined) {
          update['slug'] = update['title']
            ? slugify(update['title'] as string)
            : null;
        }

        update['updatedBy'] ??= await api.User.getOneIfExists({
          where: { id: request.user.id },
          selection:
            node.getEdgeByName('updatedBy').referencedUniqueConstraint
              .selection,
        });
      },

      postUpdate({ change }) {},
    },

    deletion: {
      preDelete({ current }) {},

      postDelete({ change }) {},
    },

    customs: [MyCustomDeletion],
  },

  output: {
    virtualFields: (node) => ({
      lowerCasedTitle: {
        args: {
          prefix: {
            description: 'Optional, a prefix',
            type: graphql.GraphQLString,
          },
        },
        type: new graphql.GraphQLNonNull(
          scalars.typesByName.NonEmptyTrimmedString,
        ),
        description: `A custom field with a dependency`,
        dependsOn: ({ prefix }) => `{
          status
          title
          @include(if: ${prefix ? 'false' : 'true'})
          category {
            title
          }
        }`,
        resolve: (
          {
            status,
            title,
            category,
          }: {
            status: ArticleStatus;
            title: string;
            category: { title: string } | null;
          },
          { prefix },
        ) =>
          (<string[]>[prefix, status, title, category?.title])
            .filter(Boolean)
            .join('-')
            .toLowerCase(),
      },
      // An exemple of how to use the "Node" to build another custom field
      upperCasedTitle: {
        dependsOn: `{
          status
          title
          category {
            title
          }
          tags(orderBy: [order_ASC], first: 2) {
            tag {
              title
            }
          }
        }`,
        type: new graphql.GraphQLNonNull(node.getLeafByName('title').type),
        description: `A custom field with a dependency`,
        resolve: (
          {
            status,
            title,
            category,
            tags,
          }: {
            status: ArticleStatus;
            title: string;
            category: { title: string } | null;
            tags: { tag: { title: string } }[];
          },
          _args,
          _context,
          _selectionSet,
        ) =>
          (<string[]>[
            status,
            title,
            category?.title,
            ...tags.map(({ tag }) => tag.title),
          ])
            .filter(Boolean)
            .join('-')
            .toUpperCase(),
      },
      mixedCasedTitle: {
        description: `A virtual-field depending on other virtual-fields`,
        dependsOn: `{
          lowerCasedTitle
          upperCasedTitle
        }`,
        type: new graphql.GraphQLNonNull(node.getLeafByName('title').type),
        resolve: ({ lowerCasedTitle, upperCasedTitle }) =>
          [lowerCasedTitle, upperCasedTitle].join(' / '),
      },
      similars: () => ({
        args: () => ({
          first: {
            description: 'The number of similar articles to return',
            type: utils.nonNillableInputType(scalars.GraphQLUnsignedInt),
          },
        }),
        type: new graphql.GraphQLNonNull(
          new graphql.GraphQLList(
            new graphql.GraphQLNonNull(node.outputType.getGraphQLObjectType()),
          ),
        ),
        resolve: (_source, _args, _context, _info) => [],
      }),
    }),

    graphql: {
      interfaces: [PublicNodeInterfaceType],
    },
  },

  features: [
    {
      name: 'history',

      reverseEdges: (node) => ({
        histories: {
          originalEdge: `${node}History.article`,
        },
      }),

      associatedNodes: (node) => ({
        [`${node}History`]: {
          components: {
            article: {
              kind: 'Edge',
              head: node.name,
              mutable: false,
              nullable: false,
            },
            createdAt: { type: 'DateTime', mutable: false, nullable: false },
            message: {
              type: 'NonEmptyTrimmedString',
              mutable: false,
              nullable: false,
            },
          },
          uniques: [['article', 'createdAt']],
          mutation: { update: false },
        },
      }),

      services: {
        auditor: () => {},
      },
    },
  ],
} satisfies NodeConfig<MyContext>;

export const ArticleExtension = {
  components: {
    article: {
      kind: 'Edge',
      head: 'Article',
      nullable: false,
      mutable: false,
      onHeadDeletion: OnEdgeHeadDeletion.CASCADE,
    },
    source: {
      description: `The source of the article`,
      kind: 'Leaf',
      type: 'NonEmptyTrimmedString',
    },
  },

  uniques: [['article']],
} satisfies NodeConfig<MyContext>;

export const Category = {
  authorization: ({ user }, mutationType) =>
    mutationType
      ? // Only the "admins" can mutate the categories
        user?.role === 'ADMIN'
      : // Everybody can read the categories
        true,

  components: {
    _id: {
      kind: 'Leaf',
      type: 'UnsignedInt',
      public: false,
      nullable: false,
      mutable: false,

      creation: {
        optional: true,
      },
    },
    id: {
      kind: 'Leaf',
      type: 'UUIDv4',
      nullable: false,
      mutable: false,

      creation: {
        defaultValue: () => randomUUID(),
        description:
          'You can either provide an UUID or let one be generated for you',
      },
    },
    title: {
      kind: 'Leaf',
      type: 'NonEmptyTrimmedString',
      nullable: false,
      mutable: false,
    },
    slug: {
      kind: 'Leaf',
      type: 'NonEmptyTrimmedString',
      nullable: false,
      mutable: false,

      creation: {
        description: `You can either provide a slug or let the title be "slugified" for you`,
        optional: true,
      },
    },
    parent: {
      kind: 'Edge',
      head: 'Category',
      onHeadDeletion: OnEdgeHeadDeletion.CASCADE,
    },
    order: {
      kind: 'Leaf',
      type: 'UnsignedInt',
      nullable: false,
    },
  },

  uniques: [['_id'], ['id'], ['parent', 'slug'], ['parent', 'order']],

  reverseEdges: {
    children: {
      originalEdge: 'Category.parent',
      description: `This category's children`,
    },

    articles: {
      originalEdge: 'Article.category',
      description: `The articles attached to this category`,
    },
  },

  mutation: {
    creation: {
      virtualFields: {
        htmlBody: {
          type: graphql.GraphQLString,
          description: `It is possible to provide the article's body as raw HTML`,
        },
      },

      async preCreate({ node, api, context, data, creation }) {
        creation['slug'] ??= slugify(creation['title'] as string);

        if (creation['parent'] == null) {
          const categoryWithoutParentCount = await api[node.name].count({
            where: { parent: null },
          });

          if (categoryWithoutParentCount !== 0) {
            throw new utils.UnexpectedValueError(
              `a parent, as the "root" category already exists`,
              data['parent'],
            );
          }
        }

        if (creation['order'] == null) {
          // Get the "MAX(order)" of the categories having the same parent
          const categories = await api.Category.findMany({
            where: { parent: creation['parent'] ?? null },
            orderBy: ['order_DESC'],
            first: 1,
            selection: '{ order }',
          });

          return (categories[0]?.order ?? 0) + 1;
        }
      },
    },
  },

  output: {
    graphql: {
      interfaces: [PublicNodeInterfaceType],
    },
  },
} satisfies NodeConfig<MyContext>;

export const Tag = {
  authorization: ({ user }, mutationType) =>
    mutationType
      ? user?.role === 'ADMIN'
        ? // The "admins" can do as they please
          true
        : user?.role === 'JOURNALIST'
          ? // The "journalists" can only "create" tags
            mutationType === utils.MutationType.CREATION
          : // Others cannot mutate the tags
            false
      : // Everybody can read all the tags
        true,

  components: {
    id: {
      kind: 'Leaf',
      type: 'UUIDv4',
      nullable: false,
      mutable: false,
      sortable: true,

      creation: {
        defaultValue: () => randomUUID(),
        description:
          'You can either provide an UUID or let one be generated for you',
      },
    },
    deprecated: {
      kind: 'Leaf',
      type: 'Boolean',
      description: 'A tag can be deprecated',
    },
    title: {
      kind: 'Leaf',
      type: 'NonEmptyTrimmedString',
      nullable: false,
      mutable: false,
    },
    slug: {
      kind: 'Leaf',
      type: 'NonEmptyTrimmedString',
      nullable: false,
      mutable: false,

      creation: {
        description: `You can either provide a slug or let the title be "slugified" for you`,
        optional: true,
      },
    },
    createdAt: {
      kind: 'Leaf',
      type: 'DateTime',
      nullable: false,
      mutable: false,

      creation: {
        public: false,
        defaultValue: () => new Date(),
      },
    },
    updatedAt: {
      kind: 'Leaf',
      type: 'DateTime',
      nullable: false,

      creation: {
        public: false,
        defaultValue: () => new Date(),
      },

      update: {
        public: false,
        defaultValue: () => new Date(),
      },
    },
  },

  uniques: [['id'], ['slug']],

  reverseEdges: {
    articles: {
      originalEdge: 'ArticleTag.tag',
    },
  },

  output: {
    graphql: {
      interfaces: [PublicNodeInterfaceType],
    },
  },

  mutation: {
    creation: {
      preCreate({ creation }) {
        creation['slug'] ??= slugify(creation['title'] as string);
      },
    },
  },
} satisfies NodeConfig<MyContext>;

export const ArticleTag = {
  authorization: ({ user }, mutationType) =>
    mutationType
      ? user?.role === 'ADMIN'
        ? // The "admins" can do as they please
          true
        : user?.role === 'JOURNALIST'
          ? mutationType === utils.MutationType.CREATION
            ? // The "journalists" can link tags to the articles
              true
            : // The "journalists" can re-order/unlink tags to the articles they have created only
              { article: { createdBy: { id: user.id } } }
          : false
      : // Every connected user can "query" all the article-tag links
        user !== undefined,

  components: {
    article: {
      kind: 'Edge',
      head: 'Article',
      nullable: false,
      mutable: false,
      onHeadDeletion: OnEdgeHeadDeletion.CASCADE,
    },
    tag: {
      kind: 'Edge',
      head: 'Tag',
      nullable: false,
      mutable: false,
      onHeadDeletion: OnEdgeHeadDeletion.CASCADE,
    },
    order: {
      kind: 'Leaf',
      type: 'UnsignedInt',
      nullable: false,
    },
  },

  uniques: [
    ['article', 'tag'],
    ['article', 'order'],
  ],

  reverseEdges: {
    moderations: {
      originalEdge: 'ArticleTagModeration.articleTag',
    },
  },
} satisfies NodeConfig<MyContext>;

export const ArticleTagModeration = {
  authorization: ({ user }, mutationType) =>
    user?.role === 'ADMIN' || !mutationType,

  components: {
    articleTag: {
      kind: 'Edge',
      head: 'ArticleTag',
      nullable: false,
      mutable: false,
      onHeadDeletion: OnEdgeHeadDeletion.CASCADE,
    },
    moderator: {
      kind: 'Edge',
      head: 'User',
      nullable: false,
      mutable: false,
    },
    moderation: {
      kind: 'Leaf',
      type: 'NonEmptyTrimmedString',
    },
  },

  uniques: [['articleTag', 'moderator']],
} satisfies NodeConfig<MyContext>;

export const User = {
  authorization: ({ user }, mutationType) =>
    mutationType
      ? // Only the "admins" can mutate the users
        user?.role === 'ADMIN'
      : // Every connected user can read the users
        user !== undefined,

  components: {
    id: {
      kind: 'Leaf',
      type: 'UUIDv4',
      nullable: false,
      mutable: false,

      creation: {
        defaultValue: () => randomUUID(),
        description:
          'You can either provide an UUID or let one be generated for you',
      },
    },
    username: {
      kind: 'Leaf',
      type: 'NonEmptyTrimmedString',
      nullable: false,
      mutable: false,
    },
    createdAt: {
      kind: 'Leaf',
      type: 'DateTime',
      public: false,
      nullable: false,
      mutable: false,

      creation: {
        defaultValue: () => new Date(),
      },
    },
    lastLoggedInAt: {
      kind: 'Leaf',
      type: 'DateTime',
      public: false,
      nullable: true,
    },
  },

  uniques: [['id'], ['username']],

  reverseEdges: {
    createdArticles: {
      originalEdge: 'Article.createdBy',
      description: `All the articles this user has created`,
    },
    updatedArticles: {
      originalEdge: 'Article.updatedBy',
      description: `All the articles this user has updated`,
    },
    profile: {
      originalEdge: 'UserProfile.user',
      description: `This user's profile, only the optional informations`,
    },
    articleTagModerations: {
      originalEdge: 'ArticleTagModeration.moderator',
    },
  },

  mutation: {
    creation: { public: false },
    update: { public: false },
    deletion: { public: false },
  },

  output: {
    graphql: {
      interfaces: [PublicNodeInterfaceType],
    },
  },
} satisfies NodeConfig<MyContext>;

export const UserProfile = {
  authorization: ({ user }, mutationType) =>
    mutationType
      ? user?.role === 'ADMIN'
        ? // The "admins" can do as they please
          true
        : user !== undefined
          ? mutationType === utils.MutationType.UPDATE
            ? // Every connected user can "update" its profile only
              { user: { id: user.id } }
            : false
          : false
      : // Every connected user can "query" the profiles
        true,

  components: {
    user: {
      kind: 'Edge',
      head: 'User',
      nullable: false,
      mutable: false,
    },
    birthday: {
      kind: 'Leaf',
      type: 'Date',
    },
    facebookId: {
      kind: 'Leaf',
      type: 'ID',
    },
    googleId: {
      kind: 'Leaf',
      type: 'ID',
    },
    twitterHandle: {
      kind: 'Leaf',
      type: 'ID',
    },
  },

  uniques: [['user']],
} satisfies NodeConfig<MyContext>;

/**
 * "Log" is a private & immutable node
 */
export const Log = {
  public: false,

  mutation: {
    update: false,
    deletion: false,
  },

  components: {
    _id: {
      kind: 'Leaf',
      type: 'UnsignedInt',
      nullable: false,
    },
    message: {
      kind: 'Leaf',
      type: 'NonEmptyTrimmedString',
      nullable: false,
    },
    createdAt: {
      kind: 'Leaf',
      type: 'DateTime',
      nullable: false,

      creation: {
        defaultValue: () => new Date(),
      },
    },
  },

  uniques: [['_id']],
} satisfies NodeConfig<MyContext>;

export const nodes = {
  Article,
  ArticleExtension,
  Category,
  Tag,
  ArticleTag,
  ArticleTagModeration,
  User,
  UserProfile,
  Log,
} satisfies Record<string, NodeConfig<MyContext>>;

export const nodeNames = Object.keys(nodes);

export const customOperations: CustomOperationsByNameByTypeConfig<MyContext> = {
  query: {
    whoAmI: () => ({
      type: new graphql.GraphQLNonNull(graphql.GraphQLString),
      resolve: (_, args, context) =>
        `Hello ${context.user?.name ?? 'world'}, I'm GraphQL-Platform`,
    }),
  },
  // Can return undefined
  mutation: () => undefined,
  // Can be undefined
  subscription: undefined,
};

export type MyNodeConfig<
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
> = NodeConfig<MyContext, TConnector, TBroker, TContainer>;

export type MyGP<
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
> = GraphQLPlatform<MyContext, TConnector, TBroker, TContainer>;

export type NodeConfigOverride<TConnector extends ConnectorInterface> = (
  nodeName: Node['name'],
) =>
  | ConnectorConfigOverride<TConnector, ConnectorConfigOverrideKind.NODE>
  | undefined;

export type LeafConfigOverride<TConnector extends ConnectorInterface> = (
  leafName: Leaf['name'],
  nodeName: Node['name'],
) =>
  | ConnectorConfigOverride<TConnector, ConnectorConfigOverrideKind.LEAF>
  | undefined;

export type EdgeConfigOverride<TConnector extends ConnectorInterface> = (
  edgeName: Edge['name'],
  nodeName: Node['name'],
) =>
  | ConnectorConfigOverride<TConnector, ConnectorConfigOverrideKind.EDGE>
  | undefined;

export type UniqueConstraintConfigOverride<
  TConnector extends ConnectorInterface,
> = (
  uniqueIndex: number,
  uniqueName: UniqueConstraint['name'] | undefined,
  nodeName: Node['name'],
) =>
  | ConnectorConfigOverride<
      TConnector,
      ConnectorConfigOverrideKind.UNIQUE_CONSTRAINT
    >
  | undefined;

export type MyGPConfig<
  TConnector extends ConnectorInterface,
  TBroker extends BrokerInterface,
  TContainer extends object,
> = {
  overrides?: {
    node?: NodeConfigOverride<TConnector>;
    leaf?: LeafConfigOverride<TConnector>;
    edge?: EdgeConfigOverride<TConnector>;
    uniqueConstraint?: UniqueConstraintConfigOverride<TConnector>;
  };
} & Except<
  GraphQLPlatformConfig<MyContext, TConnector, TBroker, TContainer>,
  'nodes'
>;

export function createMyGP<
  TConnector extends ConnectorInterface,
  TBroker extends BrokerInterface,
  TContainer extends object,
>(
  config?: MyGPConfig<TConnector, TBroker, TContainer>,
): MyGP<TConnector, TBroker, TContainer> {
  return new GraphQLPlatform({
    nodes: Object.fromEntries(
      Object.entries(nodes).map(([nodeName, nodeConfig]) => [
        nodeName,
        {
          ...nodeConfig,

          ...(config?.overrides?.node?.(nodeName) as any),

          components:
            nodeConfig.components &&
            (config?.overrides?.edge || config?.overrides?.leaf)
              ? Object.fromEntries(
                  Object.entries(
                    utils.ensurePlainObject(nodeConfig.components),
                  ).map(([componentName, componentConfig]) => [
                    componentName,
                    {
                      ...componentConfig,

                      ...(componentConfig.kind === 'Edge'
                        ? config?.overrides?.edge?.(componentName, nodeName)
                        : config?.overrides?.leaf?.(componentName, nodeName)),
                    },
                  ]),
                )
              : nodeConfig.components,

          uniques:
            nodeConfig.uniques && config?.overrides?.uniqueConstraint
              ? utils
                  .ensureArray<UniqueConstraintConfig>(nodeConfig.uniques)
                  .map((unique, index) => {
                    const uniqueConstraintConfig: FullUniqueConstraintConfig =
                      Array.isArray(unique) ? { components: unique } : unique;

                    return {
                      ...uniqueConstraintConfig,

                      ...config?.overrides?.uniqueConstraint?.(
                        index,
                        uniqueConstraintConfig.name,
                        nodeName,
                      ),
                    };
                  })
              : nodeConfig.uniques,
        },
      ]),
    ),

    ...config,
  });
}
