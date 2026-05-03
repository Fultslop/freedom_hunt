# Task 07: Setup Documentation

Status: Completed

> Part of [2026-05-02-location-editor.md](2026-05-02-location-editor.md)

**Goal:** Document the one-time manual steps an operator needs to use the location editor: creating a GitHub PAT, storing it as a Cloudflare Worker secret, setting the admin KV password, and verifying the setup.

**Files:**

- Modify: `doc/setup.md` — add Part 5 covering editor setup

---

- [ ] **Step 1: Add Part 5 to `doc/setup.md`**

Append the following to the end of `doc/setup.md`:

```markdown
---

## Part 5: Location Editor Setup

The location editor at `/editor` lets organisers add, edit, and hide hunt locations without touching code. Each change creates a GitHub pull request for review before going live. Two one-time setup steps are required: a GitHub Personal Access Token and an admin password.

### Step 1: Create a GitHub Personal Access Token

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. Click **Generate new token**
3. Set the name: `Freedom Hunt Editor`
4. Set expiration as appropriate (1 year is reasonable; you'll need to rotate it)
5. Under **Repository access**, select **Only select repositories** and choose this repo
6. Under **Permissions**, grant:
   - **Contents**: Read and write
   - **Pull requests**: Read and write
7. Click **Generate token** and copy the value — you will not see it again

### Step 2: Store the PAT as a Cloudflare secret
```

wrangler secret put GITHUB_PAT

````

Paste the token when prompted. Confirm with `wrangler secret list` — `GITHUB_PAT` should appear.

Redeploy: `npm run deploy`

### Step 3: Verify GITHUB_REPO in `wrangler.jsonc`

Open `wrangler.jsonc` and confirm the `vars.GITHUB_REPO` value matches your repo:

```jsonc
"vars": {
  "GITHUB_REPO": "your-github-username/freedom_hunt"
}
````

If you forked or renamed the repo, update this value and redeploy.

### Step 4: Set an admin password in KV

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com)
2. Go to **Workers & Pages → KV → AUTH_STORE**
3. Click **Add entry**
4. Key: `admin:your_project_id` (e.g. `admin:democrats_abroad`)
5. Value: your chosen admin password — make it strong and store it securely
6. Click **Save**

### Step 5: Verify

1. Navigate to `https://your-app-domain/editor/login`
2. Enter the project ID and admin password
3. Confirm you reach the Organiser tools landing page
4. Click Locations — confirm the location list loads

### Local development

For local development with `wrangler dev`, add your PAT to `.dev.vars`:

```
GITHUB_PAT=your_personal_access_token_here
```

Set the local admin KV entry (run once):

```
wrangler kv key put --binding=AUTH_STORE "admin:democrats_abroad" "your-admin-password" --local
```

### Security notes

- The PAT gives write access to the repo. Treat it like a password — never commit it or expose it in logs.
- Admin sessions last 30 days (same as participant sessions). If the admin password is compromised, rotate it in KV immediately. Existing admin sessions will continue until they expire — to invalidate all sessions, rotate `AUTH_SECRET` via `wrangler secret put AUTH_SECRET`.
- The editor routes (`/editor/locations`, `/editor/location`) are protected by admin auth in the Worker. The PAT never reaches the browser.

```

- [ ] **Step 2: Commit**

```

git add doc/setup.md
git commit -m "docs: add location editor setup guide (GitHub PAT, admin KV password)"

```

```
