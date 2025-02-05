import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';

new NodeSDK({
  traceExporter: new ConsoleSpanExporter(),
  instrumentations: [new HttpInstrumentation(), new ExpressInstrumentation()],
}).start();
