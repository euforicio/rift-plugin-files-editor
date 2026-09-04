import * as ContextMenu from "@radix-ui/react-context-menu";
import { cn } from "@/lib/utils";

export interface TabContextMenuProps {
  children: React.ReactNode;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseAll: () => void;
  /** Greys out "Close others" when this is the only tab. */
  hasOthers: boolean;
}

/**
 * The usual right-click menu on an editor tab.
 *
 * Radix's context menu is one of the portalling families BB shims to its own
 * copy, so this shares the host's dismissable-layer and focus stack rather than
 * stacking a second one on top of it.
 */
export function TabContextMenu({
  children,
  onClose,
  onCloseOthers,
  onCloseAll,
  hasOthers,
}: TabContextMenuProps) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          className={cn(
            "z-50 min-w-44 overflow-hidden rounded-md border border-border bg-popover p-1",
            "text-popover-foreground shadow-md",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          <Item onSelect={onClose}>Close</Item>
          <Item onSelect={onCloseOthers} isDisabled={!hasOthers}>
            Close others
          </Item>
          <Item onSelect={onCloseAll}>Close all</Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

function Item({
  children,
  onSelect,
  isDisabled,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  isDisabled?: boolean;
}) {
  return (
    <ContextMenu.Item
      disabled={isDisabled}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-[13px] outline-none select-none",
        "focus:bg-state-hover focus:text-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
      )}
    >
      {children}
    </ContextMenu.Item>
  );
}
