// @vitest-environment happy-dom
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { InsertBetweenBlocks } from "./insert-between-blocks-extension";
import { TemplateBlock, TemplateBlockParagraph } from "./template-block-node";

describe("InsertBetweenBlocks", () => {
  it("renders one insert widget before each top-level block, plus one at the end", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);

    const editor = new Editor({
      element,
      extensions: [Document, Text, Paragraph, InsertBetweenBlocks],
      content: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "um" }] },
          { type: "paragraph", content: [{ type: "text", text: "dois" }] },
        ],
      },
    });

    const widgets = element.querySelectorAll("[data-insert-block-at]");
    expect(widgets.length).toBe(3);

    editor.destroy();
    element.remove();
  });

  it("clicking a widget inserts an empty templateBlock at that position", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);

    const editor = new Editor({
      element,
      extensions: [Document, Text, TemplateBlockParagraph, TemplateBlock, InsertBetweenBlocks],
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "existente" }] }],
      },
    });

    const firstWidget = element.querySelector("[data-insert-block-at]") as HTMLButtonElement;
    firstWidget.click();

    const json = editor.getJSON();
    expect(json.content?.some((node) => node.type === "templateBlock")).toBe(true);

    editor.destroy();
    element.remove();
  });

  it("renders no insert widgets when the editor is not editable", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);

    const editor = new Editor({
      element,
      editable: false,
      extensions: [Document, Text, Paragraph, InsertBetweenBlocks],
      content: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "um" }] },
          { type: "paragraph", content: [{ type: "text", text: "dois" }] },
        ],
      },
    });

    expect(element.querySelectorAll("[data-insert-block-at]").length).toBe(0);

    editor.destroy();
    element.remove();
  });
});
