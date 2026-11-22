export function browserSafeKey(key: string) {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  try {
    const [, payload] = key.split('.');
    const value = JSON.parse(atob(payload.replaceAll('-', '+').replaceAll('_', '/')));
    return value.role === 'anon';
  } catch { return false; }
}

export function validProjectUrl(value: string) {
  try {
    const url = new URL(value);
    return !url.username && !url.password && !url.search && !url.hash && (url.pathname === '/' || url.pathname === '') &&
      (url.protocol === 'https:' || url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  } catch { return false; }
}
