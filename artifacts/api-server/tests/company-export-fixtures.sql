-- After company-fund-fixtures.sql, development only; bind the same UUID as $1.
WITH actors AS (
  SELECT m.id AS member_id, m.business_profile_id, m.full_name,
    CASE WHEN m.clerk_user_id = 'fund-test-' || $1 || ':other' THEN true ELSE false END AS foreign_company
  FROM b2b_company_members m JOIN b2b_business_profiles p ON p.id = m.business_profile_id
  WHERE m.clerk_user_id IN ('fund-test-' || $1 || ':owner', 'fund-test-' || $1 || ':other')
    AND p.internal_note = 'TEST FUND DEVELOPMENT ' || $1
), source AS (
  SELECT a.*, n,
    CASE WHEN foreign_company THEN 'FOREIGN'
      WHEN n > 531 THEN 'OUTSIDE'
      ELSE 'Şirket Çelik ' || n END AS institution,
    CASE WHEN n = 1 THEN '2025-12-31 21:00:00+00'::timestamptz
      WHEN n = 531 THEN '2026-01-01 20:59:59.999+00'::timestamptz
      WHEN n = 532 THEN '2025-12-31 20:59:59.999+00'::timestamptz
      WHEN n = 533 THEN '2026-01-02 21:00:00+00'::timestamptz
      ELSE '2026-01-01 12:00:00+00'::timestamptz END AS at
  FROM actors a CROSS JOIN LATERAL generate_series(1, CASE WHEN foreign_company THEN 1 ELSE 533 END) n
), fund_rows AS (
  INSERT INTO company_fund_records (business_profile_id, institution, operation_type, amount, currency,
    description, request_key, author_member_id, author_name, created_at)
  SELECT business_profile_id, institution, 'TEST iç kayıt',
    CASE WHEN n % 3 = 0 THEN 999999999999.99 WHEN n % 3 = 1 THEN 0.01 ELSE 12.30 END,
    CASE WHEN n % 3 = 0 THEN 'USD' WHEN n % 3 = 1 THEN 'TRY' ELSE 'EUR' END,
    E' \t=SUM(A1); "TEST"', gen_random_uuid(), member_id, full_name, at FROM source
  RETURNING *
), instruction_rows AS (
  INSERT INTO company_instructions (business_profile_id, institution, operation_type, content, author_member_id, author_name, created_at)
  SELECT business_profile_id, institution, 'TEST talimat', E' \t=SUM(A1); "TEST"',
    member_id, full_name, at FROM source RETURNING id
)
INSERT INTO company_fund_amendments (business_profile_id, original_record_id, replacement_record_id, kind,
  reason, request_key, author_member_id, author_name, created_at)
SELECT business_profile_id, id, NULL, 'iptal', 'İptal gerekçesi — TEST', gen_random_uuid(),
  author_member_id, author_name, '2026-01-03 12:00:00+00'
FROM fund_rows WHERE institution = 'Şirket Çelik 1'
RETURNING id;