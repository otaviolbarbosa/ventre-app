// @vitest-environment happy-dom
import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";
import { EditorContent, useEditor } from "@tiptap/react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TemplateBlock, type TemplateBlockAttrs, TemplateBlockParagraph } from "./template-block-node";

afterEach(cleanup);

const DOC = {
  type: "doc",
  content: [
    {
      type: "templateBlock",
      attrs: { templateId: "t1", templateScope: "personal", label: "Vitamina D" },
      content: [{ type: "paragraph", content: [{ type: "text", text: "2000ui" }] }],
    },
  ],
};

function TestHarness({
  onRequestSave,
  onRequestDelete,
  editable,
}: {
  onRequestSave: (pos: number, attrs: TemplateBlockAttrs) => void;
  onRequestDelete: (pos: number, attrs: TemplateBlockAttrs) => void;
  editable: boolean;
}) {
  const editor = useEditor({
    extensions: [
      Document,
      Text,
      TemplateBlockParagraph,
      TemplateBlock.configure({ onRequestSave, onRequestDelete }),
    ],
    content: DOC,
    editable,
    immediatelyRender: false,
  });

  if (!editor) return null;

  return <EditorContent editor={editor} />;
}

describe("TemplateBlockView", () => {
  it("renders drag/save/delete controls when editable, and calls onRequestSave/onRequestDelete", async () => {
    const onRequestSave = vi.fn();
    const onRequestDelete = vi.fn();

    render(
      <TestHarness onRequestSave={onRequestSave} onRequestDelete={onRequestDelete} editable />,
    );

    const saveButton = await screen.findByLabelText("Salvar bloco como modelo");
    const deleteButton = await screen.findByLabelText("Remover bloco");
    const dragHandle = await screen.findByLabelText("Reordenar bloco");

    expect(saveButton).toBeInTheDocument();
    expect(deleteButton).toBeInTheDocument();
    expect(dragHandle).toBeInTheDocument();

    // Regression check: a custom node view with its own `contentDOM` (this one renders
    // its content via `NodeViewContent`) never gets ProseMirror's automatic
    // `dom.draggable = true` — that's only applied to content-less node views (see
    // prosemirror-view's `ViewDesc.create`). Without this attribute on the node view's
    // root DOM, the browser never fires a native `dragstart` for `onDragStart` /
    // `stopEvent` (wired up by Tiptap's NodeView base class) to react to, so the
    // `data-drag-handle` grip button above did nothing — confirmed live in Storybook
    // before this was added.
    const wrapper = dragHandle.closest("[data-node-view-wrapper]");
    expect(wrapper).toHaveAttribute("draggable", "true");

    // Regression check: Tiptap's NodeView.stopEvent (@tiptap/core) treats a mousedown
    // whose target tag is INPUT/BUTTON/SELECT/TEXTAREA as plain input interaction and
    // returns early — before it marks the node "currently dragging". A drag handle
    // rendered as a native <button> hit that early return, so the following native
    // `dragstart` on the wrapper got swallowed by stopEvent (it never reached
    // ProseMirror's own drag handling) even though the drag gesture itself still looked
    // like it was working. Confirmed live: dragging visibly started, but dropping never
    // reordered anything.
    expect(["INPUT", "BUTTON", "SELECT", "TEXTAREA"]).not.toContain(dragHandle.tagName);

    saveButton.click();
    expect(onRequestSave).toHaveBeenCalledWith(0, {
      templateId: "t1",
      templateScope: "personal",
      label: "Vitamina D",
    });

    deleteButton.click();
    expect(onRequestDelete).toHaveBeenCalledWith(0, {
      templateId: "t1",
      templateScope: "personal",
      label: "Vitamina D",
    });
  });

  it("hides all chrome when the editor is not editable", async () => {
    render(<TestHarness onRequestSave={vi.fn()} onRequestDelete={vi.fn()} editable={false} />);

    // Wait for the NodeView to actually mount (confirmed via its content, which renders
    // regardless of editable state) before asserting the chrome is absent — otherwise
    // "not yet mounted" would look identical to "correctly hidden" and the test would
    // pass vacuously.
    await screen.findByText("2000ui");

    expect(screen.queryByLabelText("Salvar bloco como modelo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Remover bloco")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Reordenar bloco")).not.toBeInTheDocument();

    const wrapper = document.querySelector("[data-node-view-wrapper]");
    expect(wrapper).not.toHaveAttribute("draggable", "true");
  });
});
