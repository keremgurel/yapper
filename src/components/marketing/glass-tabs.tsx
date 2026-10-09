"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { useReducedMotion } from "framer-motion";
import {
  GlassContent,
  GlassScene,
  GlassTabsRoot,
  GlassTabsList,
  GlassTabsIndicator,
  GlassTabsTrigger,
} from "@glass-sdk/liquid-glass";
import type { LucideIcon } from "lucide-react";
import "@glass-sdk/liquid-glass/styles.css";

export interface GlassTab<T extends string> {
  value: T;
  label: string;
  Icon?: LucideIcon;
}

/** The existing capsule, with a refracting, draggable selection lens. */
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
  panelId: string | ((value: T) => string);
  id: string;
  label: string;
  className?: string;
}) {
  const { resolvedTheme } = useTheme();
  const reduce = useReducedMotion();
  const [keyboard, setKeyboard] = useState(false);

  return (
    <GlassScene
      className={`studio-showcase-tabs ${className}`}
      style={{ ["--studio-tab-count" as string]: tabs.length }}
      material="regular"
      appearance={resolvedTheme === "dark" ? "dark" : "light"}
      motion={reduce !== false ? "none" : "full"}
    >
      <GlassContent aria-hidden="true" className="studio-tabs-backdrop" />
      <GlassTabsRoot
        value={value}
        onValueChange={(next) => {
          const tab = tabs.find((tab) => tab.value === next);
          if (tab) onChange(tab.value);
        }}
        className="studio-tabs-root"
      >
        <GlassTabsList
          aria-label={label}
          className="studio-tabs-list"
          interactive={false}
          onKeyDownCapture={() => setKeyboard(true)}
          onPointerDownCapture={() => setKeyboard(false)}
          radius={18}
          refraction={12}
        >
          <GlassTabsIndicator
            className="studio-tabs-selection"
            motion={reduce !== false || keyboard ? "none" : "full"}
            material="clear"
            radius="capsule"
            refraction={18}
          />
          {tabs.map(({ value: tab, label: tabLabel, Icon }) => (
            <GlassTabsTrigger
              key={tab}
              value={tab}
              id={`${id}-${tab}`}
              aria-controls={
                typeof panelId === "string" ? panelId : panelId(tab)
              }
            >
              {Icon && <Icon size={16} aria-hidden="true" />}
              <span>{tabLabel}</span>
            </GlassTabsTrigger>
          ))}
        </GlassTabsList>
      </GlassTabsRoot>
    </GlassScene>
  );
}
