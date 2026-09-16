// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SaveBlockChoiceModal } from "./save-block-choice-modal";

afterEach(cleanup);

describe("SaveBlockChoiceModal", () => {
  it("calls onCreateNew when 'Criar novo modelo' is clicked", async () => {
    const onCreateNew = vi.fn();
    render(
      <SaveBlockChoiceModal
        open
        // biome-ignore lint/suspicious/noEmptyBlockStatements: noop callback for test
        onOpenChange={() => {}}
        isPending={false}
        canOverwrite
        // biome-ignore lint/suspicious/noEmptyBlockStatements: noop callback for test
        onSaveCurrent={() => {}}
        onCreateNew={onCreateNew}
      />,
    );

    await userEvent.click(screen.getByText("Criar novo modelo"));
    expect(onCreateNew).toHaveBeenCalledOnce();
  });

  it("calls onSaveCurrent when 'Sobrescrever modelo atual' is clicked", async () => {
    const onSaveCurrent = vi.fn();
    render(
      <SaveBlockChoiceModal
        open
        // biome-ignore lint/suspicious/noEmptyBlockStatements: noop callback for test
        onOpenChange={() => {}}
        isPending={false}
        canOverwrite
        onSaveCurrent={onSaveCurrent}
        // biome-ignore lint/suspicious/noEmptyBlockStatements: noop callback for test
        onCreateNew={() => {}}
      />,
    );

    await userEvent.click(screen.getByText("Sobrescrever modelo atual"));
    expect(onSaveCurrent).toHaveBeenCalledOnce();
  });

  it("hides the overwrite button when canOverwrite is false (global template)", () => {
    render(
      <SaveBlockChoiceModal
        open
        // biome-ignore lint/suspicious/noEmptyBlockStatements: noop callback for test
        onOpenChange={() => {}}
        isPending={false}
        canOverwrite={false}
        // biome-ignore lint/suspicious/noEmptyBlockStatements: noop callback for test
        onSaveCurrent={() => {}}
        // biome-ignore lint/suspicious/noEmptyBlockStatements: noop callback for test
        onCreateNew={() => {}}
      />,
    );

    expect(screen.queryByText("Sobrescrever modelo atual")).not.toBeInTheDocument();
  });
});
