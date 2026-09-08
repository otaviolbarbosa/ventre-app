// @vitest-environment happy-dom
import { dayjs } from "@/lib/dayjs";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useActionMock, toastMock, fetchEvolutionsMock, submitEvolutionMock, submitEditMock } =
  vi.hoisted(() => ({
    useActionMock: vi.fn(),
    toastMock: { success: vi.fn(), error: vi.fn() },
    fetchEvolutionsMock: vi.fn(),
    submitEvolutionMock: vi.fn(),
    submitEditMock: vi.fn(),
  }));

vi.mock("next-safe-action/hooks", () => ({ useAction: useActionMock }));
vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "professional-1" } }) }));
vi.mock("@/actions/get-patient-evolutions-action", () => ({
  getPatientEvolutionsAction: "get-patient-evolutions-action",
}));
vi.mock("@/actions/create-evolution-action", () => ({
  createEvolutionAction: "create-evolution-action",
}));
vi.mock("@/actions/edit-evolution-action", () => ({
  editEvolutionAction: "edit-evolution-action",
}));

import PatientEvolution from "./patient-evolution";

const ownEvolution = {
  id: "evo-own",
  patient_id: "patient-1",
  professional_id: "professional-1",
  content: "Paciente estável, sem queixas",
  created_at: "2026-09-01T10:00:00Z",
  updated_at: "2026-09-03T15:30:00Z",
  is_public: true,
  hasUpdatedContent: true,
  professional: { id: "professional-1", name: "Dra. Ana", avatar_url: null },
};

const otherEvolution = {
  id: "evo-other",
  patient_id: "patient-1",
  professional_id: "professional-2",
  content: "Evolução de outra profissional",
  created_at: "2026-09-02T10:00:00Z",
  updated_at: "2026-09-02T10:00:00Z",
  is_public: true,
  hasUpdatedContent: false,
  professional: { id: "professional-2", name: "Dr. Bruno", avatar_url: null },
};

const evolutionsFixture = [ownEvolution, otherEvolution];

function setupUseAction() {
  useActionMock.mockImplementation((action: string) => {
    if (action === "get-patient-evolutions-action") {
      return {
        execute: fetchEvolutionsMock,
        result: { data: { evolutions: evolutionsFixture } },
        isPending: false,
      };
    }
    if (action === "create-evolution-action") {
      return { executeAsync: submitEvolutionMock, isPending: false };
    }
    if (action === "edit-evolution-action") {
      return { executeAsync: submitEditMock, isPending: false };
    }
    throw new Error(`unexpected action: ${action}`);
  });
}

describe("PatientEvolution", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    setupUseAction();
  });

  it("shows the edit button only on evolutions authored by the current professional", () => {
    render(<PatientEvolution patientId="patient-1" />);

    expect(screen.getAllByRole("button", { name: "Editar evolução" })).toHaveLength(1);
  });

  it("shows the last-edited line only for evolutions with hasUpdatedContent", () => {
    render(<PatientEvolution patientId="patient-1" />);

    const editedFormatted = dayjs(ownEvolution.updated_at).format("DD/MM/YYYY [às] HH:mm");
    expect(screen.getByText(`Última edição: ${editedFormatted}`)).toBeInTheDocument();

    const notEditedFormatted = dayjs(otherEvolution.updated_at).format("DD/MM/YYYY [às] HH:mm");
    expect(screen.queryByText(`Última edição: ${notEditedFormatted}`)).not.toBeInTheDocument();
  });

  it("opens the edit form pre-filled and submits the update", async () => {
    submitEditMock.mockResolvedValue({ data: { evolution: {} } });
    const user = userEvent.setup();

    render(<PatientEvolution patientId="patient-1" />);

    await user.click(screen.getByRole("button", { name: "Editar evolução" }));

    const textarea = await screen.findByPlaceholderText("Descreva a evolução da paciente...");
    expect(textarea).toHaveValue("Paciente estável, sem queixas");

    await user.clear(textarea);
    await user.type(textarea, "Conteúdo corrigido");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(submitEditMock).toHaveBeenCalledWith({
        evolutionId: "evo-own",
        data: { content: "Conteúdo corrigido", is_public: true },
      }),
    );
    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith("Evolução atualizada com sucesso"),
    );
    expect(fetchEvolutionsMock).toHaveBeenCalledWith({ patientId: "patient-1" });
  });

  it("shows an error toast when the edit is rejected (e.g. not the owning professional)", async () => {
    submitEditMock.mockResolvedValue({
      serverError: "JSON object requested, multiple (or no) rows returned",
    });
    const user = userEvent.setup();

    render(<PatientEvolution patientId="patient-1" />);

    await user.click(screen.getByRole("button", { name: "Editar evolução" }));
    const textarea = await screen.findByPlaceholderText("Descreva a evolução da paciente...");
    await user.type(textarea, " (edit)");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        "JSON object requested, multiple (or no) rows returned",
      ),
    );
  });
});
