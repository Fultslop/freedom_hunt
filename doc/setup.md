# Setup Guide

This document covers the one-time manual setup required to make form submissions work. It covers two steps: (1) creating the Google Apps Script that receives submissions and writes them to a Google Sheet, and (2) storing the Script URL as a Cloudflare Worker secret.

---

## Part 1: Google Apps Script

### What you need

- A Google account (the Sheet will live in this account's Google Drive)
- About 10 minutes

### Step 1: Create a new Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com)
2. Click **+ Blank** to create a new spreadsheet
3. Name it something like **Freedom Hunt — Form Submissions** (click "Untitled spreadsheet" at the top to rename)
4. Leave the tab name as "Sheet1" (the script targets the active sheet by default)

### Step 2: Open the Apps Script editor

> **Troubleshooting:** If the menu fails with "Kan het bestand momenteel niet openen", use the direct method below instead.

**Option A — From the Sheet menu:**

1. In your new Sheet, click the menu: **Extensions → Apps Script**
2. If it fails, close the Sheet tab and try again, or use Option B

**Option B — Direct (recommended if Option A fails):**

1. Go to **[script.google.com](https://script.google.com)** and sign in
2. Click **+ New Project**
3. Name it **Freedom Hunt Forms** and delete the default `myFunction`
4. Paste the script from Step 3
5. Click **Save** (Ctrl+S)
6. To link this script to your Sheet: in the Sheet, go to **Extensions → Apps Script** — your saved project should now appear in the dropdown. If not, refresh the Sheet page.
7. If the script can't find the Sheet (shows "No active spreadsheet"), add your Sheet ID directly. Open your Google Sheet, copy the ID from the URL (the long string between `/spreadsheets/d/` and `/edit`), and update the script:
   ```javascript
   var spreadsheetId = "YOUR_SHEET_ID_HERE";
   var sheet = SpreadsheetApp.openById(spreadsheetId).getActiveSheet();
   ```
8. A new browser tab opens with the Apps Script editor
9. You'll see a default function `myFunction() {}` — delete it entirely

### Step 3: Paste the script

Copy and paste the following into the editor (replacing the deleted code):

```javascript
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.appendRow([
      data.timestamp,
      data.locationId,
      data.submitterId,
      JSON.stringify(data.fields),
    ]);
    return ContentService.createTextOutput(
      JSON.stringify({ ok: true }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: err.message }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
```

### Step 4: Save the script

Press **Ctrl+S** (or **Cmd+S** on Mac), or click the floppy disk icon. Name the project anything you like, e.g. **Freedom Hunt Forms**.

### Step 5: Deploy as a Web App

1. Click the blue **Deploy** button (top right) → **New deployment**
2. Click the **gear icon** (⚙) next to "Select type" and choose **Web app**
3. Set the fields:
   - **Description:** anything, e.g. `v1`
   - **Execute as:** `Me` (your Google account)
   - **Who has access:** `Anyone`
4. Click **Deploy**

### Step 6: Authorize the app

A dialog will appear asking you to authorize the script to access your Google Sheets.

1. Click **Authorize access**
2. Pick your Google account
3. You may see a warning: "Google hasn't verified this app" — click **Advanced** (bottom left), then **Go to [your project name] (unsafe)**
4. Review the permissions (it only needs access to your spreadsheets) and click **Allow**

### Step 7: Copy the Web App URL

After authorization, the deployment dialog shows a **Web app URL** — it looks like:

```
https://script.google.com/macros/s/AKfycby.../exec
```

**Copy this URL and keep it safe.** You'll need it in Part 2. This URL is the only thing protecting your Sheet from unauthorized submissions — treat it like a password.

---

## Part 2: Cloudflare Worker Secret

The Web App URL must be stored as a Cloudflare Worker secret so it never appears in code or git.

### Prerequisites

- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) installed (`npm install -g wrangler` if not)
- Logged in to Cloudflare (`wrangler login`)

### Step 1: Set the secret

In the project root directory, run:

```
wrangler secret put FORM_SCRIPT_URL
```

When prompted, paste the Web App URL from Part 1, Step 7. Press Enter.

Wrangler will confirm: `✅ Created secret FORM_SCRIPT_URL`

### Step 2: Verify

Deploy the Worker (if not already deployed):

```
npm run deploy
```

Submit a test form in the live app. Check your Google Sheet — a new row should appear within a few seconds.

---

---

## Part 3: Login & Authentication

This section explains how the participant login system works and how to manage it. No coding is required for day-to-day operation.

### How it works

When participants open the app and tap your project — or follow any direct link into it (a city page, a route page, anything under your project URL) — they see a full-screen login form with three fields:

- **Team name** — how the team identifies themselves during the hunt
- **Contact email** — optional, for follow-up
- **Password** — the project password you distribute to all participants before the event

Once they enter the correct password, they're logged in on that device for **30 days** and can access all cities and routes within your project. They won't be asked again unless they sign out or the session expires.

> **One password, whole project.** A single password covers the entire project — all cities and routes beneath it. You don't set separate passwords per city.

> **Both entry points are protected.** Whether a participant arrives through the home screen or via a direct deep link (e.g. a city or route URL you shared), they'll always hit the login form first if they haven't already authenticated.

### Setting a password for your project

Passwords are stored in Cloudflare's KV store — a secure key-value database you manage through the Cloudflare dashboard. No code changes or redeployment needed.

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com)
2. Go to **Workers & Pages → KV**
3. Open the **AUTH_STORE** namespace
4. Click **Add entry**
5. Set the **Key** to `auth:your_project_id` (e.g. `auth:democrats_abroad`)
6. Set the **Value** to your chosen password
7. Click **Save**

That's it. The change takes effect immediately.

### Rotating the password

To change the password, find the entry for your project in the **AUTH_STORE** KV namespace and update the value. No redeployment needed.

**Important:** Participants who already logged in with the old password will remain logged in for up to 30 days. Their session was issued when they authenticated and isn't tied to the current password — so changing the password doesn't immediately lock them out.

This is generally fine for events. If you ever need to immediately invalidate all active sessions (across all projects), contact the developer — they can rotate the `AUTH_SECRET` signing key, which expires every session at once.

### Changing the session duration

The default is **30 days**. Changing it (e.g. to 90 days) requires a one-line code change and redeployment. Contact the developer.

### What participants see

**Login form** — Full-screen, themed to match your project. Appears automatically when they first access any page under your project URL.

**Profile** — After logging in, participants can tap ☰ (top-right menu) → **Profile** to see their team name, contact email, and a **Sign out** button.

**Themes** — The same ☰ menu has a **Themes** tab with the visual style switcher (unchanged from before).

### Sign out

Participants can sign out via ☰ → **Profile** → **Sign out**. This clears their session from the device. They'll need to re-enter the password to get back in.

> **Note:** Signing out and back in with the same password is always possible — sign-out just clears the local session, it doesn't lock the account.

### One-time developer setup

Before this feature works, a developer needs to do the following once:

1. Create the **AUTH_STORE** KV namespace in Cloudflare and bind it in `wrangler.toml`
2. Set the signing secret: `wrangler secret put AUTH_SECRET` (a random string — keep it safe)
3. Deploy the updated Worker: `npm run deploy`

After that, organizers manage passwords entirely through the Cloudflare dashboard.

---

## Troubleshooting

**No row appears in the Sheet after submitting:**

- Check the browser's Network tab for the `/form-submit` request. If it returns `{ ok: false }`, the Worker received it but the Script call failed.
- Open the Apps Script editor → **Executions** (left sidebar) to see error logs.
- Make sure the deployment is set to "Anyone" access — re-deploy if needed.

**The form shows "Submission failed" immediately:**

- The Worker may not have the secret set. Run `wrangler secret list` to verify `FORM_SCRIPT_URL` appears.
- Redeploy the Worker after setting the secret: `npm run deploy`.

**"Google hasn't verified this app" warning during authorization:**

- This is expected for personal scripts. Follow the "Advanced → Go to [project] (unsafe)" steps in Part 1, Step 6.

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
```

Paste the token when prompted. Confirm with `wrangler secret list` — `GITHUB_PAT` should appear.

Redeploy: `npm run deploy`

### Step 3: Verify GITHUB_REPO in `wrangler.jsonc`

Open `wrangler.jsonc` and confirm the `vars.GITHUB_REPO` value matches your repo:

```jsonc
"vars": {
  "GITHUB_REPO": "your-github-username/freedom_hunt"
}
```

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
