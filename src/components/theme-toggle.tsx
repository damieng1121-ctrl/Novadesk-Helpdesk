"use client";

import { useSyncExternalStore } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

type Preference = "light" | "dark" | "system";

const STORAGE_KEY = "novadesk-theme";
const ORDER: Preference[] = ["light", "dark", "system"];
const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;
const LABELS = { light: "Light", dark: "Dark", system: "System" } as const;

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): Preference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && (ORDER as string[]).includes(stored) ? (stored as Preference) : "system";
  } catch {
    return "system";
  }
}

// Server has no localStorage — matches the "system" fallback the inline
// FOUC-prevention script in layout.tsx uses, so hydration never mismatches.
function getServerSnapshot(): Preference {
  return "system";
}

function applyTheme(pref: Preference) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/** Cycles light -> dark -> system, matching the inline FOUC-prevention script in layout.tsx. */
export function ThemeToggle({ className }: { className?: string }) {
  const pref = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const Icon = ICONS[pref];

  function cycle() {
    const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Best-effort only — the toggle still applies for this page load.
    }
    listeners.forEach((l) => l());
  }

  return (
    <button
      onClick={cycle}
      title={`Theme: ${LABELS[pref]} (click to change)`}
      aria-label="Change color theme"
      className={className}
    >
      <Icon size={17} />
    </button>
  );
}
