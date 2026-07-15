export function withBasePath(path: string, base = import.meta.env.BASE_URL): string {
  const cleanPath = path.replace(/^\//, '');
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  return `${cleanBase}${cleanPath}`;
}

