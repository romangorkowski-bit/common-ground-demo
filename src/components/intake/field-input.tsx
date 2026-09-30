"use client";

import { useMemo, useState } from "react";
import { SCHOOL_ALIASES, ORG_ALIASES } from "@/lib/affinity/aliases";
import type { OptionGroup } from "@/lib/intake/options";
import type { Field } from "@/lib/intake/types";
import { Combobox } from "./combobox";
import { Dictation, MicField } from "./mic-button";
import { SpecificityMeter } from "./specificity-meter";

const inputClass = "tb-field";

/** Suggestions come from the same alias tables the matcher uses, so what a
 *  student picks is guaranteed to canonicalise. */
function suggestionsFor(field: Field): string[] {
  const small = new Set(["and", "of", "for", "at", "in", "the"]);
  const upper = new Set(["rotc", "stem"]);
  const titleCase = (s: string) => s.split(" ").map((w, i) =>
    upper.has(w) ? w.toUpperCase() : i > 0 && small.has(w) ? w : w[0].toUpperCase() + w.slice(1)).join(" ");
  // One entry per school or org, under its longest (fullest) alias; the short
  // ones still find it through matcherFor.
  const fullest = (table: Readonly<Record<string, string>>) => {
    const best = new Map<string, string>();
    for (const [alias, slug] of Object.entries(table)) {
      if (alias.length > (best.get(slug)?.length ?? 0)) best.set(slug, alias);
    }
    return [...best.values()].map(titleCase).sort();
  };
  if (field.options === "school-canon") return fullest(SCHOOL_ALIASES);
  if (field.options === "org-canon") return fullest(ORG_ALIASES);
  return Array.isArray(field.options) ? [...field.options] : [];
}

const GROUP_LABEL: Record<string, string> = { "school-canon": "Schools", "org-canon": "Organisations" };

/** Grouped option lists are objects; the canon sources and flat lists become one group. */
function groupsFor(field: Field): readonly OptionGroup[] | null {
  const o = field.options;
  if (Array.isArray(o) && o.length && typeof o[0] === "object" && "items" in (o[0] as object)) {
    return o as readonly OptionGroup[];
  }
  const items = suggestionsFor(field);
  if (!items.length) return null;
  return [{ label: (typeof o === "string" && GROUP_LABEL[o]) || "Suggestions", items }];
}

/** For the canon sources, a query matches an item when it is a prefix of any
 *  alias of the same thing, so "VT" finds Virginia Tech and "DSP" Delta Sigma Pi. */
function matcherFor(field: Field): ((item: string, q: string) => boolean) | undefined {
  const table = field.options === "school-canon" ? SCHOOL_ALIASES
    : field.options === "org-canon" ? ORG_ALIASES : null;
  if (!table) return undefined;
  const bySlug = new Map<string, string[]>();
  for (const [alias, slug] of Object.entries(table)) bySlug.set(slug, [...(bySlug.get(slug) ?? []), alias]);
  return (item, q) => {
    const lower = item.toLowerCase();
    if (lower.includes(q)) return true;
    const slug = table[lower];
    return Boolean(slug && bySlug.get(slug)?.some((a) => a.startsWith(q)));
  };
}

export interface FieldInputProps {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
  onDictate?: (text: string) => void;
  dictationBusy?: boolean;
  /** Reports text typed but not yet committed, so submit can flush it. */
  onDraftChange?: (draft: string) => void;
}

/** Wraps a single field so the mic sits at its end, with any status beneath. */
function withMic(
  field: Field,
  onDictate: ((text: string) => void) | undefined,
  busy: boolean | undefined,
  input: React.ReactNode,
) {
  if (!field.dictation || !onDictate) return input;
  return <MicField onTranscript={onDictate} busy={busy}>{input}</MicField>;
}

/** For fields made of several inputs, where no one box owns the mic. */
function StandaloneMic({
  field, onDictate, busy, row,
}: {
  field: Field;
  onDictate?: (text: string) => void;
  busy?: boolean;
  row: (mic: React.ReactNode) => React.ReactNode;
}) {
  if (!field.dictation || !onDictate) return <>{row(null)}</>;
  return (
    <Dictation
      onTranscript={onDictate}
      busy={busy}
      standalone
      render={(mic, status) => <>{row(mic)}{status}</>}
    />
  );
}

export function FieldInput(props: FieldInputProps) {
  const { field } = props;
  switch (field.input) {
    case "chips": return <ChipsInput {...props} />;
    case "date-list": return <EventListInput {...props} />;
    case "pair": return <PairInput {...props} />;
    case "select": return <SelectInput {...props} />;
    case "date": return <DateInput {...props} />;
    default: return <TextInput {...props} />;
  }
}

/**
 * A field with any suggestions gets a real searchable multi-select; everything
 * else keeps free-text chip entry. These are two
 * components rather than one with a branch, because the branch would sit
 * above the free-text path's hooks.
 */
function ChipsInput(props: FieldInputProps) {
  return groupsFor(props.field) ? <PickerChips {...props} /> : <FreeChips {...props} />;
}

function PickerChips({ field, value, onChange, onDictate, dictationBusy, onDraftChange }: FieldInputProps) {
  const chips = Array.isArray(value) ? (value as string[]) : [];
  const groups = groupsFor(field)!;
  const matcher = useMemo(() => matcherFor(field), [field]);
  const box = (trailing?: React.ReactNode) => (
    <Combobox
      inputId={field.id}
      value={chips}
      onChange={onChange}
      groups={groups}
      match={matcher}
      placeholder={field.placeholder}
      onDraftChange={onDraftChange}
      trailing={trailing}
    />
  );
  return (
    <div>
      {field.dictation && onDictate ? (
        <Dictation
          onTranscript={onDictate}
          busy={dictationBusy}
          render={(mic, status) => <>{box(mic)}{status}</>}
        />
      ) : box()}
      {field.specificityMeter && <SpecificityMeter values={chips} />}
    </div>
  );
}

function FreeChips({ field, value, onChange, onDictate, dictationBusy, onDraftChange }: FieldInputProps) {
  const chips = Array.isArray(value) ? (value as string[]) : [];

  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const next = raw.trim();
    onDraftChange?.("");
    if (!next || chips.some((c) => c.toLowerCase() === next.toLowerCase())) return setDraft("");
    onChange([...chips, next]);
    setDraft("");
  };

  return (
    <div>
      {chips.length > 0 && (
        <ul className="mb-[var(--space-12)] flex flex-wrap gap-[var(--space-8)]" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {chips.map((chip) => (
            <li key={chip}>
              <button type="button" className="tb-chip mono-label"
                onClick={() => onChange(chips.filter((c) => c !== chip))}>
                {chip}
                <span aria-hidden style={{ color: "var(--ink-faint)" }}>×</span>
                <span className="sr-only">Remove {chip}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {withMic(
        field, onDictate, dictationBusy,
        <input
          className={inputClass}
          value={draft}
          placeholder={field.placeholder ?? "Type and press Enter"}
          onChange={(e) => { setDraft(e.target.value); onDraftChange?.(e.target.value); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
            if (e.key === "Backspace" && !draft && chips.length) onChange(chips.slice(0, -1));
          }}
          onBlur={() => add(draft)}
        />,
      )}

      {field.specificityMeter && <SpecificityMeter values={chips} />}
    </div>
  );
}

function TextInput({ field, value, onChange, onDictate, dictationBusy }: FieldInputProps) {
  return (
    <div>
      {withMic(
        field, onDictate, dictationBusy,
        <input
          className={inputClass}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />,
      )}
    </div>
  );
}

function DateInput({ value, onChange }: FieldInputProps) {
  return (
    <input
      type="date"
      className={inputClass}
      value={typeof value === "string" ? value.slice(0, 10) : ""}
      onChange={(e) => onChange(e.target.value || null)}
    />
  );
}

function SelectInput({ field, value, onChange, onDraftChange }: FieldInputProps) {
  const groups = useMemo(() => groupsFor(field) ?? [], [field]);
  const matcher = useMemo(() => matcherFor(field), [field]);
  const chosen = typeof value === "string" && value ? [value] : [];
  return (
    <Combobox
      inputId={field.id}
      single
      value={chosen}
      onChange={(next) => onChange(next[0] ?? null)}
      groups={groups}
      match={matcher}
      placeholder={chosen.length ? "Search to change it" : field.placeholder ?? "Start typing…"}
      onDraftChange={onDraftChange}
    />
  );
}

function PairInput({ field, value, onChange, onDictate, dictationBusy }: FieldInputProps) {
  const pair = (value ?? {}) as { from?: string; to?: string };
  const set = (part: "from" | "to") => (next: string) => {
    const merged = { from: pair.from ?? "", to: pair.to ?? "", [part]: next };
    onChange(merged.from || merged.to ? merged : null);
  };
  return (
    <div>
      <StandaloneMic field={field} onDictate={onDictate} busy={dictationBusy} row={(mic) => (
        <div className="flex flex-wrap items-center gap-[var(--space-12)]">
          <input className={inputClass} style={{ flex: 1, minWidth: "10rem" }} placeholder="from — cybersecurity"
            value={pair.from ?? ""} onChange={(e) => set("from")(e.target.value)} />
          <span className="mono-label" style={{ color: "var(--ink-faint)" }} aria-hidden>&rarr;</span>
          <input className={inputClass} style={{ flex: 1, minWidth: "10rem" }} placeholder="to — consulting"
            value={pair.to ?? ""} onChange={(e) => set("to")(e.target.value)} />
          {mic}
        </div>
      )} />
    </div>
  );
}

const EVENT_KINDS = [
  ["career_fair", "Career fair"], ["recruiting_event", "Recruiting event"],
  ["conference", "Conference"], ["webinar", "Webinar"],
  ["case_competition", "Case competition"], ["class", "Class"],
] as const;

interface EventRow { name: string; kind: string; date: string; org: string | null }

function EventListInput({ field, value, onChange, onDictate, dictationBusy }: FieldInputProps) {
  const rows: EventRow[] = Array.isArray(value) ? (value as EventRow[]) : [];
  const update = (i: number, patch: Partial<EventRow>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="grid gap-[var(--space-12)]">
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-center gap-[var(--space-12)]">
          <input className={`${inputClass} flex-1 min-w-[12rem]`} placeholder="Event name"
            value={row.name} onChange={(e) => update(i, { name: e.target.value })} />
          <select className={inputClass} style={{ width: "auto" }} value={row.kind}
            onChange={(e) => update(i, { kind: e.target.value })}>
            {EVENT_KINDS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <input type="date" className={inputClass} style={{ width: "auto" }} value={row.date.slice(0, 10)}
            onChange={(e) => update(i, { date: e.target.value })} />
          <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))}
            className="tb-btn tb-btn--sm mono-label">
            Remove
          </button>
        </div>
      ))}
      <StandaloneMic field={field} onDictate={onDictate} busy={dictationBusy} row={(mic) => (
        <div className="flex flex-wrap items-center gap-[var(--space-12)]">
          <button
            type="button"
            onClick={() => onChange([...rows, { name: "", kind: "career_fair", date: new Date().toISOString().slice(0, 10), org: null }])}
            className="tb-btn tb-btn--sm mono-label"
          >
            + Add an event
          </button>
          {mic}
        </div>
      )} />
    </div>
  );
}
