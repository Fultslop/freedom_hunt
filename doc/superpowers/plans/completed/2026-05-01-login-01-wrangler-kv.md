# Task 01 — wrangler.jsonc: KV binding

**Files:**

- Modify: `wrangler.jsonc`

---

- [ ] **Step 1: Create the KV namespace**

Run in the project root:

```bash
npx wrangler kv namespace create AUTH_STORE
```

Copy the namespace ID from the output.

- [ ] **Step 2: Add the KV binding to wrangler.jsonc**

Add the `kv_namespaces` array to `wrangler.jsonc` (after the `r2_buckets` array):

```jsonc
  "kv_namespaces": [
    {
      "binding": "AUTH_STORE",
      "id": "REPLACE_WITH_YOUR_KV_NAMESPACE_ID"
    }
  ],
```

Replace `REPLACE_WITH_YOUR_KV_NAMESPACE_ID` with the ID copied in Step 1.

- [ ] **Step 3: Set the AUTH_SECRET signing key**

Generate a strong random secret and set it:

```bash
openssl rand -base64 48 | npx wrangler secret put AUTH_SECRET
```

```ps1
$bytes = New-Object Byte[] 48
$rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::Create()
$rng.GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

This is the HMAC signing key — keep it secret.

- [ ] **Step 4: Verify wrangler config is valid**

Run:

```bash
npx wrangler deploy --dry-run
```

Expected: no errors about unknown bindings. If it complains about the KV namespace ID not existing, double-check you pasted the correct ID from Step 1.

- [ ] **Step 5: Commit**

```bash
git add wrangler.jsonc
git commit -m "config: add AUTH_STORE KV namespace binding"
```
