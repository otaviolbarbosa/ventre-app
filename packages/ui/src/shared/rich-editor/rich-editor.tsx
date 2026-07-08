"use client";

import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Underline,
} from "lucide-react";
import { cn } from "../../utils/utils";

export interface RichEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const FONT_SIZES = ["8px", "10px", "11px", "12px", "14px", "16px", "18px", "20px", "24px"];
// const FONT_FAMILIES = ["Inter", "Arial", "Times New Roman", "Georgia", "Courier New"];

export function RichEditor({
  content,
  onChange,
  placeholder,
  disabled,
  className,
}: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyleKit,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"],
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: "min-h-[200px] px-4 py-3 text-sm focus:outline-none",
        ...(placeholder && !content ? { "data-placeholder": placeholder } : {}),
      },
    },
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editable: !disabled,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  if (!editor) return null;

  const toolbarBtn = (active: boolean) =>
    cn(
      "rounded p-1 transition-colors",
      active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
      disabled && "pointer-events-none opacity-50",
    );

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-1 p-2">
        {/* <select
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
        </select> */}

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
        >
          <Bold className="h-6 w-6" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={toolbarBtn(editor.isActive("italic"))}
          disabled={disabled}
        >
          <Italic className="h-6 w-6" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={toolbarBtn(editor.isActive("underline"))}
          disabled={disabled}
        >
          <Underline className="h-6 w-6" />
        </button>

        <div className="mx-0.5 h-5 w-px bg-border" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={toolbarBtn(editor.isActive("bulletList"))}
          disabled={disabled}
        >
          <List className="h-6 w-6" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={toolbarBtn(editor.isActive("orderedList"))}
          disabled={disabled}
        >
          <ListOrdered className="h-6 w-6" />
        </button>

        <div className="mx-0.5 h-5 w-px bg-border" />

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={toolbarBtn(editor.isActive({ textAlign: "left" }))}
          disabled={disabled}
        >
          <AlignLeft className="h-6 w-6" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={toolbarBtn(editor.isActive({ textAlign: "center" }))}
          disabled={disabled}
        >
          <AlignCenter className="h-6 w-6" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={toolbarBtn(editor.isActive({ textAlign: "right" }))}
          disabled={disabled}
        >
          <AlignRight className="h-6 w-6" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          className={toolbarBtn(editor.isActive({ textAlign: "justify" }))}
          disabled={disabled}
        >
          <AlignJustify className="h-6 w-6" />
        </button>
      </div>
      <div
        className={cn("flex flex-col overflow-hidden rounded-2xl border border-input", className)}
      >
        <div className="flex-1 overflow-y-auto [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6">
          <EditorContent editor={editor} />
        </div>
      </div>
    </>
  );
}
