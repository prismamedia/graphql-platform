import { myAdminContext } from '@prismamedia/graphql-platform/__tests__/config.js';
import * as fixtures from '@prismamedia/graphql-platform/__tests__/fixture.js';
import scenarioCursor from './bench/cursor.js';
import { createMyGP } from './config.js';

const config = {
  iterations: 100,
  sampling: 0.1,
  fixtures: {
    Category: { count: 50 },
    Tag: { count: 100 },
    Article: { count: 1000, tags: { count: { min: 0, max: 5 } } },
  } satisfies fixtures.RandomFixtureOptions,
};

const sample = 1 / config.sampling;

const getFormattedMemory = () => {
  global.gc?.();

  return `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(3)} MB`;
};

console.debug(`INIT: ${getFormattedMemory()}`);

let gp = createMyGP('connector_mariadb_bench');
console.debug(`POST_CONSTRUCT: ${getFormattedMemory()}`);

try {
  await gp.connector.setup();
  await gp.seed(myAdminContext, fixtures.random(config.fixtures));
  console.debug(`POST_CONNECTOR_SETUP: ${getFormattedMemory()}`);

  for (let i = 0; i < config.iterations; i++) {
    await scenarioCursor(gp, i);

    if ((i + 1) % sample === 0) {
      console.debug(`POST_ITERATION_${i + 1}: ${getFormattedMemory()}`);
    }
  }
} finally {
  await gp.connector.teardown();
  console.debug(`POST_CONNECTOR_TEARDOWN: ${getFormattedMemory()}`);
}

console.debug(`END: ${getFormattedMemory()}`);
