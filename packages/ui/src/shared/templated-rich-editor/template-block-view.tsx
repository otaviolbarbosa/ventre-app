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
      className={cn(
        "rounded-lg",
        editable &&
          "group relative my-2 flex items-start gap-2 border border-input border-dashed p-3 pl-0 hover:border-primary/50",
      )}
    >
      {editable && (
        <Button
          variant="ghost"
          size="icon-sm"
          data-drag-handle
          contentEditable={false}
          className="cursor-grab opacity-10 hover:bg-transparent group-hover:opacity-100"
          aria-label="Reordenar bloco"
        >
          <GripVertical className="h-4 w-4" />
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
