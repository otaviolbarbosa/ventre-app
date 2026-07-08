import path from "node:path";
import type { ContractHeaderBlocks } from "@/lib/contract-header-text";
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import Html from "react-pdf-html";

Font.register({
  family: "Inter",
  fonts: [
    {
      src: path.join(process.cwd(), "public/fonts/Inter-Regular.ttf"),
      fontWeight: "normal",
    },
    {
      src: path.join(process.cwd(), "public/fonts/Inter-Bold.ttf"),
      fontWeight: "bold",
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 11,
    paddingTop: 48,
    paddingBottom: 48,
    paddingLeft: 60,
    paddingRight: 60,
    lineHeight: 1.5,
  },
  title: {
    marginBottom: 16,
    fontSize: 16,
  },
  section: {
    marginBottom: 12,
  },
  label: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  divider: {
    borderBottom: "1 solid #e5e7eb",
    paddingBottom: 12,
    marginBottom: 12,
  },
  bodyText: {
    lineHeight: 0.9,
  },
  signatureSection: {
    marginTop: 32,
  },
  localityLine: {
    textAlign: "center",
    marginBottom: 32,
  },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureColumn: {
    width: "45%",
    alignItems: "center",
  },
  stampSlot: {
    height: 220 / (541 / 195),
    width: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  stampWrapper: {
    position: "relative",
    width: 220,
    height: 220 / (541 / 195),
  },
  stampImage: {
    width: "100%",
    height: "100%",
  },
  stampTextOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "34%",
    right: 10,
    justifyContent: "center",
  },
  stampText: { fontSize: 6, textAlign: "left", lineHeight: 1.3 },
  signatureLine: {
    width: "100%",
    borderBottom: "1 solid #000000",
    marginTop: 8,
  },
  signatureName: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 4,
  },
  signatureLabel: {
    fontSize: 9,
    textAlign: "center",
    marginTop: 2,
    color: "#6b7280",
  },
});

// react-pdf-html renders <li> as a flex row with the bullet in one column and the
// content in another; a <p> inside <li> keeps its default vertical margin, which pushes
// the text below the bullet instead of aligning with it. Strip that wrapper.
function stripListItemParagraphs(html: string): string {
  return html
    .replace(/<li>\s*<p>/gi, "<li>")
    .replace(/<\/p>\s*<\/li>/gi, "</li>")
    .replace(/(?:<\/p>\s*<p>\s*){2,}/gi, "</p><p>");
}

export type ContractPdfData = ContractHeaderBlocks & {
  title: string;
  clausesHtml: string;
  signature?: {
    signedByName: string;
    signedAtLabel: string;
    verificationCode: string;
    verificationUrl: string;
    localityLine: string;
    contratanteName: string;
    contratadaName: string;
  };
};

export function ContractPdfDocument({ data }: { data: ContractPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={[styles.section, styles.title]}>
          <Text style={styles.label}>{data.title}</Text>
        </View>

        <View style={[styles.section, styles.divider]}>
          <Text style={styles.label}>CONTRATANTE:</Text>
          <Text style={styles.bodyText}>{data.contratanteBlock}</Text>
        </View>

        <View style={[styles.section, styles.divider]}>
          <Text style={styles.label}>CONTRATADA:</Text>
          <Text style={styles.bodyText}>{data.contratadaBlock}</Text>
        </View>

        {data.teamMembersBlock && (
          <View style={[styles.section, styles.divider]}>
            <Text style={styles.label}>EQUIPE DE CUIDADO:</Text>
            <Text style={styles.bodyText}>{data.teamMembersBlock}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Html style={{ fontSize: 11, fontFamily: "Inter" }}>
            {stripListItemParagraphs(data.clausesHtml || "<p></p>")}
          </Html>
        </View>

        {data.signature && (
          <View style={styles.signatureSection}>
            <Text style={styles.localityLine}>{data.signature.localityLine}</Text>

            <View style={styles.signatureRow}>
              <View style={styles.signatureColumn}>
                <View style={styles.stampSlot}>
                  <View style={styles.stampWrapper}>
                    <Image
                      src={path.join(process.cwd(), "public/images/digital-signature-stamp.png")}
                      style={styles.stampImage}
                    />
                    <View style={styles.stampTextOverlay}>
                      <Text style={styles.stampText}>
                        Assinado eletronicamente por {data.signature.signedByName}
                      </Text>
                      <Text style={styles.stampText}>{data.signature.signedAtLabel}</Text>
                      <Text style={styles.stampText}>
                        Código de verificação: {data.signature.verificationCode}
                      </Text>
                      <Text style={styles.stampText}>{data.signature.verificationUrl}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureName}>{data.signature.contratadaName}</Text>
                <Text style={styles.signatureLabel}>CONTRATADA</Text>
              </View>

              <View style={styles.signatureColumn}>
                <View style={styles.stampSlot} />
                <View style={styles.signatureLine} />
                <Text style={styles.signatureName}>{data.signature.contratanteName}</Text>
                <Text style={styles.signatureLabel}>CONTRATANTE</Text>
              </View>
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
}
