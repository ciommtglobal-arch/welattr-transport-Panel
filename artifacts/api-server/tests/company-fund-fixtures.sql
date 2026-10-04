-- Execute ONLY through executeSql({ environment: "development", params: [uuid] }).
-- $1 is a fresh UUID generated for this test run, not a real user's identifier.
WITH profiles AS (
  INSERT INTO b2b_business_profiles (
    owner_clerk_user_id, legal_name, public_name, country, registration_number,
    business_type, field, contact, verification_document_object_path,
    verification_document_file_name, verification_document_content_type,
    verification_document_size, status, internal_note
  )
  SELECT 'fund-test-' || $1 || ':' || actor, 'TEST Fund ' || actor,
    'TEST Fund ' || actor, 'TR', 'TEST-' || $1 || actor, 'TEST', 'TEST',
    'fixture@example.invalid', '/TEST/no-file', 'TEST.txt', 'text/plain', 1,
    'verified', 'TEST FUND DEVELOPMENT ' || $1
  FROM (VALUES ('owner'), ('revoked'), ('other')) roles(actor)
  RETURNING id, owner_clerk_user_id
)
INSERT INTO b2b_company_members (
  business_profile_id, clerk_user_id, full_name, email, role, status, areas, accepted_at
)
SELECT profiles.id, 'fund-test-' || $1 || ':' || actor, 'TEST ' || actor,
  actor || '-' || $1 || '@example.invalid',
  CASE WHEN actor IN ('owner', 'revoked', 'other', 'fakeowner')
    THEN 'owner' ELSE actor END::b2b_company_member_role,
  CASE WHEN actor = 'revoked' THEN 'revoked'
    ELSE 'active' END::b2b_company_member_status,
  ARRAY['finance'], now()
FROM profiles JOIN (
  VALUES ('owner'), ('manager'), ('admin'), ('member'),
    ('fakeowner'), ('revoked'), ('other')
) roles(actor)
ON profiles.owner_clerk_user_id = 'fund-test-' || $1 || ':' ||
  CASE WHEN actor IN ('manager', 'admin', 'member', 'fakeowner')
    THEN 'owner' ELSE actor END
RETURNING business_profile_id, id, role, status;