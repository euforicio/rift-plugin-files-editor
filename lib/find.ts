/**
 * Literal text search within one file.
 *
 * Deliberately not a regular expression: the query comes from a text field a
 * user types into, so every `(` and `*` would either need escaping or would
 * become a syntax error mid-keystroke, and a pathological pattern could hang
 * the render. `indexOf` cannot backtrack.
 */

export interface FindMatch {
  /** Character offset of the first character, inclusive. */
  start: number;
  /** Character offset one past the last character. */
  end: number;
  /** 1-based line the match STARTS on, for the source viewer's highlight. */
  line: number;
}

export interface FindResult {
  matches: FindMatch[];
  /** True when the file has more matches than {@link MAX_MATCHES}. */
  truncated: boolean;
}

/**
 * A minified bundle on one line can contain a match per character. Past a few
 * thousand there is nothing a person can navigate anyway, and the array is what
 * gets held in render state.
 */
export const MAX_MATCHES = 5000;

const EMPTY: FindResult = { matches: [], truncated: false };

export function findMatches(
  content: string,
  query: string,
  caseSensitive = false,
): FindResult {
  if (query === "" || content === "") return EMPTY;

  const haystack = caseSensitive ? content : content.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();

  // Lowercasing can change a string's LENGTH for some scripts (İ -> i̇), which
  // would make every offset past it point at the wrong character. Fall back to
  // a case-sensitive search rather than reporting a match in the wrong place.
  if (haystack.length !== content.length || needle.length !== query.length) {
    return findMatches(content, query, true);
  }

  const matches: FindMatch[] = [];
  let truncated = false;
  let line = 1;
  let scanned = 0; // how far the line counter has consumed `content`
  let from = 0;

  for (;;) {
    const start = haystack.indexOf(needle, from);
    if (start === -1) break;
    if (matches.length === MAX_MATCHES) {
      truncated = true;
      break;
    }

    // Matches arrive in ascending order, so the line counter only ever moves
    // forward: one pass over the file total, not one per match.
    for (let index = scanned; index < start; index += 1) {
      if (content.charCodeAt(index) === 10) line += 1;
    }
    scanned = start;

    matches.push({ start, end: start + query.length, line });
    // Non-overlapping, like every editor's find: "aaaa" for "aa" is 2 hits.
    from = start + query.length;
  }

  return { matches, truncated };
}

/**
 * The match a fresh search should land on: the first at or after `caret`, else
 * wrap to the first in the file. Returns -1 when there is nothing to select.
 */
export function matchIndexAt(matches: readonly FindMatch[], caret: number): number {
  if (matches.length === 0) return -1;
  const found = matches.findIndex((match) => match.start >= caret);
  return found === -1 ? 0 : found;
}

/** Step through matches with wrap-around in either direction. */
export function stepMatch(
  current: number,
  total: number,
  direction: 1 | -1,
): number {
  if (total === 0) return -1;
  if (current < 0) return direction === 1 ? 0 : total - 1;
  return (current + direction + total) % total;
}
