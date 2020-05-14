import {
  config,
  MyGP,
} from '@prismamedia/graphql-platform-connector-mariadb/src/__tests__/gp';
import { createServer } from '..';

const gp = new MyGP(config);

const server = createServer({
  gp,
});

(async () => {
  const db = gp.getConnector().getDatabase();
  await db.reset();
  await gp.loadFixtures();

  server.listen(3000, () => console.log(`Listening on port 3000.`));
})().catch((err) => {
  console.error(err);

  process.exit(1);
});
