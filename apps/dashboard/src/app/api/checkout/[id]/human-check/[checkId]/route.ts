import { answerHumanCheck } from "@/lib/zg/human-check";

export const maxDuration = 120;
type Ctx = { params: Promise<{ id: string; checkId: string }> };

const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

/** Answers a challenge: JSON `{ answer }`, or multipart with an `audio` recording (transcribed by Whisper on 0G). */
export async function POST(req: Request, ctx: Ctx) {
  const { id, checkId } = await ctx.params;
  const err = (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status });
  try {
    let input: { text?: string; audio?: { blob: Blob; filename: string } };
    if ((req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
      const form = await req.formData();
      const audio = form.get("audio");
      if (!(audio instanceof Blob) || audio.size === 0) return err(400, "invalid_request", "No recording received.");
      if (audio.size > MAX_AUDIO_BYTES) return err(413, "too_large", "Keep the recording under 10 seconds.");
      const name = audio instanceof File && audio.name ? audio.name : "answer.webm";
      input = { audio: { blob: audio, filename: name } };
    } else {
      const body = (await req.json().catch(() => null)) as { answer?: unknown } | null;
      if (!body || typeof body.answer !== "string") return err(400, "invalid_request", "Send { answer: string }.");
      input = { text: body.answer };
    }
    const r = await answerHumanCheck(id, checkId, input);
    if (!r.ok) return err(r.status, r.code, r.message);
    return Response.json(r);
  } catch (e) {
    console.error("[human-check] answer", e);
    return err(500, "server_error", "Something went wrong. Try again.");
  }
}
