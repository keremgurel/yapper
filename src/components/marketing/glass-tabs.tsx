"use client";

import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import {
  GlassContent,
  GlassScene,
  GlassSurface,
} from "@glass-sdk/liquid-glass";
import { useTheme } from "next-themes";
import "@glass-sdk/liquid-glass/styles.css";
import type { LucideIcon } from "lucide-react";

export interface GlassTab<T extends string> {
  value: T;
  label: string;
  Icon?: LucideIcon;
}

type Gesture = {
  pointer: number;
  x: number;
  y: number;
  origin: number;
  index: number;
  dragging: boolean;
  canceled: boolean;
  lastX: number;
  time: number;
  velocity: number;
};

/**
 * The glass capsule tab control: a clear lens that slides between equal
 * slots, follows a horizontal drag, and commits on release. Click and arrow
 * keys work too, and reduced motion makes every move immediate.
 */
export default function GlassTabs<T extends string>({
  tabs,
  value,
  onChange,
  panelId,
  id,
  label,
  className = "",
}: {
  tabs: readonly GlassTab<T>[];
  value: T;
  onChange: (value: T) => void;
  /** One shared panel id, or a function when each tab has its own panel. */
  panelId: string | ((value: T) => string);
  id: string;
  label: string;
  className?: string;
}) {
  const { resolvedTheme } = useTheme();
  const root = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const animation = useRef<ReturnType<typeof animate> | null>(null);
  const [slot, setSlot] = useState(0);
  const [pressed, setPressed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const x = useMotionValue(0);
  const reduce = useReducedMotion();
  const index = tabs.findIndex((tab) => tab.value === value);
  const selected = useRef(index);
  useEffect(() => {
    selected.current = index;
  }, [index]);
  const key = useId();

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const resize = new ResizeObserver(() => {
      const width = buttons.current[0]?.getBoundingClientRect().width ?? 0;
      animation.current?.stop();
      x.set(selected.current * width);
      setSlot(width);
    });
    resize.observe(node);
    return () => {
      resize.disconnect();
      animation.current?.stop();
    };
  }, [x]);

  const move = (destination: number, immediate = false, velocity = 0) => {
    animation.current?.stop();
    if (immediate || reduce !== false) x.set(destination);
    else
      animation.current = animate(x, destination, {
        type: "spring",
        stiffness: 440,
        damping: 36,
        mass: 0.8,
        velocity,
      });
  };
  const clear = () => {
    gesture.current = null;
    setPressed(false);
    setDragging(false);
    setPreview(null);
  };
  const finish = (event: PointerEvent<HTMLDivElement>, cancel = false) => {
    const current = gesture.current;
    if (!current || current.pointer !== event.pointerId) return;
    const bounds = root.current!.getBoundingClientRect();
    const outside =
      event.clientY < bounds.top - 24 || event.clientY > bounds.bottom + 24;
    const abort = cancel || current.canceled || outside;
    const elapsed = event.timeStamp - current.time;
    const velocity = elapsed > 100 ? 0 : current.velocity;
    const target = abort
      ? index
      : current.dragging
        ? Math.max(
            0,
            Math.min(
              tabs.length - 1,
              Math.round((x.get() + velocity * 0.07) / slot),
            ),
          )
        : current.index;
    // Suppress the browser's synthetic click after pointer-up; keyboard clicks
    // remain available. Commit only on release, never while scrubbing.
    suppressClick.current = true;
    clear();
    move(target * slot, false, abort ? 0 : velocity);
    if (!abort) {
      onChange(tabs[target].value);
      buttons.current[target]?.focus({ preventScroll: true });
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <GlassScene
      ref={root}
      material="regular"
      appearance={resolvedTheme === "dark" ? "dark" : "light"}
      motion="none"
      className={`studio-showcase-tabs ${className}`}
      style={{ ["--studio-tab-count" as string]: tabs.length }}
      role="tablist"
      aria-label={label}
      data-pressed={pressed}
      data-dragging={dragging}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0 || gesture.current || !slot)
          return;
        const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
          'button[role="tab"]',
        );
        if (!target) return;
        const at = Number(target.dataset.index);
        suppressClick.current = false;
        gesture.current = {
          pointer: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          origin: at * slot,
          index: at,
          dragging: false,
          canceled: false,
          lastX: event.clientX,
          time: event.timeStamp,
          velocity: 0,
        };
        setPressed(true);
        setPreview(at);
        move(at * slot);
      }}
      onPointerMove={(event) => {
        const current = gesture.current;
        if (!current || current.pointer !== event.pointerId || current.canceled)
          return;
        const dx = event.clientX - current.x,
          dy = event.clientY - current.y;
        if (!current.dragging) {
          if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
            current.canceled = true;
            setPressed(false);
            setPreview(null);
            move(index * slot);
            return;
          }
          if (Math.abs(dx) < 8) return;
          current.dragging = true;
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
          animation.current?.stop();
        }
        const now = event.timeStamp;
        current.velocity =
          ((event.clientX - current.lastX) / Math.max(1, now - current.time)) *
          1000;
        current.lastX = event.clientX;
        current.time = now;
        const raw = current.origin + dx,
          max = slot * (tabs.length - 1);
        const bounded = Math.max(0, Math.min(max, raw));
        x.set(
          bounded +
            Math.sign(raw - bounded) *
              Math.min(14, Math.abs(raw - bounded) * 0.16),
        );
        setPreview(
          Math.max(0, Math.min(tabs.length - 1, Math.round(bounded / slot))),
        );
      }}
      onPointerUp={(event) => finish(event)}
      onPointerCancel={(event) => finish(event, true)}
      onLostPointerCapture={(event) => {
        if (gesture.current) finish(event, true);
      }}
      onPointerLeave={(event) => {
        if (gesture.current && !gesture.current.dragging) finish(event, true);
      }}
    >
      <GlassContent aria-hidden="true" className="studio-tabs-backdrop" />
      <div className="studio-tab-lens-track" aria-hidden="true">
        <motion.div
          className="studio-tab-lens"
          style={{ x, width: slot || `${100 / tabs.length}%` }}
        >
          <GlassSurface
            className="studio-tab-lens-surface"
            material="clear"
            radius="capsule"
            refraction={18}
            interactive={false}
          />
        </motion.div>
      </div>
      {tabs.map(({ value: tab, label: tabLabel, Icon }, at) => (
        <button
          key={`${key}-${tab}`}
          ref={(node) => {
            buttons.current[at] = node;
          }}
          data-index={at}
          data-preview={(preview ?? index) === at}
          type="button"
          role="tab"
          aria-selected={value === tab}
          aria-controls={typeof panelId === "string" ? panelId : panelId(tab)}
          id={`${id}-${tab}`}
          tabIndex={value === tab ? 0 : -1}
          onClick={(event) => {
            if (event.detail !== 0 && suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            move(at * slot, event.detail === 0);
            onChange(tab);
          }}
          onKeyDown={(event) => {
            let next = at;
            if (event.key === "ArrowRight") next = (at + 1) % tabs.length;
            else if (event.key === "ArrowLeft")
              next = (at + tabs.length - 1) % tabs.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = tabs.length - 1;
            else return;
            event.preventDefault();
            clear();
            move(next * slot, true);
            onChange(tabs[next].value);
            buttons.current[next]?.focus();
          }}
        >
          {Icon && <Icon size={16} />}
          <span>{tabLabel}</span>
        </button>
      ))}
    </GlassScene>
  );
}
