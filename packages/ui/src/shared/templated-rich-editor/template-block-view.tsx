"use client";

import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { cn } from "@ventre/ui/utils";
import { GripVertical, Save, Trash2 } from "lucide-react";
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
      className={cn(
        "rounded-lg",
        editable &&
          "group relative my-2 border border-input border-dashed p-3 hover:border-primary/50",
      )}
    >
      {editable && (
        <div
          contentEditable={false}
          className="mb-2 flex items-center justify-between opacity-0 transition-opacity group-hover:opacity-100"
        >
          <button
            type="button"
            data-drag-handle
            className="cursor-grab text-muted-foreground hover:text-foreground"
            aria-label="Reordenar bloco"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleSave}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Salvar bloco como modelo"
            >
              <Save className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="Remover bloco"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <NodeViewContent />
    </NodeViewWrapper>
  );
}
