const { createPublicKey, verify } = require('node:crypto');

const origin = 'https://panel.mmtglobal.com.tr';
const userPattern = /^user_[A-Za-z0-9]{8,100}$/;
const uuidPattern = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

function authPolicy(env) {
  if (env.MMT_CIO_READS_ENABLED !== 'true') return null;
  try {
    const issuer = new URL(env.MMT_CIO_CLERK_ISSUER);
    const audience = env.MMT_CIO_CLERK_AUDIENCE;
    const founder = env.MMT_FOUNDER_REVIEWER_CLERK_USER_ID;
    const tenant = Number(env.MMT_CIO_BUSINESS_PROFILE_ID);
    const pem = env.MMT_CIO_CLERK_JWT_PUBLIC_KEY;
    if (issuer.protocol !== 'https:' || issuer.origin !== env.MMT_CIO_CLERK_ISSUER ||
        !audience || !userPattern.test(founder || '') || !Number.isSafeInteger(tenant) ||
        tenant < 1 || tenant > 2147483647 || !pem?.startsWith('-----BEGIN PUBLIC KEY-----')) return null;
    const key = createPublicKey(pem);
    if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails?.modulusLength < 2048) return null;
    return { issuer: issuer.origin, audience, founder, tenant, key };
  } catch {
    return null;
  }
}

function authorize(header, policy, now = Math.floor(Date.now() / 1000)) {
  if (!header) return 401;
  if (!policy) return 503;
  const token = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(header);
  if (!token || token[1].length > 8192) return 401;
  try {
    const [h, p, signature] = token[1].split('.');
    const metadata = JSON.parse(Buffer.from(h, 'base64url').toString());
    if (metadata.alg !== 'RS256' || metadata.crit !== undefined ||
        !verify('RSA-SHA256', Buffer.from(`${h}.${p}`), policy.key, Buffer.from(signature, 'base64url'))) return 401;
    const c = JSON.parse(Buffer.from(p, 'base64url').toString());
    const aud = typeof c.aud === 'string' ? [c.aud] : c.aud;
    if (c.iss !== policy.issuer || c.azp !== origin || !Array.isArray(aud) || !aud.includes(policy.audience) ||
        !Number.isSafeInteger(c.exp) || !Number.isSafeInteger(c.iat) || !Number.isSafeInteger(c.nbf) ||
        c.exp <= now || c.nbf > now || c.iat > now || c.exp <= c.iat || c.exp - c.iat > 300 ||
        !/^sess_[A-Za-z0-9]{8,100}$/.test(c.sid || '') || !userPattern.test(c.sub || '') ||
        (c.sts !== undefined && c.sts !== 'active') || c.act !== undefined) return 401;
    return c.sub === policy.founder ? 200 : 403;
  } catch {
    return 401;
  }
}

function projectTaskBoard(text) {
  const headings = [...text.matchAll(/^##[ \t]+(TASK-\d{1,10})[ \t]+—[ \t]+.*$/gm)];
  return headings.slice(0, 100).map((entry, index) => {
    const section = text.slice(entry.index + entry[0].length, headings[index + 1]?.index)
      .split(/^##[ \t]+/m, 1)[0];
    const code = /^-[ \t]+\*\*Durum:\*\*[ \t]+([A-Z_]+)\b/m.exec(section)?.[1];
    const status = ['OPEN','IN_PROGRESS','DONE','COMPLETED','TAMAMLANDI','WAITING','BLOCKED'].includes(code)
      ? code : 'UNVERIFIED';
    return { id: entry[1], status };
  });
}

function projectRows(rows, corporate) {
  return rows.flatMap(({ id, version, at, approval }) => {
    if (!uuidPattern.test(id) || !Number.isSafeInteger(version) || version < 1 ||
        !(at instanceof Date) || !Number.isFinite(at.valueOf())) return [];
    const summary = { id, version, at: at.toISOString() };
    if (!corporate) return [summary];
    return [{ ...summary, approval: ['pending_review','approved','rejected','changes_requested'].includes(approval)
      ? approval : 'unverified' }];
  });
}

module.exports = { authPolicy, authorize, origin, projectRows, projectTaskBoard };
