import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatToman } from "@/lib/format/money";
import { formatAllocationBasis } from "@/lib/format/allocation-basis";
import type { InvoiceRecipient } from "@/lib/export/invoice-recipient";
import "./fonts";
const styles = StyleSheet.create({
  page: {
    fontFamily: "Vazirmatn",
    padding: 42,
    fontSize: 10,
    color: "#202c29",
    textAlign: "right",
  },
  brand: { fontSize: 24, color: "#26745d", fontWeight: 700 },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#26745d",
    paddingBottom: 14,
    marginBottom: 18,
  },
  subtitle: { fontSize: 10, color: "#74807b", marginTop: 5 },
  recipient: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f6f8f6",
    borderWidth: 1,
    borderColor: "#e0e8e2",
    borderRadius: 8,
    padding: 12,
    marginBottom: 18,
  },
  unitIdentity: {
    width: 72,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#e0e8e2",
    paddingRight: 14,
  },
  recipientIdentity: { flex: 1, paddingLeft: 18, textAlign: "right" },
  identityLabel: { fontSize: 8, color: "#67756d", marginBottom: 6 },
  recipientName: { fontSize: 14, fontWeight: 700, lineHeight: 1.6 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e6ece8",
    paddingVertical: 8,
  },
  label: { width: "62%", textAlign: "right" },
  amount: { width: "38%", textAlign: "left" },
  summary: {
    marginTop: 24,
    padding: 18,
    backgroundColor: "#f0f4f2",
    borderRadius: 8,
  },
  footer: { marginTop: 16, fontSize: 9, color: "#74807b", lineHeight: 1.7 },
  pageNumber: {
    position: "absolute",
    bottom: 24,
    left: 42,
    color: "#74807b",
    fontSize: 8,
  },
});
export function InvoicePdfDocument({
  buildingName,
  periodTitle,
  unitLabel,
  recipient,
  bankAccount,
  bankSheba,
  lines,
  totalRial,
  balanceRial,
  dueDate,
  paidRial = 0,
}: {
  buildingName: string;
  periodTitle: string;
  unitLabel: string;
  recipient: InvoiceRecipient;
  bankAccount?: string | null;
  bankSheba?: string | null;
  lines: { title: string; basis: string | null; amountRial: number }[];
  totalRial: number;
  balanceRial: number;
  dueDate?: string;
  paidRial?: number;
}) {
  return (
    <Document title={`فیش ${periodTitle} واحد ${unitLabel}`} author="هم‌خانه">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>هم‌خانه.</Text>
          <Text style={{ fontSize: 16, fontWeight: 700, marginTop: 12 }}>
            {buildingName}
          </Text>
          <Text style={styles.subtitle}>{periodTitle}</Text>
          {dueDate && (
            <Text style={styles.subtitle}>سررسید پرداخت: {dueDate}</Text>
          )}
        </View>
        <View style={styles.recipient} wrap={false}>
          <View style={styles.unitIdentity}>
            <Text style={styles.identityLabel}>واحد</Text>
            <Text
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#26745d",
                textAlign: "center",
              }}
            >
              {unitLabel}
            </Text>
          </View>
          <View style={styles.recipientIdentity}>
            <Text style={styles.identityLabel}>{recipient.label}</Text>
            <Text style={styles.recipientName}>
              {recipient.name || "نام ثبت نشده"}
            </Text>
          </View>
        </View>
        <View
          style={{
            ...styles.row,
            backgroundColor: "#f0f4f2",
            paddingHorizontal: 8,
          }}
        >
          <Text style={styles.amount}>مبلغ (تومان)</Text>
          <Text style={styles.label}>شرح و مبنای تقسیم هزینه</Text>
        </View>
        {lines.map((l, i) => (
          <View key={i} style={styles.row} wrap={false}>
            <Text style={styles.amount}>{formatToman(l.amountRial)}</Text>
            <View style={styles.label}>
              <Text>{l.title}</Text>
              <Text style={{ fontSize: 8, color: "#74807b", marginTop: 5 }}>
                {formatAllocationBasis(l.basis)}
              </Text>
            </View>
          </View>
        ))}
        <View style={styles.summary} wrap={false}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <Text>{formatToman(totalRial)}</Text>
            <Text>جمع شارژ همین دوره</Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <Text>{formatToman(paidRial)}</Text>
            <Text>تسویه و اعتبار اعمال‌شده</Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              borderTopWidth: 1,
              borderTopColor: "#ced9d1",
              paddingTop: 12,
              fontWeight: 700,
              color: "#26745d",
            }}
          >
            <Text>{formatToman(balanceRial)}</Text>
            <Text>مانده این فیش</Text>
          </View>
        </View>
        <View style={styles.footer} wrap={false}>
          {bankAccount && <Text>حساب دریافت شارژ: {bankAccount}</Text>}
          {bankSheba && <Text>شماره شبا: {bankSheba}</Text>}
          <Text>پس از واریز، شماره پیگیری را در پنل ساکن ثبت کنید.</Text>
          <Text>
            این فیش فقط هزینه همین دوره را پوشش می‌دهد. مانده کل حساب در پنل
            واحد نمایش داده می‌شود.
          </Text>
        </View>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
