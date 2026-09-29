import { deflateRawSync, inflateRawSync } from "node:zlib";
import { cookies } from "next/headers";
import type { StudentProfile } from "@/lib/ai/schemas";
import { revive } from "./demo-persist";
import type { StoredStudent } from "./demo-store";

/**
 * Where a demo browser's student lives when there is no database: in the
 * browser itself, as a few cookies.
 *
 * The in-memory map is per server instance, and a host like Vercel may send
 * each request to a different one, so answers saved on one click were gone
 * on the next. A cookie travels with every request, needs no credentials and
 * never expires on our side, which is what a portfolio demo that nobody
 * maintains needs. The profile is only written when it differs from the
 * sample student's, so a normal session is the answers alone.
 *
 * Cookies are capped near 4 KB each, so the payload is deflated, base64url
 * encoded and split across `cg_s.0`, `cg_s.1`, ... Anything unreadable
 * (an old shape, a truncated chunk) decodes to null and the student starts
 * over rather than the page crashing.
 */

const PREFIX = "cg_s";
const CHUNK = 3800;
const MAX_CHUNKS = 8;
const MAX_AGE = 60 * 60 * 24 * 30;

type Payload = Omit<StoredStudent, "profile"> & { profile?: StudentProfile };

/** StoredStudent -> cookie values, in order. Pure; tested. */
export function encodeStudent(student: StoredStudent, sampleProfile: StudentProfile): string[] {
  const { profile, ...rest } = student;
  const payload: Payload = JSON.stringify(profile) === JSON.stringify(sampleProfile) ? rest : student;
  const packed = deflateRawSync(Buffer.from(JSON.stringify(payload))).toString("base64url");
  const chunks: string[] = [];
  for (let i = 0; i < packed.length; i += CHUNK) chunks.push(packed.slice(i, i + CHUNK));
  return chunks;
}

/** Cookie values, in order -> StoredStudent, or null when they do not decode. Pure; tested. */
export function decodeStudent(chunks: string[], sampleProfile: StudentProfile): StoredStudent | null {
  if (chunks.length === 0) return null;
  let payload: Payload;
  try {
    payload = JSON.parse(inflateRawSync(Buffer.from(chunks.join(""), "base64url")).toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  return revive(JSON.stringify({ ...payload, profile: payload.profile ?? sampleProfile }));
}

/** This browser's student from its cookies. Readable anywhere, including Server Components. */
export async function readCookieStudent(sampleProfile: StudentProfile): Promise<StoredStudent | null> {
  const jar = await cookies();
  const chunks: string[] = [];
  for (let i = 0; i < MAX_CHUNKS; i += 1) {
    const value = jar.get(`${PREFIX}.${i}`)?.value;
    if (!value) break;
    chunks.push(value);
  }
  return decodeStudent(chunks, sampleProfile);
}

/** Writes the student back. Only callable from a Server Action or Route Handler, where cookies can be set. */
export async function writeCookieStudent(student: StoredStudent, sampleProfile: StudentProfile): Promise<void> {
  const chunks = encodeStudent(student, sampleProfile);
  if (chunks.length > MAX_CHUNKS) {
    throw new Error(`The demo session is too large to keep in cookies (${chunks.length} chunks).`);
  }
  const jar = await cookies();
  const options = {
    httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE,
  };
  chunks.forEach((value, i) => jar.set(`${PREFIX}.${i}`, value, options));
  // A shorter session than the last one must not leave its old tail behind.
  for (let i = chunks.length; i < MAX_CHUNKS; i += 1) {
    if (jar.get(`${PREFIX}.${i}`)) jar.delete(`${PREFIX}.${i}`);
  }
}
