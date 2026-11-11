import { setBaseUrl } from '@workspace/api-client-react';

let done = false;
export function initApi() {
  if (done) return;
  done = true;
  setBaseUrl(import.meta.env.BASE_URL.replace(/\/$/, ''));
}
