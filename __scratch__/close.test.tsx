import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const reads = new Map<string, Deferred<any>>();
const writes: Deferred<any>[] = [];

vi.mock("@get-bb/plugin-sdk/app", () => ({
  useRpc: () => ({
    call: (name: string, args: any) => {
      if (name === "read") {
        const d = deferred<any>();
        reads.set(args.path, d);
        return d.promise;
      }
      if (name === "write") {
        const d = deferred<any>();
        writes.push(d);
        return d.promise;
      }
      throw new Error("unexpected rpc " + name);
    },
  }),
}));

import { useFileTabs } from "@/components/use-file-tabs";

const SCOPE = { kind: "thread", id: "t1" } as const;

function textFile(path: string, content: string, sha: string) {
  return { kind: "text", content, sha256: sha, sizeBytes: content.length, absolutePath: "/" + path, editable: true };
}

async function setup(paths: string[]) {
  reads.clear();
  writes.length = 0;
  const view = renderHook(() => useFileTabs(SCOPE));
  for (const p of paths) {
    await act(async () => { view.result.current.open(p); });
    await act(async () => {
      reads.get(p)!.resolve(textFile(p, "orig-" + p, "sha-" + p));
      await Promise.resolve();
    });
  }
  return view;
}

describe("close() and queued patches", () => {
  it("A: keeps a save-completion patch queued in the same batch as close()", async () => {
    const view = await setup(["a.txt", "b.txt"]);

    // Make a.txt active + dirty, then start a save so it is `saving`.
    await act(async () => { view.result.current.activate("a.txt"); });
    await act(async () => { view.result.current.setDraft("a.txt", "edited"); });
    await act(async () => { view.result.current.save(); });
    expect(view.result.current.tabs.find(t => t.path === "a.txt")!.save.kind).toBe("saving");

    // Same batch: write resolves (queues patch -> clean) AND the user closes b.txt.
    await act(async () => {
      writes[0]!.resolve({ outcome: "written", sha256: "sha2", sizeBytes: 6 });
      await Promise.resolve();
      view.result.current.close("b.txt");
    });

    const a = view.result.current.tabs.find(t => t.path === "a.txt");
    expect(view.result.current.tabs.map(t => t.path)).toEqual(["a.txt"]);
    expect(a!.save.kind).toBe("clean");
  });

  it("B: close() return value vs the live tab array when an open is queued in the same batch", async () => {
    const view = await setup(["a.txt", "b.txt", "c.txt"]);
    await act(async () => { view.result.current.activate("b.txt"); });

    let returned: string | null = "unset" as any;
    await act(async () => {
      view.result.current.open("d.txt");     // queued append, ref still stale
      returned = view.result.current.close("b.txt");
    });

    const paths = view.result.current.tabs.map(t => t.path);
    // eslint-disable-next-line no-console
    console.log("returned:", returned, "live:", paths, "activePath:", view.result.current.activePath);
    expect(paths).toContain("d.txt");
    expect(paths).toContain(returned!);
  });
});
