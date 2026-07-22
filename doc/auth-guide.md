# Auth Guide

This guide explains how the authentication system works for organizers running a hunt and for developers self-hosting the app.

---

## For Organizers

### Creating your account

1. Open the app and navigate to **#/signup** (add `/signup` to the app URL).
2. Enter your email address, a username, and a password (minimum 8 characters).
3. Choose your email preferences — you can opt in to receive hunt result summaries and/or product updates.
4. Click **Create account**. You are now logged in.

> Your account has no project access yet. The maintainer needs to grant you organizer access for your project (see the Bootstrap section below for the first-time setup).

---

### Inviting an editor

Once you have organizer access for a project:

1. Sign in at **#/editor/login** and go to the Editor home page.
2. Click **Invite editor**. A one-time invite link is generated (valid for 48 hours).
3. Copy the link and send it to your editor however you like — email, WhatsApp, Slack, etc. The link is not tied to a specific email address; whoever clicks it can accept the invite.
4. The editor clicks the link, creates an account (or signs in if they have one), and is automatically granted editor access for your project.

> **Tip:** If you want to invite an organizer instead of an editor, contact your maintainer — organizer invites require a configuration step.

---

### Revoking access

To remove an editor's access, contact your maintainer. Self-service revocation through an organizer dashboard is planned for a future release.

---

### Signing in as an editor

1. Go to **#/editor/login**.
2. Enter the email address and password you used when you created your account.
3. Click **Sign in**.

If you have already accepted an invite, you will be taken to the editor. If you have not yet been invited, sign in will succeed but you will not have access to the editor content — contact your organizer for an invite link.

---

## For Self-Hosters

### Prerequisites

- A Cloudflare account with Workers and D1 enabled (free tier is sufficient for small deployments).
- `wrangler` CLI installed and authenticated (`npx wrangler login`).

### First-time setup

**1. Create the D1 database**

```bash
npx wrangler d1 create scavenger_hunt_auth
```

Copy the `database_id` from the output.

**2. Add the D1 binding to `wrangler.jsonc`**

```jsonc
"d1_databases": [
  {
    "binding": "AUTH_DB",
    "database_name": "scavenger_hunt_auth",
    "database_id": "<YOUR_DATABASE_ID>"
  }
]
```

**3. Apply the schema**

```bash
npx wrangler d1 execute scavenger_hunt_auth --file=migrations/001_init.sql
```

For local development, add `--local`:

```bash
npx wrangler d1 execute scavenger_hunt_auth --local --file=migrations/001_init.sql
```

**4. Add your project to the projects table**

```bash
npx wrangler d1 execute scavenger_hunt_auth \
  --command "INSERT OR IGNORE INTO projects (id, hunt_mode, editor_mode, created_at) VALUES ('your_project_id', 'limited', 'restricted', unixepoch())"
```

**5. Set an admin bootstrap password in KV**

This one-time password is only used to grant the first organizer account. It is never used for regular login.

```bash
npx wrangler kv key put "admin:your_project_id" "your_bootstrap_password" \
  --binding AUTH_STORE
```

For local development:

```bash
npx wrangler kv key put "admin:your_project_id" "your_bootstrap_password" \
  --binding AUTH_STORE --local
```

**6. Bootstrap the first organizer**

a. Create a regular user account at `#/signup`.

b. Call the login endpoint with the bootstrap password to get a bootstrap token:

```bash
curl -c cookies.txt -X POST https://your-app.workers.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"project":"your_project_id","password":"your_bootstrap_password"}'
```

c. Find your `user_id` from the signup response or by checking the D1 database:

```bash
npx wrangler d1 execute scavenger_hunt_auth \
  --command "SELECT id, email FROM users WHERE email = 'your@email.com'"
```

d. Grant yourself organizer capability:

```bash
curl -b cookies.txt -X POST https://your-app.workers.dev/auth/bootstrap/promote \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<YOUR_USER_ID>"}'
```

You are now logged in as an organizer and can use the invite flow to add editors.

---

### Auth modes

Each project has two configurable access modes stored in the `projects` table:

| Mode | `hunt_mode` | `editor_mode` |
|------|------------|--------------|
| `open` | Anyone can access with no login | (not recommended for editor) |
| `limited` | Requires a shared password | — |
| `restricted` | Requires an individual account | Individual accounts + whitelist |

To change a project's mode:

```bash
npx wrangler d1 execute scavenger_hunt_auth \
  --command "UPDATE projects SET hunt_mode = 'open' WHERE id = 'your_project_id'"
```

> Hunt mode enforcement (open/limited/restricted) is planned for a future release. Currently only `editor_mode: 'restricted'` is enforced.

---

### Local development

Run the app locally with the Cloudflare worker emulator:

```bash
npm run preview
```

This builds the app and starts `wrangler dev`, which uses local KV and D1 databases. All auth flows work the same as in production.

---

### Data model reference

| Table | Purpose |
|-------|---------|
| `projects` | Project registry with hunt and editor access modes |
| `users` | User accounts (email, username, PBKDF2 password hash, GDPR consent) |
| `user_project_caps` | Maps users to projects with a capability (`user`, `editor`, `organizer`) |
| `invite_tokens` | One-time invite links with a 48-hour TTL |

Passwords are hashed with PBKDF2-SHA256 (100,000 iterations, random 128-bit salt) using the Web Crypto API. No external dependency.
