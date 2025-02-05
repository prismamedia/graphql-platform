import * as opentelemetry from '@opentelemetry/api';

export const trace = <TResult>(
  tracer: opentelemetry.Tracer,
  name: string,
  task: (span: opentelemetry.Span) => TResult,
  options: opentelemetry.SpanOptions = {},
): TResult =>
  tracer.startActiveSpan(name, options, (span) => {
    let result: TResult;

    try {
      result = task(span);
    } catch (error) {
      error instanceof Error && span.recordException(error);
      span.setStatus({ code: opentelemetry.SpanStatusCode.ERROR });
      span.end();

      throw error;
    }

    if (result instanceof Promise) {
      return result
        .catch((error) => {
          error instanceof Error && span.recordException(error);
          span.setStatus({ code: opentelemetry.SpanStatusCode.ERROR });

          throw error;
        })
        .finally(() => span.end()) as TResult;
    }

    span.end();

    return result;
  });

export const bindTrace =
  (tracer: opentelemetry.Tracer) =>
  <TResult>(
    name: string,
    task: (span: opentelemetry.Span) => TResult,
    options?: opentelemetry.SpanOptions,
  ) =>
    trace(tracer, name, task, options);
