import { useEffect, useMemo, useState } from "react";
import { useRpc } from "@riftlabs/plugin-sdk/app";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { ScopeRef } from "@/lib/route";
import { sameScope } from "@/lib/route";
import { defaultOptionFor, groupWorkspaces } from "@/lib/workspaces";
import type { ResolvedScope, WorkspaceOption, rpcContract } from "../server.js";

/**
 * Picks what the explorer shows, as two dependent controls: the project, then
 * the checkout or worktree inside it. One flat list mixed both together and
 * repeated the project's name on every row, which got unreadable once a
 * project had more than a couple of worktrees.
 *
 * Kept to native `<select>`s: two controls in a narrow sidebar, and the host's
 * overlay stack is better spent on the quick-open palette.
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

  const groups = useMemo(() => groupWorkspaces(options ?? []), [options]);

  // A scope reached by thread id is not one of the listed options, and its
  // project may not be listed either. Track both so neither control ever reads
  // as "nothing selected" while a workspace is open.
  const listedHere = (options ?? []).some(
    (option) => current !== null && sameScope(option.ref, current.ref),
  );
  const selectedProjectId = current?.projectId ?? "";
  const knownProject = groups.some(
    (group) => group.projectId === selectedProjectId,
  );
  const activeGroup = groups.find(
    (group) => group.projectId === selectedProjectId,
  );

  const isLoading = options === null;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <Field icon="Folder" label="Project">
        <select
          value={selectedProjectId}
          aria-label="Project"
          disabled={isLoading}
          onChange={(event) => {
            const next = defaultOptionFor(
              groups.find((group) => group.projectId === event.target.value),
            );
            // Landing on the checkout keeps one click from stranding the user
            // on a project with nothing selected inside it.
            if (next !== null) onSelect(next.ref);
          }}
          className={selectClass}
        >
          {isLoading ? <option value="">Loading…</option> : null}
          {!isLoading && current === null ? (
            // Without this the browser shows the first option as if it were
            // chosen, when nothing is actually being browsed.
            <option value="">Choose a project…</option>
          ) : null}
          {current !== null && !knownProject ? (
            <option value={selectedProjectId}>{current.label}</option>
          ) : null}
          {groups.map((group) => (
            <option key={group.projectId} value={group.projectId}>
              {group.projectName}
            </option>
          ))}
        </select>
      </Field>

      <Field
        icon={current?.environmentId === null ? "Folder" : "GitBranch"}
        label="Workspace"
      >
        <select
          value={current === null ? "" : keyOf(current.ref)}
          aria-label="Workspace"
          disabled={isLoading || current === null}
          onChange={(event) => {
            const parsed = parseKey(event.target.value);
            if (parsed !== null) onSelect(parsed);
          }}
          className={selectClass}
        >
          {current === null ? <option value="">—</option> : null}
          {current !== null && !listedHere ? (
            <option value={keyOf(current.ref)}>{current.sublabel}</option>
          ) : null}
          {(activeGroup?.options ?? []).map((option) => (
            <option key={keyOf(option.ref)} value={keyOf(option.ref)}>
              {option.sublabel}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

const selectClass = cn(
  "h-7 w-full min-w-0 cursor-pointer appearance-none rounded-md border border-border",
  "bg-background pr-6 pl-7 text-xs text-foreground",
  "focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
  "disabled:cursor-default disabled:text-muted-foreground",
);

function Field({
  icon,
  label,
  children,
}: {
  icon: "Folder" | "GitBranch";
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-w-0 items-center" title={label}>
      <Icon
        name={icon}
        aria-hidden
        className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground"
      />
      {children}
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
