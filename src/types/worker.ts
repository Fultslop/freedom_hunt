/// <reference types="@cloudflare/workers-types" />

export interface Env {
  AUTH_STORE: KVNamespace;
  AUTH_SECRET: string;
  PHOTOS: R2Bucket;
  ASSETS: Fetcher;
  GITHUB_REPO: string;
  GITHUB_PAT: string;
  FORM_SCRIPT_URL: string;
}
