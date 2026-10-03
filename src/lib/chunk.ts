export interface Chunk {
  heading: string | null;
  content: string;
}

const TARGET_CHARS = 1200;
const MAX_CHARS = 1800;

/**
 * Split page markdown into chunks that follow headings, so each chunk is about
 * one topic (a service, an FAQ answer, opening hours). Long sections are split
 * on paragraph boundaries.
 */
export function chunkMarkdown(markdown: string, pageTitle?: string | null): Chunk[] {
  const sections: { heading: string | null; body: string }[] = [];
  let current: { heading: string | null; body: string[] } = { heading: pageTitle ?? null, body: [] };

  for (const line of markdown.split("\n")) {
    const match = /^(#{1,3})\s+(.+)$/.exec(line);
    if (match) {
      if (current.body.join("").trim()) sections.push({ heading: current.heading, body: current.body.join("\n") });
      current = { heading: match[2].trim(), body: [] };
    } else {
      current.body.push(line);
    }
  }
  if (current.body.join("").trim()) sections.push({ heading: current.heading, body: current.body.join("\n") });

  const chunks: Chunk[] = [];
  for (const section of sections) {
    const paragraphs = section.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    let buffer = "";
    for (const para of paragraphs) {
      const pieces = para.length > MAX_CHARS ? splitLong(para) : [para];
      for (const piece of pieces) {
        if (buffer && buffer.length + piece.length > TARGET_CHARS) {
          chunks.push({ heading: section.heading, content: buffer });
          buffer = "";
        }
        buffer = buffer ? `${buffer}\n\n${piece}` : piece;
      }
    }
    if (buffer) chunks.push({ heading: section.heading, content: buffer });
  }
  return mergeSmall(chunks);
}

const MIN_CHARS = 120;

/**
 * Fold fragments ("01", a lone button label, a one-line heading body) into the
 * previous passage, or the next one when there is none, so every passage carries meaning.
 */
function mergeSmall(chunks: Chunk[]): Chunk[] {
  const out: Chunk[] = [];
  for (const c of chunks) {
    const prev = out.at(-1);
    if (prev && c.content.length < MIN_CHARS && prev.content.length + c.content.length < MAX_CHARS) {
      const label = c.heading && c.heading !== prev.heading ? `${c.heading}: ` : "";
      prev.content = `${prev.content}\n\n${label}${c.content}`;
    } else {
      out.push({ ...c });
    }
  }
  // A small first passage joins the one after it
  if (out.length > 1 && out[0].content.length < MIN_CHARS) {
    const [first, second] = out;
    out.splice(0, 2, { heading: first.heading, content: `${first.content}\n\n${second.content}` });
  }
  return out;
}

function splitLong(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if (buf && buf.length + s.length > TARGET_CHARS) {
      out.push(buf);
      buf = "";
    }
    buf = buf ? `${buf} ${s}` : s;
  }
  if (buf) out.push(buf);
  // Guard against a single enormous "sentence"
  return out.flatMap((p) => (p.length > MAX_CHARS ? p.match(new RegExp(`.{1,${TARGET_CHARS}}`, "gs")) ?? [] : [p]));
}

/** Text sent to the embedding model: heading gives the chunk its context. */
export function embeddingText(chunk: Chunk, pageTitle?: string | null): string {
  return [pageTitle, chunk.heading, chunk.content].filter(Boolean).join("\n");
}
