import assert from 'node:assert/strict';
import { getAuthNavigation } from '../src/lib/auth-navigation';

const company = getAuthNavigation('company', '');
assert.equal(company.returnPath, '/b2b-agi/panel');
assert.equal(company.standardSignInUrl, '/sign-in/standart');
assert.equal(company.signUpUrl, '/sign-up');

const staff = getAuthNavigation('staff', '', 'stale-company-invite');
assert.equal(staff.scope, 'staff');
assert.equal(staff.returnPath, '/staff/yonlendir');
assert.equal(staff.standardSignInUrl, '/staff/giris/standart');
assert.equal(staff.signUpUrl, '/staff/kayit');

const companyViaStaff = getAuthNavigation('staff', '?panel=connect');
assert.equal(companyViaStaff.returnPath, '/b2b-agi/panel');
assert.equal(companyViaStaff.standardSignInUrl, '/staff/giris/standart?panel=connect');
assert.equal(companyViaStaff.signUpUrl, '/sign-up');
assert.equal(
  getAuthNavigation('staff', companyViaStaff.standardSignInUrl.split('?')[1]).returnPath,
  '/b2b-agi/panel',
);

const invite = 'test+invite/with?encoded&values';
for (const entry of ['company', 'staff'] as const) {
  const route = getAuthNavigation(entry, `?invite=${encodeURIComponent(invite)}`);
  assert.equal(new URL(route.returnPath, 'https://test.invalid').searchParams.get('invite'), invite);
  assert.equal(new URL(route.standardSignInUrl, 'https://test.invalid').searchParams.get('invite'), invite);
  assert.equal(new URL(route.signUpUrl, 'https://test.invalid').searchParams.get('invite'), invite);
  const advancedQuery = new URL(route.standardSignInUrl, 'https://test.invalid').search;
  assert.equal(getAuthNavigation(entry, advancedQuery).returnPath, route.returnPath);
}
assert.equal(
  getAuthNavigation('company', '', invite).returnPath,
  `/b2b-agi/panel?invite=${encodeURIComponent(invite)}`,
);
assert.equal(getAuthNavigation('company', '?invite=', invite).returnPath, '/b2b-agi/panel');

for (const input of [
  '?redirect_url=https://evil.invalid&returnTo=//evil.invalid',
  '?panel=https://evil.invalid',
  '?panel=%2Fstaff%2Fyonetim-paneli',
]) {
  assert.equal(getAuthNavigation('company', input).returnPath, '/b2b-agi/panel');
  assert.equal(getAuthNavigation('staff', input).returnPath, '/staff/yonlendir');
}
console.log('MMT auth navigation: company, staff, advanced methods, invites and redirect allowlist passed.');