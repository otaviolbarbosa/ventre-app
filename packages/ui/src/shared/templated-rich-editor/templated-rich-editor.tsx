"use client";

import type { JSONContent } from "@tiptap/core";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import type { Tables } from "@ventre/supabase/types";
import { ConfirmModal } from "@ventre/ui/shared/confirm-modal";
import { cn } from "@ventre/ui/utils";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Plus,
  Underline,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AutoWrapLooseContent } from "./auto-wrap-loose-content-extension";
import { findGapParagraphRangeBefore } from "./find-gap-paragraph-range";
import { InsertBetweenBlocks } from "./insert-between-blocks-extension";
import { SaveBlockChoiceModal } from "./save-block-choice-modal";
import { SaveBlockTemplateModal } from "./save-block-template-modal";
import {
  TemplateBlock,
  type TemplateBlockAttrs,
  TemplateBlockBulletList,
  TemplateBlockHeading,
  TemplateBlockOrderedList,
  TemplateBlockParagraph,
  type TemplateBlockScope,
} from "./template-block-node";

const FONT_SIZES = ["8px", "10px", "11px", "12px", "14px", "16px", "18px", "20px", "24px"];
const FONT_FAMILIES = ["Inter", "Arial", "Times New Roman", "Georgia", "Courier New"];

export interface TemplatedRichEditorProps {
  content: JSONContent;
  onChange: (content: JSONContent) => void;
  templates: Tables<"document_templates">[];
  onOverwriteTemplate: (templateId: string, content: JSONContent) => Promise<void>;
  onCreateTemplate: (title: string, content: JSONContent) => Promise<{ id: string }>;
  disabled?: boolean;
  className?: string;
}

export function TemplatedRichEditor({
  content,
  onChange,
  templates,
  onOverwriteTemplate,
  onCreateTemplate,
  disabled,
  className,
}: TemplatedRichEditorProps) {
  const [activeBlock, setActiveBlock] = useState<{ pos: number; attrs: TemplateBlockAttrs } | null>(
    null,
  );
  const [saveStep, setSaveStep] = useState<"choice" | "name" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        paragraph: false,
        heading: false,
        bulletList: false,
        orderedList: false,
      }),
      TemplateBlockParagraph,
      TemplateBlockHeading,
      TemplateBlockBulletList,
      TemplateBlockOrderedList,
      TextStyleKit,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"],
      }),
      TemplateBlock.configure({
        onRequestSave: (pos, attrs) => {
          setActiveBlock({ pos, attrs });
          setSaveStep(attrs.templateId && attrs.templateScope === "personal" ? "choice" : "name");
        },
        onRequestDelete: (pos, attrs) => {
          setActiveBlock({ pos, attrs });
          setDeleteTarget(pos);
        },
      }),
      InsertBetweenBlocks,
      AutoWrapLooseContent,
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const editor = useEditor({
    extensions,
    content,
    editorProps: {
      attributes: { class: "min-h-[200px] px-4 py-3 text-sm focus:outline-none" },
    },
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editable: !disabled,
    onUpdate: ({ editor: e }) => onChange(e.getJSON()),
  });

  // useEditor only applies `content` at creation time — it does not re-parse it into the
  // doc on later prop updates. A consuming screen that loads its document asynchronously
  // (the expected real usage) would otherwise see a permanently blank editor. Mirrors the
  // same fix already used by the sibling RichEditor (packages/ui/src/shared/rich-editor/
  // rich-editor.tsx:61-65), adapted for JSON (RichEditor compares HTML strings) — the
  // stringify comparison guards against clobbering the user's own in-flight edits on every
  // onChange round-trip (onChange fires with the same content `content` was just set to).
  //
  // Known caveat (found during Task 12's review fix round, via a standalone A/B repro):
  // if `content` doesn't byte-match Tiptap's own schema-normalized JSON (e.g. missing
  // `attrs: { textAlign: null }`), this comparison treats it as "changed" and calls
  // setContent even when nothing meaningfully differs. For a document whose LAST
  // top-level node is a templateBlock specifically, that redundant setContent call can
  // append a trailing empty paragraph (ProseMirror needs a cursor-reachable position
  // after an `isolating` node). Content round-tripped through this editor's own onChange
  // already carries normalized attrs, so this mainly affects hand-authored fixtures or
  // content predating this schema — same class of imprecision RichEditor's own
  // string-equality check already accepts, not something this task introduces new risk
  // for. Worth a look if a future screen sees an unexpected trailing blank line on
  // documents ending in a template block.
  useEffect(() => {
    if (!editor) return;
    if (JSON.stringify(content) === JSON.stringify(editor.getJSON())) return;
    editor.commands.setContent(content);
  }, [editor, content]);

  if (!editor) return null;

  // Resolves to the position right after the top-level block containing `pos` (or `pos`
  // itself if already at the top level). Used to guarantee new templateBlock nodes are
  // always inserted as top-level siblings, never inside an existing templateBlock's
  // content — see the "No nesting" Global Constraint: the schema alone doesn't reject
  // invalid nesting, so insertion call sites have to avoid producing it in the first
  // place.
  const resolveTopLevelInsertPos = (pos: number): number => {
    const $pos = editor.state.doc.resolve(pos);
    return $pos.depth === 0 ? pos : $pos.after(1);
  };

  const insertTemplate = (template: Tables<"document_templates">) => {
    const templateContent = template.content as unknown as JSONContent;
    // document_templates.scope is a plain `text` column (constrained by a CHECK, not a
    // Postgres enum), so the generated type is `string`, not the "personal" | "global"
    // union TemplateBlockAttrs expects — the cast is safe because the DB constraint
    // already guarantees one of those two values.
    const blockJson: JSONContent = {
      type: "templateBlock",
      attrs: {
        templateId: template.id,
        templateScope: template.scope as TemplateBlockScope,
        label: template.title,
      },
      content: templateContent.content ?? [{ type: "paragraph" }],
    };

    // An entirely empty editor is just the single placeholder paragraph a ProseMirror
    // doc always needs to stay non-empty — replace it outright instead of inserting
    // after it, so the first block in a fresh document never leaves a blank line above it.
    if (editor.isEmpty) {
      editor
        .chain()
        .insertContentAt({ from: 0, to: editor.state.doc.content.size }, blockJson)
        .run();
      return;
    }

    const pos = resolveTopLevelInsertPos(editor.state.selection.to);
    const gapRange = findGapParagraphRangeBefore(editor.state.doc, pos);
    editor
      .chain()
      .insertContentAt(gapRange ?? pos, blockJson)
      .run();
  };

  const handleOverwrite = async () => {
    if (!activeBlock?.attrs.templateId) return;
    setIsSaving(true);
    try {
      const nodeJson = editor.state.doc.nodeAt(activeBlock.pos)?.toJSON() as
        | JSONContent
        | undefined;
      if (!nodeJson?.content) return;
      await onOverwriteTemplate(activeBlock.attrs.templateId, {
        type: "doc",
        content: nodeJson.content,
      });
      setSaveStep(null);
    } catch (error) {
      // Surfacing this to the user (toast, inline error) is the consuming screen's
      // responsibility — onOverwriteTemplate is expected to come from a hook like
      // next-safe-action's useAction, which has its own onError handling. This catch
      // exists only so a rejection doesn't become an unhandled promise rejection;
      // leaving saveStep untouched (not calling setSaveStep(null)) keeps the modal open
      // so the user can retry instead of it silently closing as if it had succeeded.
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNew = async (title: string) => {
    if (!activeBlock) return;
    setIsSaving(true);
    try {
      const nodeJson = editor.state.doc.nodeAt(activeBlock.pos)?.toJSON() as
        | JSONContent
        | undefined;
      if (!nodeJson?.content) return;
      const { id } = await onCreateTemplate(title, { type: "doc", content: nodeJson.content });
      editor
        .chain()
        .command(({ tr }) => {
          tr.setNodeAttribute(activeBlock.pos, "templateId", id);
          tr.setNodeAttribute(activeBlock.pos, "templateScope", "personal");
          tr.setNodeAttribute(activeBlock.pos, "label", title);
          return true;
        })
        .run();
      setSaveStep(null);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = () => {
    if (deleteTarget === null) return;
    const node = editor.state.doc.nodeAt(deleteTarget);
    if (node) {
      editor
        .chain()
        .deleteRange({ from: deleteTarget, to: deleteTarget + node.nodeSize })
        .run();
    }
    setDeleteTarget(null);
  };

  const toolbarBtn = (active: boolean) =>
    cn(
      "rounded p-1 transition-colors",
      active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
      disabled && "pointer-events-none opacity-50",
    );

  return (
    <div className="flex gap-4">
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-center gap-1 p-2">
          <select
            disabled={disabled}
            className="h-8 rounded-md border border-input bg-background px-1 text-xs disabled:opacity-50"
            onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
            value={FONT_FAMILIES.find((f) => editor.isActive("textStyle", { fontFamily: f })) ?? ""}
          >
            <option value="">Fonte</option>
            {FONT_FAMILIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          <select
            disabled={disabled}
            className="h-8 rounded-md border border-input bg-background px-1 text-xs disabled:opacity-50"
            onChange={(e) => editor.commands.setFontSize(e.target.value)}
            value={FONT_SIZES.find((s) => editor.isActive("textStyle", { fontSize: s })) ?? ""}
          >
            <option value="">Tam.</option>
            {FONT_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <div className="mx-0.5 h-5 w-px bg-border" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={toolbarBtn(editor.isActive("bold"))}
            disabled={disabled}
            aria-label="Negrito"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={toolbarBtn(editor.isActive("italic"))}
            disabled={disabled}
            aria-label="Itálico"
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={toolbarBtn(editor.isActive("underline"))}
            disabled={disabled}
            aria-label="Sublinhado"
          >
            <Underline className="h-4 w-4" />
          </button>
          <div className="mx-0.5 h-5 w-px bg-border" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={toolbarBtn(editor.isActive("bulletList"))}
            disabled={disabled}
            aria-label="Lista com marcadores"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={toolbarBtn(editor.isActive("orderedList"))}
            disabled={disabled}
            aria-label="Lista numerada"
          >
            <ListOrdered className="h-4 w-4" />
          </button>
          <div className="mx-0.5 h-5 w-px bg-border" />
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            className={toolbarBtn(editor.isActive({ textAlign: "left" }))}
            disabled={disabled}
            aria-label="Alinhar à esquerda"
          >
            <AlignLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            className={toolbarBtn(editor.isActive({ textAlign: "center" }))}
            disabled={disabled}
            aria-label="Centralizar"
          >
            <AlignCenter className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            className={toolbarBtn(editor.isActive({ textAlign: "right" }))}
            disabled={disabled}
            aria-label="Alinhar à direita"
          >
            <AlignRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
            className={toolbarBtn(editor.isActive({ textAlign: "justify" }))}
            disabled={disabled}
            aria-label="Justificar"
          >
            <AlignJustify className="h-4 w-4" />
          </button>
        </div>
        <div
          className={cn(
            "flex flex-col overflow-hidden rounded-2xl border border-input bg-white",
            className,
          )}
        >
          <div className="relative flex-1 overflow-y-auto [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      <div className="w-56 shrink-0">
        <h3 className="mb-2 font-medium text-sm">Modelos</h3>
        <ul className="space-y-1">
          {templates.map((template) => (
            <li
              key={template.id}
              className="flex items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-accent"
            >
              <span>{template.title}</span>
              <button
                type="button"
                onClick={() => insertTemplate(template)}
                disabled={disabled}
                aria-label={`Inserir modelo ${template.title}`}
              >
                <Plus className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <SaveBlockChoiceModal
        open={saveStep === "choice"}
        onOpenChange={(open) => !open && setSaveStep(null)}
        isPending={isSaving}
        canOverwrite={activeBlock?.attrs.templateScope === "personal"}
        onSaveCurrent={handleOverwrite}
        onCreateNew={() => setSaveStep("name")}
      />

      <SaveBlockTemplateModal
        open={saveStep === "name"}
        onOpenChange={(open) => !open && setSaveStep(null)}
        isPending={isSaving}
        onConfirm={handleCreateNew}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remover bloco"
        description="Tem certeza que deseja remover este bloco do documento? Essa ação não pode ser desfeita."
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
