// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Tables } from "@ventre/supabase/types";
import { TemplatedRichEditor } from "./templated-rich-editor";

afterEach(cleanup);

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

const PERSONAL_TEMPLATE = {
  id: "t1",
  category: "exame",
  title: "Hemograma completo",
  scope: "personal",
  owner_id: "professional-1",
  content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "HEMOGRAMA" }] }] },
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
} as unknown as Tables<"document_templates">;

describe("TemplatedRichEditor", () => {
  it("inserts a templateBlock when a sidebar template's '+' is clicked", async () => {
    const onChange = vi.fn();

    render(
      <TemplatedRichEditor
        content={EMPTY_DOC}
        onChange={onChange}
        templates={[PERSONAL_TEMPLATE]}
        onOverwriteTemplate={vi.fn()}
        onCreateTemplate={vi.fn()}
      />,
    );

    // findByLabelText, not getByLabelText: useEditor uses immediatelyRender: false (same as
    // RichEditor), so the editor — and this sidebar, gated behind `if (!editor) return null`
    // — isn't necessarily present in the very first synchronous render commit.
    await userEvent.click(await screen.findByLabelText("Inserir modelo Hemograma completo"));

    await waitFor(() => {
      const lastCall = onChange.mock.calls.at(-1)?.[0];
      expect(
        lastCall?.content?.some(
          (node: { type?: string; attrs?: { templateId?: string } }) =>
            node.type === "templateBlock" && node.attrs?.templateId === "t1",
        ),
      ).toBe(true);
    });
  });

  it("opens the choice modal when saving a block with an existing personal templateId, and calls onOverwriteTemplate", async () => {
    const onOverwriteTemplate = vi.fn().mockResolvedValue(undefined);
    const content = {
      type: "doc",
      content: [
        {
          type: "templateBlock",
          attrs: { templateId: "t1", templateScope: "personal", label: "Hemograma completo" },
          content: [{ type: "paragraph", content: [{ type: "text", text: "HEMOGRAMA" }] }],
        },
      ],
    };

    render(
      <TemplatedRichEditor
        content={content}
        onChange={vi.fn()}
        templates={[]}
        onOverwriteTemplate={onOverwriteTemplate}
        onCreateTemplate={vi.fn()}
      />,
    );

    // findByLabelText, not getByLabelText: this button lives inside templateBlock's
    // NodeView, which mounts via ReactNodeViewRenderer/EditorContent's own lifecycle —
    // the same async-mount timing Task 8 had to account for.
    await userEvent.click(await screen.findByLabelText("Salvar bloco como modelo"));
    expect(await screen.findByText("Sobrescrever modelo atual")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Sobrescrever modelo atual"));

    await waitFor(() => {
      expect(onOverwriteTemplate).toHaveBeenCalledWith(
        "t1",
        expect.objectContaining({ type: "doc" }),
      );
    });
  });

  it("skips the choice modal and opens the name modal directly for a block with no templateId", async () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "templateBlock",
          attrs: { templateId: null, templateScope: null, label: null },
          content: [{ type: "paragraph", content: [{ type: "text", text: "novo conteúdo" }] }],
        },
      ],
    };

    render(
      <TemplatedRichEditor
        content={content}
        onChange={vi.fn()}
        templates={[]}
        onOverwriteTemplate={vi.fn()}
        onCreateTemplate={vi.fn()}
      />,
    );

    await userEvent.click(await screen.findByLabelText("Salvar bloco como modelo"));

    expect(await screen.findByText("Salvar como novo modelo")).toBeInTheDocument();
    expect(screen.queryByText("Sobrescrever modelo atual")).not.toBeInTheDocument();
  });

  it("removes a block after confirming deletion", async () => {
    const onChange = vi.fn();
    const content = {
      type: "doc",
      content: [
        {
          type: "templateBlock",
          attrs: { templateId: "t1", templateScope: "personal", label: "Hemograma completo" },
          content: [{ type: "paragraph", content: [{ type: "text", text: "HEMOGRAMA" }] }],
        },
      ],
    };

    render(
      <TemplatedRichEditor
        content={content}
        onChange={onChange}
        templates={[]}
        onOverwriteTemplate={vi.fn()}
        onCreateTemplate={vi.fn()}
      />,
    );

    await userEvent.click(await screen.findByLabelText("Remover bloco"));
    expect(await screen.findByText("Remover bloco")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Confirmar"));

    await waitFor(() => {
      const lastCall = onChange.mock.calls.at(-1)?.[0];
      expect(lastCall?.content?.some((node: { type?: string }) => node.type === "templateBlock")).toBe(
        false,
      );
    });
  });

  it("inserts a new templateBlock as a top-level sibling, not nested, when the caret is inside an existing templateBlock", async () => {
    // This is the one test exercising the actual reason resolveTopLevelInsertPos exists:
    // Task 7 confirmed the schema alone does NOT reject a templateBlock nested inside
    // another one, so this insertion-position logic is the only thing standing between
    // the feature and nested blocks. The other insertion test (test 1) inserts into an
    // empty doc, where the caret is already at the top level — it never exercises the
    // depth-2 case (caret inside an existing block's paragraph) this helper is for.
    const onChange = vi.fn();
    const content = {
      type: "doc",
      content: [
        {
          type: "templateBlock",
          attrs: { templateId: "t1", templateScope: "personal", label: "Hemograma completo" },
          content: [{ type: "paragraph", content: [{ type: "text", text: "HEMOGRAMA" }] }],
        },
      ],
    };

    render(
      <TemplatedRichEditor
        content={content}
        onChange={onChange}
        templates={[PERSONAL_TEMPLATE]}
        onOverwriteTemplate={vi.fn()}
        onCreateTemplate={vi.fn()}
      />,
    );

    // Click into the existing block's text to move the caret there — ProseMirror syncs
    // its selection off the browser's own Selection/Range state on click. If this
    // doesn't reliably move ProseMirror's selection under happy-dom (unlike a real
    // browser), that's worth escalating rather than guessing around: try
    // editor.commands.setTextSelection at a known position instead (this requires
    // exposing the editor instance for the test, e.g. a test-only ref/callback prop —
    // only add that if the click-based approach genuinely doesn't work here).
    const existingText = await screen.findByText("HEMOGRAMA");
    await userEvent.click(existingText);

    await userEvent.click(await screen.findByLabelText("Inserir modelo Hemograma completo"));

    await waitFor(() => {
      const lastCall = onChange.mock.calls.at(-1)?.[0];
      const topLevelNodes: { type?: string; content?: { type?: string }[] }[] =
        lastCall?.content ?? [];

      expect(topLevelNodes.filter((node) => node.type === "templateBlock").length).toBe(2);
      for (const node of topLevelNodes) {
        // `node.content` is legitimately absent (not just empty) on a childless ProseMirror
        // node in its JSON form — e.g. an empty trailing paragraph — so default to [] rather
        // than letting `undefined?.some(...)` short-circuit to `undefined` and fail `toBe(false)`.
        expect((node.content ?? []).some((child) => child.type === "templateBlock")).toBe(false);
      }
    });
  });
});
