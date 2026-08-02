"use client";

import { Fragment } from "react";

/**
 * Tiny markdown renderer for the assistant body. Supports:
 *   - paragraph splits on `\n\n`
 *   - bullet lists on `- `
 *   - **bold** and *italic* inline (non-greedy)
 *   - `[label](url)` link syntax
 *   - `` `code` `` inline code
 *
 * Intentionally not a full markdown engine — the assistant outputs are
 * deterministic text from the upstream builder and only ever use a
 * subset of markdown. This keeps the bundle small and predictable.
 */
export function formatAssistantBody(text: string) {
  const lines = text.split(/\n/);
  const blocks: Array<
    | { kind: "p"; lines: string[] }
    | { kind: "ul"; items: string[] }
  > = [];
  let buffer: string[] = [];
  let bufferKind: "p" | "ul" | null = null;

  const flush = () => {
    if (bufferKind === "p" && buffer.length > 0) {
      blocks.push({ kind: "p", lines: buffer });
    } else if (bufferKind === "ul" && buffer.length > 0) {
      blocks.push({ kind: "ul", items: buffer });
    }
    buffer = [];
    bufferKind = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("- ")) {
      if (bufferKind !== "ul") flush();
      bufferKind = "ul";
      buffer.push(line.slice(2));
    } else if (line === "") {
      flush();
    } else {
      if (bufferKind !== "p") flush();
      bufferKind = "p";
      buffer.push(raw);
    }
  }
  flush();

  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed">
      {blocks.map((block, bi) =>
        block.kind === "ul" ? (
          <ul key={bi} className="ml-5 list-disc space-y-1 marker:text-primary">
            {block.items.map((it, li) => (
              <li key={li}>
                <InlineFormat text={it} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={bi}>
            {block.lines.map((ln, pi) => (
              <Fragment key={pi}>
                <InlineFormat text={ln} />
                {pi < block.lines.length - 1 ? <br /> : null}
              </Fragment>
            ))}
          </p>
        ),
      )}
    </div>
  );
}

function InlineFormat({ text }: { text: string }) {
  // Tokenize on **bold**, *italic*, `code`, [label](url). State machine.
  const parts: Array<
    | string
    | { kind: "strong" | "em" | "code" | "link"; text: string; href?: string }
  > = [];
  let i = 0;
  let buf = "";
  const flushBuf = () => {
    if (buf) {
      parts.push(buf);
      buf = "";
    }
  };
  while (i < text.length) {
    const c = text[i];
    // **bold**
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        flushBuf();
        parts.push({ kind: "strong", text: text.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    // *italic*
    if (c === "*" && text[i + 1] !== "*") {
      const end = text.indexOf("*", i + 1);
      if (end !== -1) {
        flushBuf();
        parts.push({ kind: "em", text: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    // `code`
    if (c === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        flushBuf();
        parts.push({ kind: "code", text: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    // [label](url)
    if (c === "[") {
      const close = text.indexOf("]", i + 1);
      const openParen = close === -1 ? -1 : text.indexOf("(", close);
      const closeParen =
        openParen === -1 ? -1 : text.indexOf(")", openParen + 1);
      if (
        close !== -1 &&
        openParen === close + 1 &&
        closeParen !== -1 &&
        /^https?:\/\//.test(text.slice(openParen + 1, closeParen))
      ) {
        flushBuf();
        parts.push({
          kind: "link",
          text: text.slice(i + 1, close),
          href: text.slice(openParen + 1, closeParen),
        });
        i = closeParen + 1;
        continue;
      }
    }
    buf += c;
    i++;
  }
  flushBuf();

  return (
    <>
      {parts.map((p, idx) => {
        if (typeof p === "string") return <span key={idx}>{p}</span>;
        if (p.kind === "strong")
          return (
            <strong key={idx} className="font-semibold text-foreground">
              {p.text}
            </strong>
          );
        if (p.kind === "em")
          return (
            <em key={idx} className="italic">
              {p.text}
            </em>
          );
        if (p.kind === "code")
          return (
            <code
              key={idx}
              className="rounded bg-secondary/60 px-1 py-0.5 font-mono text-[12px]"
            >
              {p.text}
            </code>
          );
        return (
          <a
            key={idx}
            href={p.href}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary underline-offset-4 hover:underline"
          >
            {p.text}
          </a>
        );
      })}
    </>
  );
}
