// Notification adapter used while external providers are not connected.
// Keeps API shape stable and avoids runtime crashes from removed providers.
export async function sendNotificationEmail({ to, subject, body }) {
  // Non-destructive fallback for Phase 1/Phase 2 (mock-first flow).
  console.info('[notification:fallback-email]', { to, subject, preview: body?.slice?.(0, 120) });
  return { ok: true, mode: 'fallback_mock' };
}
