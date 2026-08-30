import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { glyphTone, type GlyphTone } from "@/lib/file-kind";

// Mid-range hues only: BB's palettes are user-selectable rather than a plain
// light/dark pair, so a `dark:` variant would not track the active theme.
const TONE_CLASS: Readonly<Record<GlyphTone, string>> = {
  code: "text-sky-500",
  config: "text-amber-500",
  markup: "text-orange-500",
  style: "text-violet-500",
  doc: "text-emerald-500",
  media: "text-pink-500",
  plain: "text-muted-foreground",
};

/** The coloured file/folder mark on an explorer row. */
export function FileGlyph({
  path,
  kind,
  isExpanded,
  className,
}: {
  path: string;
  kind: "file" | "directory";
  isExpanded?: boolean;
  className?: string;
}) {
  if (kind === "directory") {
    return (
      <Icon
        name={isExpanded === true ? "FolderOpen" : "Folder"}
        aria-hidden
        className={cn("size-3.5 shrink-0 text-muted-foreground", className)}
      />
    );
  }
  return (
    <Icon
      name="File"
      aria-hidden
      className={cn("size-3.5 shrink-0", TONE_CLASS[glyphTone(path)], className)}
    />
  );
}
