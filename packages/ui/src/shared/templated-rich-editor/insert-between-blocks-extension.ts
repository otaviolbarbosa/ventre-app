import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const pluginKey = new PluginKey("insertBetweenBlocks");

// No `position: absolute`/`left`/`top`/`translate`/`z-index` here on purpose — this
// codebase imports no `.ProseMirror { position: relative }` stylesheet, so an
// absolutely-positioned widget escapes to the single nearest positioned ancestor (the
// editor's scrollable wrapper in templated-rich-editor.tsx) instead of the document
// position ProseMirror actually placed it at. `flex` + `mx-auto` keeps the button in
// normal flow so ProseMirror's own DOM placement — which is correct — determines where
// it visually sits.
const WIDGET_CLASS =
  "mx-auto flex h-4 w-4 items-center justify-center rounded-full border border-input bg-background text-[10px] leading-none text-muted-foreground opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100";

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

            state.doc.forEach((_node, offset) => {
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
              const emptyBlock = view.state.schema.nodeFromJSON({
                type: "templateBlock",
                attrs: { templateId: null, templateScope: null, label: null },
                content: [{ type: "paragraph" }],
              });

              view.dispatch(view.state.tr.insert(insertPos, emptyBlock));
              return true;
            },
          },
        },
      }),
    ];
  },
});
