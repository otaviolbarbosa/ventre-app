# Feature: Contract Management — Phase 2: RichEditor (TipTap)

## Summary

Build a shared `RichEditor` component in `packages/ui/src/shared/rich-editor/` using TipTap v3. The component wraps TipTap's `useEditor` hook and renders a toolbar (FontSize, FontFamily, Bold, Italic, Underline, OrderedList, BulletList, TextAlign) plus a `contenteditable` editor area. It produces and consumes HTML strings, making it consumable by both the contract settings screen (Phase 3) and the patient contract accordion (Phase 4), and compatible with `@react-pdf/renderer` HTML parsing (Phase 5).

## User Story

As a professional using the Ventre platform,
I want to write and format the clauses of my service contract in a rich text editor,
So that my contract looks professional and is formatted exactly as I intend.

## Problem Statement

There is no rich text editor component in the codebase. The contract feature requires one for both the base contract configuration (`/settings/contract`) and per-patient contract editing. A shared component in `packages/ui` ensures consistent behavior, toolbar options, and styling across both use sites.

## Solution Statement

Install TipTap v3 dependencies in `packages/ui`, then create `packages/ui/src/shared/rich-editor/rich-editor.tsx` mirroring the exact structure of existing shared components (e.g., `date-picker`). The component is controlled: accepts `content: string` (HTML) and calls `onChange: (html: string) => void` on every editor update. Toolbar buttons map to TipTap chain commands. The `packages/ui` exports map already covers the new path via `"./shared/*"` — no `package.json` exports changes needed.

## Metadata

| Field            | Value                                                            |
| ---------------- | ---------------------------------------------------------------- |
| Type             | NEW_CAPABILITY                                                   |
| Complexity       | MEDIUM                                                           |
| Systems Affected | packages/ui                                                      |
| Dependencies     | @tiptap/react ~3.x, @tiptap/pm, @tiptap/starter-kit, @tiptap/extension-text-style, @tiptap/extension-text-align, @floating-ui/dom |
| Estimated Tasks  | 3                                                                |

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   No rich text editor exists in the codebase.                                ║
║                                                                               ║
║   ┌────────────────────────────┐                                              ║
║   │  <Textarea />              │  ← plain textarea for any multi-line text   ║
║   │  (no formatting possible)  │                                              ║
║   └────────────────────────────┘                                              ║
║                                                                               ║
║   USER_FLOW: Professional types contract clauses in plain text field.        ║
║   PAIN_POINT: No bold, underline, lists, font size — contract looks          ║
║               unprofessional; cannot replicate Word/Docs formatting.          ║
║   DATA_FLOW: string → state → server action (no HTML structure)              ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   ┌───────────────────────────────────────────────────────────────────────┐  ║
║   │  [Font] [Size] │ [B] [I] [U] │ [≡] [1.] │ [←] [↔] [→] [⇔]          │  ║
║   ├───────────────────────────────────────────────────────────────────────┤  ║
║   │                                                                       │  ║
║   │  <contenteditable area — formatted rich text>                         │  ║
║   │                                                                       │  ║
║   └───────────────────────────────────────────────────────────────────────┘  ║
║                                                                               ║
║   NEW_FEATURE: RichEditor component available as                             ║
║                @ventre/ui/shared/rich-editor                                 ║
║                                                                               ║
║   USER_FLOW: Professional formats contract clauses with toolbar.             ║
║   VALUE_ADD: Professional-looking contracts with bold, underline, lists,     ║
║              custom fonts/sizes — matches Word/Docs formatting quality.       ║
║   DATA_FLOW: HTML string ← editor.getHTML() → onChange → server action      ║
║              → clauses_html column (text) in contracts table                 ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location                                   | Before              | After                                    | User Impact                              |
| ------------------------------------------ | ------------------- | ---------------------------------------- | ---------------------------------------- |
| `packages/ui/src/shared/rich-editor/`      | Does not exist      | RichEditor component with full toolbar   | Available for import in Phase 3 and 4   |
| `@ventre/ui/shared/rich-editor` import     | Import error        | Resolves to RichEditor component         | Phases 3/4 can consume immediately      |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File                                                                  | Lines  | Why Read This                                                    |
| -------- | --------------------------------------------------------------------- | ------ | ---------------------------------------------------------------- |
| P0       | `packages/ui/src/shared/date-picker/date-picker.tsx`                  | all    | EXACT pattern to mirror: "use client", interface, named export   |
| P0       | `packages/ui/src/shared/date-picker/index.ts`                         | all    | EXACT barrel pattern: `export * from './date-picker'`            |
| P0       | `packages/ui/src/shared/searchable-dropdown/searchable-dropdown.tsx`  | 1-48   | Second pattern example; shows `cn()` import path                 |
| P1       | `packages/ui/package.json`                                            | all    | Current deps; add TipTap here; exports map already correct       |
| P1       | `packages/ui/tsconfig.json`                                           | all    | `"bundler"` resolution, `strict: true`, `noUncheckedIndexedAccess` |
| P2       | `apps/web/tailwind.config.ts`                                         | 1-10   | Confirms `../../packages/ui/src/**/*.{ts,tsx}` in content array  |
| P2       | `biome.json` (root)                                                   | all    | `quoteStyle: "double"`, `indentWidth: 2`, `useSortedClasses: warn` |

**External Documentation:**

| Source                                                                                           | Section                  | Why Needed                                                    |
| ------------------------------------------------------------------------------------------------ | ------------------------ | ------------------------------------------------------------- |
| [TipTap React Install v3](https://tiptap.dev/docs/editor/getting-started/install/react)         | Installation + useEditor | Core setup pattern with `immediatelyRender: false`            |
| [TipTap Next.js Install](https://tiptap.dev/docs/editor/getting-started/install/nextjs)         | SSR gotchas              | `immediatelyRender: false` + `"use client"` requirement       |
| [StarterKit v3](https://tiptap.dev/docs/editor/extensions/functionality/starterkit)             | Included extensions      | Bold, Italic, Underline, BulletList, OrderedList all included |
| [TextStyleKit](https://tiptap.dev/docs/editor/extensions/functionality/text-style-kit)          | FontSize + FontFamily    | Both come from `@tiptap/extension-text-style` via TextStyleKit |
| [TextAlign](https://tiptap.dev/docs/editor/extensions/functionality/textalign)                  | Configuration            | Must pass `types: ['heading', 'paragraph']` — silently fails otherwise |
| [Style your editor](https://tiptap.dev/docs/editor/getting-started/style-editor)                | editorProps.attributes   | Tailwind class injection into contenteditable                 |

---

## Patterns to Mirror

**COMPONENT_FILE_STRUCTURE (P0 — copy exactly):**
```typescript
// SOURCE: packages/ui/src/shared/date-picker/date-picker.tsx:1-73
// COPY THIS STRUCTURE:
"use client";

import { SomeIcon } from "lucide-react";
import type React from "react";
// ... other imports

export interface DatePickerProps {
  selected: Date | null;
  onChange: (date: Date | null) => void;
  // ... rest of props
}

export function DatePicker({ selected, onChange, ... }: DatePickerProps) {
  return (
    // JSX
  );
}
```

**BARREL_FILE_PATTERN (P0 — identical to all other shared components):**
```typescript
// SOURCE: packages/ui/src/shared/date-picker/index.ts:1
// COPY THIS PATTERN — single line, no newline after:
export * from './date-picker'
```

**CN_IMPORT_PATTERN (relative path, not alias):**
```typescript
// SOURCE: packages/ui/src/shared/searchable-dropdown/searchable-dropdown.tsx:7
import { cn } from "../../utils/utils";
```

**NAMED_EXPORT_PATTERN (no default exports anywhere in packages/ui):**
```typescript
// SOURCE: packages/ui/src/shared/searchable-dropdown/searchable-dropdown.tsx:35
export function SearchableDropdown<TMultiple extends boolean = false>({
  options,
  value,
  onChange,
  // ...
}: SearchableDropdownProps<TMultiple>) {
```

**INTERFACE_PATTERN (exported, in same file as component):**
```typescript
// SOURCE: packages/ui/src/shared/date-picker/date-picker.tsx:14-23
export interface DatePickerProps {
  selected: Date | null;
  onChange: (date: Date | null) => void;
  placeholderText?: string;
  disabled?: boolean;
  className?: string;
}
```

---

## Files to Change

| File                                                             | Action | Justification                                                            |
| ---------------------------------------------------------------- | ------ | ------------------------------------------------------------------------ |
| `packages/ui/package.json`                                       | UPDATE | Add TipTap v3 dependencies                                               |
| `packages/ui/src/shared/rich-editor/rich-editor.tsx`            | CREATE | RichEditor component with toolbar and editor                             |
| `packages/ui/src/shared/rich-editor/index.ts`                   | CREATE | Barrel re-export: `export * from './rich-editor'`                        |

**No changes needed to:**
- `packages/ui/package.json` exports map (already covers `"./shared/*"`)
- `apps/web/tailwind.config.ts` (already scans `packages/ui/src/**/*.{ts,tsx}`)
- Any `tsconfig.json` (moduleResolution `"bundler"` handles exports map)

---

## NOT Building (Scope Limits)

- **Storybook / visual test page** — PRD says "Success signal: renders in Storybook or test page", but no Storybook exists in this repo. Phase success is validated by TypeScript compilation + consuming the component in Phase 3.
- **Image embedding extension** — not in PRD toolbar spec
- **Table extension** — not in PRD toolbar spec
- **Mention/suggestion extension** — out of scope
- **Collaborative editing** — out of scope
- **Custom toolbar position or floating toolbar** — fixed top toolbar only
- **Character count** — out of scope for v1
- **`editorProps.attributes.id`** for accessibility — can be added in v2 if needed
- **Controlled `shouldRerenderOnTransaction`** as a prop — hardcoded `true` internally; consumers don't configure this

---

## Step-by-Step Tasks

Execute in order. Each task is atomic and independently verifiable.

---

### Task 1: ADD TipTap dependencies to `packages/ui/package.json`

- **ACTION**: UPDATE `packages/ui/package.json` — add TipTap v3 packages to `"dependencies"`
- **IMPLEMENT**: Add the following entries inside the `"dependencies"` object, in alphabetical order (biome enforces sorted imports; keep package.json tidy):
  ```json
  "@floating-ui/dom": "^1.6.0",
  "@tiptap/extension-text-align": "^3.0.0",
  "@tiptap/extension-text-style": "^3.0.0",
  "@tiptap/pm": "^3.0.0",
  "@tiptap/react": "^3.0.0",
  "@tiptap/starter-kit": "^3.0.0",
  ```
- **GOTCHA**: `@floating-ui/dom` is a required peer dependency in TipTap v3 (replaced `tippy.js`); without it, `@tiptap/react` will warn or error at runtime.
- **GOTCHA**: All `@tiptap/*` packages must be on the **same major version**. Mixing v2 and v3 causes runtime conflicts. There are currently zero TipTap packages installed, so this is a fresh install.
- **GOTCHA**: Do NOT add `@tiptap/extension-font-family` or `@tiptap/extension-font-size` as separate packages — in v3, both are bundled inside `@tiptap/extension-text-style` via `TextStyleKit`. Adding the old packages would install v2 alongside v3.
- **GOTCHA**: Do NOT add `@tiptap/extension-underline` — it is included in `StarterKit` v3. Adding it separately is redundant and may cause extension-duplication warnings.
- **VALIDATE**: Run `pnpm install` from the repo root (Turborepo workspace). Verify no peer dependency warnings for TipTap packages.

---

### Task 2: CREATE `packages/ui/src/shared/rich-editor/rich-editor.tsx`

- **ACTION**: CREATE the main component file
- **MIRROR**: `packages/ui/src/shared/date-picker/date-picker.tsx` — exact same structure: `"use client"` at line 1, import block, exported interface, named export function
- **IMPLEMENT** the following component:

```
PROPS INTERFACE:
export interface RichEditorProps {
  content: string            // initial HTML content (e.g., from clauses_html)
  onChange: (html: string) => void   // called with editor.getHTML() on every change
  placeholder?: string       // shown when editor is empty
  disabled?: boolean         // disables editing and toolbar interactions
  className?: string         // forwarded to the outer wrapper div
}

EXTENSIONS:
  - StarterKit (includes Bold, Italic, Underline, BulletList, OrderedList, Heading, Paragraph, etc.)
  - TextStyleKit (from @tiptap/extension-text-style — provides FontSize + FontFamily + TextStyle mark)
  - TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] })

useEditor CONFIGURATION:
  extensions: [StarterKit, TextStyleKit, TextAlign.configure({...})]
  content: content prop
  editorProps: {
    attributes: {
      class: "min-h-[200px] px-4 py-3 text-sm focus:outline-none"
    }
  }
  immediatelyRender: false           ← MANDATORY — prevents Next.js SSR hydration crash
  shouldRerenderOnTransaction: true  ← MANDATORY — toolbar isActive() state updates correctly
  editable: !disabled
  onUpdate: ({ editor }) => onChange(editor.getHTML())

FONT SIZE OPTIONS (for dropdown): ["8px", "10px", "11px", "12px", "14px", "16px", "18px", "20px", "24px"]
FONT FAMILY OPTIONS (for dropdown): ["Inter", "Arial", "Times New Roman", "Georgia", "Courier New"]

TOOLBAR LAYOUT (left to right):
  [FontFamily dropdown] [FontSize dropdown] | separator |
  [Bold] [Italic] [Underline] | separator |
  [BulletList] [OrderedList] | separator |
  [AlignLeft] [AlignCenter] [AlignRight] [AlignJustify]

TOOLBAR BUTTON COMMANDS:
  Bold:          editor.chain().focus().toggleBold().run()
  Italic:        editor.chain().focus().toggleItalic().run()
  Underline:     editor.chain().focus().toggleUnderline().run()
  BulletList:    editor.chain().focus().toggleBulletList().run()
  OrderedList:   editor.chain().focus().toggleOrderedList().run()
  AlignLeft:     editor.chain().focus().setTextAlign('left').run()
  AlignCenter:   editor.chain().focus().setTextAlign('center').run()
  AlignRight:    editor.chain().focus().setTextAlign('right').run()
  AlignJustify:  editor.chain().focus().setTextAlign('justify').run()
  FontFamily:    editor.chain().focus().setFontFamily(family).run()
  FontSize:      editor.commands.setFontSize(size)

ACTIVE STATE CHECK (for toolbar button highlighting):
  Bold:          editor.isActive('bold')
  Italic:        editor.isActive('italic')
  Underline:     editor.isActive('underline')
  BulletList:    editor.isActive('bulletList')
  OrderedList:   editor.isActive('orderedList')
  AlignLeft:     editor.isActive({ textAlign: 'left' })
  AlignCenter:   editor.isActive({ textAlign: 'center' })
  AlignRight:    editor.isActive({ textAlign: 'right' })
  AlignJustify:  editor.isActive({ textAlign: 'justify' })

NULL GUARD:
  if (!editor) return null   ← useEditor returns null on first render
```

- **STYLING APPROACH**: Use Tailwind classes directly. No CSS file imports. The outer wrapper gets a `border border-input rounded-md overflow-hidden` style. Toolbar gets `border-b border-input bg-muted/40 p-1 flex flex-wrap items-center gap-0.5`. Editor area uses `editorProps.attributes.class`. Active toolbar buttons highlighted with `bg-accent text-accent-foreground` vs inactive `hover:bg-accent/50`.
- **ICONS**: Use `lucide-react` for toolbar icons:
  - Bold → `Bold`, Italic → `Italic`, Underline → `Underline`
  - BulletList → `List`, OrderedList → `ListOrdered`
  - AlignLeft → `AlignLeft`, AlignCenter → `AlignCenter`, AlignRight → `AlignRight`, AlignJustify → `AlignJustify`
  - FontFamily/FontSize dropdowns: use `<Select>` from `@ventre/ui/select` OR native `<select>` element with Tailwind classes (prefer native `<select>` to avoid Radix import complexity inside the same package)
- **IMPORTS**: All TipTap imports come from the newly installed packages. `cn` from `"../../utils/utils"`. `lucide-react` is already in `packages/ui/package.json`. `EditorContent` and `useEditor` from `"@tiptap/react"`. `StarterKit` from `"@tiptap/starter-kit"`. `TextStyleKit` from `"@tiptap/extension-text-style"`. `TextAlign` from `"@tiptap/extension-text-align"`.
- **GOTCHA**: `useEditor` returns `null` on the first render (before hydration). Always guard: `if (!editor) return null`.
- **GOTCHA**: `immediatelyRender: false` is not optional — omitting it causes: `"SSR has been detected, please set immediatelyRender explicitly to false"` error at startup.
- **GOTCHA**: `shouldRerenderOnTransaction: true` — without this, toolbar `isActive()` calls don't trigger re-renders in TipTap v3 (changed from v2 default). Toolbar buttons won't highlight as active without it.
- **GOTCHA**: `TextAlign` without `types: ['heading', 'paragraph']` silently does nothing — the extension registers but applies to zero node types.
- **GOTCHA**: FontFamily/FontSize commands require `TextStyle` mark to be present. `TextStyleKit` registers it automatically — do not try to import `TextStyle` separately.
- **GOTCHA**: Biome `useSortedClasses` is set to `"warn"` (nursery rule). Long Tailwind class strings may trigger warnings. Run `npx biome lint --write --unsafe packages/ui/src/shared/rich-editor/rich-editor.tsx` after creating the file to fix ordering.
- **GOTCHA**: Biome `quoteStyle` is `"double"` — use double quotes in all string literals.
- **VALIDATE**: `pnpm check-types` — must pass with zero errors.

---

### Task 3: CREATE `packages/ui/src/shared/rich-editor/index.ts`

- **ACTION**: CREATE the barrel re-export file
- **IMPLEMENT** — single line, exactly matching every other shared component barrel:
  ```ts
  export * from './rich-editor'
  ```
- **MIRROR**: `packages/ui/src/shared/date-picker/index.ts:1` — identical structure
- **GOTCHA**: No newline at end of file is fine; biome does not enforce it here. Do NOT add any other exports.
- **VALIDATE**: `pnpm check-types` — no TypeScript errors. Then verify the import path works:
  ```bash
  grep -r "rich-editor" apps/web/ || echo "Not yet consumed — that is expected at this phase"
  ```

---

## Testing Strategy

This phase has no unit tests (no test infrastructure exists in the project's `packages/ui`). Validation is via TypeScript compilation and manual browser verification in Phase 3 (when the component is first consumed).

### Edge Cases Checklist

- [ ] `content` prop is empty string `""` — editor must render with placeholder text (if provided)
- [ ] `content` prop contains HTML with unknown tags — TipTap parses what it knows, strips unknown
- [ ] `disabled={true}` — editor and all toolbar buttons must be non-interactive
- [ ] FontSize applied to selection then removed — `editor.commands.unsetFontSize()` must work
- [ ] Switching between FontFamily and FontSize in sequence — both apply as separate `style` attributes on the same `<span>`
- [ ] Very long content (multiple pages) — editor should scroll, not overflow the layout
- [ ] `null` guard on `editor` — component must not crash on first render

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
# From repo root:
pnpm check-types

# Fix biome Tailwind class sorting:
npx biome lint --write --unsafe packages/ui/src/shared/rich-editor/rich-editor.tsx
```

**EXPECT**: `pnpm check-types` exits 0, no TypeScript errors. Biome may warn about class sorting — fix with the unsafe command above.

### Level 2: INSTALL VERIFICATION

```bash
# After adding deps to packages/ui/package.json:
pnpm install

# Verify packages installed:
ls node_modules/@tiptap/react 2>/dev/null && echo "OK" || echo "MISSING"
```

**EXPECT**: All `@tiptap/*` packages present in `node_modules`.

### Level 3: IMPORT RESOLUTION CHECK

```bash
# Quick check that the export path resolves correctly
node -e "require.resolve('@ventre/ui/shared/rich-editor')" 2>/dev/null || echo "Cannot resolve from Node directly — OK for bundler moduleResolution"
```

**NOTE**: The `"bundler"` moduleResolution in `packages/ui/tsconfig.json` means TypeScript handles resolution, not Node's `require.resolve`. The real validation is `pnpm check-types` and consuming the import in Phase 3.

### Level 4: NO BROWSER VALIDATION IN THIS PHASE

The component is only validated visually when first consumed in Phase 3 (`/settings/contract` page). The Phase 3 plan must include browser validation of the RichEditor.

---

## Acceptance Criteria

- [ ] `pnpm check-types` exits 0 with zero TypeScript errors
- [ ] `packages/ui/src/shared/rich-editor/rich-editor.tsx` exists with `"use client"` at line 1
- [ ] `packages/ui/src/shared/rich-editor/index.ts` exists with `export * from './rich-editor'`
- [ ] `RichEditorProps` interface is exported and includes at minimum: `content`, `onChange`, `placeholder`, `disabled`, `className`
- [ ] `RichEditor` is exported as a named function (not default export)
- [ ] All 6 required TipTap packages appear in `packages/ui/package.json` `"dependencies"`
- [ ] `useEditor` config includes `immediatelyRender: false` and `shouldRerenderOnTransaction: true`
- [ ] `TextAlign` is configured with `types: ['heading', 'paragraph']`
- [ ] Toolbar covers all PRD-specified controls: FontSize, FontFamily, Bold, Italic, Underline, OrderedList, BulletList, TextAlign

---

## Completion Checklist

- [ ] Task 1: TipTap dependencies added to `packages/ui/package.json`
- [ ] Task 1: `pnpm install` run from root — no peer dep errors
- [ ] Task 2: `rich-editor.tsx` created — mirrors date-picker structure exactly
- [ ] Task 2: All TipTap gotchas applied (`immediatelyRender`, `shouldRerenderOnTransaction`, TextAlign types)
- [ ] Task 2: Biome class sorting fixed with `--unsafe` command
- [ ] Task 3: `index.ts` barrel created
- [ ] Level 1: `pnpm check-types` passes
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk                                                          | Likelihood | Impact | Mitigation                                                                                              |
| ------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------- |
| TipTap v3 breaking change undiscovered in research            | LOW        | MEDIUM | Pin to `^3.0.0` (not latest `*`); `pnpm check-types` will catch most type-level breakages              |
| `immediatelyRender: false` forgotten → SSR crash              | MEDIUM     | HIGH   | Acceptance criteria explicitly checks for it; plan flags it as MANDATORY in two places                  |
| `shouldRerenderOnTransaction` forgotten → toolbar dead        | MEDIUM     | MEDIUM | Acceptance criteria checks for it; easy to add if missed (one-line fix)                                 |
| `TextAlign` types not configured → alignment silently broken  | MEDIUM     | MEDIUM | Acceptance criteria explicitly checks for `types: ['heading', 'paragraph']`                             |
| Biome class-sort warning treated as error by CI               | LOW        | LOW    | `useSortedClasses` is `"warn"`, not `"error"` — non-blocking; fix with `--unsafe` command in Task 2     |
| Mixing TipTap v2 (peer) with v3 packages                     | LOW        | HIGH   | All TipTap packages are new installs; no existing TipTap in monorepo; checked in Phase 2 exploration    |
| FontSize/FontFamily not working (missing TextStyle mark)      | LOW        | MEDIUM | `TextStyleKit` registers `TextStyle` mark automatically — no separate import needed                     |

---

## Notes

- **Why TipTap v3 (not v2)**: Research confirmed v3 is stable (released July 2025), fully supports React 19, and bundles FontSize/FontFamily together in `TextStyleKit` — simpler install surface. v2 is in maintenance mode.
- **FontFamily/FontSize via native `<select>`**: Prefer native `<select>` over Radix `<Select>` for toolbar dropdowns to avoid importing yet another component from within the same package. The toolbar is an internal UI implementation detail, not a user-facing form field.
- **`TextStyleKit` vs individual extensions**: `TextStyleKit` is the v3 meta-extension that bundles `TextStyle` mark + `FontSize` + `FontFamily` + `Color` + `BackgroundColor` + `LineHeight`. Using it instead of individual extensions avoids missing the required `TextStyle` mark (which FontSize/FontFamily depend on).
- **Phase 3 consumption**: Once this phase is done, Phase 3 imports `import { RichEditor } from "@ventre/ui/shared/rich-editor"` and uses it as `<RichEditor content={clausesHtml} onChange={setClausesHtml} placeholder="Escreva as cláusulas do contrato..." />`.
- **Phase 5 HTML compatibility**: `editor.getHTML()` emits standard HTML. FontSize emits `<span style="font-size: 14px">`, FontFamily emits `<span style="font-family: Arial">`, TextAlign emits `style="text-align: center"` on paragraph nodes. The Phase 5 PDF generation plan must handle inline styles when parsing TipTap HTML for `@react-pdf/renderer`.
