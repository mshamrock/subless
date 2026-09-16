/** Thin GitHub REST client: only what the ranking and ownership checks need. */

const API = "https://api.github.com";

function headers(token?: string) {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "subless",
  };
  const t = token ?? process.env.GITHUB_TOKEN;
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

export interface ParsedRepo {
  owner: string;
  repo: string;
  fullName: string;
}

/** Accepts any reasonable repo reference, including bare `owner/repo`. */
export function parseRepoUrl(input: string): ParsedRepo | null {
  const raw = input.trim().replace(/\.git$/, "").replace(/\/+$/, "");
  if (!raw) return null;

  const shorthand = raw.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (shorthand) {
    return { owner: shorthand[1], repo: shorthand[2], fullName: `${shorthand[1]}/${shorthand[2]}` };
  }

  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (!/(^|\.)github\.com$/i.test(url.hostname)) return null;

  const [owner, repo] = url.pathname.split("/").filter(Boolean);
  if (!owner || !repo) return null;
  return { owner, repo, fullName: `${owner}/${repo}` };
}

export interface RepoSnapshot {
  fullName: string;
  description: string | null;
  homepage: string | null;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  contributors: number;
  releaseDownloads: number;
  pushedAt: Date | null;
  licenseSpdx: string | null;
  archived: boolean;
}

/**
 * Each project costs up to three API calls: the repo itself, plus contributors
 * and release downloads. Unauthenticated callers only get 60 calls an hour, so
 * once the budget runs low we keep fetching the essential repo record and drop
 * the two enrichment calls. A catalog with slightly incomplete numbers beats a
 * catalog where two thirds of the rows failed outright.
 */
const ENRICHMENT_BUDGET = 8;

export async function fetchRepoSnapshot(
  fullName: string,
  token?: string,
): Promise<RepoSnapshot> {
  const res = await fetch(`${API}/repos/${fullName}`, {
    headers: headers(token),
    cache: "no-store",
  });
  if (res.status === 404) throw new Error(`Repository ${fullName} not found or private`);
  if (res.status === 403 || res.status === 429) {
    throw new Error("GitHub API rate limit reached — set GITHUB_TOKEN");
  }
  if (!res.ok) throw new Error(`GitHub API returned ${res.status} for ${fullName}`);
  const repo = await res.json();

  const remaining = Number(res.headers.get("x-ratelimit-remaining") ?? Infinity);
  const canEnrich = remaining > ENRICHMENT_BUDGET;

  const [contributors, releaseDownloads] = canEnrich
    ? await Promise.all([
        fetchContributorCount(fullName, token),
        fetchReleaseDownloads(fullName, token),
      ])
    : [0, 0];

  return {
    fullName: repo.full_name,
    description: repo.description ?? null,
    homepage: repo.homepage || null,
    stars: repo.stargazers_count ?? 0,
    forks: repo.forks_count ?? 0,
    watchers: repo.subscribers_count ?? 0,
    openIssues: repo.open_issues_count ?? 0,
    contributors,
    releaseDownloads,
    pushedAt: repo.pushed_at ? new Date(repo.pushed_at) : null,
    licenseSpdx: repo.license?.spdx_id ?? null,
    archived: Boolean(repo.archived),
  };
}

/**
 * GitHub does not expose a contributor count directly. The trick: request a
 * page of size 1 and read the last page number out of the Link header.
 */
async function fetchContributorCount(fullName: string, token?: string): Promise<number> {
  try {
    const res = await fetch(
      `${API}/repos/${fullName}/contributors?per_page=1&anon=1`,
      { headers: headers(token), cache: "no-store" },
    );
    if (!res.ok) return 0;

    const link = res.headers.get("link");
    if (link) {
      const last = link.match(/[?&]page=(\d+)>;\s*rel="last"/);
      if (last) return Number(last[1]);
    }
    const body = await res.json();
    return Array.isArray(body) ? body.length : 0;
  } catch {
    return 0;
  }
}

/** Total downloads across all release assets. Honestly returns 0 for web projects. */
async function fetchReleaseDownloads(fullName: string, token?: string): Promise<number> {
  try {
    const res = await fetch(`${API}/repos/${fullName}/releases?per_page=100`, {
      headers: headers(token),
      cache: "no-store",
    });
    if (!res.ok) return 0;
    const releases = await res.json();
    if (!Array.isArray(releases)) return 0;

    return releases.reduce(
      (total: number, r: { assets?: { download_count?: number }[] }) =>
        total +
        (r.assets ?? []).reduce((s, a) => s + (a.download_count ?? 0), 0),
      0,
    );
  } catch {
    return 0;
  }
}

/**
 * Ownership check: does this user have push access to the repository?
 * Called with the user's own access token from the GitHub login, which is what
 * stops someone submitting a repo they do not own as their own work.
 */
/**
 * Result of the pre-submission repository check.
 * `private` and `missing` are separated deliberately: they call for completely
 * different fixes, and telling someone "not found" when the real problem is
 * visibility sends them hunting for a typo that is not there.
 */
export type RepoCheck =
  | { ok: true; snapshot: RepoSnapshot }
  | { ok: false; reason: "missing" | "private" | "unavailable"; detail?: string };

/**
 * Verifies a repository exists and is publicly reachable, before anything is
 * written to the database. Without this, a made-up URL creates a catalog entry
 * that can never have metrics — it just carries a permanent sync error.
 *
 * The visibility test is "can the app token see it", which is the same question
 * as "can a stranger clone it". A caveat worth being explicit about: if
 * GITHUB_TOKEN belongs to a person, their own private repos come back 200, so
 * the `private` flag on the payload is checked as well and not just the status.
 */
export async function checkPublicRepo(
  fullName: string,
  userAccessToken?: string,
): Promise<RepoCheck> {
  let res: Response;
  try {
    res = await fetch(`${API}/repos/${fullName}`, {
      headers: headers(),
      cache: "no-store",
    });
  } catch (e) {
    return {
      ok: false,
      reason: "unavailable",
      detail: e instanceof Error ? e.message : String(e),
    };
  }

  if (res.status === 403 || res.status === 429) {
    return { ok: false, reason: "unavailable", detail: "GitHub API rate limit" };
  }

  if (res.status === 404) {
    // The user's own token can see their private repos, which tells the two cases apart
    if (userAccessToken) {
      const asUser = await fetch(`${API}/repos/${fullName}`, {
        headers: headers(userAccessToken),
        cache: "no-store",
      }).catch(() => null);
      if (asUser?.ok) return { ok: false, reason: "private" };
    }
    return { ok: false, reason: "missing" };
  }

  if (!res.ok) {
    return { ok: false, reason: "unavailable", detail: `GitHub API ${res.status}` };
  }

  const repo = await res.json();
  if (repo.private) return { ok: false, reason: "private" };

  const remaining = Number(res.headers.get("x-ratelimit-remaining") ?? Infinity);
  const canEnrich = remaining > ENRICHMENT_BUDGET;
  const [contributors, releaseDownloads] = canEnrich
    ? await Promise.all([
        fetchContributorCount(fullName, undefined),
        fetchReleaseDownloads(fullName, undefined),
      ])
    : [0, 0];

  return {
    ok: true,
    snapshot: {
      fullName: repo.full_name,
      description: repo.description ?? null,
      homepage: repo.homepage || null,
      stars: repo.stargazers_count ?? 0,
      forks: repo.forks_count ?? 0,
      watchers: repo.subscribers_count ?? 0,
      openIssues: repo.open_issues_count ?? 0,
      contributors,
      releaseDownloads,
      pushedAt: repo.pushed_at ? new Date(repo.pushed_at) : null,
      licenseSpdx: repo.license?.spdx_id ?? null,
      archived: Boolean(repo.archived),
    },
  };
}

export async function verifyRepoOwnership(
  fullName: string,
  userAccessToken: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${API}/repos/${fullName}`, {
      headers: headers(userAccessToken),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const repo = await res.json();
    return Boolean(repo.permissions?.push || repo.permissions?.admin);
  } catch {
    return false;
  }
}

export async function fetchGithubUser(login: string, token?: string) {
  const res = await fetch(`${API}/users/${login}`, {
    headers: headers(token),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as { id: number; created_at: string; login: string };
}
