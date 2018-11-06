import { createServer } from '../';
import { graphqlPlatform as gp } from '../../../graphql-platform-connector-mariadb/src/__tests__';

const fixturePath = `${__dirname}/../../../graphql-platform-core/src/__tests__/fixtures`;

const server = createServer({
  gp,
});

(async () => {
  const db = gp.getConnector().getDatabase();
  await db.drop();
  await db.create();
  await gp.loadFixtures(fixturePath);

  server.listen(3000, () => console.log(`Listening on port 3000.`));
})().catch(err => {
  console.error(err);

  process.exit(1);
});
