**GraphQL Platform is an OpenCRUD implementation**

> This `@prismamedia/graphql-platform` aims to provide a complete and flexible GraphQL implementation of the [OpenCRUD](https://www.opencrud.org/) specification. Given a set of nodes' definition, it will generate an executable GraphQL schema made easy to expose through an [Apollo Server](https://github.com/apollographql/apollo-server).

[![Build status](https://github.com/prismamedia/graphql-platform/actions/workflows/ci.yml/badge.svg?branch=v1.0.0)](https://github.com/prismamedia/graphql-platform/actions/workflows/ci.yml?query=branch%3Av1.0.0)

_Requirements_

- NodeJS >=20.10
- GraphQL >=16

## Installation

with npm

```bash
npm install --save @prismamedia/graphql-platform @prismamedia/graphql-platform-connector-mariadb
```

or with yarn

```bash
yarn add @prismamedia/graphql-platform @prismamedia/graphql-platform-connector-mariadb
```

## Usage

```typescript
import {
  GraphQLPlatform,
  OnEdgeHeadDeletion,
} from '@prismamedia/graphql-platform';
import { MariaDBConnector } from '@prismamedia/graphql-platform-connector-mariadb';
import { randomUUID } from 'node:crypto';

export const ArticleStatusType = new GraphQLEnumType({
  name: 'ArticleStatus',
  values: {
    DRAFT: { value: 'draft' },
    PUBLISHED: { value: 'published' },
  },
});

export type MyUser = {
  id: string;
  name: string;
  role?: 'ADMIN' | 'JOURNALIST';
};

export type MyContext = {
  user?: MyUser;
};

const gp = new GraphQLPlatform<MyContext>({
  nodes: {
    Article: {
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
              return mutationType ? false : { status: 'published' };
          }
        }

        // Un-authenticated users cannot access articles at all
        return false;
      },

      components: {
        id: {
          type: 'UUIDv4',
          description: 'This UUID identifies an Article publicly',
          nullable: false,
          mutable: false,

          creation: { defaultValue: () => randomUUID() },
        },
        status: {
          type: ArticleStatusType,
          nullable: false,

          creation: { defaultValue: ArticleStatus.DRAFT },
        },
        title: {
          type: 'NonEmptyTrimmedString',
          nullable: false,
        },
        category: {
          kind: 'Edge',
          head: 'Category',
          onHeadDeletion: OnEdgeHeadDeletion.SET_NULL,
        },
        createdBy: {
          kind: 'Edge',
          head: 'Author',
          nullable: false,
          mutable: false,

          creation: {
            public: false,
          },
        },
      },
      uniques: [['id']],
    },
    Category: {
      components: {
        id: {
          type: 'UUIDv4',
          description: 'This UUID identifies a Category publicly',
          nullable: false,
          mutable: false,

          creation: { defaultValue: () => randomUUID() },
        },
        title: {
          kind: 'Leaf',
          type: 'NonEmptyTrimmedString',
          nullable: false,
        },
      },
      uniques: [['id']],
    },
    Author: {
      components: {
        id: {
          type: 'UUIDv4',
          description: 'This UUID identifies an Author publicly',
          nullable: false,
          mutable: false,

          creation: { defaultValue: () => randomUUID() },
        },
        name: {
          kind: 'Leaf',
          type: 'NonEmptyTrimmedString',
          nullable: false,
        },
      },
      uniques: [['id']],
    },
  },

  connector: (gp) => new MariaDBConnector(gp),
});
```

## Expose it through Apollo Server

Given the `gp` instance above:

```typescript
import { ApolloServerIntegration } from '@prismamedia/graphql-platform-integration-apollo-server';

// `server` is an Apollo Server instance
const server = new ApolloServerIntegration(gp);

// you can now expose it as you wish, AWS Lambda, ExpressJS, ...
```
