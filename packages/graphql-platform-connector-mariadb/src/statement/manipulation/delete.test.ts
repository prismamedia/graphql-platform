import {
  Node,
  NodeChange,
  type DeleteManyMutationArgs,
} from '@prismamedia/graphql-platform';
import { MutationType } from '@prismamedia/graphql-platform-utils';
import {
  ArticleStatus,
  myAdminContext,
  type MyContext,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import * as fixtures from '@prismamedia/graphql-platform/__tests__/fixture.js';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createMyGP, type MyGP } from '../../__tests__/config.js';

describe('Delete statement', () => {
  let gp: MyGP;
  const changes: NodeChange[] = [];

  before(async () => {
    gp = createMyGP(`connector_mariadb_delete_statement`);
    gp.on('node-changes', (aggregation) => changes.push(...aggregation));

    await gp.connector.setup();
    await gp.seed(myAdminContext, fixtures.constant);
  });

  beforeEach(() => {
    changes.length = 0;
  });

  after(() => gp.connector.teardown());

  (
    [
      [
        'Article',
        myAdminContext,
        {
          where: { status: ArticleStatus.PUBLISHED },
          orderBy: ['createdAt_ASC'],
          first: 10,
          selection: '{ title }',
        },
      ],
      [
        'Article',
        myAdminContext,
        {
          where: { status: ArticleStatus.DRAFT },
          orderBy: ['createdAt_ASC'],
          first: 10,
          selection: '{ title }',
        },
      ],
    ] satisfies ReadonlyArray<[Node['name'], MyContext, DeleteManyMutationArgs]>
  ).forEach(([nodeName, context, args]) => {
    it('generates statements', async ({ assert: { snapshot } }) => {
      snapshot(await gp.api[nodeName].deleteMany(context, args));

      snapshot(
        changes.reduce<Map<Node['name'], Map<MutationType, number>>>(
          (changesByMutationTypeByNodeName, change) => {
            let changesByMutationType = changesByMutationTypeByNodeName.get(
              change.node.name,
            );

            if (!changesByMutationType) {
              changesByMutationTypeByNodeName.set(
                change.node.name,
                (changesByMutationType = new Map()),
              );
            }

            changesByMutationType.set(
              change.kind,
              (changesByMutationType.get(change.kind) ?? 0) + 1,
            );

            return changesByMutationTypeByNodeName;
          },
          new Map(),
        ),
      );
    });
  });
});
