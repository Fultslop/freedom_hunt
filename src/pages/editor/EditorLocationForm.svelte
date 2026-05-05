<script lang="ts">
  import { untrack } from "svelte";
  import { push } from "svelte-spa-router";
  import { titleBarStore } from "../../stores/titleBarStore";
  import { addPending } from "./editorStorage";
  import type { FormField } from "../../types/data";
  import "./EditorLocationForm.css";

  let {
    params,
  }: {
    params: {
      project: string;
      city: string;
      filename?: string;
    };
  } = $props();

  const isEdit = $derived(!!params.filename);

  interface Fields {
    locationId: string;
    title: string;
    image: string;
    name: { label: string; value: string };
    address: string;
    coordinates: { latitude: string; longitude: string };
    storyline: string;
    challenge: {
      name: string;
      description: string;
      notes: string;
      form: FormField[];
    };
    breadcrumb: string;
  }

  const EMPTY: Fields = {
    locationId: "",
    title: "",
    image: "",
    name: { label: "", value: "" },
    address: "",
    coordinates: { latitude: "", longitude: "" },
    storyline: "",
    challenge: { name: "", description: "", notes: "", form: [] },
    breadcrumb: "",
  };

  function buildFilename(locationId: string | number, title: string): string {
    const slug = String(title)
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
    return `${String(locationId).padStart(3, "0")}_loc_${slug}.yaml`;
  }

  let fields = $state<Fields>({ ...EMPTY });
  let existingSha = $state<string | null>(null);
  let loading = $state(untrack(() => Boolean(params.filename)));
  let submitState = $state<"idle" | "submitting" | "success" | "error">("idle");
  let prUrl = $state<string | null>(null);
  let submitError = $state<string | null>(null);

  $effect(() => {
    titleBarStore.set({
      title: isEdit ? "Edit location" : "Add location",
      progress: null,
      backPath: `/editor/locations/${params.project}/${params.city}`,
    });
  });

  $effect(() => {
    if (isEdit && params.filename) {
      loading = true;
      fetch(
        `/editor/location?project=${params.project}&city=${params.city}&file=${params.filename}`,
      )
        .then((r) => r.json())
        .then((data) => {
          const typed = data as {
            ok?: boolean;
            sha?: string;
            location?: Record<string, unknown>;
          };
          if (typed.ok && typed.location) {
            fields = {
              ...EMPTY,
              ...(typed.location ?? {}),
              name: {
                ...EMPTY.name,
                ...((typed.location.name as object) ?? {}),
              },
              coordinates: {
                ...EMPTY.coordinates,
                ...((typed.location.coordinates as object) ?? {}),
              },
              challenge: {
                ...EMPTY.challenge,
                ...((typed.location.challenge as object) ?? {}),
              },
            } as Fields;
            existingSha = typed.sha ?? null;
          }
        })
        .catch(() => {})
        .finally(() => {
          loading = false;
        });
    }
  });

  function setField(path: string, value: unknown) {
    if (path.includes(".")) {
      const [parent, child] = path.split(".");
      const parentVal = (fields as unknown as Record<string, unknown>)[
        parent
      ] as Record<string, unknown>;
      fields = {
        ...fields,
        [parent]: { ...parentVal, [child]: value },
      } as Fields;
    } else {
      fields = { ...fields, [path]: value } as Fields;
    }
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    submitState = "submitting";
    submitError = null;

    const resolvedFilename = isEdit
      ? params.filename
      : buildFilename(fields.locationId, fields.title);

    const location = {
      ...fields,
      locationId: Number(fields.locationId) || fields.locationId,
      coordinates: {
        latitude: parseFloat(fields.coordinates.latitude) || 0,
        longitude: parseFloat(fields.coordinates.longitude) || 0,
      },
    };

    try {
      const res = await fetch("/editor/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: params.project,
          city: params.city,
          filename: resolvedFilename,
          existingSha,
          location,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        prUrl?: string;
        error?: string;
      };
      if (data.ok) {
        addPending(params.project, params.city, {
          filename: resolvedFilename!,
          locationTitle: fields.title,
          prUrl: data.prUrl,
          prTitle: `${isEdit ? "Edit" : "Add"} location: ${fields.title}`,
          submittedAt: new Date().toISOString(),
        });
        submitState = "success";
        prUrl = data.prUrl ?? null;
      } else {
        submitError = data.error ?? "Submission failed";
        submitState = "error";
      }
    } catch {
      submitError = "Request failed. Check your connection.";
      submitState = "error";
    }
  }
</script>

{#if loading}
  <div class="loc-form__loading">Loading…</div>
{:else if submitState === "success"}
  <div class="loc-form">
    <div class="loc-form__success">
      ✓ Changes submitted for review.
      {#if prUrl}
        <a
          href={prUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="loc-form__pr-link"
        >
          View pull request →
        </a>
      {/if}
    </div>
    <div class="loc-form__actions" style="margin-top: 20px">
      <button
        class="loc-form__cancel"
        onclick={() =>
          push(`/editor/locations/${params.project}/${params.city}`)}
      >
        Back to list
      </button>
    </div>
  </div>
{:else}
  <form class="loc-form" onsubmit={handleSubmit}>
    <div class="loc-form__section">
      <div class="loc-form__section-title">Identity</div>

      <div class="loc-form__field">
        <label class="loc-form__label" for="locationId">
          Location ID <span class="loc-form__label--muted"
            >(number, must be unique)</span
          >
        </label>
        <input
          id="locationId"
          type="number"
          value={fields.locationId}
          oninput={(e) =>
            setField("locationId", (e.target as HTMLInputElement).value)}
          required
          readonly={isEdit}
          class={`loc-form__input${isEdit ? " loc-form__input--readonly" : ""}`}
        />
      </div>

      <div class="loc-form__field">
        <label class="loc-form__label" for="title">Title</label>
        <input
          id="title"
          type="text"
          value={fields.title}
          oninput={(e) =>
            setField("title", (e.target as HTMLInputElement).value)}
          required
          class="loc-form__input"
        />
      </div>

      <div class="loc-form__field">
        <label class="loc-form__label" for="image">
          Image filename <span class="loc-form__label--muted"
            >(e.g. my-photo.jpg — upload separately)</span
          >
        </label>
        <input
          id="image"
          type="text"
          value={fields.image}
          oninput={(e) =>
            setField("image", (e.target as HTMLInputElement).value)}
          class="loc-form__input"
        />
      </div>

      <div class="loc-form__row">
        <div class="loc-form__field">
          <label class="loc-form__label" for="nameLabel">Name label</label>
          <input
            id="nameLabel"
            type="text"
            value={fields.name.label}
            oninput={(e) =>
              setField("name.label", (e.target as HTMLInputElement).value)}
            class="loc-form__input"
          />
        </div>
        <div class="loc-form__field">
          <label class="loc-form__label" for="nameValue">Name value</label>
          <input
            id="nameValue"
            type="text"
            value={fields.name.value}
            oninput={(e) =>
              setField("name.value", (e.target as HTMLInputElement).value)}
            class="loc-form__input"
          />
        </div>
      </div>

      <div class="loc-form__field">
        <label class="loc-form__label" for="address">Street address</label>
        <input
          id="address"
          type="text"
          value={fields.address}
          oninput={(e) =>
            setField("address", (e.target as HTMLInputElement).value)}
          class="loc-form__input"
        />
      </div>

      <div class="loc-form__row">
        <div class="loc-form__field">
          <label class="loc-form__label" for="latitude">Latitude</label>
          <input
            id="latitude"
            type="number"
            step="any"
            value={fields.coordinates.latitude}
            oninput={(e) =>
              setField(
                "coordinates.latitude",
                (e.target as HTMLInputElement).value,
              )}
            class="loc-form__input"
          />
        </div>
        <div class="loc-form__field">
          <label class="loc-form__label" for="longitude">Longitude</label>
          <input
            id="longitude"
            type="number"
            step="any"
            value={fields.coordinates.longitude}
            oninput={(e) =>
              setField(
                "coordinates.longitude",
                (e.target as HTMLInputElement).value,
              )}
            class="loc-form__input"
          />
        </div>
      </div>
    </div>

    <div class="loc-form__section">
      <div class="loc-form__section-title">Narrative</div>

      <div class="loc-form__field">
        <label class="loc-form__label" for="storyline">Storyline</label>
        <textarea
          id="storyline"
          value={fields.storyline}
          oninput={(e) =>
            setField("storyline", (e.target as HTMLTextAreaElement).value)}
          class="loc-form__textarea"
          style="min-height: 120px"
        ></textarea>
      </div>

      <div class="loc-form__field">
        <label class="loc-form__label" for="breadcrumb">Breadcrumb clue</label>
        <textarea
          id="breadcrumb"
          value={fields.breadcrumb}
          oninput={(e) =>
            setField("breadcrumb", (e.target as HTMLTextAreaElement).value)}
          class="loc-form__textarea"
        ></textarea>
      </div>
    </div>

    <div class="loc-form__section">
      <div class="loc-form__section-title">Challenge</div>

      <div class="loc-form__field">
        <label class="loc-form__label" for="challengeName">Challenge name</label
        >
        <input
          id="challengeName"
          type="text"
          value={fields.challenge.name}
          oninput={(e) =>
            setField("challenge.name", (e.target as HTMLInputElement).value)}
          class="loc-form__input"
        />
      </div>

      <div class="loc-form__field">
        <label class="loc-form__label" for="challengeDescription"
          >Challenge description</label
        >
        <textarea
          id="challengeDescription"
          value={fields.challenge.description}
          oninput={(e) =>
            setField(
              "challenge.description",
              (e.target as HTMLTextAreaElement).value,
            )}
          class="loc-form__textarea"
          style="min-height: 100px"
        ></textarea>
      </div>

      <div class="loc-form__field">
        <label class="loc-form__label" for="challengeNotes">
          Notes <span class="loc-form__label--muted"
            >(internal, not shown to participants)</span
          >
        </label>
        <textarea
          id="challengeNotes"
          value={fields.challenge.notes}
          oninput={(e) =>
            setField(
              "challenge.notes",
              (e.target as HTMLTextAreaElement).value,
            )}
          class="loc-form__textarea"
        ></textarea>
      </div>

      {#if isEdit && fields.challenge.form?.length > 0}
        <p class="loc-form__hint">
          This location has {fields.challenge.form.length} form field(s). Form fields
          are preserved but not editable here — edit them directly in the YAML file.
        </p>
      {/if}
    </div>

    {#if submitError}
      <div class="loc-form__error">✕ {submitError}</div>
    {/if}

    <div class="loc-form__actions">
      <button
        type="button"
        class="loc-form__cancel"
        onclick={() =>
          push(`/editor/locations/${params.project}/${params.city}`)}
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={submitState === "submitting"}
        class={`loc-form__submit${submitState === "submitting" ? " loc-form__submit--loading" : ""}`}
      >
        {submitState === "submitting" ? "Submitting…" : "Submit for review"}
      </button>
    </div>
  </form>
{/if}
