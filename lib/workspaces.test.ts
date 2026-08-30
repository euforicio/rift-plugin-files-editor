import { describe, expect, it } from "vitest";
import { defaultOptionFor, groupWorkspaces } from "./workspaces.js";

interface Row {
  projectId: string;
  label: string;
  sublabel: string;
  kind: "project" | "environment";
}

const row = (
  projectId: string,
  label: string,
  sublabel: string,
  kind: "project" | "environment",
): Row => ({ projectId, label, sublabel, kind });

const ROWS: Row[] = [
  row("p1", "Shop", "project checkout", "project"),
  row("p1", "Shop", "feature/cart", "environment"),
  row("p1", "Shop", "fix/tax", "environment"),
  row("p2", "Docs", "project checkout", "project"),
];

describe("groupWorkspaces", () => {
  it("folds the flat list into one group per project", () => {
    const groups = groupWorkspaces(ROWS);
    expect(groups.map((g) => [g.projectId, g.projectName])).toEqual([
      ["p1", "Shop"],
      ["p2", "Docs"],
    ]);
    expect(groups[0]!.options).toHaveLength(3);
    expect(groups[1]!.options).toHaveLength(1);
  });

  it("keeps projects in the order the server listed them", () => {
    const groups = groupWorkspaces([ROWS[3]!, ROWS[0]!, ROWS[1]!]);
    expect(groups.map((g) => g.projectId)).toEqual(["p2", "p1"]);
  });

  it("puts the checkout first and leaves worktrees in server order", () => {
    const groups = groupWorkspaces([ROWS[1]!, ROWS[2]!, ROWS[0]!]);
    expect(groups[0]!.options.map((o) => o.sublabel)).toEqual([
      "project checkout",
      "feature/cart",
      "fix/tax",
    ]);
  });

  it("names a group from its checkout even when a worktree comes first", () => {
    const groups = groupWorkspaces([
      row("p1", "Shop worktree label", "feature/cart", "environment"),
      row("p1", "Shop", "project checkout", "project"),
    ]);
    expect(groups[0]!.projectName).toBe("Shop");
  });

  it("still names a group that has only worktrees", () => {
    const groups = groupWorkspaces([row("p9", "Orphan", "main", "environment")]);
    expect(groups[0]!.projectName).toBe("Orphan");
  });

  it("returns nothing for an empty list", () => {
    expect(groupWorkspaces([])).toEqual([]);
  });
});

describe("defaultOptionFor", () => {
  const groups = groupWorkspaces(ROWS);

  it("prefers the project checkout", () => {
    expect(defaultOptionFor(groups[0])?.sublabel).toBe("project checkout");
  });

  it("falls back to the first worktree when there is no checkout", () => {
    const worktreeOnly = groupWorkspaces([
      row("p9", "Orphan", "main", "environment"),
      row("p9", "Orphan", "spike", "environment"),
    ]);
    expect(defaultOptionFor(worktreeOnly[0])?.sublabel).toBe("main");
  });

  it("is null for a missing group", () => {
    expect(defaultOptionFor(undefined)).toBeNull();
  });
});
