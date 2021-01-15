import {
  GraphQLEnumType,
  GraphQLInterfaceType,
  GraphQLNonNull,
  GraphQLString,
} from 'graphql';
import { GraphQLPlatform, IConnector, Scalars, TNodeConfig } from '..';
import { TCustomOperationMap } from '../custom-operations';

export type TMyUser = {
  id: string;
  name: string;
  role: 'ADMIN' | 'JOURNALIST';
};

export type TMyContext = {
  myUser?: TMyUser;
};

export const myAdminUser: TMyUser = Object.freeze({
  id: '4e08b305-7e81-4a67-9377-b06d5b900b55',
  name: 'My admin',
  role: 'ADMIN',
});

export const myAdminContext: TMyContext = Object.freeze({
  myUser: myAdminUser,
});

export const myJournalistUser: TMyUser = Object.freeze({
  id: '5ff01840-8e75-4b18-baa1-90b51e7318cd',
  name: 'My journalist',
  role: 'JOURNALIST',
});

export const myJournalistContext: TMyContext = Object.freeze({
  myUser: myJournalistUser,
});

export const NodeInterfaceType = new GraphQLInterfaceType({
  name: 'Node',
  fields: {
    id: {
      type: GraphQLNonNull(Scalars.UUID),
    },
  },
});

export enum ArticleStatus {
  Draft = 'DRAFT',
  Published = 'PUBLISHED',
}

export const ArticleStatusType = new GraphQLEnumType({
  name: 'ArticleStatus',
  values: Object.fromEntries(
    Object.entries({
      Draft: ArticleStatus.Draft,
      Published: ArticleStatus.Published,
    }).map(([key, value]) => [key, { value }]),
  ),
});

export const Article: TNodeConfig<TMyContext> = {
  description: `The article is the main node, written by the journalists`,
  filter: (context) =>
    context?.myUser
      ? context.myUser.role === 'ADMIN'
        ? // No filter for the "admins"
          true
        : // The "journalists" see only the articles they have written
          { createdBy: { id: context.myUser.id } }
      : // "Anonymous" users won't have access to any articles
        false,
  components: {
    _id: {
      // kind: 'Leaf',
      description: 'This id is used to identify an Article privatly',
      type: 'NonNegativeInt',
      nullable: false,
      immutable: true,
      public: false,
      inputs: {
        create: {
          nullable: true,
        },
      },
    },
    id: {
      kind: 'Leaf',
      description: 'This UUID is used to identify an Article publicly',
      type: 'UUID',
      nullable: false,
      immutable: true,
      inputs: {
        create: {
          description: 'You can either provide an UUID or let one be generated',
          nullable: true,
          // parser: ({ value }) => value || v4(),
        },
      },
    },
    status: {
      type: ArticleStatusType,
      nullable: false,
      inputs: {
        create: {
          defaultValue: ArticleStatus.Draft,
        },
      },
    },
    title: {
      type: 'NonEmptyTrimmedString',
      nullable: false,
    },
    slug: {
      kind: 'Leaf',
      type: 'NonEmptyTrimmedString',
      nullable: false,
      inputs: {
        create: {
          description: `You can either provide a slug or let the title be "slugified" for you`,
          nullable: true,
          dependencies: ['title'],
          // parser: ({ value, dependencies: { title } }) =>
          //   value || slugify(title, slugify.defaults.modes.rfc3986),
        },
      },
    },
    body: {
      description: `The article's body`,
      type: 'NonEmptyTrimmedString',
    },
    category: {
      type: 'Category',
      reference: 'parent-slug',
      inputs: {
        create: {
          defaultValue: {
            connect: {
              parent: null,
              slug: 'home',
            },
          },
        },
      },
    },
    createdBy: {
      type: 'User',
      nullable: false,
      immutable: true,
      inputs: {
        create: {
          public: false,
          nullable: true,
          // parser: ({
          //   context: {
          //     requestContext: { custom },
          //   },
          // }) => ({
          //   id: '8496b9b2-bac8-4ed8-88a9-f4bf521b6cc2',
          // }),
        },
      },
    },
    createdAt: {
      type: 'DateTime',
      nullable: false,
      immutable: true,
      inputs: {
        create: {
          public: false,
          nullable: true,
          // parser: () => new Date(),
        },
      },
    },
    updatedBy: {
      type: 'User',
      reference: 'username',
      nullable: false,
      inputs: {
        create: {
          public: false,
          nullable: true,
          // parser: ({
          //   context: {
          //     requestContext: { custom },
          //   },
          // }) => ({
          //   id: '8496b9b2-bac8-4ed8-88a9-f4bf521b6cc2',
          // }),
        },
      },
    },
    updatedAt: {
      type: 'DateTime',
      nullable: false,
      inputs: {
        create: {
          public: false,
          nullable: true,
          // parser: () => new Date(),
        },
      },
    },
    metas: {
      description:
        'Contains any arbitrary data you want to store alongside the article',
      type: 'JSONObject',
    },
  },

  uniques: [['_id'], ['id']],

  reverseEdges: {
    'ArticleTag.article': {
      defaultArgs: {
        orderBy: ['order_ASC'],
        first: 10,
      },
      inputs: {
        create: {
          description:
            'Optional, link this new article with some tags at creation',
        },
      },
    },
  },

  interfaces: [NodeInterfaceType],

  customFields: {
    lowerCasedTitle: {
      fragment: '{ status title category { title } }',
      description: `A custom field with a dependency`,
      type: GraphQLNonNull(Scalars.NonEmptyTrimmedString),
      resolve: ({ status, title, category }) =>
        (<string[]>[status, title, category?.title])
          .filter(Boolean)
          .join('-')
          .toLowerCase(),
    },
    // An exemple of how to use the "Node" to build another custom field
    upperCasedTitle: (node) => ({
      fragment: '{ status title category { title } }',
      description: `A custom field with a dependency`,
      type: GraphQLNonNull(node.getLeaf('title').type),
      resolve: ({ status, title, category }, args, context) =>
        (<string[]>[status, title, category?.title])
          .filter(Boolean)
          .join('-')
          .toUpperCase(),
    }),
  },

  operations: {
    find: {
      defaultArgs: {
        where: { status: ArticleStatus.Published },
        orderBy: ['createdAt_DESC'],
        first: 25,
      },
    },
  },

  on: {
    created({ value: nodeValue }) {
      console.debug(
        `The article "${nodeValue.id}" has been created at "${nodeValue.createdAt}" by "${nodeValue.createdBy}"`,
      );
    },
    updated({ value: nodeValue }) {
      console.debug(
        `The article "${nodeValue.id}" has been updated at "${nodeValue.updatedAt}" by "${nodeValue.updatedBy}"`,
      );
    },
    deleted({ value: nodeValue }) {
      console.debug(
        `The article "${
          nodeValue.id
        }" has been deleted at ${new Date().toISOString()}`,
      );
    },
  },
};

export const Category: TNodeConfig<TMyContext> = {
  components: {
    _id: {
      type: 'NonNegativeInt',
      nullable: false,
      immutable: true,
      public: false,
      inputs: {
        create: {
          public: false,
          nullable: true,
        },
      },
    },
    id: {
      kind: 'Leaf',
      type: 'UUID',
      nullable: false,
      immutable: true,
      inputs: {
        create: {
          description: 'You can either provide an UUID or let one be generated',
          nullable: true,
          // parser: ({ value }) => value || v4(),
        },
      },
    },
    title: {
      type: 'NonEmptyTrimmedString',
      nullable: false,
    },
    slug: {
      kind: 'Leaf',
      type: 'NonEmptyTrimmedString',
      nullable: false,
      inputs: {
        create: {
          description: `You can either provide a slug or let the title be "slugified" for you`,
          nullable: true,
          dependencies: ['title'],
          // parser: ({ value, dependencies: { title } }) =>
          //   value || slugify(title, slugify.defaults.modes.rfc3986),
        },
      },
    },
    parent: {
      type: 'Category',
    },
    order: {
      type: 'NonNegativeInt',
      nullable: false,
    },
  },
  uniques: [['_id'], ['id'], ['parent', 'slug'], ['parent', 'order']],
  reverseEdges: {
    'Category.parent': {
      name: 'children',
      description: `This category's children`,
      defaultArgs: {
        orderBy: ['order_ASC'],
        first: 25,
      },
    },
  },
  interfaces: [NodeInterfaceType],
};

export const Tag: TNodeConfig<TMyContext> = {
  components: {
    id: {
      kind: 'Leaf',
      type: 'UUID',
      nullable: false,
      immutable: true,
      inputs: {
        create: {
          description: 'You can either provide an UUID or let one be generated',
          nullable: true,
          // parser: ({ value }) => value || v4(),
        },
      },
    },
    title: {
      type: 'NonEmptyTrimmedString',
      nullable: false,
    },
    slug: {
      type: 'NonEmptyTrimmedString',
      nullable: false,
      // onCreate: {
      //   source: 'Optional',
      //   dependencies: ['title'],
      //   parser: ({ value, dependencies: { title } }) =>
      //     value || slugify(title, slugify.defaults.modes.rfc3986),
      // },
    },
    createdAt: {
      type: 'DateTime',
      nullable: false,
      immutable: true,
      inputs: {
        create: {
          public: false,
          nullable: true,
          // parser: () => new Date(),
        },
      },
    },
    updatedAt: {
      type: 'DateTime',
      nullable: false,
      inputs: {
        create: {
          public: false,
          nullable: true,
          // parser: () => new Date(),
        },
      },
    },
  },
  uniques: [['id'], ['slug']],
  interfaces: [NodeInterfaceType],
};

export const ArticleTag: TNodeConfig<TMyContext> = {
  components: {
    article: {
      type: 'Article',
      nullable: false,
      immutable: true,
    },
    tag: {
      type: 'Tag',
      nullable: false,
      immutable: true,
    },
    order: {
      type: 'NonNegativeInt',
      nullable: false,
      immutable: true,
      sortable: true,
    },
  },
  uniques: [
    ['article', 'tag'],
    ['article', 'order'],
  ],
};

export const User: TNodeConfig<TMyContext> = {
  filter: (context) =>
    context?.myUser
      ? context.myUser.role === 'ADMIN'
        ? // No filter for the "admins"
          true
        : // The "journalists" see only its own "User"
          { id: context.myUser.id }
      : // "Anonymous" users won't have access to any users
        false,
  components: {
    id: {
      kind: 'Leaf',
      type: 'UUID',
      nullable: false,
      immutable: true,
      inputs: {
        create: {
          description: 'You can either provide an UUID or let one be generated',
          nullable: true,
          // parser: ({ value }) => value || v4(),
        },
      },
    },
    username: {
      type: 'NonEmptyTrimmedString',
      nullable: false,
    },
  },
  uniques: [['id'], ['username']],
  reverseEdges: {
    'Article.createdBy': {
      name: 'created',
      description: `All the articles this user has created`,
    },
    'Article.updatedBy': {
      name: 'updated',
      description: `All the articles this user has updated`,
    },
    'UserProfile.user': {
      description: `This user's profile, only the optional informations`,
    },
  },
  interfaces: [NodeInterfaceType],
};

export const UserProfile: TNodeConfig<TMyContext> = {
  components: {
    user: {
      type: 'User',
      nullable: false,
      immutable: true,
    },
    birthday: {
      type: 'Date',
    },
    facebookId: {
      type: 'ID',
    },
    googleId: {
      type: 'ID',
    },
    twitterId: {
      type: 'ID',
    },
  },
  uniques: [['user']],
};

/**
 * "Log" is a private node
 */
export const Log: TNodeConfig<TMyContext> = {
  public: false,
  immutable: true,
  components: {
    _id: {
      type: 'NonNegativeInt',
      nullable: false,
      inputs: {
        create: {
          public: false,
        },
      },
    },
    message: {
      type: 'NonEmptyTrimmedString',
      nullable: false,
    },
    createdAt: {
      type: 'DateTime',
      nullable: false,
    },
  },
  uniques: [['_id']],
};

/**
 * "Hit" is a node with only "managed" components
 */
export const Hit: TNodeConfig<TMyContext> = {
  components: {
    _id: {
      type: 'NonNegativeInt',
      nullable: false,
      immutable: true,
      inputs: {
        create: {
          public: false,
          nullable: true,
        },
      },
    },
    at: {
      type: 'DateTime',
      nullable: false,
      immutable: true,
      inputs: {
        create: {
          public: false,
          nullable: true,
        },
      },
    },
  },
  uniques: [['_id']],
};

export const nodes: Record<string, TNodeConfig<TMyContext>> = {
  Article,
  Category,
  Tag,
  ArticleTag,
  User,
  UserProfile,
  Log,
  Hit,
};

export const nodeNames = Object.keys(nodes);

export const customOperations: TCustomOperationMap<TMyContext, IConnector> = {
  query: {
    whoAmI: () => ({
      type: GraphQLNonNull(GraphQLString),
      resolve: (_, args, context) =>
        `Hello ${context.myUser?.name ?? 'world'}, I'm GraphQL Platform`,
    }),
  },
  // Can return true
  mutation: () => undefined,
  // Can be undefined
  subscription: undefined,
};

export const gp = new GraphQLPlatform({ nodes, customOperations });

export type MyGP = typeof gp;
