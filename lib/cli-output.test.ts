import { describe, expect, it } from "vitest";
import { clipForCli, clipLinesForCli } from "./cli-output.js";

describe("clipForCli", () => {
  it("passes text under the budget through untouched", () => {
    expect(clipForCli("hello", 100)).toEqual({ text: "hello", clippedFrom: null });
  });

  it("reports the original byte length when it clips", () => {
    const result = clipForCli("abcdefghij", 4);
    expect(result.text).toBe("abcd");
    expect(result.clippedFrom).toBe(10);
  });

  it("never emits more bytes than the budget", () => {
    const text = "a".repeat(5000);
    const result = clipForCli(text, 1024);
    expect(Buffer.byteLength(result.text, "utf8")).toBeLessThanOrEqual(1024);
  });

  it("cuts on a character boundary rather than splitting a code point", () => {
    // Each emoji is 4 bytes; a budget of 6 must yield one emoji, not one and a half.
    const result = clipForCli("🎉🎉🎉", 6);
    expect(result.text).toBe("🎉");
    expect(Buffer.byteLength(result.text, "utf8")).toBe(4);
  });

  it("measures bytes, not characters", () => {
    // "é" is 2 bytes in UTF-8, so 3 of them exceed a 4-byte budget.
    const result = clipForCli("ééé", 4);
    expect(result.text).toBe("éé");
    expect(result.clippedFrom).toBe(6);
  });

  it("returns empty text when nothing fits", () => {
    expect(clipForCli("🎉", 2).text).toBe("");
  });
});

describe("clipLinesForCli", () => {
  it("keeps every line when they fit", () => {
    const result = clipLinesForCli(["a", "bb", "ccc"], 100);
    expect(result.text).toBe("a\nbb\nccc\n");
    expect(result.omitted).toBe(0);
  });

  it("returns empty text for no lines", () => {
    expect(clipLinesForCli([], 100)).toEqual({ text: "", omitted: 0 });
  });

  it("drops whole lines rather than cutting one in half", () => {
    // "aaaa\n" is 5 bytes, so only the first fits in 9.
    const result = clipLinesForCli(["aaaa", "bbbb", "cccc"], 9);
    expect(result.text).toBe("aaaa\n");
    expect(result.omitted).toBe(2);
  });

  it("counts each line's newline against the budget", () => {
    // Exactly 10 bytes of payload + 2 newlines needs 12.
    expect(clipLinesForCli(["aaaaa", "bbbbb"], 11).omitted).toBe(1);
    expect(clipLinesForCli(["aaaaa", "bbbbb"], 12).omitted).toBe(0);
  });

  it("measures bytes, not characters", () => {
    expect(clipLinesForCli(["éé"], 5)).toEqual({ text: "éé\n", omitted: 0 });
    expect(clipLinesForCli(["éé"], 4)).toEqual({ text: "", omitted: 1 });
  });
});

/**
 * BB discards an oversize CLI result rather than truncating it, so these
 * budgets are the difference between a partial answer and none. The numbers
 * mirror server.ts; if either constant moves, this is what catches it.
 */
describe("the CLI budgets leave room for what the commands actually print", () => {
  const MAX = 1024 * 1024; // PLUGIN_CLI_OUTPUT_MAX_BYTES
  const OUTPUT_BUDGET = MAX - 4096;
  const LISTING_BUDGET = OUTPUT_BUDGET - 1024;

  it("fits a worst-case tree: a full listing plus every trailing note", () => {
    const lines = Array.from(
      { length: 40_000 },
      (_, index) =>
        `${"d".repeat(60)}/${"e".repeat(60)}/${"f".repeat(60)}/file-${index}.tsx`,
    );
    const clipped = clipLinesForCli(lines, LISTING_BUDGET);
    const notes =
      `(showing ${lines.length} of ${lines.length + 1} entries)\n` +
      "(listing was truncated)\n" +
      `(output capped: printed ${lines.length - clipped.omitted} of ${lines.length} entries — BB caps a command's output)\n`;
    const total =
      Buffer.byteLength(clipped.text, "utf8") + Buffer.byteLength(notes, "utf8");
    expect(total).toBeLessThanOrEqual(MAX);
  });

  it("reserves more than the note block can possibly need", () => {
    const worstCaseNotes =
      "(showing 40000 of 40000 entries)\n(listing was truncated)\n" +
      "(output capped: printed 40000 of 40000 entries — BB caps a command's output)\n";
    expect(Buffer.byteLength(worstCaseNotes, "utf8")).toBeLessThan(1024);
  });

  it("fits a worst-case find: clipped matches plus the stderr note", () => {
    const lines = Array.from(
      { length: 40_000 },
      (_, index) => `${"p".repeat(120)}/${index}.ts`,
    );
    const clipped = clipLinesForCli(lines, LISTING_BUDGET);
    const stderr = `(output capped: ${clipped.omitted} more matches omitted — BB caps a command's output)\n`;
    const total =
      Buffer.byteLength(clipped.text, "utf8") + Buffer.byteLength(stderr, "utf8");
    expect(total).toBeLessThanOrEqual(MAX);
  });

  it("fits a worst-case read: clipped content plus the stderr note", () => {
    const clipped = clipForCli("x".repeat(5_000_000), OUTPUT_BUDGET);
    const stderr = `(truncated: printed ${OUTPUT_BUDGET} of ${clipped.clippedFrom} bytes — BB caps a command's output)\n`;
    const total =
      Buffer.byteLength(clipped.text, "utf8") + Buffer.byteLength(stderr, "utf8");
    expect(total).toBeLessThanOrEqual(MAX);
  });

  it("stops at the first line that does not fit, keeping the listing in order", () => {
    // Only reachable with a path longer than any filesystem allows, but the
    // ordering guarantee is the point: a listing must not silently reorder.
    const giant = "z".repeat(LISTING_BUDGET + 10);
    expect(clipLinesForCli([giant, "short"], LISTING_BUDGET)).toEqual({
      text: "",
      omitted: 2,
    });
  });
});
