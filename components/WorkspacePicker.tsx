import { useEffect, useState } from "react";
import { useRpc } from "@get-bb/plugin-sdk/app";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { ScopeRef } from "@/lib/route";
import { sameScope } from "@/lib/route";
import type { ResolvedScope, WorkspaceOption, rpcContract } from "../server.js";

/**
 * Picks which checkout or worktree the explorer shows. Kept to a native
 * `<select>`: it is one control in a dense toolbar, and the host's overlay
 * stack is better spent on the quick-open palette.
 */
export function WorkspacePicker({
  current,
  onSelect,
}: {
  current: ResolvedScope | null;
  onSelect: (scope: ScopeRef) => void;
}) {
  const rpc = useRpc<typeof rpcContract>();
  const [options, setOptions] = useState<WorkspaceOption[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void rpc
      .call("workspaces")
      .then((result) => {
        if (!cancelled) setOptions(result.workspaces);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [rpc]);

  const selectedKey =
    current === null ? "" : keyOf(current.ref);

  // A scope reached by thread id is not one of the listed options; show it as
  // its own entry so the control never reads as "nothing selected".
  const hasSelected =
    current === null ||
    (options ?? []).some((option) => sameScope(option.ref, current.ref));

  return (
    <div className="relative flex min-w-0 flex-1 items-center">
      <Icon
        name="Folder"
        aria-hidden
        className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground"
      />
      <select
        value={selectedKey}
        aria-label="Workspace"
        onChange={(event) => {
          const parsed = parseKey(event.target.value);
          if (parsed !== null) onSelect(parsed);
        }}
        className={cn(
          "h-7 w-full min-w-0 cursor-pointer appearance-none rounded-md border border-border",
          "bg-background pr-6 pl-7 text-xs text-foreground",
          "focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
        )}
      >
        {options === null ? (
          <option value="">Loading workspaces…</option>
        ) : current === null ? (
          // Without this the browser would show the first option as if it were
          // the selection, when nothing is actually being browsed.
          <option value="">Choose a workspace…</option>
        ) : null}
        {current !== null && !hasSelected ? (
          <option value={selectedKey}>
            {current.label} — {current.sublabel}
          </option>
        ) : null}
        {(options ?? []).map((option) => (
          <option key={keyOf(option.ref)} value={keyOf(option.ref)}>
            {option.label} — {option.sublabel}
          </option>
        ))}
      </select>
      <Icon
        name="ChevronDown"
        aria-hidden
        className="pointer-events-none absolute right-1.5 size-3 text-muted-foreground"
      />
    </div>
  );
}

function keyOf(ref: ScopeRef): string {
  return `${ref.kind}:${ref.id}`;
}

function parseKey(value: string): ScopeRef | null {
  const separator = value.indexOf(":");
  if (separator === -1) return null;
  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (id === "") return null;
  if (kind !== "thread" && kind !== "environment" && kind !== "project") {
    return null;
  }
  return { kind, id };
}
