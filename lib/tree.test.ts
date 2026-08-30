import { describe, expect, it } from "vitest";
import {
  ancestorsOf,
  basename,
  buildTree,
  filterTree,
  fuzzyMatch,
  rankEntries,
  visibleRows,
  type FlatEntry,
} from "./tree.js";

const ENTRIES: FlatEntry[] = [
  { path: "config", kind: "directory" },
  { path: "config/auth.php", kind: "file" },
  { path: "config/app.php", kind: "file" },
  { path: "app/Http/Controllers/AuthController.php", kind: "file" },
  { path: "README.md", kind: "file" },
  { path: "storage/logs", kind: "directory" },
];

describe("buildTree", () => {
  it("creates the directories a file path implies", () => {
    const tree = buildTree([
      { path: "a/b/c.ts", kind: "file" },
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.path).toBe("a");
    expect(tree[0]?.children[0]?.path).toBe("a/b");
    expect(tree[0]?.children[0]?.children[0]?.kind).toBe("file");
  });

  it("puts directories before files and sorts each group by name", () => {
    const tree = buildTree(ENTRIES);
    expect(tree.map((node) => node.path)).toEqual([
      "app",
      "config",
      "storage",
      "README.md",
    ]);
  });

  it("keeps a directory that holds no files", () => {
    const tree = buildTree(ENTRIES);
    const storage = tree.find((node) => node.path === "storage");
    expect(storage?.children.map((node) => node.path)).toEqual(["storage/logs"]);
  });

  it("normalises leading ./ and trailing slashes into one node", () => {
    const tree = buildTree([
      { path: "./src/", kind: "directory" },
      { path: "src/index.ts", kind: "file" },
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.children).toHaveLength(1);
  });
});

describe("visibleRows", () => {
  it("descends only into expanded directories", () => {
    const tree = buildTree(ENTRIES);
    const collapsed = visibleRows(tree, new Set());
    expect(collapsed.map((row) => row.node.path)).toEqual([
      "app",
      "config",
      "storage",
      "README.md",
    ]);

    const expanded = visibleRows(tree, new Set(["config"]));
    expect(expanded.map((row) => row.node.path)).toContain("config/app.php");
    expect(expanded.find((row) => row.node.path === "config/app.php")?.depth).toBe(1);
  });
});

describe("ancestorsOf", () => {
  it("lists every directory above a path, outermost first", () => {
    expect(ancestorsOf("app/Http/Controllers/AuthController.php")).toEqual([
      "app",
      "app/Http",
      "app/Http/Controllers",
    ]);
  });

  it("returns nothing for a root-level file", () => {
    expect(ancestorsOf("README.md")).toEqual([]);
  });
});

describe("fuzzyMatch", () => {
  it("matches a scattered subsequence", () => {
    expect(fuzzyMatch("config/auth.php", "cauth")).not.toBeNull();
  });

  it("rejects characters that are out of order", () => {
    expect(fuzzyMatch("config/auth.php", "htua")).toBeNull();
  });

  it("scores a segment-boundary match above a mid-word one", () => {
    const boundary = fuzzyMatch("src/auth.ts", "auth");
    const middle = fuzzyMatch("src/reauthorize.ts", "auth");
    expect(boundary?.score).toBeGreaterThan(middle?.score ?? 0);
  });

  it("reports the index of every matched character", () => {
    expect(fuzzyMatch("abc", "ac")?.positions).toEqual([0, 2]);
  });
});

describe("rankEntries", () => {
  it("puts a filename match above a directory-only match", () => {
    const ranked = rankEntries(
      [
        { path: "auth/service/user.ts", kind: "file" },
        { path: "src/auth.ts", kind: "file" },
      ],
      "auth",
      10,
    );
    expect(ranked.matches[0]?.path).toBe("src/auth.ts");
  });

  it("returns nothing for an empty query", () => {
    expect(rankEntries(ENTRIES, "   ", 10).matches).toEqual([]);
  });

  it("flags truncation past the limit", () => {
    const entries: FlatEntry[] = Array.from({ length: 5 }, (_, index) => ({
      path: `src/file${index}.ts`,
      kind: "file",
    }));
    const ranked = rankEntries(entries, "ts", 2);
    expect(ranked.matches).toHaveLength(2);
    expect(ranked.truncated).toBe(true);
  });
});

describe("filterTree", () => {
  it("keeps matching files with their parent directories", () => {
    const filtered = filterTree(buildTree(ENTRIES), "auth");
    const paths = visibleRows(filtered.nodes, filtered.expand).map(
      (row) => row.node.path,
    );
    expect(paths).toContain("config/auth.php");
    expect(paths).toContain("app/Http/Controllers/AuthController.php");
    expect(paths).not.toContain("README.md");
  });

  it("expands every surviving directory so matches are on screen", () => {
    const filtered = filterTree(buildTree(ENTRIES), "auth");
    expect(filtered.expand.has("config")).toBe(true);
    expect(filtered.matchCount).toBe(2);
  });

  it("drops a directory whose files all failed to match", () => {
    const filtered = filterTree(buildTree(ENTRIES), "readme");
    expect(filtered.nodes.map((node) => node.path)).toEqual(["README.md"]);
  });

  it("returns the tree untouched for an empty query", () => {
    const tree = buildTree(ENTRIES);
    expect(filterTree(tree, "").nodes).toHaveLength(tree.length);
  });
});

describe("a POSIX name containing a backslash", () => {
  it("stays one file rather than becoming a directory", () => {
    const nodes = buildTree([{ path: "odd\\name.txt", kind: "file" }]);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.kind).toBe("file");
    // The path the explorer hands back to the read RPC must be the path the
    // server listed, or resolveWithinRoot looks for a file that is not there.
    expect(nodes[0]!.path).toBe("odd\\name.txt");
    expect(nodes[0]!.name).toBe("odd\\name.txt");
  });

  it("is not treated as a path separator by basename or ancestorsOf", () => {
    expect(basename("src/odd\\name.txt")).toBe("odd\\name.txt");
    expect(ancestorsOf("src/odd\\name.txt")).toEqual(["src"]);
  });
});
