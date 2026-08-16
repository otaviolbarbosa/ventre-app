import path from "node:path";
import { PDF_FONT_FAMILY } from "@/lib/contract-pdf-fonts";
import { Document, Image, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 10,
    paddingTop: 90,
    paddingBottom: 56,
    paddingLeft: 60,
    paddingRight: 60,
    lineHeight: 1.5,
  },
  header: {
    position: "absolute",
    top: 32,
    left: 60,
    right: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1 solid #e5e7eb",
    paddingBottom: 12,
  },
  headerLogo: {
    height: 24,
    width: 72,
    objectFit: "contain",
  },
  headerText: {
    fontSize: 8,
    color: "#6b7280",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 60,
    right: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTop: "1 solid #e5e7eb",
    paddingTop: 8,
  },
  footerLogo: {
    height: 16,
    width: 48,
    objectFit: "contain",
  },
  footerText: {
    fontSize: 7,
    color: "#9ca3af",
  },
  section: {
    paddingBottom: 20,
    marginBottom: 20,
    borderBottom: "1 solid #e5e7eb",
  },
  h1: {
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 8,
  },
  bodyText: {
    marginBottom: 2,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  bulletMarker: {
    width: 12,
  },
  bulletText: {
    flex: 1,
  },
  muted: {
    color: "#6b7280",
  },
  signerRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  signerCheck: {
    width: 16,
    color: "#059669",
    fontWeight: "bold",
  },
  signerDetails: {
    flex: 1,
  },
  signerName: {
    fontWeight: "semibold",
  },
  auditEntry: {
    flexDirection: "row",
    marginBottom: 10,
  },
  auditTimestamp: {
    width: 110,
    color: "#6b7280",
  },
  auditBody: {
    flex: 1,
  },
  auditSubtext: {
    color: "#6b7280",
    marginTop: 2,
  },
  legalNotice: {
    marginTop: 8,
    paddingTop: 12,
    borderTop: "1 solid #e5e7eb",
  },
  link: {
    color: "#2563eb",
  },
});

export type CertificateSigner = {
  name: string;
  cpf: string;
  roleLabel: "CONTRATANTE" | "CONTRATADA";
  representing: string | null;
};

export type CertificateAuditEntry = {
  timestampLabel: string;
  text: string;
  subtext?: string;
};

export type ContractCertificateData = {
  documentName: string;
  documentId: string;
  documentVerificationCode: string;
  originalHash: string;
  generatedAtLabel: string;
  verificationUrl: string;
  signers: CertificateSigner[];
  auditEntries: CertificateAuditEntry[];
};

const LOGO_PATH = path.join(process.cwd(), "src/assets/ventre.png");

function BulletItem({ children }: { children: ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletMarker}>{"•"}</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

export function ContractCertificateDocument({ data }: { data: ContractCertificateData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <Image src={LOGO_PATH} style={styles.headerLogo} />
          <Text style={styles.headerText}>Certificado de autenticidade eletrônica</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.bodyText}>
            Este certificado integra o documento {data.documentName} e comprova sua autenticidade,
            validade e integridade, nos termos da MP 2.200-2/2001 e da legislação aplicável às
            assinaturas eletrônicas no Brasil.
          </Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.h1}>Códigos de Identificação</Text>
          <BulletItem>
            Código de verificação do documento: {data.documentVerificationCode}
          </BulletItem>
          <BulletItem>Identificador do documento: {data.documentId}</BulletItem>
          <BulletItem>
            Hash do documento original (código que garante que o conteúdo não foi alterado):{" "}
            {data.originalHash}
          </BulletItem>
        </View>

        <View style={styles.section}>
          <Text style={styles.h1}>Assinaturas coletadas</Text>
          {data.signers.map((signer) => (
            <View key={`${signer.roleLabel}-${signer.name}`} style={styles.signerRow}>
              <Text style={styles.signerCheck}>{"✓"}</Text>
              <View style={styles.signerDetails}>
                <Text style={styles.signerName}>{signer.name}</Text>
                <Text style={styles.muted}>
                  {signer.cpf ? `CPF: ${signer.cpf}` : "CPF não informado"}
                </Text>
                <Text style={styles.muted}>
                  Assinou como {signer.roleLabel}
                  {signer.representing ? ` (Representando ${signer.representing})` : ""}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.h1}>Registros comprobatórios coletados</Text>
          {data.auditEntries.map((entry, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: entries are a fixed, ordered audit log
            <View key={index} style={styles.auditEntry}>
              <Text style={styles.auditTimestamp}>{entry.timestampLabel}</Text>
              <View style={styles.auditBody}>
                <Text>{entry.text}</Text>
                {entry.subtext && <Text style={styles.auditSubtext}>{entry.subtext}</Text>}
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.legalNotice, styles.section]}>
          <Text style={styles.h1}>Verificação</Text>
          <Text style={styles.bodyText}>
            Para validar a autenticidade deste documento, acesse:{" "}
            <Link src={data.verificationUrl} style={styles.link}>
              {data.verificationUrl}
            </Link>{" "}
            e envie este arquivo no formulário de verificação.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={{ fontWeight: "bold", marginBottom: 4 }}>
            Este certificado é parte integrante e indissociável do documento {data.documentId}.
          </Text>
          <Text style={styles.bodyText}>Comprovante gerado em {data.generatedAtLabel}.</Text>
        </View>

        <View style={styles.footer} fixed>
          <Image src={LOGO_PATH} style={styles.footerLogo} />
          <Text style={styles.footerText}>{data.documentId}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber}/${totalPages} deste comprovante`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
