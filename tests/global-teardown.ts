// Teardown is intentionally minimal: test data lives in the DB and is reused across runs.
// To do a full reset, manually delete users with @pos-test.local emails from Supabase Auth.
export default async function globalTeardown() {
  // No-op — preserves test accounts for inspection
}
