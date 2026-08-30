/**
 * The server returns one flat list of browsable workspaces. The picker shows
 * them as project → workspace, so the list has to be folded back into groups.
 *
 * Structurally typed rather than importing the server's DTO: this keeps the
 * module testable in a node environment without pulling `server.ts` (and
 * `node:fs`) into the app bundle's dependency graph.
 */

export interface WorkspaceLike {
  projectId: string;
  /** The project's name; the server sets it on every option in the group. */
  label: string;
  kind: "project" | "environment";
}

export interface WorkspaceGroup<T extends WorkspaceLike> {
  projectId: string;
  projectName: string;
  /** The checkout first, then its worktrees in server order. */
  options: T[];
}

export function groupWorkspaces<T extends WorkspaceLike>(
  options: readonly T[],
): WorkspaceGroup<T>[] {
  const groups: WorkspaceGroup<T>[] = [];
  const byProject = new Map<string, WorkspaceGroup<T>>();

  for (const option of options) {
    let group = byProject.get(option.projectId);
    if (group === undefined) {
      // First appearance fixes the project's position, so the picker's order
      // matches the order the server (and therefore the sidebar) uses.
      group = {
        projectId: option.projectId,
        projectName: option.label,
        options: [],
      };
      byProject.set(option.projectId, group);
      groups.push(group);
    }
    // A project whose checkout row arrives after a worktree row would
    // otherwise leave the group named after the worktree.
    if (option.kind === "project") group.projectName = option.label;
    group.options.push(option);
  }

  for (const group of groups) {
    group.options.sort((left, right) => rank(left) - rank(right));
  }
  return groups;
}

/** Stable: only lifts the checkout, leaving worktrees in server order. */
function rank(option: WorkspaceLike): number {
  return option.kind === "project" ? 0 : 1;
}

/**
 * What to browse when a project is picked: its checkout, else its first
 * worktree. Null only when the group is empty, which the server does not
 * produce.
 */
export function defaultOptionFor<T extends WorkspaceLike>(
  group: WorkspaceGroup<T> | undefined,
): T | null {
  if (group === undefined) return null;
  return group.options.find((option) => option.kind === "project") ?? group.options[0] ?? null;
}
