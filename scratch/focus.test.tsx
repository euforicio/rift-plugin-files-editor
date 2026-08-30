import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const entries = [
  { path: "a.txt", kind: "file", sizeBytes: 10 },
  { path: "b.txt", kind: "file", sizeBytes: 10 },
];

vi.mock("@get-bb/plugin-sdk/app", () => {
  return {
    useRpc: () => ({
      call: (name: string) => {
        if (name === "tree") {
          return Promise.resolve({
            scope: {
              ref: { kind: "thread", id: "t" },
              label: "L",
              sublabel: "S",
              root: "/root",
              environmentId: null,
              hostId: "h",
              hostName: "host",
              isLocal: true,
            },
            entries,
            truncated: false,
            listing: "local",
            excluded: [],
          });
        }
        if (name === "read") {
          return Promise.resolve({
            kind: "text",
            content: "hello",
            sha256: "sha",
            sizeBytes: 5,
            absolutePath: "/root/x",
            editable: true,
          });
        }
        return Promise.resolve({});
      },
    }),
    useBbNavigate: () => ({
      toPluginPanel: () => {},
      experimental_openFilePreview: () => true,
    }),
    useRealtime: () => {},
    useBbContext: () => ({ threadId: null, projectId: null }),
    experimental_SourceCode: ({ content }: { content: string }) => <pre>{content}</pre>,
    definePluginApp: (fn: unknown) => fn,
  };
});

vi.mock("sonner", () => ({ toast: Object.assign(() => {}, { warning: () => {}, error: () => {} }) }));

import { Workspace } from "@/components/Workspace";

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  });
}

async function frame() {
  await act(async () => {
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => setTimeout(r, 0));
  });
}

function describeActive() {
  const el = document.activeElement;
  if (el === null) return "null";
  if (el === document.body) return "BODY";
  return `${el.tagName}[${el.getAttribute("aria-label") ?? el.textContent?.slice(0, 20) ?? ""}]${el.getAttribute("tabindex") ?? ""}`;
}

describe("page variant focus", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("A: quick open from empty state button (page)", async () => {
    render(
      <Workspace scope={{ kind: "thread", id: "t" }} filePath={null} onOpenPath={() => {}} variant="page" />,
    );
    await flush();
    const root = document.querySelector('div[tabindex="-1"]') as HTMLElement;
    expect(root).toBeTruthy();
    // focus the empty state "go to file" button and click it
    const goto = screen.getByText("go to file") as HTMLButtonElement;
    goto.focus();
    expect(document.activeElement).toBe(goto);
    fireEvent.click(goto);
    await flush();
    console.log("after opening palette:", describeActive());
    const input = screen.getByLabelText("Go to file") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "a.txt" } });
    await flush();
    fireEvent.keyDown(input, { key: "Enter" });
    console.log("immediately after Enter:", describeActive());
    await frame();
    console.log("after rAF:", describeActive());
    expect(document.activeElement).toBe(root);
  });
});
