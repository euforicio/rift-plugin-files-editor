import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Explorer } from "@/components/Explorer";
import type { FlatEntry } from "@/lib/tree";

const TARGET = "d0/zzz-target.txt";

function makeEntries(): FlatEntry[] {
  const out: FlatEntry[] = [{ path: "d0", kind: "directory" }];
  for (let i = 0; i < 700; i += 1) {
    out.push({ path: `d0/f${String(i).padStart(4, "0")}.txt`, kind: "file" });
  }
  out.push({ path: TARGET, kind: "file" });
  return out;
}

const entries = makeEntries();

let scrollCalls = 0;
afterEach(() => cleanup());

beforeEach(() => {
  scrollCalls = 0;
  // jsdom has no scrollIntoView
  (Element.prototype as any).scrollIntoView = function () {
    scrollCalls += 1;
  };
});

function renderExplorer(activePath: string | null) {
  return render(
    <Explorer
      entries={entries}
      activePath={activePath}
      isLoading={false}
      error={null}
      truncated={false}
      hiddenSupported={false}
      includeHidden={false}
      onToggleHidden={() => {}}
      onOpenFile={() => {}}
      onRefresh={() => {}}
      onQuickOpen={() => {}}
      header={null}
    />,
  );
}

function rowTitles(): string[] {
  return Array.from(document.querySelectorAll('button[role="treeitem"]')).map(
    (el) => el.getAttribute("title") ?? "",
  );
}

describe("Explorer cap + active row", () => {
  it("A: mount with activePath already set (ancestors collapsed)", () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    renderExplorer(TARGET);
    const titles = rowTitles();
    console.log("A rows:", titles.length, "last:", titles.at(-1), "second-last:", titles.at(-2));
    console.log("A target mounted:", titles.includes(TARGET));
    console.log("A scrollIntoView calls:", scrollCalls);
    console.log("A console.error calls:", warn.mock.calls.map((c) => String(c[0])).slice(0, 3));
    warn.mockRestore();
  });

  it("B: ancestors already expanded, then activePath changes", () => {
    const view = renderExplorer(null);
    // expand d0 by clicking its row
    const dir = screen.getByTitle("d0");
    fireEvent.click(dir);
    const before = rowTitles();
    console.log("B before rows:", before.length, "idx598:", before[598], "idx599:", before[599]);
    scrollCalls = 0;
    view.rerender(
      <Explorer
        entries={entries}
        activePath={TARGET}
        isLoading={false}
        error={null}
        truncated={false}
        hiddenSupported={false}
        includeHidden={false}
        onToggleHidden={() => {}}
        onOpenFile={() => {}}
        onRefresh={() => {}}
        onQuickOpen={() => {}}
        header={null}
      />,
    );
    const after = rowTitles();
    console.log("B after rows:", after.length, "idx598:", after[598], "idx599:", after[599]);
    console.log("B target mounted:", after.includes(TARGET));
    console.log("B scrollIntoView calls:", scrollCalls);
    const lost = before.filter((t) => !after.includes(t));
    console.log("B rows lost by opening the file:", lost);
    console.log("B footer:", document.querySelector("div.shrink-0.border-t")?.textContent);
  });
});
