import path from "node:path";
import { PDF_FONT_FAMILY } from "@/lib/contract-pdf-fonts";
import { dayjs } from "@/lib/dayjs";
import type { PartographHeaderInfo } from "@/lib/partograph-header-data";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type PartographPdfData = {
  headerInfo: PartographHeaderInfo;
  imageBuffer: Buffer | null;
  // True when the timeline has events beyond hour 23 from t0 — the template only has 24
  // hour columns, so anything past that is clamped into column 23 and not shown.
  exceedsTemplateWindow: boolean;
};

const LOGO_PATH = path.join(process.cwd(), "src/assets/ventre.png");

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 9,
    padding: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottom: "1 solid #e5e7eb",
  },
  // Height derived from the logo's real aspect ratio (1438x452) — a fixed square would
  // squash it.
  logo: {
    width: 80,
    height: 80 / (1438 / 452),
    marginRight: 12,
  },
  headerInfo: {
    flexGrow: 1,
    alignItems: "flex-end",
  },
  title: {
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "right",
  },
  subtitle: {
    fontSize: 9,
    color: "#6b7280",
    marginTop: 2,
    textAlign: "right",
  },
  // Capped to fit the remaining page height below the header (A4 = 842pt tall, minus
  // 48pt page padding and an ~80-90pt header block — up to 3 subtitle lines when the
  // >24h notice renders — leaves headroom of roughly 710-720pt) so the image never
  // spills onto a second PDF page. Verified against a real render via pdf-lib's
  // getPageCount(). Width is derived from the template's own aspect ratio (595x841)
  // rather than the page's full content width, since @react-pdf/renderer's <Image> has
  // no objectFit support to letterbox/crop it for us.
  partographImage: {
    width: 481,
    height: 680,
  },
  emptyMessage: {
    fontSize: 9,
    color: "#6b7280",
    marginTop: 24,
  },
});

export function PartographPdfDocument({ data }: { data: PartographPdfData }) {
  const { headerInfo, imageBuffer, exceedsTemplateWindow } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image src={LOGO_PATH} style={styles.logo} />
          <View style={styles.headerInfo}>
            <Text style={styles.title}>Partograma — {headerInfo.patientName}</Text>
            <Text style={styles.subtitle}>
              {headerInfo.gestationalAgeLabel
                ? `Idade gestacional: ${headerInfo.gestationalAgeLabel}`
                : "Idade gestacional: não informada"}
              {headerInfo.dueDate
                ? ` · DPP: ${dayjs(headerInfo.dueDate).format("DD/MM/YYYY")}`
                : ""}
            </Text>
            <Text style={styles.subtitle}>
              Modelo clássico (Ministério da Saúde) — gerado em {dayjs().format("DD/MM/YYYY HH:mm")}
            </Text>
            {exceedsTemplateWindow ? (
              <Text style={styles.subtitle}>
                Dados após 24h de acompanhamento não são exibidos no template.
              </Text>
            ) : null}
          </View>
        </View>
        {imageBuffer ? (
          <Image
            src={`data:image/png;base64,${imageBuffer.toString("base64")}`}
            style={styles.partographImage}
          />
        ) : (
          <Text style={styles.emptyMessage}>Sem dados suficientes para gerar o partograma.</Text>
        )}
      </Page>
    </Document>
  );
}
