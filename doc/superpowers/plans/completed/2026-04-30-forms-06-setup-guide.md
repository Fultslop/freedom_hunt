# Task 6 — Setup guide

**Files:**
- Create: `doc/setup.md`

---

No tests for this task.

- [ ] **Step 1: Create doc/setup.md**

Create `doc/setup.md` with the following content:

````markdown
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

1. In your new Sheet, click the menu: **Extensions → Apps Script**
2. A new browser tab opens with the Apps Script editor
3. You'll see a default function `myFunction() {}` — delete it entirely

### Step 3: Paste the script

Copy and paste the following into the editor (replacing the deleted code):

```javascript
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents)
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet()
    sheet.appendRow([
      data.timestamp,
      data.locationId,
      data.submitterId,
      JSON.stringify(data.fields),
    ])
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON)
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON)
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
````

- [ ] **Step 2: Commit**

```
git add doc/setup.md
git commit -m "docs: add setup guide for Google Apps Script and Cloudflare Worker secret"
```
````
