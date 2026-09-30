"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { OptionGroup } from "@/lib/intake/options";

/**
 * A searchable multi-select.
 *
 * Deliberately not a native <select multiple> or a bare <datalist>. The first
 * is unsearchable and unstyleable; the second gives no keyboard affordance, no
 * group headers, and — the reason it was replaced — no way for the field to
 * tell the form that something has been typed but not yet committed.
 *
 * It accepts free text. The seed lists are a starting point, and a student
 * targeting a firm nobody listed must not be told their answer is invalid.
 *
 * `onDraftChange` is what fixes the unresponsive Continue button: the parent
 * needs to know about a half-typed entry so it can commit it on submit rather
 * than silently dropping it.
 */
export interface ComboboxProps {
  value: string[];
  onChange: (next: string[]) => void;
  groups: readonly OptionGroup[];
  placeholder?: string;
  /** Reports the uncommitted text so the form can flush it on submit. */
  onDraftChange?: (draft: string) => void;
  inputId?: string;
  /** Sits inside the input's box, at its end — the dictation mic. */
  trailing?: React.ReactNode;
  /** One answer only: picking replaces the current one. */
  single?: boolean;
  /** Custom search, e.g. so "VT" finds Virginia Tech. Defaults to substring. */
  match?: (item: string, query: string) => boolean;
}

interface Row { kind: "header" | "option" | "free"; label: string; value?: string }

export function Combobox({ value, onChange, groups, placeholder, onDraftChange, inputId, trailing, single, match }: ComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const chosen = useMemo(() => new Set(value.map((v) => v.toLowerCase())), [value]);

  // Group headers are rendered inline so a single index can walk the list with
  // the arrow keys; headers are skipped when moving.
  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const out: Row[] = [];
    for (const group of groups) {
      const items = group.items.filter(
        (item) => !chosen.has(item.toLowerCase())
          && (!q || (match ? match(item, q) : item.toLowerCase().includes(q))),
      );
      if (!items.length) continue;
      out.push({ kind: "header", label: group.label });
      for (const item of items) out.push({ kind: "option", label: item, value: item });
    }
    const exact = groups.some((g) => g.items.some((i) => i.toLowerCase() === q));
    if (q && !exact && !chosen.has(q)) {
      const free: Row = { kind: "free", label: `Add “${query.trim()}”`, value: query.trim() };
      // Enter takes the best match when the list is the point: a single-answer
      // field, or one searched by alias, where "dsp" means Delta Sigma Pi.
      if ((single || match) && out.length) out.push({ kind: "header", label: "Not listed" }, free);
      else out.unshift(free);
    }
    return out;
  }, [groups, query, chosen, match, single]);

  const selectable = rows.filter((r) => r.kind !== "header");

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  /** Query and the reported draft move together — they are the same thing. */
  const type = (next: string) => {
    setQuery(next);
    setActive(0);
    onDraftChange?.(next);
  };

  const add = (raw: string) => {
    const next = raw.trim();
    if (!next || chosen.has(next.toLowerCase())) { type(""); return; }
    onChange(single ? [next] : [...value, next]);
    type("");
    if (single) setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (!selectable.length) return;
      setActive((i) => (e.key === "ArrowDown"
        ? (i + 1) % selectable.length
        : (i - 1 + selectable.length) % selectable.length));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const pick = open && selectable[active];
      add(pick && pick.value ? pick.value : query);
      return;
    }
    if (e.key === "," ) { e.preventDefault(); add(query); return; }
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "Backspace" && !query && value.length) onChange(value.slice(0, -1));
  };

  let selectableIndex = -1;

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      {value.length > 0 && (
        <ul className="mb-[var(--space-12)] flex flex-wrap gap-[var(--space-8)]" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {value.map((chip) => (
            <li key={chip}>
              <button type="button" className="tb-chip mono-label"
                onClick={() => onChange(value.filter((c) => c !== chip))}>
                {chip}
                <span aria-hidden style={{ color: "var(--ink-faint)" }}>×</span>
                <span className="sr-only">Remove {chip}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <span className="tb-dictate__box">
        <input
          id={inputId}
          className="tb-field"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={query}
          placeholder={placeholder ?? "Search, or type your own"}
          onChange={(e) => { type(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {trailing}
      </span>

      {open && rows.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          style={{
            position: "absolute", zIndex: 30, left: 0, right: 0, top: "100%",
            margin: "var(--border-2) 0 0", padding: 0, listStyle: "none",
            maxHeight: 260, overflowY: "auto",
            background: "var(--canvas)",
            border: "var(--border-1) solid var(--rule-strong)",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          {rows.map((row, i) => {
            if (row.kind === "header") {
              return (
                <li key={`h-${row.label}-${i}`} className="mono-micro" aria-hidden
                  style={{
                    padding: "var(--space-8) var(--space-12) var(--space-4)",
                    color: "var(--ink-faint)", textTransform: "uppercase",
                    borderTop: i === 0 ? "none" : "var(--border-1) solid var(--rule)",
                  }}>
                  {row.label}
                </li>
              );
            }
            selectableIndex += 1;
            const idx = selectableIndex;
            const isActive = idx === active;
            return (
              <li key={`${row.kind}-${row.value}`} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  // mousedown, not click: the input's blur would otherwise close
                  // the list before the click landed.
                  onMouseDown={(e) => { e.preventDefault(); add(row.value!); }}
                  onMouseEnter={() => setActive(idx)}
                  className="mono-body"
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "var(--space-8) var(--space-12)",
                    background: isActive ? "var(--inverse-surface)" : "transparent",
                    color: isActive ? "var(--inverse-ink)" : "var(--ink)",
                    border: "none", cursor: "pointer", textTransform: "none",
                  }}
                >
                  {row.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
