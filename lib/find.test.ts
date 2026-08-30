import { describe, expect, it } from "vitest";
import { MAX_MATCHES, findMatches, matchIndexAt, stepMatch } from "./find.js";

describe("findMatches", () => {
  it("finds nothing for an empty query or an empty file", () => {
    expect(findMatches("hello", "")).toEqual({ matches: [], truncated: false });
    expect(findMatches("", "hello")).toEqual({ matches: [], truncated: false });
  });

  it("reports offsets and 1-based line numbers", () => {
    const content = "const a = 1;\nconst b = 2;\nreturn a + b;";
    const { matches } = findMatches(content, "const");
    expect(matches).toEqual([
      { start: 0, end: 5, line: 1 },
      { start: 13, end: 18, line: 2 },
    ]);
  });

  it("counts lines correctly for a match after many newlines", () => {
    const content = `${"\n".repeat(120)}needle`;
    expect(findMatches(content, "needle").matches[0]).toEqual({
      start: 120,
      end: 126,
      line: 121,
    });
  });

  it("ignores case by default and respects it on request", () => {
    expect(findMatches("Foo foo FOO", "foo").matches).toHaveLength(3);
    expect(findMatches("Foo foo FOO", "foo", true).matches).toEqual([
      { start: 4, end: 7, line: 1 },
    ]);
  });

  it("returns non-overlapping matches, like an editor's find", () => {
    // Overlapping would report 3 here; every editor reports 2.
    expect(findMatches("aaaa", "aa").matches).toEqual([
      { start: 0, end: 2, line: 1 },
      { start: 2, end: 4, line: 1 },
    ]);
  });

  it("handles a multi-line query, reporting the line it starts on", () => {
    const content = "one\ntwo\nthree";
    expect(findMatches(content, "two\nthree").matches).toEqual([
      { start: 4, end: 13, line: 2 },
    ]);
  });

  it("counts lines by \\n, so CRLF files still line up", () => {
    const content = "alpha\r\nbeta\r\ngamma";
    expect(findMatches(content, "gamma").matches[0]?.line).toBe(3);
  });

  it("treats regex metacharacters as literal text", () => {
    const content = "value = arr[0].map(x => x)";
    expect(findMatches(content, "arr[0]").matches).toEqual([
      { start: 8, end: 14, line: 1 },
    ]);
    expect(findMatches(content, ".*").matches).toEqual([]);
  });

  it("stops at the match cap and says so", () => {
    const result = findMatches("a".repeat(MAX_MATCHES + 50), "a");
    expect(result.matches).toHaveLength(MAX_MATCHES);
    expect(result.truncated).toBe(true);
  });

  it("does not report truncation when the file ends exactly at the cap", () => {
    const result = findMatches("a".repeat(MAX_MATCHES), "a");
    expect(result.matches).toHaveLength(MAX_MATCHES);
    expect(result.truncated).toBe(false);
  });

  it("keeps offsets valid when lowercasing would change length", () => {
    // "İ" lowercases to two code units, which would shift every later offset.
    // The search falls back to case-sensitive rather than pointing at the
    // wrong characters.
    const content = "İstanbul and istanbul";
    for (const match of findMatches(content, "istanbul").matches) {
      expect(content.slice(match.start, match.end)).toBe("istanbul");
    }
  });
});

describe("matchIndexAt", () => {
  const matches = findMatches("a\nb\na\nb\na", "a").matches;

  it("selects the first match at or after the caret", () => {
    expect(matchIndexAt(matches, 0)).toBe(0);
    expect(matchIndexAt(matches, 1)).toBe(1);
    expect(matchIndexAt(matches, 5)).toBe(2);
  });

  it("wraps to the first match when the caret is past the last one", () => {
    expect(matchIndexAt(matches, 999)).toBe(0);
  });

  it("reports -1 when there is nothing to select", () => {
    expect(matchIndexAt([], 0)).toBe(-1);
  });
});

describe("stepMatch", () => {
  it("wraps forward and backward", () => {
    expect(stepMatch(2, 3, 1)).toBe(0);
    expect(stepMatch(0, 3, -1)).toBe(2);
    expect(stepMatch(1, 3, 1)).toBe(2);
  });

  it("enters the list from either end when nothing is selected", () => {
    expect(stepMatch(-1, 3, 1)).toBe(0);
    expect(stepMatch(-1, 3, -1)).toBe(2);
  });

  it("stays at -1 with no matches", () => {
    expect(stepMatch(-1, 0, 1)).toBe(-1);
  });
});
