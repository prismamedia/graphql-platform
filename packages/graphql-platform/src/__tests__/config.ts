import { Scalars } from '@prismamedia/graphql-platform-scalars';
import {
  GraphQLEnumType,
  GraphQLInterfaceType,
  GraphQLNonNull,
  GraphQLString,
} from 'graphql';
import { GraphQLPlatform, ModelConfig } from '..';
import { CustomOperationMap } from '../custom-operations';
import { NodeChangeKind } from '../model/operations';

export type MyUser = {
  id: string;
  name: string;
  role: 'ADMIN' | 'JOURNALIST' | 'VISITOR';
};

export type MyContext = {
  user: MyUser;
};

export const myAdminContext: MyContext = Object.freeze({
  user: Object.freeze<MyUser>({
    id: '4e08b305-7e81-4a67-9377-b06d5b900b55',
    name: 'My admin',
    role: 'ADMIN',
  }),
});

export const myJournalistContext: MyContext = Object.freeze({
  user: Object.freeze<MyUser>({
    id: '5ff01840-8e75-4b18-baa1-90b51e7318cd',
    name: 'My journalist',
    role: 'JOURNALIST',
  }),
});

export const myVisitorContext: MyContext = Object.freeze({
  user: Object.freeze<MyUser>({
    id: 'ae5ea62b-f518-4ab6-8dc0-438ad5deb0c4',
    name: 'My reader',
    role: 'VISITOR',
  }),
});

export const NodeInterfaceType = new GraphQLInterfaceType({
  name: 'NodeInterface',
  fields: {
    id: {
      type: GraphQLNonNull(Scalars.UUID),
    },
  },
});

export enum ArticleStatus {
  Draft = 'DRAFT',
  Published = 'PUBLISHED',
  Deleted = 'DELETED',
}

export const ArticleStatusType = new GraphQLEnumType({
  name: 'ArticleStatus',
  values: Object.fromEntries(
    Object.entries({
      Draft: ArticleStatus.Draft,
      Published: ArticleStatus.Published,
      Deleted: ArticleStatus.Deleted,
    }).map(([key, value]) => [key, { value }]),
  ),
});

export const Article: ModelConfig<MyContext> = {
  description: `The article is the main resource, written by the journalists`,

  filter: ({ requestContext: { user: myUser } }) =>
    myUser.role === 'ADMIN'
      ? // No filter for the "admins"
        true
      : myUser.role === 'JOURNALIST'
      ? // The "journalists" see only the articles they have created
        { createdBy: { id: myUser.id } }
      : // Others won't have access to any articles
        false,

  components: {
    _id: {
      kind: 'Leaf',
      type: 'PositiveInt',
      description: 'This id is used to identify an Article internally',
      public: false,
      immutable: true,

      // inputs: {
      //   creation: null,
      //   update: null,
      // },
    },
    id: {
      kind: 'Leaf',
      type: 'UUID',
      description: 'This UUID is used to identify an Article publicly',
      immutable: true,

      // inputs: {
      //   creation: {
      //     defaultValue: () => randomUUID(),
      //     description:
      //       'You can either provide an UUID or let one be generated for you',
      //   },
      //   update: null,
      // },
    },
    status: {
      kind: 'Leaf',
      type: ArticleStatusType,

      // inputs: {
      //   creation: {
      //     defaultValue: ArticleStatus.Draft,
      //   },
      //   update: {
      //     /**
      //      * An example of conditional dependencies:
      //      *  if the status is provided by the client
      //      *  -> let's get the current one to test against the workflow
      //      */
      //     dependsOnCurrent: ({ leafUpdate }) =>
      //       leafUpdate !== undefined
      //         ? ['status'] /** or "{ status }" */
      //         : undefined,

      //     preUpdate({ leafUpdate, current: { status } }) {
      //       if (leafUpdate !== undefined && status === ArticleStatus.Deleted) {
      //         throw new Error(
      //           `The status of a "Deleted" article cannot be changed`,
      //         );
      //       }
      //     },
      //   },
      // },
    },
    title: {
      kind: 'Leaf',
      type: 'NonEmptyTrimmedString',
    },
    slug: {
      kind: 'Leaf',
      type: 'NonEmptyTrimmedString',

      // inputs: {
      //   creation: {
      //     description: `You can either provide a slug or let the title be "slugified" for you`,
      //     optional: false,
      //     dependsOnCreation: ['title'],
      //     preCreate: ({ leafValue, creation: { title } }) =>
      //       leafValue || slugify(title, slugify.defaults.modes.rfc3986),
      //   },
      //   update: {
      //     /**
      //      * An example of conditional dependencies:
      //      *  if the status or the title is provided by the client while the slug is not
      //      *  -> let's get the current title and slug
      //      */
      //     dependsOnCurrent: ({ data: { status, title, slug } }) =>
      //       (status !== undefined || title !== undefined) && slug === undefined
      //         ? ['title', 'slug'] /** or "{ title slug }" */
      //         : undefined,

      //     dependsOnUpdate: ['status', 'title'],

      //     preUpdate: ({ leafUpdate, update, current }) => {
      //       if (leafUpdate) {
      //         return slugify(leafUpdate, slugify.defaults.modes.rfc3986);
      //       } else if (update.status === ArticleStatus.Published) {
      //         return slugify(
      //           update.title || current.title,
      //           slugify.defaults.modes.rfc3986,
      //         );
      //       }
      //     },
      //   },
      // },
    },
    body: {
      kind: 'Leaf',
      type: 'DraftJS',
      description: `The article's body`,
      nullable: true,
    },
    category: {
      kind: 'Reference',
      type: 'Category.parent-slug',
      nullable: true,
    },
    createdBy: {
      kind: 'Reference',
      type: 'User',
      immutable: true,

      // inputs: {
      //   creation: {
      //     public: false,
      //     preCreate: ({ api, operationContext: { requestContext }, edge }) =>
      //       api.get('User', {
      //         where: { id: requestContext.user.id },
      //         selection: edge.headReference.selection,
      //       }),
      //   },
      //   update: null,
      // },
    },
    createdAt: {
      kind: 'Leaf',
      type: 'DateTime',
      immutable: true,

      // inputs: {
      //   creation: {
      //     public: false,
      //     defaultValue: () => new Date(),
      //   },
      //   update: null,
      // },
    },
    updatedBy: {
      kind: 'Reference',
      type: 'User.username',

      // inputs: {
      //   creation: {
      //     public: false,
      //     preCreate: ({ api, operationContext: { requestContext }, edge }) =>
      //       api.get('User', {
      //         where: { id: requestContext.user.id },
      //         selection: edge.headReference.selection,
      //       }),
      //   },
      //   update: {
      //     public: false,
      //     preUpdate: ({ api, operationContext: { requestContext }, edge }) =>
      //       api.get('User', {
      //         where: { id: requestContext.user.id },
      //         selection: edge.headReference.selection,
      //       }),
      //   },
      // },
    },
    updatedAt: {
      kind: 'Leaf',
      type: 'DateTime',

      // inputs: {
      //   creation: {
      //     public: false,
      //     defaultValue: () => new Date(),
      //   },
      //   update: {
      //     public: false,
      //     defaultValue: () => new Date(),
      //   },
      // },
    },
    metas: {
      kind: 'Leaf',
      type: 'JSONObject',
      description:
        'Contains any arbitrary data you want to store alongside the article',
      nullable: true,
    },
  },

  uniques: [['_id'], ['id']],

  referrers: {
    tags: {
      referrer: 'ArticleTag.article',

      // inputs: {
      //   creation: {
      //     optional: true,
      //   },
      // },
    },
  },

  node: {
    interfaces: [NodeInterfaceType],

    virtualFields: (model) => ({
      lowerCasedTitle: {
        dependsOn: '{ status title category { title } }',
        type: GraphQLNonNull(Scalars.NonEmptyTrimmedString),
        description: `A custom field with a dependency`,
        resolve: ({ status, title, category }) =>
          (<string[]>[status, title, category?.title])
            .filter(Boolean)
            .join('-')
            .toLowerCase(),
      },
      // An exemple of how to use the "Model" to build another custom field
      upperCasedTitle: {
        dependsOn: '{ status title category { title } }',
        type: GraphQLNonNull(model.getLeaf('title').type),
        description: `A custom field with a dependency`,
        resolve: ({ status, title, category }, args, context) =>
          (<string[]>[status, title, category?.title])
            .filter(Boolean)
            .join('-')
            .toUpperCase(),
      },
    }),
  },

  mutations: {
    create: {
      virtualFields: {
        htmlBody: {
          type: GraphQLString,
          description: `It is possible to provide the article's body as raw HTML`,
        },
      },

      // preCreate({ creation, data }) {
      //   if (data['htmlBody']) {
      //     // Custom logic with this field's value
      //   }

      //   return creation;
      // },
    },
  },

  onChange(change) {
    switch (change.kind) {
      case NodeChangeKind.Created:
        console.debug(
          `The article "${change.new.id}" has been created at "${change.new.createdAt}" by "${change.new.createdBy}"`,
        );
        break;

      case NodeChangeKind.Updated:
        console.debug(
          `The article "${change.new.id}" has been updated at "${change.new.createdAt}" by "${change.new.createdBy}"`,
        );
        break;

      case NodeChangeKind.Deleted:
        console.debug(
          `The article "${change.old.id}" has been deleted at "${change.old.createdAt}" by "${change.old.createdBy}"`,
        );
        break;
    }
  },
};

export const Category: ModelConfig<MyContext> = {
  components: {
    _id: {
      kind: 'Leaf',
      type: 'PositiveInt',
      public: false,
      immutable: true,

      // inputs: {
      //   creation: null,
      //   update: null,
      // },
    },
    id: {
      kind: 'Leaf',
      type: 'UUID',
      immutable: true,

      // inputs: {
      //   creation: {
      //     defaultValue: () => randomUUID(),
      //     description:
      //       'You can either provide an UUID or let one be generated for you',
      //   },
      //   update: null,
      // },
    },
    title: {
      kind: 'Leaf',
      type: 'NonEmptyTrimmedString',
    },
    slug: {
      kind: 'Leaf',
      type: 'NonEmptyTrimmedString',

      // inputs: {
      //   creation: {
      //     description: `You can either provide a slug or let the title be "slugified" for you`,
      //     optional: false,
      //     dependsOnCreation: ['title'],
      //     preCreate: ({ leafValue, creation: { title } }) =>
      //       leafValue || slugify(title, slugify.defaults.modes.rfc3986),
      //   },
      // },
    },
    parent: {
      kind: 'Reference',
      type: 'Category',
      nullable: true,

      // inputs: {
      //   creation: {
      //     preCreate: async ({ edgeValue, api, path }) => {
      //       if (edgeValue == null) {
      //         const categoryCount = await api.count('Category', {
      //           where: { parent: null },
      //         });

      //         if (categoryCount !== 0) {
      //           throw new UnexpectedValueError(
      //             edgeValue,
      //             `a valid parent as the "root" category already exists`,
      //             path,
      //           );
      //         }
      //       }

      //       return edgeValue;
      //     },
      //   },
      // },
    },
    order: {
      kind: 'Leaf',
      type: 'PositiveInt',

      // inputs: {
      //   creation: {
      //     optional: false,
      //     dependsOnCreation: ['parent'],
      //     preCreate: async ({ leafValue, creation: { parent }, api }) => {
      //       if (leafValue === undefined) {
      //         // Get the "MAX(order)" of the categories having the same parent
      //         const categories = await api.find('Category', {
      //           where: { parent },
      //           orderBy: ['order_DESC'],
      //           first: 1,
      //           selection: '{ order }',
      //         });

      //         return categories[0]?.order ?? 0;
      //       }

      //       return leafValue;
      //     },
      //   },
      // },
    },
  },

  uniques: [['_id'], ['id'], ['parent', 'slug'], ['parent', 'order']],

  referrers: {
    children: {
      referrer: 'Category.parent',
      description: `This category's children`,
    },
  },

  node: {
    interfaces: [NodeInterfaceType],
  },
};

export const Tag: ModelConfig<MyContext> = {
  components: {
    id: {
      kind: 'Leaf',
      type: 'UUID',
      public: false,
      immutable: true,

      // inputs: {
      //   creation: {
      //     defaultValue: () => randomUUID(),
      //     description:
      //       'You can either provide an UUID or let one be generated for you',
      //   },
      //   update: null,
      // },
    },
    deprecated: {
      kind: 'Leaf',
      type: 'Boolean',
      description: 'A tag can be deprecated',
    },
    title: {
      kind: 'Leaf',
      type: 'NonEmptyTrimmedString',
    },
    slug: {
      kind: 'Leaf',
      type: 'NonEmptyTrimmedString',

      // inputs: {
      //   creation: {
      //     description: `You can either provide a slug or let the title be "slugified" for you`,
      //     optional: false,
      //     preCreate: ({ leafValue, data }) =>
      //       leafValue || slugify(data?.title, slugify.defaults.modes.rfc3986),
      //   },
      // },
    },
    createdAt: {
      kind: 'Leaf',
      type: 'DateTime',
      immutable: true,

      // inputs: {
      //   creation: {
      //     public: false,
      //     defaultValue: () => new Date(),
      //   },
      //   update: null,
      // },
    },
    updatedAt: {
      kind: 'Leaf',
      type: 'DateTime',

      // inputs: {
      //   creation: {
      //     public: false,
      //     defaultValue: () => new Date(),
      //   },
      //   update: {
      //     public: false,
      //     defaultValue: () => new Date(),
      //   },
      // },
    },
  },

  uniques: [['id'], ['slug']],

  node: {
    interfaces: [NodeInterfaceType],
  },
};

export const ArticleTag: ModelConfig<MyContext> = {
  components: {
    article: {
      kind: 'Reference',
      type: 'Article',
      immutable: true,

      // inputs: {
      //   update: null,
      // },
    },
    tag: {
      kind: 'Reference',
      type: 'Tag',
      immutable: true,

      // inputs: {
      //   update: null,
      // },
    },
    order: {
      kind: 'Leaf',
      type: 'PositiveInt',

      // inputs: {
      //   update: null,
      // },
    },
  },

  uniques: [
    ['article', 'tag'],
    ['article', 'order'],
  ],
};

export const User: ModelConfig<MyContext> = {
  filter: ({ requestContext: { user: myUser } }) =>
    myUser.role === 'ADMIN'
      ? // No filter for the "admins"
        true
      : myUser.role === 'JOURNALIST'
      ? // The "journalists" see only the articles they have created
        { id: myUser.id }
      : // Others won't have access to any articles
        false,

  components: {
    id: {
      kind: 'Leaf',
      type: 'UUID',
      immutable: true,

      // inputs: {
      //   creation: {
      //     defaultValue: () => randomUUID(),
      //     description:
      //       'You can either provide an UUID or let one be generated for you',
      //   },
      //   update: null,
      // },
    },
    username: {
      kind: 'Leaf',
      type: 'NonEmptyTrimmedString',
      immutable: true,
    },
  },

  uniques: [['id'], ['username']],

  referrers: {
    createdArticles: {
      referrer: 'Article.createdBy',
      description: `All the articles this user has created`,
    },
    updatedArticles: {
      referrer: 'Article.updatedBy',
      description: `All the articles this user has updated`,
    },
    profile: {
      referrer: 'UserProfile.user',
      description: `This user's profile, only the optional informations`,
    },
  },

  node: {
    interfaces: [NodeInterfaceType],
  },
};

export const UserProfile: ModelConfig<MyContext> = {
  components: {
    user: {
      kind: 'Reference',
      type: 'User',
      immutable: true,

      // inputs: {
      //   update: null,
      // },
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
    twitterId: {
      kind: 'Leaf',
      type: 'ID',
    },
  },

  uniques: [['user']],
};

/**
 * "Log" is a private model
 */
export const Log: ModelConfig<MyContext> = {
  public: false,

  components: {
    _id: {
      kind: 'Leaf',
      type: 'PositiveInt',
      public: false,
      immutable: true,

      // inputs: {
      //   creation: null,
      //   update: null,
      // },
    },
    id: {
      kind: 'Leaf',
      type: 'UUID',
      public: false,
      immutable: true,

      // inputs: {
      //   creation: {
      //     defaultValue: () => randomUUID(),
      //     description:
      //       'You can either provide an UUID or let one be generated for you',
      //   },
      //   update: null,
      // },
    },
    message: {
      kind: 'Leaf',
      type: 'NonEmptyTrimmedString',
    },
    createdAt: {
      kind: 'Leaf',
      type: 'DateTime',
      immutable: true,

      // inputs: {
      //   creation: {
      //     defaultValue: () => new Date(),
      //   },
      // },
    },
  },

  uniques: [['_id']],

  mutations: {
    update: { enabled: false },
  },
};

/**
 * "Hit" is an immutable model with only managed fields
 */
export const Hit: ModelConfig<MyContext> = {
  components: {
    _id: {
      kind: 'Leaf',
      type: 'PositiveInt',
      public: false,
      immutable: true,

      // inputs: {
      //   creation: null,
      // },
    },
    id: {
      kind: 'Leaf',
      type: 'UUID',
      immutable: true,

      // inputs: {
      //   creation: {
      //     managed: true,
      //     defaultValue: () => randomUUID(),
      //   },
      // },
    },
    by: {
      kind: 'Reference',
      type: 'User.id',

      // inputs: {
      //   creation: {
      //     public: false,
      //     preCreate: ({ operationContext: { requestContext } }) => ({
      //       id: requestContext.user.id,
      //     }),
      //   },
      // },
    },
    at: {
      kind: 'Leaf',
      type: 'DateTime',
      immutable: true,

      // inputs: {
      //   creation: {
      //     defaultValue: () => new Date(),
      //   },
      // },
    },
  },

  uniques: [['_id']],

  mutations: {
    update: { enabled: false },
    delete: { enabled: false },
  },
};

export const models: Record<string, ModelConfig<MyContext>> = {
  Article,
  Category,
  Tag,
  ArticleTag,
  User,
  UserProfile,
  Log,
  Hit,
};

export const modelNames = Object.keys(models);

export const customOperations: CustomOperationMap<MyContext> = {
  query: {
    whoAmI: () => ({
      type: GraphQLNonNull(GraphQLString),
      resolve: (_, args, context) =>
        `Hello ${context.user.name ?? 'world'}, I'm GraphQL Platform`,
    }),
  },
  // Can return undefined
  mutation: () => undefined,
  // Can be undefined
  subscription: undefined,
};

export const gp = new GraphQLPlatform<MyContext>({
  models,
  customOperations,
  // context: (context): MyContext => context,
});

export type MyGP = typeof gp;
