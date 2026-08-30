import React from "react";

export const navCalls: Array<{ panel: string; subPath: string; replace: boolean }> = [];
export const files: Record<string, string> = {};

export function useRpc() {
  return {
    call: (method: string, args: any) => {
      if (method === "tree") {
        return Promise.resolve({
          scope: {
            label: "WS",
            sublabel: "",
            root: "/root",
            hostId: "h",
            hostName: "host",
            isLocal: true,
            environmentId: null,
          },
          entries: [],
          truncated: false,
          listing: "local",
          excluded: [],
        });
      }
      if (method === "read") {
        return Promise.resolve({
          kind: "text",
          content: files[args.path] ?? `body of ${args.path}`,
          sha256: `sha-${args.path}`,
          sizeBytes: 10,
          absolutePath: `/root/${args.path}`,
          editable: true,
        });
      }
      if (method === "write") {
        return Promise.resolve({ outcome: "written", sha256: "sha2", sizeBytes: 10 });
      }
      return Promise.resolve({});
    },
  };
}

export function useBbNavigate() {
  return {
    toPluginPanel: (panel: string, opts: any) => {
      navCalls.push({ panel, subPath: opts.subPath, replace: opts.replace === true });
      return true;
    },
    experimental_openFilePreview: () => true,
  };
}

export function useRealtime(_event: string, _handler: (payload: unknown) => void) {}
export function useBbContext() {
  return { threadId: null, projectId: null };
}
export function experimental_SourceCode(props: any) {
  return <pre data-testid="source">{props.content}</pre>;
}
export function definePluginApp(fn: any) {
  return fn;
}
