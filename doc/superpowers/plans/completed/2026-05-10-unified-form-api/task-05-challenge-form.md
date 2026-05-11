# Task 05: Refactor `ChallengeForm` to Thin Wrapper

**Files:**
- Modify: `src/components/ChallengeForm.svelte`
- Modify: `src/components/ChallengeForm.css`

`ChallengeForm` becomes a thin wrapper around `AppForm`. It keeps: flag dividers and success state message. It provides: the `onSubmit` callback (builds challenge payload, calls `postFormSubmit`), `onPhotoUpload` callback (calls `postPhotoUpload`), and `confirmMessage`.

Field rendering moves entirely to `AppForm`. The confirm dialog also moves to `AppForm` (it's triggered by the `confirmMessage` prop). All field CSS moves to `AppForm.css`.

---

- [ ] **Step 1: Replace `ChallengeForm.svelte`**

Replace the entire file contents with:

```svelte
<script lang="ts">
  import { Flag } from "lucide-svelte";
  import { authStore } from "../stores/authStore";
  import type { FormField } from "../types/data";
  import { postFormSubmit, postPhotoUpload } from "../utils/api";
  import AppForm from "./AppForm.svelte";
  import "./ChallengeForm.css";

  let {
    form,
    locationId,
    routeId = undefined,
  }: { form: FormField[]; locationId: number; routeId?: string } = $props();

  let submitted = $state(false);

  async function handleSubmit(values: Record<string, unknown>) {
    const data = await postFormSubmit({
      locationId,
      routeId,
      teamName: $authStore.activeAuth?.teamName ?? "",
      contact: $authStore.activeAuth?.contact ?? "",
      answers: values,
    });
    if (!data.ok) throw new Error("Submission failed");
  }

  async function handlePhotoUpload(file: File): Promise<{ ok: boolean }> {
    return postPhotoUpload(locationId, file);
  }
</script>

<div class="challenge-form">
  {#if submitted}
    <p class="cf-success">Submitted! ✓</p>
  {:else}
    <div class="cf-divider" aria-hidden="true">
      <span class="cf-divider__line"></span>
      <Flag size={12} aria-hidden="true" />
      <span class="cf-divider__line"></span>
    </div>

    <AppForm
      fields={form}
      onSubmit={handleSubmit}
      onPhotoUpload={handlePhotoUpload}
      onSuccess={() => (submitted = true)}
      confirmMessage="Submit your answers?"
      submitLabel="Submit"
    />

    <div class="cf-divider" aria-hidden="true">
      <span class="cf-divider__line"></span>
      <Flag size={12} aria-hidden="true" />
      <span class="cf-divider__line"></span>
    </div>
  {/if}
</div>
```

- [ ] **Step 2: Replace `ChallengeForm.css` with chrome-only styles**

Replace the entire file with (field styles have moved to `AppForm.css`):

```css
/* src/components/ChallengeForm.css */

.cf-divider {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 20px 0;
}

.cf-divider__line {
  flex: 1;
  height: 1px;
  background: var(--color-border);
}

.cf-success {
  font-size: var(--font-size-base);
  color: var(--color-success);
  font-weight: 600;
  margin-top: 12px;
}
```

- [ ] **Step 3: Run lint**

```
npm run lint
```

Expected: passes cleanly. The `challenge-form` class is referenced in ChallengeCard — that class name is unchanged.

- [ ] **Step 4: Run tests**

```
npm test -- ChallengeForm
```

Some tests will fail because they mock `globalThis.fetch` but `ChallengeForm` no longer calls `fetch` directly. They will be fixed in Task 12.

- [ ] **Step 5: Commit**

```
git add src/components/ChallengeForm.svelte src/components/ChallengeForm.css
git commit -m "refactor: ChallengeForm becomes thin wrapper around AppForm"
```
