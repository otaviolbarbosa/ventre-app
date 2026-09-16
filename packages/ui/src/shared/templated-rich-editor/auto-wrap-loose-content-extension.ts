import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";

const pluginKey = new PluginKey("autoWrapLooseContent");

// Every valid top-level node in this schema is either a `templateBlock` or one of the
// `templateBlockContent`-group types (paragraph/heading/bulletList/orderedList) that also
// double as a block's own content — those are what the "+" widgets leave lying around as
// gap placeholders (see insert-between-blocks-extension.ts, find-gap-paragraph-range.ts).
// A plain name check against "templateBlock" is enough to tell the two apart without
// needing the node type's group list.
function isLooseContent(node: ProseMirrorNode): boolean {
  return node.type.name !== "templateBlock" && node.content.size > 0;
}

// Wraps a top-level paragraph/heading/list the moment it gets real content while sitting
// directly under the doc (i.e. outside any templateBlock) — the leading/trailing/gap
// placeholder paragraphs the rest of this editor already relies on staying empty. Runs as
// an `appendTransaction` (same technique Tiptap's own TrailingNode extension uses) so it
// reacts to typing, paste, or any other doc-changing transaction, and handles one loose
// node per pass — ProseMirror reruns plugin `appendTransaction` hooks until nothing more
// is appended, so any remaining loose siblings (e.g. from a multi-paragraph paste) get
// wrapped in their own follow-up passes.
export const AutoWrapLooseContent = Extension.create({
  name: "autoWrapLooseContent",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;

          const found: { pos: number; node: ProseMirrorNode }[] = [];
          newState.doc.forEach((node, offset) => {
            if (found.length === 0 && isLooseContent(node)) found.push({ pos: offset, node });
          });
          const loose = found[0];
          if (!loose) return null;

          const $from = newState.doc.resolve(loose.pos + 1);
          const $to = newState.doc.resolve(loose.pos + loose.node.nodeSize - 1);
          const range = $from.blockRange($to);
          if (!range) return null;

          const templateBlockType = newState.schema.nodes.templateBlock;
          if (!templateBlockType) return null;

          const tr = newState.tr;
          tr.wrap(range, [
            {
              type: templateBlockType,
              attrs: { templateId: null, templateScope: null, label: null },
            },
          ]);
          return tr;
        },
      }),
    ];
  },
});
