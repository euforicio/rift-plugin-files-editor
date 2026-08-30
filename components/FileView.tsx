import { useEffect, useMemo, useRef } from "react";
import { experimental_SourceCode as SourceCode } from "@get-bb/plugin-sdk/app";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { formatBytes, languageLabel } from "@/lib/file-kind";
import type { FileTab } from "./use-file-tabs";

export interface FileViewProps {
  tab: FileTab;
  onChangeDraft: (path: string, draft: string) => void;
  onSave: () => void;
  onReload: () => void;
  onOverwrite: () => void;
  onRetry: () => void;
}

export function FileView({
  tab,
  onChangeDraft,
  onSave,
  onReload,
  onOverwrite,
  onRetry,
}: FileViewProps) {
  const file = tab.file;

  if (file === null) {
    return tab.error === null ? (
      <Centered>
        <Icon name="Loading" aria-hidden className="size-4 animate-spin" />
        <span>Opening {tab.path}…</span>
      </Centered>
    ) : (
      <Centered tone="error">
        <Icon name="AlertTriangle" aria-hidden className="size-4" />
        <span>{tab.error}</span>
        <button
          type="button"
          onClick={onRetry}
          className="cursor-pointer font-medium underline underline-offset-2"
        >
          Try again
        </button>
      </Centered>
    );
  }

  if (file.kind === "image") {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
        <img
          src={file.dataUrl}
          alt={tab.path}
          className="mx-auto max-w-full rounded-md border border-border bg-card object-contain"
        />
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {formatBytes(file.sizeBytes)}
        </p>
      </div>
    );
  }

  if (file.kind === "binary") {
    return (
      <Centered>
        <Icon name="File" aria-hidden className="size-4" />
        <span>
          {file.reason} ({formatBytes(file.sizeBytes)})
        </span>
      </Centered>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SaveNotice
        tab={tab}
        onReload={onReload}
        onOverwrite={onOverwrite}
      />
      {tab.isEditing ? (
        <CodeEditor
          path={tab.path}
          value={tab.draft ?? file.content}
          onChange={(next) => onChangeDraft(tab.path, next)}
          onSave={onSave}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <SourceCode
            content={file.content}
            path={tab.path}
            overflow="scroll"
            className="min-h-full text-[13px]"
          />
        </div>
      )}
    </div>
  );
}

/**
 * A plain textarea with a matching gutter. BB's own source viewer owns
 * highlighting for reading; editing only needs a caret, a monospace grid, and
 * line numbers that stay glued to it while it scrolls.
 */
function CodeEditor({
  path,
  value,
  onChange,
  onSave,
}: {
  path: string;
  value: string;
  onChange: (next: string) => void;
  onSave: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLPreElement | null>(null);

  const lineCount = useMemo(() => value.split("\n").length, [value]);
  // One text node rather than one element per line: a 100k-line lock file would
  // otherwise remount its whole gutter on every keystroke.
  const gutterText = useMemo(
    () => Array.from({ length: lineCount }, (_, index) => index + 1).join("\n"),
    [lineCount],
  );

  useEffect(() => {
    textareaRef.current?.focus();
  }, [path]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-background font-mono text-[13px] leading-5">
      <pre
        ref={gutterRef}
        aria-hidden
        className="shrink-0 overflow-hidden border-r border-border bg-surface-recessed px-2 py-3 text-right font-mono text-[13px] leading-5 tabular-nums text-muted-foreground select-none"
      >
        {gutterText}
      </pre>
      <textarea
        ref={textareaRef}
        value={value}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-label={`Edit ${path}`}
        onScroll={(event) => {
          if (gutterRef.current !== null) {
            gutterRef.current.scrollTop = event.currentTarget.scrollTop;
          }
        }}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
            event.preventDefault();
            // The workspace root handles ⌘S too; without this the keystroke
            // bubbles and fires a second write against the same guard hash,
            // which comes back as a conflict that never happened.
            event.stopPropagation();
            onSave();
            return;
          }
          if (event.key === "Tab") {
            event.preventDefault();
            event.stopPropagation();
            insertAtCaret(event.currentTarget, "  ", onChange);
          }
        }}
        // No soft wrap: the gutter renders one row per logical line, so a
        // wrapped line would make every number below it drift.
        wrap="off"
        className={cn(
          "min-h-0 flex-1 resize-none bg-transparent py-3 pr-4 pl-3 text-foreground",
          "overflow-auto whitespace-pre",
          "focus-visible:outline-none",
        )}
      />
    </div>
  );
}

function insertAtCaret(
  textarea: HTMLTextAreaElement,
  text: string,
  onChange: (next: string) => void,
): void {
  const { selectionStart, selectionEnd, value } = textarea;
  const next = `${value.slice(0, selectionStart)}${text}${value.slice(selectionEnd)}`;
  onChange(next);
  requestAnimationFrame(() => {
    const caret = selectionStart + text.length;
    textarea.setSelectionRange(caret, caret);
  });
}

function SaveNotice({
  tab,
  onReload,
  onOverwrite,
}: {
  tab: FileTab;
  onReload: () => void;
  onOverwrite: () => void;
}) {
  if (tab.save.kind === "conflict") {
    return (
      <NoticeRow tone="error">
        {tab.path} changed on disk since you opened it.
        <NoticeAction onClick={onReload}>Reload</NoticeAction>
        <NoticeAction onClick={onOverwrite}>Overwrite</NoticeAction>
      </NoticeRow>
    );
  }
  if (tab.save.kind === "error") {
    return <NoticeRow tone="error">{tab.save.message}</NoticeRow>;
  }
  if (tab.file?.kind === "text" && !tab.file.editable && tab.isEditing) {
    return (
      <NoticeRow tone="warning">
        This file is too large to edit here — it is shown read-only.
      </NoticeRow>
    );
  }
  return null;
}

function NoticeRow({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "error" | "warning";
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex shrink-0 items-center gap-2 px-4 py-1.5 text-xs",
        tone === "error"
          ? "bg-surface-destructive text-destructive-text"
          : "bg-surface-attention text-foreground",
      )}
    >
      {children}
    </div>
  );
}

function NoticeAction({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded-sm font-medium underline underline-offset-2 hover:opacity-80 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
    >
      {children}
    </button>
  );
}

function Centered({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "error";
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-wrap items-center justify-center gap-2 p-8 text-sm",
        tone === "error" ? "text-destructive-text" : "text-muted-foreground",
      )}
    >
      {children}
    </div>
  );
}

export function fileMetaLabel(tab: FileTab): string {
  if (tab.file === null) return "";
  const language = languageLabel(tab.path);
  if (tab.file.kind === "text") {
    const lines = tab.file.content === "" ? 0 : tab.file.content.split("\n").length;
    return `${language} · ${lines.toLocaleString()} lines · ${formatBytes(tab.file.sizeBytes)}`;
  }
  return `${language} · ${formatBytes(tab.file.sizeBytes)}`;
}
