import { TailoredResumeSchema } from "@/lib/ai/schemas";
import { getSession } from "@/lib/session";
import { renderResumePdf, resumeFileName } from "@/lib/tailor";
import { resumeHeader } from "@/lib/tailor";
import { findPosition } from "@/lib/tailor/lookup";

/** A resume is a few kilobytes of JSON; anything near this is not one. */
const MAX_BODY = 64 * 1024;

/**
 * The formatter guide's PDF, for the resume the student is looking at. The
 * page posts the tailored resume back rather than this route re-tailoring,
 * so a model's rewrite downloads exactly as it was shown.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { student, demo } = await getSession();
  if (!student) return new Response("Sign in first.", { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return new Response("Too large.", { status: 413 });

  const form = await request.formData();
  let json: unknown;
  try {
    json = JSON.parse(String(form.get("resume") ?? ""));
  } catch {
    return new Response("That is not a resume.", { status: 400 });
  }
  const parsed = TailoredResumeSchema.safeParse(json);
  if (!parsed.success) return new Response("That is not a resume.", { status: 400 });

  const { position } = await findPosition(student, id);
  const { bytes } = await renderResumePdf(parsed.data, resumeHeader(student.profile, demo ? null : student.email));
  const name = resumeFileName(student.profile.full_name ?? "Resume", position?.title ?? "Role", position?.company ?? "Company");
  return new Response(new Blob([bytes as BlobPart], { type: "application/pdf" }), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
