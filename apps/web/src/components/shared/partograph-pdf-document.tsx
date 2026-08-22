import type { PartographHeaderInfo } from "@/lib/partograph-header-data";
import { PDF_FONT_FAMILY } from "@/lib/contract-pdf-fonts";
import { dayjs } from "@/lib/dayjs";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import path from "node:path";

export type PartographPdfData = {
  headerInfo: PartographHeaderInfo;
  imageBuffer: Buffer | null;
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
  logo: {
    width: 48,
    height: 48,
    marginRight: 12,
  },
  headerInfo: {
    flexGrow: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 9,
    color: "#6b7280",
    marginTop: 2,
  },
  partographImage: {
    width: 545,
  },
  emptyMessage: {
    fontSize: 9,
    color: "#6b7280",
    marginTop: 24,
  },
});

export function PartographPdfDocument({ data }: { data: PartographPdfData }) {
  const { headerInfo, imageBuffer } = data;

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
              {headerInfo.dueDate ? ` · DPP: ${dayjs(headerInfo.dueDate).format("DD/MM/YYYY")}` : ""}
            </Text>
            <Text style={styles.subtitle}>
              Modelo classico (Ministerio da Saude) — gerado em {dayjs().format("DD/MM/YYYY HH:mm")}
            </Text>
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
