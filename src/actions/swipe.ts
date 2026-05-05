export interface SwipeParams {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  threshold?: number;
}

export function swipe(node: HTMLElement, params: SwipeParams) {
  let startX: number | null = null;
  let threshold = params.threshold ?? 60;

  function onTouchStart(evt: TouchEvent) {
    startX = evt.touches[0].clientX;
  }

  function onTouchEnd(evt: TouchEvent) {
    if (startX === null) {
      return undefined;
    }
    const delta = evt.changedTouches[0].clientX - startX;
    startX = null;
    if (delta < -threshold) {
      params.onSwipeLeft();
    } else if (delta > threshold) {
      params.onSwipeRight();
    }
  }

  node.addEventListener("touchstart", onTouchStart);
  node.addEventListener("touchend", onTouchEnd);

  return {
    update(newParams: SwipeParams) {
      params = newParams;
      threshold = newParams.threshold ?? 60;
    },
    destroy() {
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchend", onTouchEnd);
    },
  };
}
