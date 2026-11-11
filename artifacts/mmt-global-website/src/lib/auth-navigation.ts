export type AuthScope = 'company' | 'staff';

// Only named, local destinations are accepted. Never navigate to a caller's URL.
export function getAuthNavigation(
  entryScope: AuthScope,
  search: string,
  storedInvite = '',
) {
  const query = new URLSearchParams(search);
  const scope: AuthScope = entryScope === 'company' ||
    query.get('panel') === 'connect' || Boolean(query.get('invite'))
    ? 'company' : 'staff';
  const invite = scope === 'company' ? query.get('invite') ?? storedInvite : '';
  const params = new URLSearchParams();
  if (entryScope === 'staff' && scope === 'company') params.set('panel', 'connect');
  if (invite) params.set('invite', invite);
  const suffix = params.size ? `?${params}` : '';
  const signInPath = entryScope === 'company' ? '/sign-in' : '/staff/giris';
  const signupParams = new URLSearchParams();
  if (invite) signupParams.set('invite', invite);
  const signupSuffix = signupParams.size ? `?${signupParams}` : '';

  return {
    scope,
    returnPath: scope === 'company'
      ? `/b2b-agi/panel${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`
      : '/staff/yonlendir',
    signInUrl: `${signInPath}${suffix}`,
    standardSignInUrl: `${signInPath}/standart${suffix}`,
    signUpUrl: scope === 'company' ? `/sign-up${signupSuffix}` : '/staff/kayit',
  };
}