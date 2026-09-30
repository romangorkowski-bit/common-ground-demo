import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { TailoredResume } from "@/lib/ai/schemas";
import { dateRange, monthYear } from "./dates";

/**
 * The resume-formatter guide as a layout: US Letter, 0.6" margins, one
 * column, Helvetica, name 18pt, caps section headers 12pt, body 10.5pt,
 * plain "•" bullets, no tables, images or text boxes. The text layer is real
 * text, which is what an ATS parses. Sections follow the guide's order.
 */
const PAGE = { width: 612, height: 792 };
const MARGIN = 43;
const WIDTH = PAGE.width - MARGIN * 2;
const SIZE = { name: 18, header: 12, body: 10.5, small: 10 };
const LEADING = 1.2;
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.35, 0.35, 0.35);

export interface ResumeHeader {
  name: string;
  /** email, phone, LinkedIn, city: whatever the app knows, joined with " | ". */
  contact: string[];
}

export interface RenderedResume {
  bytes: Uint8Array;
  pages: number;
}

export async function renderResumePdf(resume: TailoredResume, header: ResumeHeader): Promise<RenderedResume> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${header.name} resume`);
  doc.setCreator("Common Ground");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;

  const ensure = (height: number) => {
    if (y - height < MARGIN) {
      page = doc.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - MARGIN;
    }
  };

  const write = (text: string, opts: { font?: PDFFont; size?: number; indent?: number; color?: ReturnType<typeof rgb>; prefix?: string } = {}) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? SIZE.body;
    const indent = opts.indent ?? 0;
    const lines = wrap(winAnsi(text, font), font, size, WIDTH - indent);
    lines.forEach((line, i) => {
      ensure(size * LEADING);
      y -= size * LEADING;
      if (i === 0 && opts.prefix) page.drawText(opts.prefix, { x: MARGIN + indent - 9, y, size, font, color: opts.color ?? INK });
      page.drawText(line, { x: MARGIN + indent, y, size, font, color: opts.color ?? INK });
    });
  };

  /** A left text and a right-aligned date on one line. */
  const writeRow = (left: string, right: string, font: PDFFont) => {
    ensure(SIZE.body * LEADING);
    y -= SIZE.body * LEADING;
    const r = winAnsi(right, regular);
    const rw = regular.widthOfTextAtSize(r, SIZE.small);
    const l = wrap(winAnsi(left, font), font, SIZE.body, WIDTH - rw - 12)[0] ?? "";
    page.drawText(l, { x: MARGIN, y, size: SIZE.body, font, color: INK });
    if (r) page.drawText(r, { x: PAGE.width - MARGIN - rw, y, size: SIZE.small, font: regular, color: MUTED });
  };

  const section = (title: string) => {
    ensure(SIZE.header * LEADING + 20);
    y -= 10;
    y -= SIZE.header * LEADING;
    page.drawText(title.toUpperCase(), { x: MARGIN, y, size: SIZE.header, font: bold, color: INK });
    y -= 3;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE.width - MARGIN, y }, thickness: 0.6, color: MUTED });
    y -= 2;
  };

  // Contact information, in the body rather than a header (the guide's ATS rule).
  write(header.name, { font: bold, size: SIZE.name });
  if (header.contact.length) write(header.contact.join(" | "), { size: SIZE.small, color: MUTED });

  if (resume.summary) {
    section("Summary");
    write(resume.summary);
  }
  if (resume.skills.length) {
    section("Skills");
    write(resume.skills.join(", "));
  }
  if (resume.experience.length) {
    section("Experience");
    for (const role of resume.experience) {
      y -= 4;
      writeRow(`${role.title}, ${role.employer}`, dateRange(role.start, role.end), bold);
      for (const b of role.bullets) write(b, { indent: 12, prefix: "•" });
    }
  }
  if (resume.projects.length) {
    section("Projects");
    for (const p of resume.projects) {
      y -= 4;
      write(p.name, { font: bold });
      for (const b of p.bullets) write(b, { indent: 12, prefix: "•" });
    }
  }
  if (resume.education.school) {
    section("Education");
    y -= 4;
    writeRow(resume.education.school, monthYear(resume.education.grad_date) ?? "", bold);
    if (resume.education.credential) write(resume.education.credential);
    for (const h of resume.education.highlights) write(h, { indent: 12, prefix: "•" });
  }

  return { bytes: await doc.save(), pages: doc.getPageCount() };
}

/** Greedy word wrap by measured width. A single over-long word is left to overflow rather than split. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(next, size) > width) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

const FALLBACK: Record<string, string> = { "→": "->", "≥": ">=", "≤": "<=", "✓": "", " ": " " };

/** Standard fonts only encode WinAnsi. Anything else is swapped or dropped rather than throwing mid-render. */
function winAnsi(text: string, font: PDFFont): string {
  let out = "";
  for (const ch of text) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += FALLBACK[ch] ?? "";
    }
  }
  return out;
}

/** The tailor and formatter guides' naming: Last_First_Resume_Role_Company.pdf. */
export function resumeFileName(name: string, role: string, company: string): string {
  const clean = (s: string) => s.replace(/[^A-Za-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  const parts = clean(name);
  const person = parts.length > 1 ? [parts.at(-1)!, ...parts.slice(0, -1)].join("_") : parts[0] ?? "Resume";
  const camel = (s: string) => clean(s).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
  return `${person}_Resume_${camel(role) || "Role"}_${camel(company) || "Company"}.pdf`;
}
