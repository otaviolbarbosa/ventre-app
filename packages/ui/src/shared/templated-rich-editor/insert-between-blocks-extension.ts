import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { findGapParagraphRangeBefore } from "./find-gap-paragraph-range";

const pluginKey = new PluginKey("insertBetweenBlocks");

// No `position: absolute`/`left`/`top`/`translate`/`z-index` here on purpose — this
// codebase imports no `.ProseMirror { position: relative }` stylesheet, so an
// absolutely-positioned widget escapes to the single nearest positioned ancestor (the
// editor's scrollable wrapper in templated-rich-editor.tsx) instead of the document
// position ProseMirror actually placed it at. `flex` + `mx-auto` keeps the button in
// normal flow so ProseMirror's own DOM placement — which is correct — determines where
// it visually sits.
const WIDGET_CLASS =
  "mx-auto flex h-4 w-4 items-center justify-center rounded-full border border-input bg-background text-[10px] leading-none text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

function makeInsertWidget(pos: number): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.insertBlockAt = String(pos);
  button.setAttribute("contenteditable", "false");
  button.setAttribute("aria-label", "Inserir bloco");
  button.className = WIDGET_CLASS;
  button.textContent = "+";
  return button;
}

export const InsertBetweenBlocks = Extension.create({
  name: "insertBetweenBlocks",

  addProseMirrorPlugins() {
    const { editor } = this;

    return [
      new Plugin({
        key: pluginKey,
        props: {
          decorations: (state) => {
            if (!editor.isEditable) return DecorationSet.empty;

            const decorations: Decoration[] = [];
            const childCount = state.doc.childCount;

            state.doc.forEach((node, offset, index) => {
              // Skip the "before" widget for a trailing empty paragraph: it's the
              // cursor-accessibility placeholder ProseMirror auto-inserts after the doc's
              // last node (see find-gap-paragraph-range.ts), not real content, and it has
              // no visible height — so its "before" widget renders immediately on top of
              // the end-of-doc widget below, reading as one control duplicated on screen.
              // The end-of-doc widget alone already covers inserting at that position.
              const isTrailingEmptyPlaceholder =
                index === childCount - 1 &&
                node.type.name === "paragraph" &&
                node.content.size === 0;
              if (isTrailingEmptyPlaceholder) return;

              decorations.push(
                Decoration.widget(offset, () => makeInsertWidget(offset), {
                  side: -1,
                  key: `insert-${offset}`,
                }),
              );
            });

            const endPos = state.doc.content.size;
            decorations.push(
              // Keyed by position, not a fixed "insert-end" — ProseMirror reuses a widget's
              // DOM node across decoration recomputes when the key matches, without
              // necessarily re-invoking the factory. A fixed key here meant that once the
              // doc grew (e.g. after inserting a block), the end widget kept whichever DOM
              // node was first created for it — with `dataset.insertBlockAt` baked in from
              // that earlier, now-wrong position — even though it visually moved to the
              // correct new location. Confirmed live in Storybook: the button rendered at
              // the bottom of the doc but still carried the position from before the insert.
              Decoration.widget(endPos, () => makeInsertWidget(endPos), {
                side: 1,
                key: `insert-end-${endPos}`,
              }),
            );

            return DecorationSet.create(state.doc, decorations);
          },
          handleDOMEvents: {
            click: (view, event) => {
              if (!view.editable) return false;

              const target = event.target as HTMLElement;
              const posAttr = target
                .closest("[data-insert-block-at]")
                ?.getAttribute("data-insert-block-at");
              if (posAttr === null || posAttr === undefined) return false;

              const insertPos = Number(posAttr);
              const emptyBlockJson = {
                type: "templateBlock",
                attrs: { templateId: null, templateScope: null, label: null },
                content: [{ type: "paragraph" }],
              };

              // Mirrors insertTemplate's placeholder handling in templated-rich-editor.tsx:
              // a raw `tr.insert` here would leave the doc's baseline empty paragraph (or a
              // stranded gap paragraph left behind by TrailingNode after a templateBlock)
              // as a real sibling next to the new block instead of being consumed by it —
              // which is how a lone leftover empty paragraph ends up sitting beside (or, once
              // TrailingNode adds its own after the new isolating block, on both sides of)
              // the newly inserted block.
              if (editor.isEmpty) {
                editor
                  .chain()
                  .insertContentAt({ from: 0, to: editor.state.doc.content.size }, emptyBlockJson)
                  .run();
                return true;
              }

              const gapRange = findGapParagraphRangeBefore(editor.state.doc, insertPos);
              editor
                .chain()
                .insertContentAt(gapRange ?? insertPos, emptyBlockJson)
                .run();
              return true;
            },
          },
        },
      }),
    ];
  },
});
