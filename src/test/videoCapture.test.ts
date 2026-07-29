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

function makeMockMediaRecorder(isTypeSupportedImpl?: (type: string) => boolean) {
  const isTypeSupported = vi.fn(isTypeSupportedImpl ?? ((type: string) => type === "video/webm;codecs=vp8,opus"));
  class MockMediaRecorder extends EventTarget {
    static isTypeSupported = isTypeSupported;
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
      if (this.state !== "inactive") {
        this.state = "inactive";
        this.dispatchEvent(new FakeDataEvent(new Blob(["chunk"])));
        this.dispatchEvent(new Event("stop"));
      }
    }
  }
  return { MockMediaRecorder, isTypeSupported };
}

function setGlobal<K extends string>(name: K, value: unknown) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

function deleteGlobal(name: string) {
  delete (globalThis as Record<string, unknown>)[name];
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

test("pickSupportedMimeType returns the first supported candidate", () => {
  const { MockMediaRecorder } = makeMockMediaRecorder();
  setGlobal("MediaRecorder", MockMediaRecorder);
  expect(pickSupportedMimeType()).toBe("video/webm;codecs=vp8,opus");
  deleteGlobal("MediaRecorder");
});

test("pickSupportedMimeType returns null when nothing is supported", () => {
  const { MockMediaRecorder } = makeMockMediaRecorder(() => false);
  setGlobal("MediaRecorder", MockMediaRecorder);
  expect(pickSupportedMimeType()).toBeNull();
  deleteGlobal("MediaRecorder");
});

test("isVideoRecordingSupported is true when getUserMedia and a mime type both exist", () => {
  const { MockMediaRecorder } = makeMockMediaRecorder();
  setGlobal("MediaRecorder", MockMediaRecorder);
  setGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn() } });
  expect(isVideoRecordingSupported()).toBe(true);
  deleteGlobal("navigator");
  deleteGlobal("MediaRecorder");
});

test("isVideoRecordingSupported is false without getUserMedia", () => {
  const { MockMediaRecorder } = makeMockMediaRecorder();
  setGlobal("MediaRecorder", MockMediaRecorder);
  setGlobal("navigator", { mediaDevices: {} });
  expect(isVideoRecordingSupported()).toBe(false);
  deleteGlobal("navigator");
  deleteGlobal("MediaRecorder");
});

test("isVideoRecordingSupported is false when no mime type is supported", () => {
  const { MockMediaRecorder } = makeMockMediaRecorder(() => false);
  setGlobal("MediaRecorder", MockMediaRecorder);
  setGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn() } });
  expect(isVideoRecordingSupported()).toBe(false);
  deleteGlobal("navigator");
  deleteGlobal("MediaRecorder");
});

test("requestCameraStream calls getUserMedia with capped resolution and audio enabled", async () => {
  const fakeStream = {} as MediaStream;
  const getUserMedia = vi.fn().mockResolvedValue(fakeStream);
  setGlobal("navigator", { mediaDevices: { getUserMedia } });
  const result = await requestCameraStream();
  expect(result).toBe(fakeStream);
  expect(getUserMedia).toHaveBeenCalledWith({
    video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
    audio: true,
  });
  deleteGlobal("navigator");
});

test("startVideoRecording auto-stops after MAX_RECORD_MS and resolves done with an encoded File", async () => {
  const { MockMediaRecorder } = makeMockMediaRecorder();
  setGlobal("MediaRecorder", MockMediaRecorder);
  vi.useFakeTimers();
  const recording = startVideoRecording({} as MediaStream);
  vi.advanceTimersByTime(MAX_RECORD_MS);
  const file = await recording.done;
  expect(file).toBeInstanceOf(File);
  expect(file.type).toBe("video/webm;codecs=vp8,opus");
  expect(file.name).toBe("clip.webm");
  vi.useRealTimers();
  deleteGlobal("MediaRecorder");
});

test("startVideoRecording resolves done early when stop() is called manually", async () => {
  const { MockMediaRecorder } = makeMockMediaRecorder();
  setGlobal("MediaRecorder", MockMediaRecorder);
  vi.useFakeTimers();
  const recording = startVideoRecording({} as MediaStream);
  recording.stop();
  const file = await recording.done;
  expect(file).toBeInstanceOf(File);
  vi.useRealTimers();
  deleteGlobal("MediaRecorder");
});

test("startVideoRecording throws synchronously when no mime type is supported", () => {
  const { MockMediaRecorder } = makeMockMediaRecorder(() => false);
  setGlobal("MediaRecorder", MockMediaRecorder);
  expect(() => startVideoRecording({} as MediaStream)).toThrow(
    "No supported video recording format",
  );
  deleteGlobal("MediaRecorder");
});

test("capturePosterFrame draws the current video frame to a canvas and returns a JPEG File", async () => {
  const drawImage = vi.fn();
  const toBlob = vi.fn((callback: BlobCallback) =>
    callback(new Blob(["jpeg-bytes"], { type: "image/jpeg" })),
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
    toBlob: vi.fn((callback: BlobCallback) => callback(null)),
  };
  vi.spyOn(document, "createElement").mockReturnValue(
    fakeCanvas as unknown as HTMLCanvasElement,
  );
  await expect(
    capturePosterFrame({ videoWidth: 640, videoHeight: 480 } as HTMLVideoElement),
  ).rejects.toThrow("JPEG encoding failed");
});
