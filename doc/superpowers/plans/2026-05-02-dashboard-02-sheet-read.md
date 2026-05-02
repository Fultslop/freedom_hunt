# Task 02: Update Apps Script — Fix Schema + Add doGet

> Part of [2026-05-02-dashboard.md](2026-05-02-dashboard.md)

**Goal:** The existing Apps Script saves only 4 columns (`timestamp, locationId, submitterId, fields`) but the Worker sends 6 fields (`timestamp, routeId, locationId, teamName, email, fields`). Fix `doPost` to save the full payload, and add `doGet` so the Worker can read rows back for the dashboard.

**This task is mostly manual.** The code changes are to the Apps Script (done in the Google browser editor) and to `doc/setup.md` in the repo. There is no new Worker route in this task — the Worker endpoint that calls `FORM_SCRIPT_URL` with GET is added in Task 05.

**Files:**
- Modify: `doc/setup.md` — update the script in Part 1 Step 3, add a new Part 4 for reading data
- Manual: redeploy the Apps Script as a new version in the Google editor

---

- [ ] **Step 1: Open the Apps Script editor**

In the Google Sheet used for form submissions, click **Extensions → Apps Script**. You should see the existing `doPost` function.

- [ ] **Step 2: Replace the script with the updated version**

Delete everything and paste:

```javascript
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents)
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet()
    sheet.appendRow([
      data.timestamp  || '',
      data.routeId    || '',
      data.locationId || '',
      data.teamName   || '',
      data.email      || '',
      JSON.stringify(data.fields || {}),
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

function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet()
    var allValues = sheet.getDataRange().getValues()
    if (allValues.length < 2) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, rows: [] }))
        .setMimeType(ContentService.MimeType.JSON)
    }
    var headers = allValues[0]
    var rows = allValues.slice(1).map(function(row) {
      var obj = {}
      headers.forEach(function(h, i) { obj[h] = row[i] })
      return obj
    })
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, rows: rows }))
      .setMimeType(ContentService.MimeType.JSON)
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON)
  }
}
```

- [ ] **Step 3: Add column headers to the sheet (if not already present)**

In row 1 of the Google Sheet, manually type these headers in columns A–F:

```
timestamp | routeId | locationId | teamName | email | fields
```

If the sheet already has data rows with the old schema (4 columns: `timestamp, locationId, submitterId, fields`), those rows will be misread by `doGet` — the header names will be wrong. Add a note in the sheet or migrate existing rows manually if needed.

- [ ] **Step 4: Save and redeploy**

1. Press **Ctrl+S** to save
2. Click **Deploy → Manage deployments**
3. Click the pencil/edit icon on the current deployment
4. Change the **Version** dropdown to **New version**
5. Click **Deploy**

The deployment URL does not change — `FORM_SCRIPT_URL` secret in Cloudflare stays the same.

- [ ] **Step 5: Smoke-test doGet manually**

Paste the deployment URL into a browser tab and append nothing (it's already a GET). You should see JSON like:

```json
{ "ok": true, "rows": [] }
```

or an array of existing rows. If you see an HTML error page, check the Apps Script **Executions** tab for the error message.

- [ ] **Step 6: Update `doc/setup.md`**

In Part 1, Step 3, replace the script block with the new version from Step 2 above.

Add a new section after the existing content:

```markdown
## Part 4: Reading Submissions (for the Dashboard)

The `doGet()` function added to the Apps Script in Part 1 allows the Cloudflare Worker to read all submitted rows for the organiser dashboard.

**No extra setup is required** — the same `FORM_SCRIPT_URL` secret is used for both reading (GET) and writing (POST).

### Column schema

After the Part 1 update, your sheet should have these headers in row 1:

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| timestamp | routeId | locationId | teamName | email | fields |

`fields` is a JSON string — e.g. `{"q1":"answer","q2":"42"}`.

### Admin password

To access the dashboard, an admin password must be set in KV:

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com)
2. Go to **Workers & Pages → KV → AUTH_STORE**
3. Click **Add entry**
4. Key: `admin:your_project_id` (e.g. `admin:democrats_abroad`)
5. Value: your chosen admin password
6. Click **Save**

The dashboard is then accessible at `/admin` after logging in with the admin password.
```

- [ ] **Step 7: Commit**

```
git add doc/setup.md
git commit -m "docs: update Apps Script to full payload schema, add doGet and dashboard setup"
```
