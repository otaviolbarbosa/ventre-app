import { getWhatsAppTemplate, shortenName } from "@ventre/whatsapp";
import { describe, expect, it } from "vitest";

describe("shortenName", () => {
  it("keeps a preposition attached to the surname that follows it", () => {
    expect(shortenName("Joana da Costa Oliveira")).toBe("Joana da Costa");
  });

  it("drops a plain (non-preposition) third name", () => {
    expect(shortenName("Fernanda Farias Oliveira")).toBe("Fernanda Farias");
  });

  it("handles other pt-BR surname prepositions (de, do, das, dos)", () => {
    expect(shortenName("Maria de Fátima Souza")).toBe("Maria de Fátima");
    expect(shortenName("João do Carmo Lima")).toBe("João do Carmo");
    expect(shortenName("Ana das Neves Costa")).toBe("Ana das Neves");
    expect(shortenName("Pedro dos Santos Silva")).toBe("Pedro dos Santos");
  });

  it("handles single-word foreign particles (van, von, di, du, del, zu, vom)", () => {
    expect(shortenName("Marina van Garten")).toBe("Marina van Garten");
    expect(shortenName("Marina di Fiori")).toBe("Marina di Fiori");
    expect(shortenName("Otto von Bismarck")).toBe("Otto von Bismarck");
    expect(shortenName("Kevin De Bruyne")).toBe("Kevin De Bruyne");
    expect(shortenName("Wernher vom Rath")).toBe("Wernher vom Rath");
  });

  it("handles the Italian combined article (della/delle/degli/dello)", () => {
    expect(shortenName("Marina della Vechia")).toBe("Marina della Vechia");
    expect(shortenName("Paolo delle Alpi")).toBe("Paolo delle Alpi");
  });

  it("keeps two-word particles together (van der, van den, de la, de los)", () => {
    expect(shortenName("Erik van der Sar")).toBe("Erik van der Sar");
    expect(shortenName("Dirk van den Berg")).toBe("Dirk van den Berg");
    expect(shortenName("Marina de la Vechia")).toBe("Marina de la Vechia");
    expect(shortenName("Maria de los Ríos")).toBe("Maria de los Ríos");
  });

  it("leaves a one or two word name untouched", () => {
    expect(shortenName("Joana")).toBe("Joana");
    expect(shortenName("Joana Silva")).toBe("Joana Silva");
  });

  it("collapses extra whitespace", () => {
    expect(shortenName("  Ana   Paula  Souza ")).toBe("Ana Paula");
  });

  it("returns an empty string for an empty name", () => {
    expect(shortenName("")).toBe("");
  });
});

describe("getWhatsAppTemplate name shortening", () => {
  it("shortens patientName and professionalName before building template parameters", () => {
    const template = getWhatsAppTemplate("appointment_scheduled", {
      patientName: "Joana da Costa Oliveira",
      professionalName: "Fernanda Farias Oliveira",
      appointmentType: "Consulta",
      date: "hoje",
      time: "14:00",
      appointmentId: "appointment-1",
    });

    expect(template.parameters).toEqual([
      "Joana da Costa",
      "Consulta",
      "Fernanda Farias",
      "hoje",
      "14:00",
    ]);
  });
});
