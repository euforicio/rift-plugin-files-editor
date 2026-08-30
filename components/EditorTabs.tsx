import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { basename } from "@/lib/tree";
import { FileGlyph } from "./FileGlyph";
import { isDirty, type FileTab } from "./use-file-tabs";

export function EditorTabs({
  tabs,
  activePath,
  onActivate,
  onClose,
}: {
  tabs: readonly FileTab[];
  activePath: string | null;
  onActivate: (path: string) => void;
  onClose: (path: string) => void;
}) {
  const activeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activePath]);

  if (tabs.length === 0) return null;

  return (
    // Deliberately a list rather than role="tablist": a real tab list needs
    // each tab to own a tabpanel and to hold no other focusable children, and
    // every entry here carries its own close button.
    <div
      role="list"
      aria-label="Open files"
      className="flex shrink-0 items-stretch overflow-x-auto border-b border-border bg-surface-recessed"
    >
      {tabs.map((tab) => {
        const isActive = tab.path === activePath;
        const dirty = isDirty(tab);
        return (
          <div
            key={tab.path}
            role="listitem"
            ref={isActive ? activeRef : undefined}
            className={cn(
              "group flex shrink-0 items-center gap-1.5 border-r border-border pr-1 pl-3",
              isActive
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:bg-state-hover",
            )}
          >
            <button
              type="button"
              aria-current={isActive ? "true" : undefined}
              title={tab.path}
              onClick={() => onActivate(tab.path)}
              onAuxClick={(event) => {
                if (event.button === 1) onClose(tab.path);
              }}
              className="flex cursor-pointer items-center gap-1.5 py-2 text-[13px] focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            >
              <FileGlyph path={tab.path} kind="file" />
              <span className={cn("max-w-48 truncate", dirty && "italic")}>
                {basename(tab.path)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onClose(tab.path)}
              aria-label={`Close ${basename(tab.path)}`}
              title={dirty ? "Close (unsaved changes)" : "Close"}
              className={cn(
                "flex size-5 cursor-pointer items-center justify-center rounded",
                "text-muted-foreground hover:bg-state-active hover:text-foreground",
                "focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
              )}
            >
              {dirty ? (
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-foreground group-hover:hidden"
                />
              ) : null}
              <Icon
                name="X"
                aria-hidden
                className={cn("size-3", dirty && "hidden group-hover:block")}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}
