// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SaveBlockTemplateModal } from "./save-block-template-modal";

afterEach(cleanup);

describe("SaveBlockTemplateModal", () => {
  it("calls onConfirm with the entered name on submit", async () => {
    const onConfirm = vi.fn();
    render(
      <SaveBlockTemplateModal
        open
        onOpenChange={() => undefined}
        isPending={false}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.type(screen.getByLabelText("Nome"), "Vitamina D");
    await userEvent.click(screen.getByText("Salvar"));

    expect(onConfirm).toHaveBeenCalledWith("Vitamina D");
  });

  it("does not call onConfirm when the name is empty", async () => {
    const onConfirm = vi.fn();
    render(
      <SaveBlockTemplateModal
        open
        onOpenChange={() => undefined}
        isPending={false}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.click(screen.getByText("Salvar"));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(await screen.findByText("O nome não pode estar vazio")).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when cancelled", async () => {
    const onOpenChange = vi.fn();
    render(
      <SaveBlockTemplateModal
        open
        onOpenChange={onOpenChange}
        isPending={false}
        onConfirm={() => undefined}
      />,
    );

    await userEvent.click(screen.getByText("Cancelar"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
