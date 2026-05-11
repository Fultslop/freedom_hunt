import yaml from "js-yaml";
import type { Env } from "../types/worker";
import type { Location } from "../types/data";

const LOC_FILE_PATTERN = /^\d+_loc_.*\.yaml$/;
const DATA_PATH = "src/data/text/en/projects";

interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  content?: string;
  encoding?: string;
}

interface LocationEntry {
  filename: string;
  sha: string;
  location: Location;
}

interface PRStatus {
  number: number;
  title: string;
  state: string;
  html_url: string;
}

async function githubRequest(
  path: string,
  options: RequestInit = {},
  env: Env,
): Promise<unknown> {
  const res = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${env.GITHUB_PAT}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "freedom-hunt-editor",
        ...(options.headers ?? {}),
      },
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub ${res.status}: ${err}`);
  }
  return res.json();
}

export function decodeGitHubContent(base64: string): string {
  const raw = atob(base64.replace(/\s/g, ""));
  const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeGitHubContent(content: string): string {
  const bytes = new TextEncoder().encode(content);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

export function locationFilePath(
  project: string,
  city: string,
  filename: string,
): string {
  return `${DATA_PATH}/${project}/${city}/${filename}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function fetchLocations(
  project: string,
  city: string,
  env: Env,
): Promise<LocationEntry[]> {
  const files = (await githubRequest(
    `/contents/${DATA_PATH}/${project}/${city}`,
    {},
    env,
  )) as GitHubFile[];
  const locationFiles = files.filter((f) => LOC_FILE_PATTERN.test(f.name));
  return Promise.all(
    locationFiles.map((f) => fetchLocation(project, city, f.name, env)),
  );
}

export async function fetchLocation(
  project: string,
  city: string,
  filename: string,
  env: Env,
): Promise<LocationEntry> {
  const file = (await githubRequest(
    `/contents/${locationFilePath(project, city, filename)}`,
    {},
    env,
  )) as GitHubFile;
  const content = file.content
    ? (yaml.load(decodeGitHubContent(file.content)) as Location)
    : ({} as Location);
  return { filename, sha: file.sha, location: content };
}

export async function createFilePR(
  filePath: string,
  content: string,
  teamName: string,
  env: Env,
): Promise<{ prUrl: string }> {
  const repoOwner = env.GITHUB_REPO.split("/")[0];
  const teamSlug = slugify(teamName) || "admin";
  const branch = `editor/${teamSlug}/${slugify(filePath)}`;

  // Always get main SHA (needed for branch creation fallback)
  const { object } = (await githubRequest(`/git/ref/heads/main`, {}, env)) as {
    object: { sha: string };
  };

  // Check if our deterministic branch already exists
  let branchExists = false;
  try {
    await githubRequest(`/git/ref/heads/${branch}`, {}, env);
    branchExists = true;
  } catch {
    // 404 = branch doesn't exist yet
  }

  if (!branchExists) {
    await githubRequest(
      `/git/refs`,
      {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: object.sha }),
      },
      env,
    );
  }

  // Get file SHA on the branch (not main) so the commit succeeds
  let currentSha: string | null = null;
  try {
    const existing = (await githubRequest(
      `/contents/${filePath}?ref=${branch}`,
      {},
      env,
    )) as GitHubFile;
    currentSha = existing.sha ?? null;
  } catch {
    // 404 = new file on this branch
  }

  await githubRequest(
    `/contents/${filePath}`,
    {
      method: "PUT",
      body: JSON.stringify({
        message: `editor: update ${filePath.split("/").pop()}`,
        content: encodeGitHubContent(content),
        branch,
        ...(currentSha ? { sha: currentSha } : {}),
      }),
    },
    env,
  );

  // Find existing open PR for this branch, or create one
  const openPRs = (await githubRequest(
    `/pulls?head=${repoOwner}:${branch}&state=open`,
    {},
    env,
  )) as Array<{ html_url: string }>;

  if (openPRs.length > 0) {
    return { prUrl: openPRs[0].html_url };
  }

  const pr = (await githubRequest(
    `/pulls`,
    {
      method: "POST",
      body: JSON.stringify({
        title: `editor: update ${filePath.split("/").pop()}`,
        head: branch,
        base: "main",
        body: "Created via editor UI",
      }),
    },
    env,
  )) as { html_url: string };

  return { prUrl: pr.html_url };
}

export async function fetchPRStatuses(
  numbers: string[],
  env: Env,
): Promise<Record<string, string>> {
  const statuses: Record<string, string> = {};
  for (const num of numbers) {
    const pr = (await githubRequest(`/pulls/${num}`, {}, env)) as PRStatus;
    statuses[num] = pr.state;
  }
  return statuses;
}
