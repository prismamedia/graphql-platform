import * as opentelemetry from '@opentelemetry/api';
import { bindTrace } from '@prismamedia/graphql-platform-utils';
import pkg from '../package.json' with { type: 'json' };

export const tracer = opentelemetry.trace.getTracer(
  pkg.name,
  'version' in pkg ? String(pkg.version) : undefined,
);

export const trace = bindTrace(tracer);
