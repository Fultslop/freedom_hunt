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

export async function createLocationPR(
  project: string,
  city: string,
  filename: string,
  content: string,
  _existingSha: string | null,
  env: Env,
): Promise<{ prUrl: string }> {
  const branch = `editor/${Date.now()}`;
  const path = locationFilePath(project, city, filename);

  const { object } = (await githubRequest(
    `/git/ref/heads/main`,
    {},
    env,
  )) as { object: { sha: string } };

  await githubRequest(
    `/git/refs`,
    {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: object.sha }),
    },
    env,
  );

  let currentSha: string | null = null;
  try {
    const existing = (await githubRequest(
      `/contents/${path}`,
      {},
      env,
    )) as GitHubFile;
    currentSha = existing.sha ?? null;
  } catch {
    // 404 = new file
  }

  await githubRequest(
    `/contents/${path}`,
    {
      method: "PUT",
      body: JSON.stringify({
        message: `editor: update ${filename}`,
        content: encodeGitHubContent(content),
        branch,
        ...(currentSha ? { sha: currentSha } : {}),
      }),
    },
    env,
  );

  const pr = (await githubRequest(
    `/pulls`,
    {
      method: "POST",
      body: JSON.stringify({
        title: `editor: update ${filename}`,
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