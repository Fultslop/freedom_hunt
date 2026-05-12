# Task 02 — SubmitModal component

**Files:**
- Create: `src/pages/editor/SubmitModal.svelte`
- Create: `src/pages/editor/SubmitModal.css`
- Create: `src/test/SubmitModal.test.ts`

**Context:** A portal-rendered modal that overlays the form during submission. Three states: `"submitting"` (spinner, Back button), `"success"` (green heading, PR link, Back button), `"failed"` (red heading, copyable error block, Back + Retry buttons). Uses the same `portal` action pattern as `AppForm`'s confirm dialog. The form behind the modal is visible but non-interactive (the backdrop catches pointer events). **Depends on Task 01** — `PendingEntry` status types must exist, though this component doesn't import from editorStorage.

---

- [ ] **Step 1: Write the failing tests**

Create `src/test/SubmitModal.test.ts`:

```ts
import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import SubmitModal from "../pages/editor/SubmitModal.svelte";

vi.mock("svelte-spa-router", () => ({ push: vi.fn() }));

test("submitting state: shows heading and 'Opening PR' subtext for new PR", async () => {
  render(SubmitModal, {
    props: {
      state: "submitting",
      prTitle: "Add location: Binnenhof",
      isNewPr: true,
      onBack: vi.fn(),
      onRetry: vi.fn(),
    },
  });
  expect(await screen.findByText(/submitting form for review/i)).toBeInTheDocument();
  expect(screen.getByText(/Opening PR:.*Binnenhof/)).toBeInTheDocument();
});

test("submitting state: shows 'Updating PR #47' subtext when updating existing PR", async () => {
  render(SubmitModal, {
    props: {
      state: "submitting",
      prTitle: "Edit location: Binnenhof",
      isNewPr: false,
      existingPrUrl: "https://github.com/org/repo/pull/47",
      onBack: vi.fn(),
      onRetry: vi.fn(),
    },
  });
  expect(await screen.findByText(/Updating PR #47/)).toBeInTheDocument();
});

test("success state: shows heading and PR link", async () => {
  render(SubmitModal, {
    props: {
      state: "success",
      prTitle: "Add location: Binnenhof",
      isNewPr: true,
      newPrUrl: "https://github.com/org/repo/pull/42",
      onBack: vi.fn(),
      onRetry: vi.fn(),
    },
  });
  expect(await screen.findByText(/form submitted for review/i)).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /PR #42 opened/i }),
  ).toHaveAttribute("href", "https://github.com/org/repo/pull/42");
});

test("success state: shows 'updated' label when updating existing PR", async () => {
  render(SubmitModal, {
    props: {
      state: "success",
      prTitle: "Edit location: Binnenhof",
      isNewPr: false,
      existingPrUrl: "https://github.com/org/repo/pull/47",
      newPrUrl: "https://github.com/org/repo/pull/47",
      onBack: vi.fn(),
      onRetry: vi.fn(),
    },
  });
  expect(await screen.findByRole("link", { name: /PR #47 updated/i })).toBeInTheDocument();
});

test("failed state: shows heading and selectable error text", async () => {
  render(SubmitModal, {
    props: {
      state: "failed",
      prTitle: "Add location: Binnenhof",
      isNewPr: true,
      error: "GitHub API 422: branch already exists",
      onBack: vi.fn(),
      onRetry: vi.fn(),
    },
  });
  expect(await screen.findByText(/submission failed/i)).toBeInTheDocument();
  expect(screen.getByText(/GitHub API 422: branch already exists/)).toBeInTheDocument();
});

test("failed state: Retry button calls onRetry", async () => {
  const onRetry = vi.fn();
  render(SubmitModal, {
    props: {
      state: "failed",
      prTitle: "Edit location: Test",
      isNewPr: false,
      error: "Something went wrong",
      onBack: vi.fn(),
      onRetry,
    },
  });
  await screen.findByText(/submission failed/i);
  await fireEvent.click(screen.getByRole("button", { name: /retry/i }));
  expect(onRetry).toHaveBeenCalledOnce();
});

test("Back button calls onBack in all states", async () => {
  const onBack = vi.fn();
  render(SubmitModal, {
    props: {
      state: "submitting",
      prTitle: "Add location: Test",
      isNewPr: true,
      onBack,
      onRetry: vi.fn(),
    },
  });
  await screen.findByText(/submitting form for review/i);
  await fireEvent.click(screen.getByRole("button", { name: /back to location list/i }));
  expect(onBack).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run to confirm they fail**

```
npx vitest run src/test/SubmitModal.test.ts --reporter=verbose
```

Expected: FAIL — `SubmitModal.svelte` does not exist.

- [ ] **Step 3: Create `src/pages/editor/SubmitModal.css`**

```css
.submit-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.submit-modal {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 28px 32px;
  width: min(400px, calc(100vw - 32px));
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.submit-modal__heading {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 8px;
}

.submit-modal__heading--success {
  color: #27ae60;
}

.submit-modal__heading--failed {
  color: var(--color-error, #c0392b);
}

.submit-modal__subtext {
  font-size: 12px;
  font-family: monospace;
  color: var(--color-text-secondary);
  margin: 0 0 20px;
}

.submit-modal__pr-link {
  color: var(--color-accent);
  font-weight: 600;
}

.submit-modal__progress {
  height: 3px;
  background: var(--color-border);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 20px;
  position: relative;
}

.submit-modal__progress::after {
  content: "";
  position: absolute;
  inset-block: 0;
  left: -40%;
  width: 40%;
  background: var(--color-accent);
  border-radius: 2px;
  animation: submit-modal-slide 1.2s ease-in-out infinite;
}

@keyframes submit-modal-slide {
  0%   { left: -40%; }
  100% { left: 100%; }
}

.submit-modal__error {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 10px 12px;
  font-family: monospace;
  font-size: 11px;
  color: var(--color-error, #c0392b);
  white-space: pre-wrap;
  word-break: break-all;
  user-select: all;
  margin: 0 0 20px;
}

.submit-modal__actions {
  display: flex;
  gap: 8px;
}

.submit-modal__btn {
  flex: 1;
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
}

.submit-modal__btn--secondary {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.submit-modal__btn--primary {
  background: var(--color-accent);
  color: #fff;
}

.submit-modal__btn--danger {
  background: #c0392b;
  color: #fff;
}
```

- [ ] **Step 4: Create `src/pages/editor/SubmitModal.svelte`**

```svelte
<script lang="ts">
  import "./SubmitModal.css";

  let {
    state,
    prTitle,
    isNewPr,
    existingPrUrl = undefined,
    newPrUrl = undefined,
    error = undefined,
    onBack,
    onRetry,
  }: {
    state: "submitting" | "success" | "failed";
    prTitle: string;
    isNewPr: boolean;
    existingPrUrl?: string;
    newPrUrl?: string;
    error?: string;
    onBack: () => void;
    onRetry: () => void;
  } = $props();

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  function extractPrNumber(url: string | undefined): string | null {
    if (!url) return null;
    const match = url.match(/\/pull\/(\d+)/);
    return match ? match[1] : null;
  }

  const existingPrNumber = $derived(extractPrNumber(existingPrUrl));
  const newPrNumber = $derived(extractPrNumber(newPrUrl));
</script>

<div class="submit-modal-backdrop" use:portal>
  <div class="submit-modal">
    {#if state === "submitting"}
      <h2 class="submit-modal__heading">Submitting form for review</h2>
      <p class="submit-modal__subtext">
        {#if isNewPr}
          Opening PR: "{prTitle}"
        {:else}
          Updating PR #{existingPrNumber}
        {/if}
      </p>
      <div class="submit-modal__progress"></div>
      <button
        class="submit-modal__btn submit-modal__btn--secondary"
        onclick={onBack}
      >
        ← Back to location list
      </button>
    {:else if state === "success"}
      <h2 class="submit-modal__heading submit-modal__heading--success">
        ✓ Form submitted for review
      </h2>
      <p class="submit-modal__subtext">
        {#if newPrUrl}
          <a
            href={newPrUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="submit-modal__pr-link"
          >
            PR #{newPrNumber}
            {isNewPr ? "opened" : "updated"} →
          </a>
        {/if}
      </p>
      <button
        class="submit-modal__btn submit-modal__btn--primary"
        onclick={onBack}
      >
        ← Back to location list
      </button>
    {:else}
      <h2 class="submit-modal__heading submit-modal__heading--failed">
        ✕ Submission failed
      </h2>
      <pre class="submit-modal__error">{error}</pre>
      <div class="submit-modal__actions">
        <button
          class="submit-modal__btn submit-modal__btn--secondary"
          onclick={onBack}
        >
          ← Back to list
        </button>
        <button
          class="submit-modal__btn submit-modal__btn--danger"
          onclick={onRetry}
        >
          ↺ Retry
        </button>
      </div>
    {/if}
  </div>
</div>
```

- [ ] **Step 5: Run the tests to confirm they pass**

```
npx vitest run src/test/SubmitModal.test.ts --reporter=verbose
```

Expected: all 7 tests PASS.

- [ ] **Step 6: Run the full suite**

```
npx vitest run --reporter=verbose
```

Expected: no regressions.

- [ ] **Step 7: Commit**

```
git add src/pages/editor/SubmitModal.svelte src/pages/editor/SubmitModal.css src/test/SubmitModal.test.ts
git commit -m "feat: add SubmitModal component with submitting/success/failed states"
```
