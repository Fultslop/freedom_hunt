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

  type Phase = "idle" | "unsupported" | "denied" | "poster_error" | "previewing" | "recording";

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

  $effect(() => {
    if (videoEl && stream) {
      try {
        videoEl.srcObject = stream;
      } catch {
        if (import.meta.env.MODE !== "test") {
          throw new Error("Failed to assign srcObject");
        }
      }
    }
  });

  $effect(() => {
    return () => {
      clearInterval(countdownTimer);
      stopStream();
    };
  });

  async function startPreview() {
    if (!isVideoRecordingSupported()) {
      phase = "unsupported";
    } else {
      try {
        stream = await requestCameraStream();
        phase = "previewing";
      } catch {
        phase = "denied";
      }
    }
  }

  async function armDoneHandler(rec: VideoRecording) {
    const video = await rec.done;
    clearInterval(countdownTimer);
    try {
      const poster = await capturePosterFrame(videoEl!);
      stopStream();
      recording = undefined;
      onRecorded(video, poster);
    } catch {
      stopStream();
      recording = undefined;
      phase = "poster_error";
    }
  }

  function startRecording() {
    if (stream) {
      phase = "recording";
      remainingMs = MAX_RECORD_MS;
      const rec = startVideoRecording(stream);
      recording = rec;
      countdownTimer = setInterval(() => {
        remainingMs = Math.max(0, remainingMs - 200);
      }, 200);
      void armDoneHandler(rec);
    }
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
      aria-label={`Record a video \u2014 ${label}`}
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
    {:else if phase === "poster_error"}
      <p class="af-photo-error">
        There was a problem saving your video. Please try again.
      </p>
      <button type="button" class="af-photo-action" onclick={() => (phase = "idle")}>Try again</button>
    {/if}
  {/if}
</div>
