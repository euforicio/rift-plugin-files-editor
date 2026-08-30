/**
 * BB rejects an oversized CLI result outright rather than clipping it, so a big
 * file has to be cut before it is returned.
 */
export function clipForCli(
  text: string,
  budget: number,
): { text: string; clippedFrom: number | null } {
  const total = Buffer.byteLength(text, "utf8");
  if (total <= budget) return { text, clippedFrom: null };

  // Binary search on a CHARACTER boundary: slicing the buffer at a byte offset
  // could split a multi-byte code point and emit a replacement character.
  let low = 0;
  let high = text.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (Buffer.byteLength(text.slice(0, middle), "utf8") <= budget) low = middle;
    else high = middle - 1;
  }
  return { text: text.slice(0, low), clippedFrom: total };
}

/**
 * The listing counterpart of {@link clipForCli}. A listing is only useful if it
 * parses, so this drops whole lines rather than cutting one in half.
 */
export function clipLinesForCli(
  lines: readonly string[],
  budget: number,
): { text: string; omitted: number } {
  let used = 0;
  let kept = 0;
  for (const line of lines) {
    const size = Buffer.byteLength(line, "utf8") + 1; // the line's own newline
    if (used + size > budget) break;
    used += size;
    kept += 1;
  }
  const text = kept === 0 ? "" : `${lines.slice(0, kept).join("\n")}\n`;
  return { text, omitted: lines.length - kept };
}
