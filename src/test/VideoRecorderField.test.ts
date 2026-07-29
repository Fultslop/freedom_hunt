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

test("shows an error message with a retry button when poster-frame capture fails", async () => {
  const fakeStream = makeFakeStream();
  vi.mocked(videoCapture.requestCameraStream).mockResolvedValue(fakeStream);
  const videoFile = new File(["clip"], "clip.webm", { type: "video/webm" });
  let resolveDone: (file: File) => void = () => {};
  const done = new Promise<File>((resolve) => {
    resolveDone = resolve;
  });
  const fakeRecording: VideoRecording = { done, stop: vi.fn(() => resolveDone(videoFile)) };
  vi.mocked(videoCapture.startVideoRecording).mockReturnValue(fakeRecording);
  vi.mocked(videoCapture.capturePosterFrame).mockRejectedValue(new Error("JPEG encoding failed"));

  const onRecorded = vi.fn();
  render(VideoRecorderField, { props: { label: "Your message", onRecorded } });

  await fireEvent.click(screen.getByRole("button", { name: /record a video/i }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /start recording/i })).toBeInTheDocument(),
  );
  await fireEvent.click(screen.getByRole("button", { name: /start recording/i }));
  await waitFor(() => expect(screen.getByRole("button", { name: /^stop$/i })).toBeInTheDocument());
  await fireEvent.click(screen.getByRole("button", { name: /^stop$/i }));

  await waitFor(() =>
    expect(screen.getByText(/problem saving your video/i)).toBeInTheDocument(),
  );
  expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  expect(onRecorded).not.toHaveBeenCalled();
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
