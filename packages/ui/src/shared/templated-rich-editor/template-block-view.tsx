"use client";

import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { cn } from "@ventre/ui/utils";
import { GripVertical, Save, Trash2 } from "lucide-react";
import { Button } from "../../button";
import type { TemplateBlockAttrs, TemplateBlockOptions } from "./template-block-node";

export function TemplateBlockView({ node, editor, getPos, extension }: ReactNodeViewProps) {
  const attrs = node.attrs as TemplateBlockAttrs;
  const options = extension.options as TemplateBlockOptions;
  const editable = editor.isEditable;

  function handleSave() {
    const pos = getPos();
    if (typeof pos !== "number") return;
    options.onRequestSave(pos, attrs);
  }

  function handleDelete() {
    const pos = getPos();
    if (typeof pos !== "number") return;
    options.onRequestDelete(pos, attrs);
  }

  return (
    <NodeViewWrapper
      // ProseMirror only auto-sets `draggable` on a custom node view's DOM when it has no
      // `contentDOM` (see prosemirror-view's `ViewDesc.create`) — this node view renders
      // its content via `NodeViewContent`, so it has one, and the attribute is never added
      // on its own. Without it, the browser never fires a native `dragstart` for the grip
      // handle below to hook into (Tiptap's NodeView.onDragStart/stopEvent, wired through
      // NodeViewWrapper's `onDragStart` prop, only run in response to that native event).
      // `data-drag-handle` alone constrains WHERE a drag may start; this is what lets one
      // start at all.
      draggable={editable}
      className={cn(
        "rounded-lg",
        editable &&
          "group relative my-2 flex items-start gap-2 border border-input border-dashed p-3 pl-0 hover:border-primary/50",
      )}
    >
      {editable && (
        // `asChild` + a plain div instead of a native <button>: Tiptap's NodeView.stopEvent
        // (which @tiptap/core's onDragStart wiring depends on) treats a mousedown whose
        // target tag is INPUT/BUTTON/SELECT/TEXTAREA as ordinary input interaction and
        // returns early, before it ever marks the node as "being dragged" — which in turn
        // makes stopEvent swallow the following native `dragstart` instead of letting
        // ProseMirror see it. A real <button> here silently broke the handle: the drag
        // gesture would visibly start (native `draggable` doesn't care about any of this),
        // but drop never reordered anything, since ProseMirror's own drag handling never
        // ran. Confirmed live in a real browser, not just CDP-simulated drags.
        <Button
          asChild
          variant="ghost"
          size="icon-sm"
          data-drag-handle
          contentEditable={false}
          className="cursor-grab opacity-10 hover:bg-transparent group-hover:opacity-100"
          aria-label="Reordenar bloco"
        >
          {/* biome-ignore lint/a11y/useSemanticElements: must not be a <button> — see the
          comment above on why a native button breaks Tiptap's drag-handle detection. */}
          <div role="button" tabIndex={0}>
            <GripVertical className="h-4 w-4" />
          </div>
        </Button>
      )}
      <div className="flex-1">
        <NodeViewContent />
      </div>
      {editable && (
        <div
          contentEditable={false}
          className="flex items-center gap-1 opacity-10 group-hover:opacity-100"
        >
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleSave}
            aria-label="Salvar bloco como modelo"
          >
            <Save className="h-4 w-4" />
          </Button>
          <Button
            variant="destructive-ghost"
            size="icon-sm"
            onClick={handleDelete}
            aria-label="Remover bloco"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </NodeViewWrapper>
  );
}
