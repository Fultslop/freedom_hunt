export interface SwipeParams {
  onDragMove: (delta: number) => void;
  onDragEnd: (delta: number) => void;
  threshold?: number;
}

export function swipe(node: HTMLElement, params: SwipeParams) {
  let startX = 0;
  let startY = 0;
  let direction: "horizontal" | "vertical" | null = null;
  let threshold = params.threshold ?? 10;

  function onTouchStart(evt: TouchEvent) {
    startX = evt.touches[0].clientX;
    startY = evt.touches[0].clientY;
    direction = null;
  }

  function onTouchMove(evt: TouchEvent) {
    const clientX = evt.changedTouches[0].clientX;
    const clientY = evt.changedTouches[0].clientY;
    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    if (direction === null) {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= threshold) {
        direction = Math.abs(deltaX) >= Math.abs(deltaY) ? "horizontal" : "vertical";
      }
    }

    if (direction === "horizontal") {
      evt.preventDefault();
      params.onDragMove(deltaX);
    }
  }

  function onTouchEnd(evt: TouchEvent) {
    if (direction === "horizontal") {
      const deltaX = evt.changedTouches[0].clientX - startX;
      params.onDragEnd(deltaX);
    }
    direction = null;
  }

  node.addEventListener("touchstart", onTouchStart, { passive: true });
  node.addEventListener("touchmove", onTouchMove, { passive: false });
  node.addEventListener("touchend", onTouchEnd);

  return {
    update(newParams: SwipeParams) {
      params = newParams;
      threshold = newParams.threshold ?? 10;
    },
    destroy() {
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchmove", onTouchMove);
      node.removeEventListener("touchend", onTouchEnd);
    },
  };
}
