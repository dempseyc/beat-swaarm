import React, { useCallback, useRef } from 'react';

export interface NormalizedPointerEvent {
  pointerId: number;
  pointerType: string;
  isPrimary: boolean;
  button: number;
  clientX: number;
  clientY: number;
  detail: number;
  originalEvent: React.PointerEvent;
  target: EventTarget | null;
}

export interface PointerInputCallbacks {
  onDown?: (event: NormalizedPointerEvent) => void;
  onMove?: (event: NormalizedPointerEvent) => void;
  onUp?: (event: NormalizedPointerEvent) => void;
  onCancel?: (event: NormalizedPointerEvent) => void;
  onDoubleClick?: (event: NormalizedPointerEvent) => void;
  stopPropagation?: boolean;
  capture?: boolean;
}

const DOUBLE_TAP_TIMEOUT = 300;
const DOUBLE_TAP_DISTANCE = 36;

const normalizeEvent = (event: React.PointerEvent): NormalizedPointerEvent => ({
  pointerId: event.pointerId,
  pointerType: event.pointerType,
  isPrimary: event.isPrimary,
  button: event.button,
  clientX: event.clientX,
  clientY: event.clientY,
  detail: event.detail,
  originalEvent: event,
  target: event.target,
});

export const pointerInputStyle: React.CSSProperties = {
  touchAction: 'none',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
  MozUserSelect: 'none',
};

export function usePointerInput() {
  const activePointersRef = useRef<Set<number>>(new Set());
  const lastTapRef = useRef<{
    time: number;
    x: number;
    y: number;
    pointerType: string;
  } | null>(null);

  const isPrimaryButton = (event: React.PointerEvent) => {
    return event.pointerType !== 'mouse' || event.button === 0;
  };

  const isDoubleTap = (event: NormalizedPointerEvent) => {
    if (event.pointerType === 'mouse') {
      return event.detail === 2;
    }

    const lastTap = lastTapRef.current;
    const now = Date.now();
    if (!lastTap) {
      lastTapRef.current = {
        time: now,
        x: event.clientX,
        y: event.clientY,
        pointerType: event.pointerType,
      };
      return false;
    }

    const deltaTime = now - lastTap.time;
    const deltaX = event.clientX - lastTap.x;
    const deltaY = event.clientY - lastTap.y;
    const distance = Math.hypot(deltaX, deltaY);
    const samePointerType = event.pointerType === lastTap.pointerType;

    lastTapRef.current = {
      time: now,
      x: event.clientX,
      y: event.clientY,
      pointerType: event.pointerType,
    };

    return samePointerType && deltaTime <= DOUBLE_TAP_TIMEOUT && distance <= DOUBLE_TAP_DISTANCE;
  };

  const createPointerHandlers = useCallback((callbacks: PointerInputCallbacks) => {
    const handlePointerDown: React.PointerEventHandler = (event) => {
      if (!isPrimaryButton(event)) return;

      const normalized = normalizeEvent(event);
      const target = event.currentTarget as Element;
      if (callbacks.capture !== false) {
        target.setPointerCapture?.(event.pointerId);
      }
      activePointersRef.current.add(event.pointerId);
      if (callbacks.stopPropagation) event.stopPropagation();
      event.preventDefault();

      if (callbacks.onDoubleClick && isDoubleTap(normalized)) {
        callbacks.onDoubleClick(normalized);
      }

      callbacks.onDown?.(normalized);
    };

    const handlePointerMove: React.PointerEventHandler = (event) => {
      if (!activePointersRef.current.has(event.pointerId)) return;
      const normalized = normalizeEvent(event);
      if (callbacks.stopPropagation) event.stopPropagation();
      callbacks.onMove?.(normalized);
    };

    const cleanupPointer = (event: React.PointerEvent) => {
      if (!activePointersRef.current.has(event.pointerId)) return;
      const target = event.currentTarget as Element;
      if (callbacks.capture !== false) {
        target.releasePointerCapture?.(event.pointerId);
      }
      activePointersRef.current.delete(event.pointerId);
    };

    const handlePointerUp: React.PointerEventHandler = (event) => {
      const normalized = normalizeEvent(event);
      cleanupPointer(event);
      if (callbacks.stopPropagation) event.stopPropagation();
      callbacks.onUp?.(normalized);
    };

    const handlePointerCancel: React.PointerEventHandler = (event) => {
      const normalized = normalizeEvent(event);
      cleanupPointer(event);
      if (callbacks.stopPropagation) event.stopPropagation();
      callbacks.onCancel?.(normalized);
    };

    return {
      onPointerDown: handlePointerDown,
      onPointerMove: callbacks.onMove ? handlePointerMove : undefined,
      onPointerUp: callbacks.onUp ? handlePointerUp : undefined,
      onPointerCancel: callbacks.onCancel ? handlePointerCancel : undefined,
    };
  }, []);

  return { createPointerHandlers, pointerStyle: pointerInputStyle };
}
