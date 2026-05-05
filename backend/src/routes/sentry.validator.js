/**
 * src/routes/sentry.validator.js
 * Validates and extracts the fields RootSignal needs from a Sentry webhook payload.
 *
 * Input:  Raw parsed Sentry webhook payload (object)
 * Output: { valid: boolean, data?: ExtractedError, reason?: string }
 */

export function extractSentryError(payload) {
  const action = payload?.action;

  const validActions = ["created", "triggered"];
  if (!validActions.includes(action)) {
    return {
      valid: false,
      reason: `Ignored action type: "${action}" — only processing "created" and "triggered"`,
    };
  }

  const issue = payload?.data?.issue;
  const event = payload?.data?.event;

  if (!issue && !event) {
    return {
      valid: false,
      reason: "Payload has no data.issue or data.event — unrecognised structure",
    };
  }

  const sentryIssueId =
    issue?.id ?? event?.issue_id ?? payload?.data?.issue_id;

  if (!sentryIssueId) {
    return { valid: false, reason: "Could not extract Sentry issue ID" };
  }

  const errorMessage =
    issue?.title ??
    event?.title ??
    event?.exception?.values?.[0]?.value ??
    "Unknown error";

  const rawTimestamp =
    issue?.firstSeen ??
    event?.timestamp ??
    event?.received ??
    new Date().toISOString();

  const errorTimestamp = new Date(rawTimestamp);
  if (isNaN(errorTimestamp.getTime())) {
    return { valid: false, reason: `Invalid timestamp: "${rawTimestamp}"` };
  }

  const serviceName =
    payload?.data?.project?.slug ??
    issue?.project?.slug ??
    event?.project ??
    "unknown-service";

  const stackFrames =
    event?.exception?.values?.[0]?.stacktrace?.frames ??
    issue?.annotations ??
    [];

  const stackFiles = stackFrames
    .map((f) => f?.filename ?? f?.abs_path ?? "")
    .filter(Boolean);

  return {
    valid: true,
    data: {
      sentryIssueId: String(sentryIssueId),
      errorMessage,
      errorTimestamp,
      serviceName,
      stackFiles,
      rawPayload: payload,
    },
  };
}