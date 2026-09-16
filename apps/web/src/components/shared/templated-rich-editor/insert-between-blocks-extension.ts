import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const pluginKey = new PluginKey("insertBetweenBlocks");

const WIDGET_CLASS =
  "absolute left-1/2 top-0 z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-input bg-background text-xs text-muted-foreground opacity-0 transition-opacity hover:opacity-100 hover:text-foreground focus-visible:opacity-100";

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
    return [
      new Plugin({
        key: pluginKey,
        props: {
          decorations: (state) => {
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
              Decoration.widget(endPos, () => makeInsertWidget(endPos), {
                side: 1,
                key: "insert-end",
              }),
            );

            return DecorationSet.create(state.doc, decorations);
          },
          handleDOMEvents: {
            click: (view, event) => {
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
