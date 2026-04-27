// Translate raw Supabase / Postgres errors into safe, user-friendly messages.
// Full error details are logged to the console for debugging only.

type AnyError =
  | { code?: string | null; message?: string | null; details?: string | null }
  | Error
  | null
  | undefined;

const PG_MESSAGES: Record<string, string> = {
  "23505": "A record with that value already exists.",
  "23503": "This record is referenced by other data and can't be changed.",
  "23502": "A required field is missing.",
  "23514": "Some values don't meet the required rules.",
  "22001": "One of the values is too long.",
  "22P02": "One of the values has an invalid format.",
  "42501": "You don't have permission to perform this action.",
  "42P01": "Requested data is not available.",
  "PGRST116": "No matching record found.",
  "PGRST301": "You don't have permission to perform this action.",
};

export function friendlyError(err: AnyError, fallback = "Something went wrong. Please try again."): string {
  if (!err) return fallback;

  // Always log raw error for developers
  // eslint-disable-next-line no-console
  console.error("[error]", err);

  const code = (err as { code?: string }).code ?? undefined;
  if (code && PG_MESSAGES[code]) return PG_MESSAGES[code];

  const msg = (err as { message?: string }).message?.toLowerCase() ?? "";

  if (msg.includes("row-level security") || msg.includes("permission denied")) {
    return "You don't have permission to perform this action.";
  }
  if (msg.includes("network") || msg.includes("failed to fetch")) {
    return "Network error. Please check your connection and try again.";
  }
  if (msg.includes("jwt") || msg.includes("token")) {
    return "Your session has expired. Please sign in again.";
  }

  return fallback;
}
