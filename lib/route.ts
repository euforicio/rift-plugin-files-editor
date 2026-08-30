/**
 * The nav panel owns `/plugins/files-editor/files/*`. A route is
 * `<scopeKind>/<scopeId>[/<relative path>]`, so a workspace and the file open in
 * it are both linkable and survive back/forward.
 *
 * Segments go in RAW and come back percent-encoded: BB builds the URL from the
 * subPath and hands back the encoded remainder, so pre-encoding here would
 * double-encode (`config/auth.php` arriving as `config%2Fauth.php`). Write with
 * `/` separators, read by splitting on `/` and decoding each segment — the same
 * convention BB's own Docs plugin uses.
 */

export type ScopeKind = "thread" | "environment" | "project";

export interface ScopeRef {
  kind: ScopeKind;
  id: string;
}

export interface Route {
  scope: ScopeRef | null;
  filePath: string | null;
}

const SCOPE_KINDS: readonly ScopeKind[] = ["thread", "environment", "project"];

function isScopeKind(value: string): value is ScopeKind {
  return (SCOPE_KINDS as readonly string[]).includes(value);
}

export function formatRoute(scope: ScopeRef | null, filePath: string | null): string {
  if (scope === null) return "";
  const base = `${scope.kind}/${scope.id}`;
  if (filePath === null || filePath === "") return base;
  return `${base}/${filePath}`;
}

export function parseRoute(subPath: string): Route {
  const segments = subPath.split("/").filter((segment) => segment !== "");
  if (segments.length < 2) return { scope: null, filePath: null };

  const kind = decodeSegment(segments[0]!);
  if (!isScopeKind(kind)) return { scope: null, filePath: null };

  const id = decodeSegment(segments[1]!);
  if (id === "") return { scope: null, filePath: null };

  const rest = segments.slice(2).map(decodeSegment).join("/");
  return {
    scope: { kind, id },
    filePath: rest === "" ? null : rest,
  };
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    // A hand-typed URL can carry a stray `%`; treat it as literal text rather
    // than throwing out of a render.
    return segment;
  }
}

export function sameScope(left: ScopeRef | null, right: ScopeRef | null): boolean {
  if (left === null || right === null) return left === right;
  return left.kind === right.kind && left.id === right.id;
}
