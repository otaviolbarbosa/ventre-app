import path from "node:path";
import type { AppliedFeeLineItem } from "@/lib/billing/calculations";
import { formatCurrency } from "@/lib/billing/calculations";
import { formatSaoPauloDateTime } from "@/lib/billing/report-data";
import type { BillingReportData } from "@/lib/billing/report-data";
import { PDF_FONT_FAMILY } from "@/lib/contract-pdf-fonts";
import { dayjs } from "@/lib/dayjs";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 9,
    paddingTop: 40,
    paddingBottom: 40,
    paddingLeft: 40,
    paddingRight: 40,
  },
  header: { marginBottom: 16, paddingBottom: 12, borderBottom: "1 solid #e5e7eb" },
  // Real asset is 1438x452 (ratio ~3.181) — height derived from width to avoid stretching.
  logo: { width: 100, height: 31.4, marginBottom: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between" },
  headerLabel: { fontSize: 8, color: "#6b7280" },
  headerValue: { fontSize: 10, fontWeight: "bold" },
  sectionTitle: { fontSize: 11, fontWeight: "bold", marginTop: 16, marginBottom: 6 },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottom: "1 solid #d1d5db",
    paddingBottom: 4,
    marginBottom: 2,
  },
  tableRow: { flexDirection: "row", borderBottom: "1 solid #f3f4f6", paddingVertical: 4 },
  colPatient: { width: "18%" },
  colDescription: { width: "16%" },
  colInstallment: { width: "7%" },
  colDueDate: { width: "11%" },
  colPaidDate: { width: "11%" },
  colGross: { width: "12%", textAlign: "right" },
  colDiscounts: { width: "14%", paddingLeft: 4, textAlign: "right" },
  colNet: { width: "11%", textAlign: "right" },
  headerCellText: { fontSize: 7, fontWeight: "bold", color: "#6b7280" },
  cellText: { fontSize: 8 },
  cellTextBold: { fontSize: 8, fontWeight: "bold" },
  discountDetailsContainer: { marginTop: 2 },
  discountLine: { fontSize: 6, color: "#6b7280" },
  subtotalRow: { flexDirection: "row", paddingVertical: 4, borderTop: "1 solid #d1d5db" },
  subtotalLabel: {
    fontSize: 8,
    fontWeight: "bold",
    width: "63%",
    textAlign: "right",
    paddingRight: 8,
  },
  totalSection: { marginTop: 16, paddingTop: 8, borderTop: "1 solid #111827" },
});

function formatNegativeMoney(cents: number): string {
  const amount = (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `-R$ ${amount}`;
}

function formatDiscountLine(fee: AppliedFeeLineItem): string {
  const label = fee.fee_type === "percentage" ? `${fee.value}% de ${fee.name}` : fee.name;
  return `${formatNegativeMoney(fee.amountCents)} (${label})`;
}

function sumDiscountCents(discounts: AppliedFeeLineItem[]): number {
  return discounts.reduce((sum, discount) => sum + discount.amountCents, 0);
}

function TableHeader() {
  return (
    <View style={styles.tableHeaderRow}>
      <Text style={[styles.headerCellText, styles.colPatient]}>Gestante</Text>
      <Text style={[styles.headerCellText, styles.colDescription]}>Descrição</Text>
      <Text style={[styles.headerCellText, styles.colInstallment]}>Parcela</Text>
      <Text style={[styles.headerCellText, styles.colDueDate]}>Vencimento</Text>
      <Text style={[styles.headerCellText, styles.colPaidDate]}>Pagamento</Text>
      <Text style={[styles.headerCellText, styles.colGross]}>Bruto</Text>
      <Text style={[styles.headerCellText, styles.colDiscounts]}>Descontos</Text>
      <Text style={[styles.headerCellText, styles.colNet]}>Líquido</Text>
    </View>
  );
}

export function BillingReportPdfDocument({ data }: { data: BillingReportData }) {
  const visibleSections = data.sections.filter((section) => section.rows.length > 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image src={path.join(process.cwd(), "src/assets/ventre.png")} style={styles.logo} />
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerLabel}>Profissional</Text>
              <Text style={styles.headerValue}>{data.professionalName}</Text>
            </View>
            <View>
              <Text style={styles.headerLabel}>Mês de referência</Text>
              <Text style={styles.headerValue}>{data.monthLabel}</Text>
            </View>
            <View>
              <Text style={styles.headerLabel}>Gerado em</Text>
              <Text style={styles.headerValue}>
                {formatSaoPauloDateTime(data.generatedAt, "DD/MM/YYYY [às] HH:mm")}
              </Text>
            </View>
          </View>
        </View>

        {visibleSections.length === 0 ? (
          <Text style={styles.cellText}>Nenhuma cobrança lançada neste mês.</Text>
        ) : (
          visibleSections.map((section) => (
            <View key={section.key}>
              <Text style={styles.sectionTitle}>{section.label}</Text>
              <TableHeader />
              {section.rows.map((row, index) => (
                <View key={`${section.key}-${index}`} style={styles.tableRow}>
                  <Text style={[styles.cellText, styles.colPatient]}>{row.patientName}</Text>
                  <Text style={[styles.cellText, styles.colDescription]}>{row.description}</Text>
                  <Text style={[styles.cellText, styles.colInstallment]}>
                    {row.installmentLabel}
                  </Text>
                  <Text style={[styles.cellText, styles.colDueDate]}>
                    {dayjs(row.dueDate).format("DD/MM/YYYY")}
                  </Text>
                  <Text style={[styles.cellText, styles.colPaidDate]}>
                    {row.paidAt ? formatSaoPauloDateTime(row.paidAt, "DD/MM/YYYY") : "-"}
                  </Text>
                  <Text style={[styles.cellText, styles.colGross]}>
                    {formatCurrency(row.grossAmountCents)}
                  </Text>
                  <View style={styles.colDiscounts}>
                    {row.discounts.length === 0 ? (
                      <Text style={styles.cellText}>-</Text>
                    ) : (
                      <>
                        <Text style={styles.cellText}>
                          {formatNegativeMoney(sumDiscountCents(row.discounts))}
                        </Text>
                        <View style={styles.discountDetailsContainer}>
                          {row.discounts.map((discount) => (
                            <Text key={discount.fee_id} style={styles.discountLine}>
                              {formatDiscountLine(discount)}
                            </Text>
                          ))}
                        </View>
                      </>
                    )}
                  </View>
                  <Text style={[styles.cellText, styles.colNet]}>
                    {formatCurrency(row.netAmountCents)}
                  </Text>
                </View>
              ))}
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>Subtotal {section.label}</Text>
                <Text style={[styles.cellTextBold, styles.colGross]}>
                  {formatCurrency(section.subtotalGrossCents)}
                </Text>
                <View style={styles.colDiscounts} />
                <Text style={[styles.cellTextBold, styles.colNet]}>
                  {formatCurrency(section.subtotalNetCents)}
                </Text>
              </View>
            </View>
          ))
        )}

        <View style={styles.totalSection}>
          <View style={styles.tableRow}>
            <Text style={styles.subtotalLabel}>Total Geral</Text>
            <Text style={[styles.cellTextBold, styles.colGross]}>
              {formatCurrency(data.totalGrossCents)}
            </Text>
            <View style={styles.colDiscounts} />
            <Text style={[styles.cellTextBold, styles.colNet]}>
              {formatCurrency(data.totalNetCents)}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
