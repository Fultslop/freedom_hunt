export const MAX_RECORD_MS = 12_000;
const VIDEO_BITS_PER_SECOND = 800_000;
const AUDIO_BITS_PER_SECOND = 64_000;

const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export function pickSupportedMimeType(): string | null {
  const mediaRecorder = globalThis.MediaRecorder as typeof MediaRecorder | undefined;
  if (!mediaRecorder) {
    return null;
  }
  return MIME_CANDIDATES.find((candidate) => mediaRecorder.isTypeSupported(candidate)) ?? null;
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
  done: Promise<File>;
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
