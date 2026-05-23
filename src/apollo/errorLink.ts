import { CombinedGraphQLErrors, CombinedProtocolErrors } from "@apollo/client";
import { ErrorLink } from "@apollo/client/link/error";

type OnError = (error: unknown) => void;

/**
 * Lightweight error link. Forwards every error to the consumer-supplied
 * `onError` handler (configured on the provider). No toasts, no auth, no
 * token refresh — the package is auth-key only.
 */
export function createErrorLink(onError?: OnError) {
  return new ErrorLink(({ error }) => {
    if (!onError) return;
    if (CombinedGraphQLErrors.is(error)) {
      error.errors.forEach((e) => onError(e));
    } else if (CombinedProtocolErrors.is(error)) {
      error.errors.forEach((e) => onError(e));
    } else {
      onError(error);
    }
  });
}
