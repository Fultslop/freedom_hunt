# `video` Form Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `video` form field type that lets a team record a short (≤12s) video-with-audio message in-app and upload it, for use first on `005_form_malieveld.yaml`, without risking Cloudflare R2 storage costs the way an unbounded native-camera upload would.

**Architecture:** In-app capture bounds clip size at the source — the page opens the camera itself via `getUserMedia`, records through `MediaRecorder` with a capped bitrate and a hard ~12s auto-stop, and extracts a JPEG poster frame client-side. The poster reuses the *existing* photo pipeline (`generateVariants`) unchanged; only the raw video clip is new storage, added as one extra R2 object per submission. Server-side, video submissions reuse the `photos` D1 table (a new `kind` discriminator column) rather than a parallel table, so gallery listing/filtering logic stays unified. Six independently-testable slices: (1) a pure `videoCapture.ts` browser-API wrapper, (2) a `VideoRecorderField.svelte` capture UI built on it, (3) wiring the `video` field type into `AppForm.svelte`, (4) the server upload route + DB/R2 plumbing, (5) gallery playback support, (6) the actual `005_form_malieveld.yaml` content change.

**Tech Stack:** Svelte 5 (runes), TypeScript, browser `MediaRecorder`/`getUserMedia` APIs, `lucide-svelte` (`Video` icon), Cloudflare Workers + R2 + D1, Vitest + `@testing-library/svelte`.

## Global Constraints

- **No git commands.** This repo's `.claude/CLAUDE.md` reserves git control for the user — do not run `git add`/`git commit`/etc. Each task ends with "ready for review," not a commit step.
- **TypeScript only** — `.svelte` files use `<script lang="ts">`; no `.js`/`.jsx`/`.tsx` in `src/`.
- **Svelte 5 runes only** (`$state`, `$derived`, `$effect`, `$props`) — no Svelte 4 `$:` syntax.
- **CSS via co-located `.css` files** using `var(--color-*)` tokens; class names follow the existing `af-`/component-prefix BEM-ish convention.
- **No Playwright/browser automation** for verification — the user does manual verification themselves. Manual verification of the actual camera/recording flow on a real phone is called out explicitly at the end of the relevant tasks.
- **Video clips must stay small by construction**: capped bitrate (~800kbps video + 64kbps audio) and a hard ~12s auto-stop, enforced client-side in `videoCapture.ts` — this is the mechanism that makes video-only submissions safe for Cloudflare R2's free tier at this project's scale (~10-30 teams/hunt), not a size limit enforced only after the fact.
- **Reuse existing infrastructure wherever the spec calls for it**: the poster frame goes through the existing `generateVariants()` image pipeline unchanged; video rows reuse the existing `photos` D1 table (new `kind` column) and `uploadRoute.ts`'s auth/R2/DB pattern, not a parallel mechanism.

---

### Task 1: `src/utils/videoCapture.ts` — recording utility

**Files:**
- Create: `src/utils/videoCapture.ts`
- Test: `src/test/videoCapture.test.ts`

**Interfaces:**
- Produces: `MAX_RECORD_MS: number`; `isVideoRecordingSupported(): boolean`; `requestCameraStream(): Promise<MediaStream>`; `startVideoRecording(stream: MediaStream): VideoRecording` where `VideoRecording = { done: Promise<File>; stop: () => void }`; `capturePosterFrame(videoEl: HTMLVideoElement): Promise<File>`. All five are consumed by Task 2's `VideoRecorderField.svelte`.

- [ ] **Step 1: Write the failing tests**

Create `src/test/videoCapture.test.ts`:

```ts
import {
  isVideoRecordingSupported,
  pickSupportedMimeType,
  requestCameraStream,
  startVideoRecording,
  capturePosterFrame,
  MAX_RECORD_MS,
} from "../utils/videoCapture";

class FakeDataEvent extends Event {
  data: Blob;
  constructor(data: Blob) {
    super("dataavailable");
    this.data = data;
  }
}

class FakeMediaRecorder extends EventTarget {
  static isTypeSupported = vi.fn((type: string) => type === "video/webm;codecs=vp8,opus");
  state: "inactive" | "recording" = "inactive";
  constructor(
    public stream: MediaStream,
    public options: MediaRecorderOptions,
  ) {
    super();
  }
  start() {
    this.state = "recording";
  }
  stop() {
    if (this.state === "inactive") {
      return;
    }
    this.state = "inactive";
    this.dispatchEvent(new FakeDataEvent(new Blob(["chunk"])));
    this.dispatchEvent(new Event("stop"));
  }
}

beforeEach(() => {
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

test("pickSupportedMimeType returns the first supported candidate", () => {
  expect(pickSupportedMimeType()).toBe("video/webm;codecs=vp8,opus");
});

test("pickSupportedMimeType returns null when nothing is supported", () => {
  vi.spyOn(FakeMediaRecorder, "isTypeSupported").mockReturnValue(false);
  expect(pickSupportedMimeType()).toBeNull();
});

test("isVideoRecordingSupported is true when getUserMedia and a mime type both exist", () => {
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn() } });
  expect(isVideoRecordingSupported()).toBe(true);
});

test("isVideoRecordingSupported is false without getUserMedia", () => {
  vi.stubGlobal("navigator", { mediaDevices: {} });
  expect(isVideoRecordingSupported()).toBe(false);
});

test("isVideoRecordingSupported is false when no mime type is supported", () => {
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn() } });
  vi.spyOn(FakeMediaRecorder, "isTypeSupported").mockReturnValue(false);
  expect(isVideoRecordingSupported()).toBe(false);
});

test("requestCameraStream calls getUserMedia with capped resolution and audio enabled", async () => {
  const fakeStream = {} as MediaStream;
  const getUserMedia = vi.fn().mockResolvedValue(fakeStream);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  const result = await requestCameraStream();
  expect(result).toBe(fakeStream);
  expect(getUserMedia).toHaveBeenCalledWith({
    video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
    audio: true,
  });
});

test("startVideoRecording auto-stops after MAX_RECORD_MS and resolves done with an encoded File", async () => {
  vi.useFakeTimers();
  const recording = startVideoRecording({} as MediaStream);
  vi.advanceTimersByTime(MAX_RECORD_MS);
  const file = await recording.done;
  expect(file).toBeInstanceOf(File);
  expect(file.type).toBe("video/webm;codecs=vp8,opus");
  expect(file.name).toBe("clip.webm");
});

test("startVideoRecording resolves done early when stop() is called manually", async () => {
  vi.useFakeTimers();
  const recording = startVideoRecording({} as MediaStream);
  recording.stop();
  const file = await recording.done;
  expect(file).toBeInstanceOf(File);
});

test("startVideoRecording throws synchronously when no mime type is supported", () => {
  vi.spyOn(FakeMediaRecorder, "isTypeSupported").mockReturnValue(false);
  expect(() => startVideoRecording({} as MediaStream)).toThrow(
    "No supported video recording format",
  );
});

test("capturePosterFrame draws the current video frame to a canvas and returns a JPEG File", async () => {
  const drawImage = vi.fn();
  const toBlob = vi.fn((cb: BlobCallback) =>
    cb(new Blob(["jpeg-bytes"], { type: "image/jpeg" })),
  );
  const fakeCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue({ drawImage }),
    toBlob,
  };
  vi.spyOn(document, "createElement").mockReturnValue(
    fakeCanvas as unknown as HTMLCanvasElement,
  );
  const videoEl = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement;

  const file = await capturePosterFrame(videoEl);

  expect(fakeCanvas.width).toBe(640);
  expect(fakeCanvas.height).toBe(480);
  expect(drawImage).toHaveBeenCalledWith(videoEl, 0, 0, 640, 480);
  expect(file).toBeInstanceOf(File);
  expect(file.type).toBe("image/jpeg");
  expect(file.name).toBe("poster.jpg");
});

test("capturePosterFrame rejects when no 2D context is available", async () => {
  const fakeCanvas = { width: 0, height: 0, getContext: vi.fn().mockReturnValue(null), toBlob: vi.fn() };
  vi.spyOn(document, "createElement").mockReturnValue(
    fakeCanvas as unknown as HTMLCanvasElement,
  );
  await expect(
    capturePosterFrame({ videoWidth: 640, videoHeight: 480 } as HTMLVideoElement),
  ).rejects.toThrow("2D canvas context unavailable");
});

test("capturePosterFrame rejects when JPEG encoding produces no blob", async () => {
  const fakeCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue({ drawImage: vi.fn() }),
    toBlob: vi.fn((cb: BlobCallback) => cb(null)),
  };
  vi.spyOn(document, "createElement").mockReturnValue(
    fakeCanvas as unknown as HTMLCanvasElement,
  );
  await expect(
    capturePosterFrame({ videoWidth: 640, videoHeight: 480 } as HTMLVideoElement),
  ).rejects.toThrow("JPEG encoding failed");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- videoCapture`
Expected: FAIL — `src/utils/videoCapture.ts` doesn't exist yet.

- [ ] **Step 3: Implement `src/utils/videoCapture.ts`**

```ts
export const MAX_RECORD_MS = 12_000;
const VIDEO_BITS_PER_SECOND = 800_000;
const AUDIO_BITS_PER_SECOND = 64_000;

// Preference order: MP4/H.264 for Safari/iOS (the only container it records
// to), then WebM/VP8 for Chrome/Firefox/Android.
const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export function pickSupportedMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") {
    return null;
  }
  return MIME_CANDIDATES.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? null;
}

export function isVideoRecordingSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    pickSupportedMimeType() !== null
  );
}

export async function requestCameraStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
    audio: true,
  });
}

export interface VideoRecording {
  /** Resolves with the encoded clip once recording stops — either the
   * MAX_RECORD_MS auto-stop timer or a manual `stop()` call. */
  done: Promise<File>;
  /** Requests an immediate stop; safe to call after recording has already auto-stopped. */
  stop: () => void;
}

export function startVideoRecording(stream: MediaStream): VideoRecording {
  const mimeType = pickSupportedMimeType();
  if (!mimeType) {
    throw new Error("No supported video recording format");
  }
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
    audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
  });
  recorder.addEventListener("dataavailable", (event: Event) => {
    const data = (event as unknown as { data: Blob }).data;
    if (data.size > 0) {
      chunks.push(data);
    }
  });
  const done = new Promise<File>((resolve) => {
    recorder.addEventListener("stop", () => {
      clearTimeout(autoStopTimer);
      const ext = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
      resolve(new File(chunks, `clip.${ext}`, { type: mimeType }));
    });
  });
  recorder.start();
  const autoStopTimer = setTimeout(() => {
    if (recorder.state !== "inactive") {
      recorder.stop();
    }
  }, MAX_RECORD_MS);
  return {
    done,
    stop: () => {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    },
  };
}

export async function capturePosterFrame(videoEl: HTMLVideoElement): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = videoEl.videoWidth || 640;
  canvas.height = videoEl.videoHeight || 480;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas context unavailable");
  }
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.85);
  });
  if (!blob) {
    throw new Error("JPEG encoding failed");
  }
  return new File([blob], "poster.jpg", { type: "image/jpeg" });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- videoCapture`
Expected: all tests PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Ready for review**

Do not commit. Summarize the diff (`src/utils/videoCapture.ts`, `src/test/videoCapture.test.ts`) for the user to review.

---

### Task 2: `src/components/VideoRecorderField.svelte` — capture UI

**Files:**
- Create: `src/components/VideoRecorderField.svelte`
- Create: `src/components/VideoRecorderField.css`
- Test: `src/test/VideoRecorderField.test.ts`

**Interfaces:**
- Consumes: `isVideoRecordingSupported`, `requestCameraStream`, `startVideoRecording`, `capturePosterFrame`, `MAX_RECORD_MS`, `VideoRecording` from Task 1's `src/utils/videoCapture.ts` (mocked in this task's tests, exercised for real by Task 1's own tests).
- Produces: a `VideoRecorderField` component with props `{ label: string; onRecorded: (video: File, poster: File) => void }`. Consumed by Task 3's `AppForm.svelte`.

- [ ] **Step 1: Write the failing tests**

Create `src/test/VideoRecorderField.test.ts`:

```ts
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import VideoRecorderField from "../components/VideoRecorderField.svelte";
import * as videoCapture from "../utils/videoCapture";
import type { VideoRecording } from "../utils/videoCapture";

vi.mock("../utils/videoCapture", () => ({
  isVideoRecordingSupported: vi.fn(() => true),
  requestCameraStream: vi.fn(),
  startVideoRecording: vi.fn(),
  capturePosterFrame: vi.fn(),
  MAX_RECORD_MS: 12000,
}));

function makeFakeStream(): MediaStream {
  return { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
}

afterEach(() => {
  vi.mocked(videoCapture.isVideoRecordingSupported).mockReturnValue(true);
});

test("shows the unsupported message when recording isn't supported", async () => {
  vi.mocked(videoCapture.isVideoRecordingSupported).mockReturnValue(false);
  render(VideoRecorderField, { props: { label: "Your message", onRecorded: vi.fn() } });
  await fireEvent.click(screen.getByRole("button", { name: /record a video/i }));
  expect(screen.getByText(/isn't supported/i)).toBeInTheDocument();
});

test("shows a retry message when camera/mic permission is denied", async () => {
  vi.mocked(videoCapture.requestCameraStream).mockRejectedValue(new Error("denied"));
  render(VideoRecorderField, { props: { label: "Your message", onRecorded: vi.fn() } });
  await fireEvent.click(screen.getByRole("button", { name: /record a video/i }));
  await waitFor(() => expect(screen.getByText(/access is needed/i)).toBeInTheDocument());
  expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
});

test("recording end-to-end: preview -> start -> stop calls onRecorded with the video and poster files", async () => {
  const fakeStream = makeFakeStream();
  vi.mocked(videoCapture.requestCameraStream).mockResolvedValue(fakeStream);
  const videoFile = new File(["clip"], "clip.webm", { type: "video/webm" });
  let resolveDone: (file: File) => void = () => {};
  const done = new Promise<File>((resolve) => {
    resolveDone = resolve;
  });
  const fakeRecording: VideoRecording = { done, stop: vi.fn(() => resolveDone(videoFile)) };
  vi.mocked(videoCapture.startVideoRecording).mockReturnValue(fakeRecording);
  const posterFile = new File(["poster"], "poster.jpg", { type: "image/jpeg" });
  vi.mocked(videoCapture.capturePosterFrame).mockResolvedValue(posterFile);

  const onRecorded = vi.fn();
  render(VideoRecorderField, { props: { label: "Your message", onRecorded } });

  await fireEvent.click(screen.getByRole("button", { name: /record a video/i }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /start recording/i })).toBeInTheDocument(),
  );
  await fireEvent.click(screen.getByRole("button", { name: /start recording/i }));
  await waitFor(() => expect(screen.getByRole("button", { name: /^stop$/i })).toBeInTheDocument());
  await fireEvent.click(screen.getByRole("button", { name: /^stop$/i }));

  await waitFor(() => expect(onRecorded).toHaveBeenCalledWith(videoFile, posterFile));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- VideoRecorderField`
Expected: FAIL — the component doesn't exist yet.

- [ ] **Step 3: Implement `src/components/VideoRecorderField.svelte`**

```svelte
<script lang="ts">
  import { Video } from "lucide-svelte";
  import {
    isVideoRecordingSupported,
    requestCameraStream,
    startVideoRecording,
    capturePosterFrame,
    MAX_RECORD_MS,
    type VideoRecording,
  } from "../utils/videoCapture";
  import "./VideoRecorderField.css";

  let { label, onRecorded }: { label: string; onRecorded: (video: File, poster: File) => void } =
    $props();

  type Phase = "idle" | "unsupported" | "denied" | "previewing" | "recording";

  let phase = $state<Phase>("idle");
  let stream = $state<MediaStream | undefined>(undefined);
  let remainingMs = $state(MAX_RECORD_MS);
  let videoEl = $state<HTMLVideoElement | undefined>(undefined);
  let recording: VideoRecording | undefined;
  let countdownTimer: ReturnType<typeof setInterval> | undefined;

  function stopStream() {
    stream?.getTracks().forEach((track) => track.stop());
    stream = undefined;
  }

  // The live preview element only exists once phase leaves "idle"/"unsupported"/"denied",
  // so this can't be set inline on the <video> — it has to follow `stream` reactively.
  $effect(() => {
    if (videoEl) {
      videoEl.srcObject = stream ?? null;
    }
  });

  // If the participant swipes to an adjacent carousel card mid-recording,
  // RoutePage keeps this component's location card mounted but this instance
  // still gets destroyed/recreated — make sure a live camera stream doesn't
  // stay open in the background.
  $effect(() => {
    return () => {
      clearInterval(countdownTimer);
      stopStream();
    };
  });

  async function startPreview() {
    if (!isVideoRecordingSupported()) {
      phase = "unsupported";
      return;
    }
    try {
      stream = await requestCameraStream();
      phase = "previewing";
    } catch {
      phase = "denied";
    }
  }

  async function armDoneHandler(rec: VideoRecording) {
    const video = await rec.done;
    clearInterval(countdownTimer);
    const poster = videoEl ? await capturePosterFrame(videoEl) : undefined;
    stopStream();
    recording = undefined;
    if (poster) {
      onRecorded(video, poster);
    }
  }

  function startRecording() {
    if (!stream) {
      return;
    }
    phase = "recording";
    remainingMs = MAX_RECORD_MS;
    const rec = startVideoRecording(stream);
    recording = rec;
    countdownTimer = setInterval(() => {
      remainingMs = Math.max(0, remainingMs - 200);
    }, 200);
    void armDoneHandler(rec);
  }

  function stopRecording() {
    recording?.stop();
  }
</script>

<div class="vrf">
  {#if phase === "idle"}
    <button
      type="button"
      class="af-photo-tile"
      onclick={startPreview}
      aria-label={`Record a video — ${label}`}
    >
      <Video size={28} aria-hidden="true" />
      <span class="af-photo-tile__label">Record a video</span>
      <span class="af-photo-tile__hint">Up to {MAX_RECORD_MS / 1000} seconds, with sound</span>
    </button>
  {:else if phase === "unsupported"}
    <p class="af-photo-error">Video recording isn't supported on this device or browser.</p>
  {:else if phase === "denied"}
    <p class="af-photo-error">
      Camera/microphone access is needed to record. Check your browser permissions and try again.
    </p>
    <button type="button" class="af-photo-action" onclick={startPreview}>Retry</button>
  {:else}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video bind:this={videoEl} class="vrf__preview" autoplay muted playsinline></video>
    {#if phase === "previewing"}
      <button type="button" class="af-photo-action" onclick={startRecording}>Start recording</button>
    {:else if phase === "recording"}
      <p class="vrf__countdown" aria-live="polite">{Math.ceil(remainingMs / 1000)}s</p>
      <button
        type="button"
        class="af-photo-action af-photo-action--remove"
        onclick={stopRecording}
      >
        Stop
      </button>
    {/if}
  {/if}
</div>
```

- [ ] **Step 4: Implement `src/components/VideoRecorderField.css`**

```css
.vrf {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.vrf__preview {
  width: 100%;
  max-width: 320px;
  border-radius: 12px;
  background: #000;
}

.vrf__countdown {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:run -- VideoRecorderField`
Expected: all tests PASS.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Ready for review**

Do not commit. Summarize the diff (`src/components/VideoRecorderField.svelte`, `src/components/VideoRecorderField.css`, `src/test/VideoRecorderField.test.ts`) for the user to review.

---

### Task 3: Wire the `video` field type into `AppForm.svelte`

**Files:**
- Modify: `src/types/data.ts:3-15` (`FormFieldType` union)
- Modify: `src/data/schemas/form.schema.json:9-14` (`type` enum)
- Modify: `src/components/AppForm.svelte`
- Modify: `src/test/AppForm.test.ts`

**Interfaces:**
- Consumes: `VideoRecorderField` from Task 2 (`{ label, onRecorded }` props); `createPhotoPreview` (already imported by `AppForm.svelte` for the `photo` field, reused here on the poster `File`).
- Produces: `FormFieldType` including `"video"`; `AppForm`'s new `onVideoUpload?: (video: File, poster: File) => Promise<{ ok: boolean; httpCode?: number }>` prop, consumed by Task 4's `ChallengeForm.svelte`.

- [ ] **Step 1: Add `"video"` to the type system**

Edit `src/types/data.ts`, changing:

```ts
export type FormFieldType =
  | "boolean"
  | "string"
  | "number"
  | "radio"
  | "multiple"
  | "photo"
  | "textarea"
  | "section"
  | "image-picker"
  | "coord-picker"
  | "random_value"
  | "schema_error";
```

to:

```ts
export type FormFieldType =
  | "boolean"
  | "string"
  | "number"
  | "radio"
  | "multiple"
  | "photo"
  | "video"
  | "textarea"
  | "section"
  | "image-picker"
  | "coord-picker"
  | "random_value"
  | "schema_error";
```

- [ ] **Step 2: Add `"video"` to the JSON schema**

Edit `src/data/schemas/form.schema.json`'s `type` enum:

```json
      "type":  {
        "type": "string",
        "enum": ["boolean", "string", "number", "radio", "multiple", "photo", "video", "textarea", "section", "random_value"]
      },
```

- [ ] **Step 3: Write the failing tests**

Add to `src/test/AppForm.test.ts`. First, add the mock near the existing `photoPreview`/`photoUpload` mocks (after line 29):

```ts
import * as videoCapture from "../utils/videoCapture";

vi.mock("../utils/videoCapture", () => ({
  isVideoRecordingSupported: vi.fn(() => true),
  requestCameraStream: vi.fn(),
  startVideoRecording: vi.fn(),
  capturePosterFrame: vi.fn(),
  MAX_RECORD_MS: 12000,
}));
```

Then add a new section at the end of the file:

```ts
// ---------------------------------------------------------------------------
// video field
// ---------------------------------------------------------------------------

test("video field: renders the record button when no upload exists", () => {
  const fields: FormField[] = [{ id: "clip", type: "video" as FormFieldType, label: "Your message" }];
  render(AppForm, { props: { fields, onSubmit: vi.fn(), onVideoUpload: vi.fn() } });
  expect(screen.getByRole("button", { name: /record a video/i })).toBeInTheDocument();
});

test("video field: recording end-to-end calls onVideoUpload and shows the success tile", async () => {
  const fakeStream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
  vi.mocked(videoCapture.requestCameraStream).mockResolvedValue(fakeStream);
  const videoFile = new File(["clip"], "clip.webm", { type: "video/webm" });
  let resolveDone: (file: File) => void = () => {};
  const done = new Promise<File>((resolve) => {
    resolveDone = resolve;
  });
  vi.mocked(videoCapture.startVideoRecording).mockReturnValue({
    done,
    stop: vi.fn(() => resolveDone(videoFile)),
  });
  const posterFile = new File(["poster"], "poster.jpg", { type: "image/jpeg" });
  vi.mocked(videoCapture.capturePosterFrame).mockResolvedValue(posterFile);

  const onVideoUpload = vi.fn().mockResolvedValue({ ok: true, httpCode: 200 });
  const fields: FormField[] = [{ id: "clip", type: "video" as FormFieldType, label: "Your message" }];
  render(AppForm, { props: { fields, onSubmit: vi.fn(), onVideoUpload } });

  await fireEvent.click(screen.getByRole("button", { name: /record a video/i }));
  await waitFor(() => screen.getByRole("button", { name: /start recording/i }));
  await fireEvent.click(screen.getByRole("button", { name: /start recording/i }));
  await waitFor(() => screen.getByRole("button", { name: /^stop$/i }));
  await fireEvent.click(screen.getByRole("button", { name: /^stop$/i }));

  await waitFor(() => expect(onVideoUpload).toHaveBeenCalledWith(videoFile, posterFile));
  await waitFor(() =>
    expect(screen.getByLabelText(/re-record video/i)).toBeInTheDocument(),
  );
});

test("video field: required validation blocks submit until upload succeeds", async () => {
  const fields: FormField[] = [
    { id: "clip", type: "video" as FormFieldType, label: "Your message", isRequired: true },
    { id: "note", type: "string", label: "Note" },
  ];
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(AppForm, { props: { fields, onSubmit, onVideoUpload: vi.fn() } });
  await fireEvent.input(screen.getByLabelText("Note"), { target: { value: "hi" } });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(onSubmit).not.toHaveBeenCalled();
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npm run test:run -- AppForm`
Expected: the 3 new `video` tests FAIL (no `video` branch rendered yet). All pre-existing `AppForm.test.ts` tests still PASS.

- [ ] **Step 5: Wire the `video` field type into `AppForm.svelte`**

Add the import (alongside the existing `CoordinatePicker`/`ImagePickerDialog` imports):

```ts
import VideoRecorderField from "./VideoRecorderField.svelte";
```

Add the type constant next to the others, and add it to `VALID_TYPES`:

```ts
const STR_VIDEO = "video";
```

```ts
const VALID_TYPES: FormFieldType[] = [
  STR_STRING,
  STR_NUMBER,
  STR_BOOLEAN,
  STR_RADIO,
  STR_MULTIPLE,
  STR_PHOTO,
  STR_VIDEO,
  STR_TEXTAREA,
  STR_SECTION,
  STR_IMAGE_PICKER,
  STR_COORD_PICKER,
  STR_RANDOM_VALUE,
];
```

Add the new prop to the `$props()` destructure (both the value and its type):

```ts
  let {
    fields,
    initialValues = {},
    baseValues = undefined,
    initialUploads = {},
    baseUploads = undefined,
    onSubmit,
    onPhotoUpload = undefined,
    onVideoUpload = undefined,
    onSuccess = undefined,
    onValuesChange = undefined,
    onHasChangesChange = undefined,
    onStatusChange = undefined,
    onUploadsChange = undefined,
    submitLabel = "Submit",
    confirmMessage = undefined,
  }: {
    fields: FormField[];
    initialValues?: Record<string, unknown>;
    baseValues?: Record<string, unknown>;
    initialUploads?: Record<string, PhotoUploadStatus>;
    baseUploads?: Record<string, PhotoUploadStatus>;
    onSubmit: (values: Record<string, unknown>) => Promise<void>;
    onPhotoUpload?: (file: File) => Promise<{ ok: boolean; httpCode?: number }>;
    onVideoUpload?: (video: File, poster: File) => Promise<{ ok: boolean; httpCode?: number }>;
    onSuccess?: () => void;
    onValuesChange?: (values: FieldValues) => void;
    onHasChangesChange?: (hasChanges: boolean) => void;
    onStatusChange?: (status: FormValidationStatus) => void;
    onUploadsChange?: (uploads: Record<string, PhotoUploadStatus>) => void;
    submitLabel?: string;
    confirmMessage?: string;
  } = $props();
```

Extend `hasChanges`'s media check from `f.type === STR_PHOTO` to:

```ts
        if (f.type === STR_PHOTO || f.type === STR_VIDEO) {
```

Extend `validateValues`'s media check from `field.type === STR_PHOTO` to:

```ts
      } else if (field.type === STR_PHOTO || field.type === STR_VIDEO) {
        if (uploadStates[field.id]?.status !== "success") {
          errs[field.id] = MSG_REQUIRED;
        }
```

Add `handleVideoRecorded` next to `handleFileChange`:

```ts
  async function handleVideoRecorded(fieldId: string, video: File, poster: File) {
    if (!onVideoUpload) {
      return;
    }
    uploadStates = { ...uploadStates, [fieldId]: { status: "uploading" } };
    const [uploadResult, previewResult] = await Promise.allSettled([
      onVideoUpload(video, poster),
      createPhotoPreview(poster),
    ]);
    const upload =
      uploadResult.status === "fulfilled" ? uploadResult.value : { ok: false, httpCode: 0 };
    const previewDataUrl =
      previewResult.status === "fulfilled" ? previewResult.value : undefined;
    uploadStates = {
      ...uploadStates,
      [fieldId]: upload.ok
        ? { status: "success", httpCode: upload.httpCode, previewDataUrl }
        : { status: "error", httpCode: upload.httpCode ?? 0 },
    };
  }
```

Extend `isPhotoOnlyForm`'s predicate (the auto-submit check) to also cover video-only forms:

```ts
  const isPhotoOnlyForm = $derived(
    fields.some((f) => f.type === STR_PHOTO || f.type === STR_VIDEO) &&
      fields.every((f) => f.type === STR_PHOTO || f.type === STR_VIDEO || f.type === STR_SECTION),
  );
```

Finally, add the template branch. It goes as a new `{:else if field.type === "video"}` right after the existing `{#if field.type === "photo"} ... {/if}` block (same tier — it needs its own label/subtext rendering, like `photo` does, not the shared block used by `string`/`textarea`/etc.):

```svelte
        {:else if field.type === "video"}
          {@const upload = uploadStates[id]}
          <div class="af-photo-wrap">
            <label class="af-label" class:af-label--required={field.isRequired} for={domId}>{field.label}</label>
            {#if field.subtext}<p class="af-subtext">{field.subtext}</p>{/if}
            {#if upload?.status === "success"}
              <div class="af-photo-tile af-photo-tile--filled">
                {#if upload.previewDataUrl}
                  <img src={upload.previewDataUrl} alt={field.label} class="af-photo-tile__img" />
                  <span class="af-photo-tile__badge" aria-hidden="true"><Check size={14} /></span>
                {:else}
                  <Check size={32} aria-hidden="true" />
                {/if}
              </div>
              <div class="af-photo-actions">
                <button
                  type="button"
                  class="af-photo-action"
                  aria-label={`Re-record video — ${field.label}`}
                  onclick={() => removePhoto(id)}
                >
                  Re-record
                </button>
              </div>
            {:else if upload?.status === "uploading"}
              <div class="af-photo-tile af-photo-tile--uploading">
                <span class="af-photo-tile__spinner" aria-hidden="true"></span>
              </div>
            {:else}
              <VideoRecorderField
                label={field.label}
                onRecorded={(video, poster) => handleVideoRecorded(id, video, poster)}
              />
              {#if upload?.status === "error"}
                <p class="af-photo-error" aria-live="polite">Upload failed. Try again.</p>
              {/if}
            {/if}
          </div>
```

This uses the `af-photo-*` classes that already exist in `AppForm.css` — no CSS file changes needed for this task; `VideoRecorderField.css` (Task 2) covers the recorder-specific parts.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test:run -- AppForm`
Expected: all tests PASS, including the 3 new `video` ones.

- [ ] **Step 7: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 8: Ready for review**

Do not commit. Summarize the diff (`src/types/data.ts`, `src/data/schemas/form.schema.json`, `src/components/AppForm.svelte`, `src/test/AppForm.test.ts`) for the user to review.

---

### Task 4: Server — migration, R2/DB plumbing, and the `/upload-video` route

**Files:**
- Create: `migrations/005_photo_kind.sql`
- Modify: `src/worker/photoKeys.ts`
- Modify: `src/worker/db.ts`
- Create: `src/worker/routes/uploadVideoRoute.ts`
- Modify: `src/worker.ts`
- Modify: `src/utils/api.ts`
- Modify: `src/components/ChallengeForm.svelte`
- Test: `src/test/worker.uploadVideoRoute.test.ts`

**Interfaces:**
- Consumes: `generateVariants` (`src/worker/imageProcessing.ts`, unchanged), `requireAuth`/`isParticipantToken` (unchanged), `buildR2KeyPrefix`/`buildVariantKey` (unchanged).
- Produces: `buildVideoKey(prefix: string, mimeType: string): string`; `DbPhoto.kind?: "photo" | "video"`; `POST /upload-video` route; `postVideoUpload(payload): Promise<{ ok, id?, key?, httpCode }>` in `api.ts`, consumed by Task 5's gallery work (via the `photos` row it writes) and already wired into `ChallengeForm.svelte` by the end of this task.

- [ ] **Step 1: Add the `kind` column migration**

Create `migrations/005_photo_kind.sql`:

```sql
ALTER TABLE photos ADD COLUMN kind TEXT NOT NULL DEFAULT 'photo';
```

- [ ] **Step 2: Add `buildVideoKey` to `photoKeys.ts`**

Edit `src/worker/photoKeys.ts`, appending:

```ts
/** Full R2 object key for a video clip's raw bytes. Extension reflects the
 * browser-recorded mime type (webm on Chrome/Firefox/Android, mp4 on Safari/iOS)
 * — unlike photo variants, this is the only copy of the clip, so the
 * extension has to match what's actually inside for correct playback. */
export function buildVideoKey(prefix: string, mimeType: string): string {
  const ext = mimeType.includes("mp4") ? "mp4" : "webm";
  return `${prefix}/video.${ext}`;
}
```

- [ ] **Step 3: Add `kind` to `DbPhoto` and `insertPhoto`**

Edit `src/worker/db.ts`. Change the `DbPhoto` interface from:

```ts
export interface DbPhoto {
  id: string;
  project_id: string;
  city_id: string;
  route_id: string | null;
  location_id: string;
  task_title: string;
  team_name: string;
  contact: string | null;
  r2_key: string;
  mime_type: string;
  uploaded_at: number;
}
```

to:

```ts
export interface DbPhoto {
  id: string;
  project_id: string;
  city_id: string;
  route_id: string | null;
  location_id: string;
  task_title: string;
  team_name: string;
  contact: string | null;
  r2_key: string;
  mime_type: string;
  uploaded_at: number;
  kind?: "photo" | "video";
}
```

Change `insertPhoto` from:

```ts
export async function insertPhoto(
  database: D1Database,
  photo: DbPhoto,
): Promise<void> {
  await database
    .prepare(
      `INSERT INTO photos
       (id, project_id, city_id, route_id, location_id, task_title,
        team_name, contact, r2_key, mime_type, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      photo.id, photo.project_id, photo.city_id, photo.route_id ?? null,
      photo.location_id, photo.task_title, photo.team_name,
      photo.contact ?? null, photo.r2_key, photo.mime_type, photo.uploaded_at,
    )
    .run();
}
```

to:

```ts
export async function insertPhoto(
  database: D1Database,
  photo: DbPhoto,
): Promise<void> {
  await database
    .prepare(
      `INSERT INTO photos
       (id, project_id, city_id, route_id, location_id, task_title,
        team_name, contact, r2_key, mime_type, uploaded_at, kind)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      photo.id, photo.project_id, photo.city_id, photo.route_id ?? null,
      photo.location_id, photo.task_title, photo.team_name,
      photo.contact ?? null, photo.r2_key, photo.mime_type, photo.uploaded_at,
      photo.kind ?? "photo",
    )
    .run();
}
```

`kind` is appended as the *last* bound parameter specifically so existing callers (`uploadRoute.ts`, which never sets `kind`) keep working unchanged — it defaults to `"photo"` in both the JS binding and the column's own `DEFAULT`. This also means `src/test/worker.photodb.test.ts`'s existing fake-DB fixture (which reads bound args positionally by index 0-10) doesn't need to change — the new `kind` argument lands at index 11, which that fixture's `run()` handler simply doesn't read.

- [ ] **Step 4: Write the failing server-route tests**

Create `src/test/worker.uploadVideoRoute.test.ts`:

```ts
// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from "vitest";
import worker from "../worker";
import { createToken } from "../worker/auth";
import type { TokenPayload } from "../types/auth";
import type { Env } from "../types/worker";

vi.mock("../worker/imageProcessing", () => ({
  generateVariants: vi.fn(),
}));

import { generateVariants } from "../worker/imageProcessing";

const TEST_SECRET = "test-secret";
const TEST_PAYLOAD: TokenPayload = {
  project: "test_project",
  teamName: "Team A",
  contact: "a@b.com",
  isAdmin: false,
  exp: Math.floor(Date.now() / 1000) + 3600,
};

let authToken: string;
beforeEach(async () => {
  authToken = await createToken(TEST_PAYLOAD, TEST_SECRET);
  vi.mocked(generateVariants).mockReset();
});

function makeVideoFormData(videoBytes = new Uint8Array([1, 2, 3])) {
  return {
    get: (key: string) => {
      const values: Record<string, unknown> = {
        video: { type: "video/webm", arrayBuffer: async () => videoBytes.buffer },
        poster: { type: "image/jpeg", arrayBuffer: async () => new Uint8Array([9, 9]).buffer },
        locationId: "5",
        cityId: "den_haag",
        routeId: "short_loop",
        taskTitle: "Hear the Voices",
      };
      return values[key] ?? null;
    },
  };
}

describe("/upload-video", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 when not authenticated", async () => {
    const env = {
      AUTH_SECRET: TEST_SECRET,
      PHOTOS: { put: vi.fn() },
      AUTH_DB: {},
    } as unknown as Env;
    const request = new Request("https://example.com/upload-video", {
      method: "POST",
      body: makeVideoFormData(),
      headers: {},
    });
    request.formData = vi.fn().mockResolvedValue(makeVideoFormData());
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(401);
  });

  it("stores the poster variants and the raw video, and inserts a photos row with kind='video'", async () => {
    vi.mocked(generateVariants).mockReturnValue({
      thumb: new Uint8Array([1]),
      medium: new Uint8Array([2]),
      full: new Uint8Array([3]),
      mimeType: "image/jpeg",
    });
    const putMock = vi.fn().mockResolvedValue(undefined);
    const runMock = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const bindArgs: unknown[] = [];
    const env = {
      AUTH_SECRET: TEST_SECRET,
      PHOTOS: { put: putMock },
      AUTH_DB: {
        prepare: () => ({
          bind: (...args: unknown[]) => {
            bindArgs.push(...args);
            return { run: runMock };
          },
        }),
      },
    } as unknown as Env;
    const request = new Request("https://example.com/upload-video", {
      method: "POST",
      body: makeVideoFormData(),
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });
    request.formData = vi.fn().mockResolvedValue(makeVideoFormData());
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    // 3 poster variants (thumb/medium/full) + 1 raw video object
    expect(putMock).toHaveBeenCalledTimes(4);
    expect(putMock.mock.calls.some(([key]: [string]) => key.endsWith("video.webm"))).toBe(true);
    expect(runMock).toHaveBeenCalledOnce();
    expect(bindArgs[bindArgs.length - 1]).toBe("video");
  });

  it("rejects an oversized video before writing anything to R2", async () => {
    const hugeBytes = new Uint8Array(16 * 1024 * 1024);
    const putMock = vi.fn();
    const env = {
      AUTH_SECRET: TEST_SECRET,
      PHOTOS: { put: putMock },
      AUTH_DB: { prepare: () => ({ bind: () => ({ run: vi.fn() }) }) },
    } as unknown as Env;
    const request = new Request("https://example.com/upload-video", {
      method: "POST",
      body: makeVideoFormData(hugeBytes),
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });
    request.formData = vi.fn().mockResolvedValue(makeVideoFormData(hugeBytes));
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(400);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("returns 500 when R2 put throws", async () => {
    vi.mocked(generateVariants).mockReturnValue({
      thumb: new Uint8Array([1]),
      medium: new Uint8Array([2]),
      full: new Uint8Array([3]),
      mimeType: "image/jpeg",
    });
    const env = {
      AUTH_SECRET: TEST_SECRET,
      PHOTOS: { put: vi.fn().mockRejectedValue(new Error("R2 down")) },
      AUTH_DB: { prepare: () => ({ bind: () => ({ run: vi.fn() }) }) },
    } as unknown as Env;
    const request = new Request("https://example.com/upload-video", {
      method: "POST",
      body: makeVideoFormData(),
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });
    request.formData = vi.fn().mockResolvedValue(makeVideoFormData());
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(500);
  });
});
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `npm run test:run -- worker.uploadVideoRoute`
Expected: FAIL — `/upload-video` doesn't exist yet (404s or errors from the route not being registered).

- [ ] **Step 6: Implement `src/worker/routes/uploadVideoRoute.ts`**

```ts
import type { Env } from "../../types/worker";
import { requireAuth } from "../auth";
import { json } from "../utils";
import { isParticipantToken } from "../../types/auth";
import { generateVariants } from "../imageProcessing";
import { buildR2KeyPrefix, buildVariantKey, buildVideoKey } from "../photoKeys";
import { insertPhoto } from "../db";

/** Real clips at the capped bitrate/duration land around 1-1.5MB; this is a
 * sanity backstop in case a browser ignores the bitrate cap, not the primary
 * size control (see videoCapture.ts for that). */
const MAX_VIDEO_BYTES = 15 * 1024 * 1024;

function generateId(): string {
  return crypto.randomUUID();
}

export async function handleUploadVideoRoute(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  if (request.method !== "POST" || url.pathname !== "/upload-video") {
    return null;
  }

  const authPayload = await requireAuth(request, env);
  if (!authPayload || !isParticipantToken(authPayload)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  try {
    const formData = await request.formData();
    const video = formData.get("video") as File | null;
    const poster = formData.get("poster") as File | null;
    if (!video || !poster) {
      return json({ ok: false, error: "No video provided" }, 400);
    }

    const videoBytes = new Uint8Array(await video.arrayBuffer());
    if (videoBytes.length > MAX_VIDEO_BYTES) {
      return json({ ok: false, error: "Video too large" }, 400);
    }

    const locationId = (formData.get("locationId") as string) || "unknown";
    const cityId = (formData.get("cityId") as string) || "unknown";
    const routeId = (formData.get("routeId") as string) || null;
    const taskTitle = (formData.get("taskTitle") as string) || "Untitled challenge";

    const timestamp = Date.now();
    const keyPrefix = buildR2KeyPrefix(locationId, timestamp);
    const videoMimeType = video.type || "video/webm";

    const posterBytes = new Uint8Array(await poster.arrayBuffer());
    let posterMimeType = poster.type || "image/jpeg";
    let fullBytes: Uint8Array = posterBytes;
    let mediumBytes: Uint8Array | null = null;
    let thumbBytes: Uint8Array | null = null;

    try {
      const variants = generateVariants(posterBytes, posterMimeType);
      fullBytes = variants.full;
      mediumBytes = variants.medium;
      thumbBytes = variants.thumb;
      posterMimeType = variants.mimeType;
    } catch {
      // Corrupt poster or unsupported format — fall back to storing the raw
      // poster as the "full" variant only, same fallback uploadRoute.ts uses.
    }

    await env.PHOTOS.put(buildVariantKey(keyPrefix, "full"), fullBytes, {
      httpMetadata: { contentType: posterMimeType },
    });
    if (mediumBytes) {
      await env.PHOTOS.put(buildVariantKey(keyPrefix, "medium"), mediumBytes, {
        httpMetadata: { contentType: "image/jpeg" },
      });
    }
    if (thumbBytes) {
      await env.PHOTOS.put(buildVariantKey(keyPrefix, "thumb"), thumbBytes, {
        httpMetadata: { contentType: "image/jpeg" },
      });
    }
    await env.PHOTOS.put(buildVideoKey(keyPrefix, videoMimeType), videoBytes, {
      httpMetadata: { contentType: videoMimeType },
    });

    const photoId = generateId();
    await insertPhoto(env.AUTH_DB, {
      id: photoId,
      project_id: authPayload.project,
      city_id: cityId,
      route_id: routeId,
      location_id: locationId,
      task_title: taskTitle,
      team_name: authPayload.teamName,
      contact: authPayload.contact || null,
      r2_key: keyPrefix,
      mime_type: videoMimeType,
      uploaded_at: Math.floor(timestamp / 1000),
      kind: "video",
    });

    return json({ ok: true, id: photoId, key: keyPrefix });
  } catch {
    return json({ ok: false, error: "Upload failed" }, 500);
  }
}
```

- [ ] **Step 7: Wire the route into `worker.ts`**

Edit `src/worker.ts`:

```ts
import type { Env } from "./types/worker";
import { handleAuthRoutes } from "./worker/routes/authRoutes";
import { handleInviteRoutes } from "./worker/routes/inviteRoutes";
import { handleUploadRoute } from "./worker/routes/uploadRoute";
import { handleUploadVideoRoute } from "./worker/routes/uploadVideoRoute";
import { handleFormSubmitRoute } from "./worker/routes/formSubmitRoute";
import { handleGalleryRoutes } from "./worker/routes/galleryRoutes";
import { handleEditorRoutes } from "./worker/routes/editorRoutes";
import { handleResultsRoutes } from "./worker/routes/resultsRoutes";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    console.log(
      `[worker] ${new Date().toISOString()} ${request.method} ${url.pathname} ` +
        `bindings: AUTH_DB=${!!env.AUTH_DB} AUTH_STORE=${!!env.AUTH_STORE} ` +
        `PHOTOS=${!!env.PHOTOS} AUTH_SECRET=${!!env.AUTH_SECRET} ASSETS=${!!env.ASSETS}`,
    );
    return (
      (await handleAuthRoutes(request, url, env)) ??
      (await handleInviteRoutes(request, url, env)) ??
      (await handleUploadRoute(request, url, env)) ??
      (await handleUploadVideoRoute(request, url, env)) ??
      (await handleFormSubmitRoute(request, url, env)) ??
      (await handleGalleryRoutes(request, url, env)) ??
      (await handleResultsRoutes(request, url, env)) ??
      (await handleEditorRoutes(request, url, env)) ??
      (env.ASSETS
        ? env.ASSETS.fetch(request)
        : new Response("Not found", { status: 404 }))
    );
  },
};
```

- [ ] **Step 8: Run the server tests to verify they pass**

Run: `npm run test:run -- worker.uploadVideoRoute`
Expected: all tests PASS.

- [ ] **Step 9: Add `postVideoUpload` to `api.ts`**

Edit `src/utils/api.ts`, adding this after `postPhotoUpload`:

```ts
export interface VideoUploadPayload {
  locationId: number;
  cityId: string;
  routeId?: string;
  taskTitle: string;
  video: File;
  poster: File;
}

export async function postVideoUpload(
  payload: VideoUploadPayload,
): Promise<{ ok: boolean; id?: string; key?: string; httpCode: number }> {
  const body = new FormData();
  body.append("video", payload.video);
  body.append("poster", payload.poster);
  body.append("locationId", String(payload.locationId));
  body.append("cityId", payload.cityId);
  if (payload.routeId) {
    body.append("routeId", payload.routeId);
  }
  body.append("taskTitle", payload.taskTitle);
  const res = await fetch("/upload-video", { method: "POST", body });
  const data = (await res.json()) as { ok: boolean; id?: string; key?: string };
  return { ...data, httpCode: res.status };
}
```

- [ ] **Step 10: Wire `onVideoUpload` through `ChallengeForm.svelte`**

Edit `src/components/ChallengeForm.svelte`. Change the import line:

```ts
  import { postFormSubmit, postPhotoUpload, postVideoUpload } from "../utils/api";
```

Add a new handler next to `handlePhotoUpload`:

```ts
  async function handleVideoUpload(
    video: File,
    poster: File,
  ): Promise<{ ok: boolean; httpCode?: number }> {
    return postVideoUpload({ locationId, cityId, routeId, taskTitle, video, poster });
  }
```

Add the prop to the `<AppForm>` invocation:

```svelte
      <AppForm
        fields={form}
        initialValues={baseValues}
        {baseValues}
        initialUploads={baseUploads}
        {baseUploads}
        onSubmit={handleSubmit}
        onPhotoUpload={handlePhotoUpload}
        onVideoUpload={handleVideoUpload}
        onSuccess={handleSuccess}
        onValuesChange={handleValuesChange}
        onUploadsChange={handleUploadsChange}
        onStatusChange={handleStatusChange}
        confirmMessage="Submit your answers?"
        submitLabel={hasSubmittedOnce ? "Re-submit" : "Submit"}
      />
```

- [ ] **Step 11: Run the full test suite**

Run: `npm run test:run`
Expected: all tests PASS (confirms `ChallengeForm.svelte`'s existing tests, if any reference its prop list, still pass, and nothing else regressed).

- [ ] **Step 12: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 13: Apply the migration locally**

Run: `npx wrangler d1 execute scavenger_hunt_auth --local --file=migrations/005_photo_kind.sql`
Expected: succeeds (the column is added; `ALTER TABLE ... ADD COLUMN` is idempotent-safe to re-run only if it errors on "duplicate column" — if so, it's already applied). Note for the user: the deployed/remote D1 database needs the equivalent `--remote` (or dashboard) run before this ships to production, same as every prior migration in `doc/testing/local-00-setup.md`.

- [ ] **Step 14: Ready for review**

Do not commit. Summarize the diff (`migrations/005_photo_kind.sql`, `src/worker/photoKeys.ts`, `src/worker/db.ts`, `src/worker/routes/uploadVideoRoute.ts`, `src/worker.ts`, `src/utils/api.ts`, `src/components/ChallengeForm.svelte`, `src/test/worker.uploadVideoRoute.test.ts`) for the user to review.

---

### Task 5: Gallery playback support

**Files:**
- Modify: `src/types/gallery.ts`
- Modify: `src/worker/routes/galleryRoutes.ts`
- Modify: `src/components/PhotoLightbox.svelte`
- Modify: `src/components/PhotoLightbox.css`
- Modify: `src/components/PhotoThumb.svelte`
- Modify: `src/components/PhotoThumb.css`
- Modify: `src/test/worker.gallery.test.ts`
- Modify: `src/test/PhotoLightbox.test.ts`

**Interfaces:**
- Consumes: `buildVideoKey` (Task 4's `photoKeys.ts`), `DbPhoto.kind` (Task 4's `db.ts`).
- Produces: `GalleryPhoto.kind?: "photo" | "video"` and `GalleryPhoto.videoUrl?: string`, and a `GET /photos/:id/video` route.

- [ ] **Step 1: Add `kind`/`videoUrl` to `GalleryPhoto`**

Edit `src/types/gallery.ts`:

```ts
export interface GalleryPhoto {
  id: string;
  kind?: "photo" | "video";
  locationId: string;
  taskTitle: string;
  teamName: string;
  uploadedAt: number;
  thumbUrl: string;
  mediumUrl: string;
  fullUrl: string;
  videoUrl?: string;
}
```

`kind` and `videoUrl` are optional (rather than `kind` defaulting to `"photo"`) so every existing `GalleryPhoto` fixture across the test suite — none of which set `kind` today — keeps working unchanged; only the new video-specific tests below set it explicitly.

- [ ] **Step 2: Write the failing gallery-route tests**

Edit `src/test/worker.gallery.test.ts`. Add this constant right after `SAMPLE_PHOTOS`:

```ts
const VIDEO_PHOTO = {
  id: "v1", project_id: "democrats_abroad", city_id: "den_haag", route_id: "short_loop",
  location_id: "5", task_title: "Hear the Voices", team_name: "Team A",
  contact: "a@b.com", r2_key: "5_3000", mime_type: "video/webm", uploaded_at: 3000, kind: "video",
};
```

Add these two new `describe` blocks at the end of the file:

```ts
describe("GET /photos/:id/video", () => {
  it("streams the raw video object using the stored mime type", async () => {
    const getMock = vi.fn().mockResolvedValue({ body: "fake-video-body" });
    const request = new Request("https://example.com/photos/v1/video", {
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });
    const response = await worker.fetch(request, {
      AUTH_SECRET: TEST_SECRET,
      AUTH_DB: makeDb([...SAMPLE_PHOTOS, VIDEO_PHOTO]),
      PHOTOS: { get: getMock },
    } as unknown as Env);
    expect(response.status).toBe(200);
    expect(getMock).toHaveBeenCalledWith("5_3000/video.webm");
    expect(response.headers.get("Content-Type")).toBe("video/webm");
  });

  it("still serves the poster's thumb/medium/full variants for a video photo", async () => {
    const getMock = vi.fn().mockResolvedValue({ body: "fake-poster-body" });
    const request = new Request("https://example.com/photos/v1/thumb", {
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });
    const response = await worker.fetch(request, {
      AUTH_SECRET: TEST_SECRET,
      AUTH_DB: makeDb([...SAMPLE_PHOTOS, VIDEO_PHOTO]),
      PHOTOS: { get: getMock },
    } as unknown as Env);
    expect(response.status).toBe(200);
    expect(getMock).toHaveBeenCalledWith("5_3000/thumb.jpg");
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
  });

  it("returns 400 when requesting the 'video' variant of a photo-kind row", async () => {
    const request = new Request("https://example.com/photos/p1/video", {
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });
    const response = await worker.fetch(request, {
      AUTH_SECRET: TEST_SECRET,
      AUTH_DB: makeDb(),
      PHOTOS: { get: vi.fn() },
    } as unknown as Env);
    expect(response.status).toBe(400);
  });
});

describe("GET /gallery/:project/:city/photos — video kind passthrough", () => {
  it("includes kind and videoUrl for a video row", async () => {
    const request = new Request("https://example.com/gallery/democrats_abroad/den_haag/photos", {
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });
    const response = await worker.fetch(request, {
      AUTH_SECRET: TEST_SECRET,
      AUTH_DB: makeDb([...SAMPLE_PHOTOS, VIDEO_PHOTO]),
    } as unknown as Env);
    const data = await response.json();
    const videoEntry = data.photos.find((p: { id: string }) => p.id === "v1");
    expect(videoEntry).toMatchObject({ kind: "video", videoUrl: "/photos/v1/video" });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test:run -- worker.gallery`
Expected: FAIL — no `video` variant handling or `kind`/`videoUrl` passthrough exists yet.

- [ ] **Step 4: Implement the gallery-route changes**

Edit `src/worker/routes/galleryRoutes.ts`. Add `buildVideoKey` to the import:

```ts
import { buildVariantKey, buildVideoKey, PHOTO_VARIANTS, type PhotoVariant } from "../photoKeys";
```

Change `toGalleryPhoto` from:

```ts
function toGalleryPhoto(photo: DbPhoto): GalleryPhoto {
  return {
    id: photo.id,
    locationId: photo.location_id,
    taskTitle: photo.task_title,
    teamName: photo.team_name,
    uploadedAt: photo.uploaded_at,
    thumbUrl: `/photos/${photo.id}/thumb`,
    mediumUrl: `/photos/${photo.id}/medium`,
    fullUrl: `/photos/${photo.id}/full`,
  };
}
```

to:

```ts
function toGalleryPhoto(photo: DbPhoto): GalleryPhoto {
  const kind = photo.kind === "video" ? "video" : undefined;
  return {
    id: photo.id,
    kind,
    locationId: photo.location_id,
    taskTitle: photo.task_title,
    teamName: photo.team_name,
    uploadedAt: photo.uploaded_at,
    thumbUrl: `/photos/${photo.id}/thumb`,
    mediumUrl: `/photos/${photo.id}/medium`,
    fullUrl: `/photos/${photo.id}/full`,
    videoUrl: kind === "video" ? `/photos/${photo.id}/video` : undefined,
  };
}
```

Replace the whole `photoMatch` block (reordering photo lookup before variant validation, so a `"video"` variant param can be recognized only for a video-kind row) from:

```ts
  if (photoMatch) {
    const authPayload = await requireAuth(request, env);
    if (!authPayload) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }
    const [, id, variantParam] = photoMatch;
    if (!(PHOTO_VARIANTS as readonly string[]).includes(variantParam)) {
      return json({ ok: false, error: "Unknown variant" }, 400);
    }
    const variant = variantParam as PhotoVariant;
    const photo = await getPhotoById(env.AUTH_DB, id);
    if (!photo) {
      return json({ ok: false, error: "Not found" }, 404);
    }
    if (!isParticipantToken(authPayload) || authPayload.project !== photo.project_id) {
      return json({ ok: false, error: "Forbidden" }, 403);
    }
    const key = buildVariantKey(photo.r2_key, variant);
    const object = await env.PHOTOS.get(key);
    if (!object) {
      return json({ ok: false, error: "Not found" }, 404);
    }
    const contentType = variant === "full" ? photo.mime_type : "image/jpeg";
    return new Response(object.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }
```

to:

```ts
  if (photoMatch) {
    const authPayload = await requireAuth(request, env);
    if (!authPayload) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }
    const [, id, variantParam] = photoMatch;
    const photo = await getPhotoById(env.AUTH_DB, id);
    if (!photo) {
      return json({ ok: false, error: "Not found" }, 404);
    }
    if (!isParticipantToken(authPayload) || authPayload.project !== photo.project_id) {
      return json({ ok: false, error: "Forbidden" }, 403);
    }

    if (photo.kind === "video" && variantParam === "video") {
      const key = buildVideoKey(photo.r2_key, photo.mime_type);
      const object = await env.PHOTOS.get(key);
      if (!object) {
        return json({ ok: false, error: "Not found" }, 404);
      }
      return new Response(object.body, {
        headers: {
          "Content-Type": photo.mime_type,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    if (!(PHOTO_VARIANTS as readonly string[]).includes(variantParam)) {
      return json({ ok: false, error: "Unknown variant" }, 400);
    }
    const variant = variantParam as PhotoVariant;
    const key = buildVariantKey(photo.r2_key, variant);
    const object = await env.PHOTOS.get(key);
    if (!object) {
      return json({ ok: false, error: "Not found" }, 404);
    }
    const contentType = variant === "full" ? photo.mime_type : "image/jpeg";
    return new Response(object.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }
```

- [ ] **Step 5: Run the gallery-route tests to verify they pass**

Run: `npm run test:run -- worker.gallery`
Expected: all tests PASS, including the pre-existing ones (confirms the reordering didn't change behavior for any existing case — see the note below).

The reordering moves the "is this a known variant?" check to *after* the photo lookup and ownership check (previously it ran first). This doesn't change the observable result for any existing test: auth failures and ownership failures still short-circuit before a variant is ever inspected in either order, and every existing "unknown variant"/"missing photo" test uses inputs where both orderings produce the same status code.

- [ ] **Step 6: Write the failing `PhotoLightbox` tests**

Edit `src/test/PhotoLightbox.test.ts`, adding this after the existing tests:

```ts
const VIDEO_PHOTO_FIXTURE: GalleryPhoto = {
  id: "v1",
  kind: "video",
  locationId: "5",
  taskTitle: "Hear the Voices",
  teamName: "Team A",
  uploadedAt: 1,
  thumbUrl: "/photos/v1/thumb",
  mediumUrl: "/photos/v1/medium",
  fullUrl: "/photos/v1/full",
  videoUrl: "/photos/v1/video",
};

test("renders a <video> element with the poster and a Download Video button for a video photo", () => {
  render(PhotoLightbox, { props: { photo: VIDEO_PHOTO_FIXTURE, onClose: vi.fn() } });
  const video = document.querySelector("video");
  expect(video).not.toBeNull();
  expect(video?.getAttribute("src")).toBe("/photos/v1/video");
  expect(video?.getAttribute("poster")).toBe("/photos/v1/medium");
  expect(screen.getByRole("button", { name: /download video/i })).toBeInTheDocument();
});
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `npm run test:run -- PhotoLightbox`
Expected: FAIL — no `<video>` branch exists yet.

- [ ] **Step 8: Implement the `PhotoLightbox.svelte` video branch**

Edit `src/components/PhotoLightbox.svelte`:

```svelte
<script lang="ts">
  import type { GalleryPhoto } from "../types/gallery";
  import "./PhotoLightbox.css";

  let { photo, onClose }: { photo: GalleryPhoto | null; onClose: () => void } = $props();

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      onClose();
    }
  }

  async function handleDownload() {
    if (photo) {
      const isVideo = photo.kind === "video" && !!photo.videoUrl;
      const res = await fetch(isVideo ? (photo.videoUrl as string) : photo.fullUrl);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const ext = isVideo ? (blob.type.includes("mp4") ? "mp4" : "webm") : "jpg";
        a.download = `${photo.teamName} - ${photo.taskTitle}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if photo}
  <div class="photo-lightbox" role="dialog" aria-modal="true" aria-label={photo.taskTitle}>
    <button
      class="photo-lightbox__backdrop"
      aria-label="Close photo preview"
      onclick={onClose}
    ></button>
    <div class="photo-lightbox__content">
      <button class="photo-lightbox__close" onclick={onClose} aria-label="Close">✕</button>
      {#if photo.kind === "video" && photo.videoUrl}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video
          src={photo.videoUrl}
          poster={photo.mediumUrl}
          controls
          class="photo-lightbox__video"
        ></video>
      {:else}
        <img src={photo.mediumUrl} alt={photo.taskTitle} class="photo-lightbox__img" />
      {/if}
      <div class="photo-lightbox__meta">
        <div class="photo-lightbox__team">{photo.teamName}</div>
        <div class="photo-lightbox__task">{photo.taskTitle}</div>
      </div>
      <button class="photo-lightbox__download" onclick={handleDownload}>
        {photo.kind === "video" ? "Download Video" : "Download Photo"}
      </button>
    </div>
  </div>
{/if}
```

Add to `src/components/PhotoLightbox.css`:

```css
.photo-lightbox__video {
  display: block;
  width: 100%;
  max-height: 60vh;
  border-radius: 4px;
  background: #000;
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npm run test:run -- PhotoLightbox`
Expected: all tests PASS, including the pre-existing ones (the existing `PHOTO` fixture has no `kind`, so it still renders the `<img>` branch and "Download Photo" label unchanged).

- [ ] **Step 10: Add a small video-badge affordance to `PhotoThumb.svelte`**

Without this, a video submission's grid tile looks identical to a photo's until tapped open — a minor UX gap worth closing while already touching this file, but it's purely visual and not separately tested (existing `PhotoThumb`/gallery tests don't assert on it, and no user-facing test infrastructure covers this file today).

Edit `src/components/PhotoThumb.svelte`:

```svelte
<script lang="ts">
  import type { GalleryPhoto } from "../types/gallery";
  import "./PhotoThumb.css";

  let { photo, onClick }: { photo: GalleryPhoto; onClick: () => void } = $props();

  let fallbackUsed = $state(false);
  let src = $derived(fallbackUsed ? photo.fullUrl : photo.thumbUrl);

  function handleError() {
    fallbackUsed = true;
  }
</script>

<button class="photo-thumb" onclick={onClick} data-testid="photo-thumb">
  <img
    src={src}
    alt={photo.taskTitle}
    class="photo-thumb__img"
    onerror={handleError}
  />
  {#if photo.kind === "video"}
    <span class="photo-thumb__video-badge" aria-hidden="true">▶</span>
  {/if}
  <div class="photo-thumb__caption">
    <span class="photo-thumb__team">{photo.teamName}</span>
    <span class="photo-thumb__task">{photo.taskTitle}</span>
  </div>
</button>
```

Edit `src/components/PhotoThumb.css` — add `position: relative;` to the existing `.photo-thumb` rule (needed to anchor the badge):

```css
.photo-thumb {
  display: block;
  width: 100%;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  cursor: pointer;
  overflow: hidden;
  text-align: left;
  position: relative;
  transition: transform 150ms ease, box-shadow 150ms ease;
}
```

Append the badge style:

```css
.photo-thumb__video-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
}
```

- [ ] **Step 11: Run the full test suite**

Run: `npm run test:run`
Expected: all tests PASS.

- [ ] **Step 12: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 13: Ready for review**

Do not commit. Summarize the diff (`src/types/gallery.ts`, `src/worker/routes/galleryRoutes.ts`, `src/components/PhotoLightbox.svelte`, `src/components/PhotoLightbox.css`, `src/components/PhotoThumb.svelte`, `src/components/PhotoThumb.css`, `src/test/worker.gallery.test.ts`, `src/test/PhotoLightbox.test.ts`) for the user to review.

---

### Task 6: Add the `video` field to `005_form_malieveld.yaml`

**Files:**
- Modify: `src/data/text/en/projects/democrats_abroad/den_haag/005_form_malieveld.yaml`

**Interfaces:**
- Consumes: the `video` field type from Task 3 (must be merged/implemented first — `npm run validate:yaml` will reject this file against the old schema otherwise).

- [ ] **Step 1: Add the field**

Edit `src/data/text/en/projects/democrats_abroad/den_haag/005_form_malieveld.yaml` from:

```yaml
- id: manifesto
  type: textarea
  label: Your message, who are you standing with, what are you defending ?
  config:
    lineCount: 6
```

to:

```yaml
- id: manifesto
  type: textarea
  label: Your message, who are you standing with, what are you defending ?
  config:
    lineCount: 6

- id: video_message
  type: video
  label: "Optional: record a short video of your message"
```

Not marked `isRequired` — the challenge copy in `005_loc_malieveld.yaml` frames a video as one of several optional expression modes (sign, chant, slogan, video, mock-news), with the written `manifesto` textarea as the one actually-required answer. If a future session wants video to be mandatory instead, that's a one-line content change (`isRequired: true`), not a mechanism change.

- [ ] **Step 2: Validate**

Run: `npm run validate:yaml`
Expected: no errors. (If Task 3's schema change isn't in place yet, this fails with `must be equal to one of the allowed values` for `type` — that means Task 3 needs to land first.)

- [ ] **Step 3: Run the full test suite**

Run: `npm run test:run`
Expected: all tests PASS (this location's form file isn't covered by a dedicated unit test — the run confirms nothing else regressed).

- [ ] **Step 4: Ready for review**

Do not commit. Note for the user: manual verification of the actual recording flow (visiting `005_loc_malieveld` in the running app on a real phone, granting camera/mic permission, recording, confirming upload, and checking it appears correctly — including as a playable video — in the results gallery) is manual/UI verification the user does themselves, not run via Playwright. This is also the first real end-to-end test of the whole feature; earlier tasks only exercise it against mocked browser APIs.

---

## Self-Review Notes

- **Spec coverage:** Problem/Approach → Tasks 1-2 (capture mechanism); Data Model Changes → Task 3 Steps 1-2; Capture UI → Tasks 2-3; Server Changes (storage/R2 layout/route) → Task 4; Gallery → Task 5; Data Files → Task 6; Testing → each task's own test steps; Out of Scope items (Range support, editor authoring UI, exact form copy/requiredness) are not implemented anywhere in this plan, as intended.
- **Placeholder scan:** no TBD/TODO; every step has complete, runnable code with exact file paths. The one deliberately-undertested item (Task 5's video badge) is called out explicitly as a scope decision, not left ambiguous.
- **Type consistency:** `VideoRecording` (`{ done: Promise<File>; stop: () => void }`) is defined once in Task 1 and used with that exact shape in Task 2's component and both test files. `onVideoUpload`'s signature (`(video: File, poster: File) => Promise<{ ok: boolean; httpCode?: number }>`) matches across `AppForm.svelte` (Task 3), `ChallengeForm.svelte` and `api.ts`'s `postVideoUpload` (Task 4). `buildVideoKey(prefix, mimeType)` is defined once in Task 4 and consumed identically by `uploadVideoRoute.ts` and `galleryRoutes.ts` (Task 5). `DbPhoto.kind`/`GalleryPhoto.kind` both use the same `"photo" | "video"` union.
