import { swipe } from "../actions/swipe";

function makeNode() {
  return document.createElement("div");
}

function touch(clientX: number): Touch {
  return { clientX } as Touch;
}

function makeTouchInit(touches: Touch[]): TouchEventInit {
  return { touches } as unknown as TouchEventInit;
}

function makeTouchInitEnd(changedTouches: Touch[]): TouchEventInit {
  return { changedTouches } as unknown as TouchEventInit;
}

test("calls onSwipeLeft when delta exceeds threshold", () => {
  const node = makeNode();
  const onSwipeLeft = vi.fn();
  const onSwipeRight = vi.fn();
  swipe(node, { onSwipeLeft, onSwipeRight });

  node.dispatchEvent(new TouchEvent("touchstart", makeTouchInit([touch(200)])));
  node.dispatchEvent(
    new TouchEvent("touchend", makeTouchInitEnd([touch(100)])),
  );

  expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  expect(onSwipeRight).not.toHaveBeenCalled();
});

test("calls onSwipeRight when delta exceeds threshold", () => {
  const node = makeNode();
  const onSwipeLeft = vi.fn();
  const onSwipeRight = vi.fn();
  swipe(node, { onSwipeLeft, onSwipeRight });

  node.dispatchEvent(new TouchEvent("touchstart", makeTouchInit([touch(100)])));
  node.dispatchEvent(
    new TouchEvent("touchend", makeTouchInitEnd([touch(200)])),
  );

  expect(onSwipeRight).toHaveBeenCalledTimes(1);
  expect(onSwipeLeft).not.toHaveBeenCalled();
});

test("ignores swipes below threshold", () => {
  const node = makeNode();
  const onSwipeLeft = vi.fn();
  const onSwipeRight = vi.fn();
  swipe(node, { onSwipeLeft, onSwipeRight, threshold: 60 });

  node.dispatchEvent(new TouchEvent("touchstart", makeTouchInit([touch(100)])));
  node.dispatchEvent(
    new TouchEvent("touchend", makeTouchInitEnd([touch(120)])),
  );

  expect(onSwipeLeft).not.toHaveBeenCalled();
  expect(onSwipeRight).not.toHaveBeenCalled();
});

test("destroy removes event listeners", () => {
  const node = makeNode();
  const onSwipeLeft = vi.fn();
  const action = swipe(node, { onSwipeLeft, onSwipeRight: vi.fn() });
  action.destroy();

  node.dispatchEvent(new TouchEvent("touchstart", makeTouchInit([touch(200)])));
  node.dispatchEvent(
    new TouchEvent("touchend", makeTouchInitEnd([touch(100)])),
  );

  expect(onSwipeLeft).not.toHaveBeenCalled();
});
