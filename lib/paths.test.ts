import { describe, expect, it } from "vitest";
import { relativeToRoot, resolveWithinRoot } from "./paths.js";
import { parseExcludedNames } from "./walk.js";
import { parseRoute, formatRoute, sameScope } from "./route.js";

describe("resolveWithinRoot", () => {
  it("joins a relative path onto a POSIX root", () => {
    expect(resolveWithinRoot("/work/app", "src/index.ts")).toBe(
      "/work/app/src/index.ts",
    );
  });

  it("uses backslashes for a Windows root", () => {
    expect(resolveWithinRoot("C:\\work\\app", "src/index.ts")).toBe(
      "C:\\work\\app\\src\\index.ts",
    );
  });

  it("refuses a path that climbs out of the root", () => {
    expect(() => resolveWithinRoot("/work/app", "../secrets.env")).toThrow(
      /escapes the workspace/,
    );
  });

  it("refuses a traversal buried mid-path", () => {
    expect(() => resolveWithinRoot("/work/app", "src/../../etc/passwd")).toThrow(
      /escapes the workspace/,
    );
  });

  it("treats an absolute-looking relative path as root-relative", () => {
    expect(resolveWithinRoot("/work/app", "/src/index.ts")).toBe(
      "/work/app/src/index.ts",
    );
  });

  it("returns the root itself for an empty or dot path", () => {
    expect(resolveWithinRoot("/work/app", ".")).toBe("/work/app");
  });
});

describe("relativeToRoot", () => {
  it("strips the root and normalises separators", () => {
    expect(relativeToRoot("C:\\work", "C:\\work\\src\\a.ts")).toBe("src/a.ts");
  });
});

describe("parseExcludedNames", () => {
  it("accepts newline and comma separated names", () => {
    expect([...parseExcludedNames(".git\nnode_modules, vendor\n\n")]).toEqual([
      ".git",
      "node_modules",
      "vendor",
    ]);
  });
});

describe("routes", () => {
  it("round-trips a scope and a nested file path", () => {
    const subPath = formatRoute({ kind: "environment", id: "env_1" }, "a/b c.ts");
    expect(parseRoute(subPath)).toEqual({
      scope: { kind: "environment", id: "env_1" },
      filePath: "a/b c.ts",
    });
  });

  it("writes path separators raw, so BB does the encoding exactly once", () => {
    expect(formatRoute({ kind: "project", id: "proj_1" }, "config/auth.php")).toBe(
      "project/proj_1/config/auth.php",
    );
  });

  it("reads back a path BB percent-encoded on the way out", () => {
    // What BB hands back for a file literally named `a b&c.ts`.
    expect(parseRoute("project/proj_1/src/a%20b%26c.ts").filePath).toBe(
      "src/a b&c.ts",
    );
  });

  it("round-trips a scope with no file", () => {
    const subPath = formatRoute({ kind: "project", id: "proj_1" }, null);
    expect(parseRoute(subPath)).toEqual({
      scope: { kind: "project", id: "proj_1" },
      filePath: null,
    });
  });

  it("ignores a route with an unknown scope kind", () => {
    expect(parseRoute("nonsense/abc")).toEqual({ scope: null, filePath: null });
  });

  it("ignores an empty route", () => {
    expect(parseRoute("")).toEqual({ scope: null, filePath: null });
  });

  it("survives a malformed percent escape instead of throwing", () => {
    expect(parseRoute("project/proj_1/100%").filePath).toBe("100%");
  });

  it("compares scopes by kind and id", () => {
    expect(sameScope({ kind: "thread", id: "a" }, { kind: "thread", id: "a" })).toBe(true);
    expect(sameScope({ kind: "thread", id: "a" }, { kind: "project", id: "a" })).toBe(false);
    expect(sameScope(null, null)).toBe(true);
    expect(sameScope(null, { kind: "thread", id: "a" })).toBe(false);
  });
});

describe("resolveWithinRoot on a Windows root written with forward slashes", () => {
  it("resolves rather than reporting an escape", () => {
    // BB reports whatever the host stored; a drive-letter root can arrive with
    // either separator, and the containment check is textual.
    expect(resolveWithinRoot("C:/Users/dev/app", "README.md")).toBe(
      "C:\\Users\\dev\\app\\README.md",
    );
  });

  it("still refuses a traversal from that root", () => {
    expect(() => resolveWithinRoot("C:/Users/dev/app", "../other/x")).toThrow(
      /escapes the workspace/,
    );
  });

  it("keeps a backslash in a POSIX file name as part of the name", () => {
    // On POSIX `\` is a legal character, so it must not act as a separator.
    expect(resolveWithinRoot("/work/app", "odd\\name.txt")).toBe(
      "/work/app/odd\\name.txt",
    );
  });

  it("treats a backslash as a separator on a Windows root", () => {
    expect(resolveWithinRoot("C:\\work", "src\\a.ts")).toBe("C:\\work\\src\\a.ts");
  });

  it("collapses redundant separators", () => {
    expect(resolveWithinRoot("/work/app/", "src//index.ts")).toBe(
      "/work/app/src/index.ts",
    );
  });
});
