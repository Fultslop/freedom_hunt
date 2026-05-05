import { describe, test, expect, vi } from "vitest";
import { swipe } from "../actions/swipe";

function touchStart(element: HTMLElement, clientX: number, clientY: number) {
  element.dispatchEvent(
    new TouchEvent("touchstart", {
      touches: [{ clientX, clientY } as Touch],
      changedTouches: [{ clientX, clientY } as Touch],
      bubbles: true,
      cancelable: true,
    })
  );
}

function touchMove(element: HTMLElement, clientX: number, clientY: number): TouchEvent {
  const evt = new TouchEvent("touchmove", {
    touches: [{ clientX, clientY } as Touch],
    changedTouches: [{ clientX, clientY } as Touch],
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(evt);
  return evt;
}

function touchEnd(element: HTMLElement, clientX: number, clientY: number) {
  element.dispatchEvent(
    new TouchEvent("touchend", {
      touches: [],
      changedTouches: [{ clientX, clientY } as Touch],
      bubbles: true,
      cancelable: true,
    })
  );
}

describe("swipe action — direction lock", () => {
  test("predominantly vertical touchmove does not call onDragMove", () => {
    const element = document.createElement("div");
    const onDragMove = vi.fn();
    swipe(element, { onDragMove, onDragEnd: vi.fn() });

    touchStart(element, 100, 100);
    touchMove(element, 102, 130); // dy=30 > dx=2 → vertical

    expect(onDragMove).not.toHaveBeenCalled();
  });

  test("predominantly horizontal touchmove calls onDragMove with delta", () => {
    const element = document.createElement("div");
    const onDragMove = vi.fn();
    swipe(element, { onDragMove, onDragEnd: vi.fn() });

    touchStart(element, 100, 100);
    touchMove(element, 130, 102); // dx=30 > dy=2 → horizontal, delta=30

    expect(onDragMove).toHaveBeenCalledWith(30);
  });

  test("direction lock persists for the touch even when motion turns vertical", () => {
    const element = document.createElement("div");
    const onDragMove = vi.fn();
    swipe(element, { onDragMove, onDragEnd: vi.fn() });

    touchStart(element, 100, 100);
    touchMove(element, 130, 102); // locks horizontal
    touchMove(element, 131, 180); // very vertical, but still horizontal-locked

    expect(onDragMove).toHaveBeenCalledTimes(2);
    expect(onDragMove).toHaveBeenLastCalledWith(31);
  });

  test("touchend calls onDragEnd with final delta after horizontal lock", () => {
    const element = document.createElement("div");
    const onDragEnd = vi.fn();
    swipe(element, { onDragMove: vi.fn(), onDragEnd });

    touchStart(element, 100, 100);
    touchMove(element, 130, 102);
    touchEnd(element, 160, 105);

    expect(onDragEnd).toHaveBeenCalledWith(60); // 160 - 100
  });

  test("touchend does not call onDragEnd after vertical lock", () => {
    const element = document.createElement("div");
    const onDragEnd = vi.fn();
    swipe(element, { onDragMove: vi.fn(), onDragEnd });

    touchStart(element, 100, 100);
    touchMove(element, 102, 130); // vertical lock
    touchEnd(element, 104, 160);

    expect(onDragEnd).not.toHaveBeenCalled();
  });

  test("direction resets between touches", () => {
    const element = document.createElement("div");
    const onDragMove = vi.fn();
    swipe(element, { onDragMove, onDragEnd: vi.fn() });

    // First touch — vertical
    touchStart(element, 100, 100);
    touchMove(element, 102, 130);
    touchEnd(element, 102, 160);

    // Second touch — horizontal
    touchStart(element, 100, 100);
    touchMove(element, 130, 102);

    expect(onDragMove).toHaveBeenCalledTimes(1);
    expect(onDragMove).toHaveBeenCalledWith(30);
  });

  test("destroy removes event listeners", () => {
    const element = document.createElement("div");
    const onDragMove = vi.fn();
    const action = swipe(element, { onDragMove, onDragEnd: vi.fn() });
    action.destroy();

    touchStart(element, 100, 100);
    touchMove(element, 150, 100);

    expect(onDragMove).not.toHaveBeenCalled();
  });

  test("update replaces params", () => {
    const element = document.createElement("div");
    const first = vi.fn();
    const second = vi.fn();
    const action = swipe(element, { onDragMove: first, onDragEnd: vi.fn() });
    action.update({ onDragMove: second, onDragEnd: vi.fn() });

    touchStart(element, 100, 100);
    touchMove(element, 130, 102);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(30);
  });
});
