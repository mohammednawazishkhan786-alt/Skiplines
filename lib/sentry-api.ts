import * as Sentry from "@sentry/nextjs";
import { wrapRouteHandlerWithSentry } from "@sentry/nextjs";

type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export function captureApiError(error: unknown) {
  Sentry.captureException(error);
}

export function withSentryApiRoute<F extends (...args: never[]) => Promise<Response>>(
  method: HttpMethod,
  parameterizedRoute: string,
  handler: F,
) {
  return wrapRouteHandlerWithSentry(handler, { method, parameterizedRoute });
}
