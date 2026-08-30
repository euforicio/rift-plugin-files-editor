import path from "node:path";

/** Always forward slashes, so a Windows host and a POSIX one agree on a key. */
export function normalizeListedPath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/");
}

/**
 * The host a workspace lives on picks the path flavour, not the machine this
 * plugin runs on: a Windows workspace browsed from a macOS server still needs
 * backslashes when the absolute path goes back to BB.
 *
 * Detected by drive letter or UNC prefix, NOT by `win32.isAbsolute` — that
 * returns true for `/work/app` too, which would send every POSIX root down the
 * Windows path.
 */
export function pathApiFor(root: string): path.PlatformPath {
  const isWindows = /^[a-zA-Z]:[\\/]/.test(root) || root.startsWith("\\\\");
  return isWindows ? path.win32 : path.posix;
}

/**
 * Join a workspace-relative path onto its root, refusing anything that would
 * escape the root. `rootPath` confinement on BB's side is the real guard; this
 * one keeps a bad request from ever reaching it.
 */
export function resolveWithinRoot(root: string, relativePath: string): string {
  const api = pathApiFor(root);
  // Normalise the root through the same flavour used to join it. A Windows
  // root written with forward slashes (`C:/Users/dev/app`) otherwise fails
  // every containment check, because join() returns backslashes and the
  // prefix comparison is textual.
  const base = api.normalize(root);
  // A backslash separates segments only on a Windows host. On POSIX it is a
  // legal character in a file name, so splitting on it would silently retarget
  // a file literally called `foo\bar.txt`.
  const separator = api === path.win32 ? /[/\\]+/ : /\/+/;
  const relative = relativePath.replace(
    api === path.win32 ? /^[/\\]+/ : /^\/+/,
    "",
  );
  if (relative === "" || relative === ".") return base;

  const segments = relative.split(separator).filter((segment) => segment !== "");
  if (segments.some((segment) => segment === "..")) {
    throw new Error(`Path escapes the workspace: ${relativePath}`);
  }

  const resolved = api.join(base, ...segments);
  const prefix = base.endsWith(api.sep) ? base : `${base}${api.sep}`;
  if (resolved !== base && !resolved.startsWith(prefix)) {
    throw new Error(`Path escapes the workspace: ${relativePath}`);
  }
  return resolved;
}

export function relativeToRoot(root: string, absolutePath: string): string {
  const api = pathApiFor(root);
  return normalizeListedPath(api.relative(root, absolutePath)) || api.basename(absolutePath);
}
