function queryFlag(params: URLSearchParams, name: string): boolean {
  const value = params.get(name)?.trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}

function expertReviewFlag(params: URLSearchParams): boolean {
  return queryFlag(params, 'expert_review') || params.get('expert_review')?.trim().toLowerCase() === 'probe';
}

function hashParams(url: URL): URLSearchParams {
  const queryIndex = url.hash.indexOf('?');
  return queryIndex >= 0
    ? new URLSearchParams(url.hash.slice(queryIndex + 1))
    : new URLSearchParams();
}

export function isExpertReviewUrl(
  value = typeof window === 'undefined' ? 'http://localhost/' : window.location.href,
): boolean {
  const url = new URL(value, 'http://localhost/');
  return expertReviewFlag(url.searchParams) || expertReviewFlag(hashParams(url));
}

export function isDirectProbeReviewUrl(
  value = typeof window === 'undefined' ? 'http://localhost/' : window.location.href,
): boolean {
  const url = new URL(value, 'http://localhost/');
  const sources = [url.searchParams, hashParams(url)];
  return (
    isExpertReviewUrl(value) &&
    sources.some(
      (params) =>
        queryFlag(params, 'probe') || params.get('expert_review')?.trim().toLowerCase() === 'probe',
    )
  );
}

export function showsResearcherControls(
  value = typeof window === 'undefined' ? 'http://localhost/' : window.location.href,
): boolean {
  const url = new URL(value, 'http://localhost/');
  return (
    isExpertReviewUrl(value) ||
    queryFlag(url.searchParams, 'researcher') ||
    queryFlag(hashParams(url), 'researcher')
  );
}

export function canonicalizeEntryUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const original = url.href;
  const hashRoute = url.hash.slice(1).split('?')[0];
  const hashQuery = hashParams(url);

  if (isExpertReviewUrl(url.href) && !expertReviewFlag(url.searchParams)) {
    url.searchParams.set(
      'expert_review',
      hashQuery.get('expert_review')?.trim().toLowerCase() === 'probe' ? 'probe' : 'true',
    );
  }

  if (hashRoute === '' || hashRoute === '/') {
    hashQuery.forEach((value, key) => {
      if (!url.searchParams.has(key)) url.searchParams.set(key, value);
    });
    url.hash = '';
  }

  if (url.href !== original) window.history.replaceState(window.history.state, '', url);
}

export function readProlificId(
  value = typeof window === 'undefined' ? 'http://localhost/' : window.location.href,
): string {
  const url = new URL(value, 'http://localhost/');
  const params = [url.searchParams, hashParams(url)];
  const keys = ['PROLIFIC_PID', 'prolific_pid', 'prolificPid'];
  for (const source of params) {
    for (const key of keys) {
      const candidate = source.get(key)?.trim();
      if (candidate) return candidate;
    }
  }
  return '';
}

export function readExpertSceneId(
  value = typeof window === 'undefined' ? 'http://localhost/' : window.location.href,
): string {
  const url = new URL(value, 'http://localhost/');
  const sources = [url.searchParams, hashParams(url)];
  for (const params of sources) {
    const sceneId = params.get('scene')?.trim() || params.get('sceneId')?.trim();
    if (sceneId) return sceneId;
  }
  return '';
}
