-- Run after schema initialization on a NEW database, before first onboarding.
-- Matches lib/plans.ts. Existing plan rows/custom limits are left unchanged.
-- This is not an upgrade migration or a subscription-reconciliation script.
BEGIN;
INSERT INTO "plan_allowance"
  ("id", "name", "display_name", "credits", "max_workspaces", "max_members",
   "features", "sort_order", "created_at", "updated_at")
VALUES
  ('plan_free', 'free', 'Free', 10, 1, 3, '[]', 0, NOW(), NOW()),
  ('plan_pro', 'pro', 'Pro', 100, 5, 25, '["api_key","advanced_analytics"]', 1, NOW(), NOW()),
  ('plan_enterprise', 'enterprise', 'Enterprise', -1, -1, -1,
   '["api_key","advanced_analytics","priority_support","sso","audit_logs","custom_branding"]', 2, NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;
COMMIT;

SELECT "name", "credits", "max_workspaces", "max_members"
FROM "plan_allowance" ORDER BY "sort_order";
