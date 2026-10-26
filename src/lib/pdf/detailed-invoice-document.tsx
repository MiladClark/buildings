import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatToman, toPersianDigits as fa } from "@/lib/format/money";
import type { InvoiceExplanation } from "@/lib/export/invoice-explanation";
import type { InvoiceRecipient } from "@/lib/export/invoice-recipient";
import "./fonts";
const s = StyleSheet.create({
  page: {
    fontFamily: "Vazirmatn",
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 36,
    fontSize: 9,
    lineHeight: "14pt",
    textAlign: "right",
    color: "#202c29",
  },
  running: {
    position: "absolute",
    top: 16,
    right: 36,
    left: 36,
    height: 20,
    fontSize: 7,
    color: "#74807b",
    textAlign: "right",
  },
  brand: {
    fontSize: 21,
    lineHeight: "29pt",
    color: "#26745d",
    fontWeight: 700,
  },
  title: { fontSize: 15, lineHeight: "23pt", fontWeight: 700, marginTop: 4 },
  muted: { fontSize: 8, lineHeight: "13pt", color: "#67756d" },
  identity: {
    marginTop: 10,
    padding: 9,
    backgroundColor: "#f0f4f2",
    borderRadius: 6,
  },
  heading: {
    fontSize: 11,
    fontWeight: 700,
    lineHeight: "17pt",
    marginTop: 12,
    marginBottom: 7,
  },
  header: {
    flexDirection: "row",
    backgroundColor: "#edf4f0",
    paddingVertical: 7,
    paddingHorizontal: 5,
    fontSize: 8,
  },
  row: {
    paddingVertical: 7,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e8e2",
  },
  unit: { width: "23%", textAlign: "left" },
  building: { width: "24%", textAlign: "left" },
  description: { width: "53%", textAlign: "right", paddingLeft: 9 },
  assessment: {
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e8e2",
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  amount: { width: "36%", textAlign: "left" },
  label: { width: "64%", textAlign: "right", paddingLeft: 10 },
  note: { fontSize: 8, lineHeight: "13pt", color: "#67756d", marginTop: 4 },
  summary: {
    marginTop: 12,
    padding: 13,
    backgroundColor: "#edf4f0",
    borderRadius: 6,
  },
  payable: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#ccdcd3",
    fontSize: 12,
    fontWeight: 700,
    color: "#26745d",
  },
  footer: { fontSize: 8, lineHeight: "14pt", marginTop: 8, color: "#67756d" },
  pageNumber: {
    position: "absolute",
    bottom: 20,
    left: 36,
    fontSize: 8,
    width: 100,
    height: 12,
    color: "#67756d",
  },
});
export function DetailedInvoicePdfDocument({
  buildingName,
  periodTitle,
  unitLabel,
  recipient,
  dueDate,
  bankAccount,
  bankSheba,
  totalRial,
  paidRial,
  balanceRial,
  explanation: d,
}: {
  buildingName: string;
  periodTitle: string;
  unitLabel: string;
  recipient: InvoiceRecipient;
  dueDate?: string;
  bankAccount?: string | null;
  bankSheba?: string | null;
  totalRial: number;
  paidRial: number;
  balanceRial: number;
  explanation: InvoiceExplanation;
}) {
  return (
    <Document
      title={`فیش تفصیلی ${periodTitle} واحد ${unitLabel}`}
      author="هم‌خانه"
    >
      <Page size="A4" style={s.page}>
        <View fixed style={s.running}>
          <Text style={{ fontSize: 7, lineHeight: "10pt" }}>
            {buildingName} · واحد {unitLabel} · {periodTitle}
          </Text>
        </View>
        <Text style={s.brand}>هم‌خانه.</Text>
        <Text style={s.title}>صورت‌حساب تفصیلی واحد {unitLabel}</Text>
        <Text style={s.muted}>
          {buildingName} · {periodTitle}
        </Text>
        <View style={s.identity} wrap={false}>
          <Text style={{ fontSize: 12, fontWeight: 700, lineHeight: "19pt" }}>
            {recipient.label}: {recipient.name || "نام ثبت نشده"}
          </Text>
          <Text style={s.muted}>بازه دوره: {d.periodRange}</Text>
          <Text style={s.muted}>
            سررسید: {dueDate || "تعیین نشده"} · {d.occupancy}
          </Text>
        </View>
        <Text style={s.heading} minPresenceAhead={70}>
          ۱. ریز مخارج ساختمان و سهم محاسباتی واحد
        </Text>
        <View style={s.header}>
          <Text style={s.unit}>سهم محاسباتی واحد</Text>
          <Text style={s.building}>کل هزینه ساختمان</Text>
          <Text style={s.description}>شرح هزینه و تاریخ</Text>
        </View>
        {d.costRows.length ? (
          d.costRows.map((r, i) => (
            <View key={i} style={s.row} wrap={r.title.length > 500}>
              <View style={{ flexDirection: "row" }}>
                <View style={s.unit}>
                  <Text>{formatToman(r.unitRial)}</Text>
                  <Text style={s.muted}>
                    {r.funded
                      ? "داخل شارژ پایه"
                      : r.unitRial === 0
                        ? "سهم واحد: صفر"
                        : "دریافت جداگانه"}
                  </Text>
                </View>
                <Text style={s.building}>{formatToman(r.buildingRial)}</Text>
                <View style={s.description}>
                  <Text style={{ fontWeight: 700 }}>{r.title}</Text>
                  <Text style={s.muted}>
                    {[r.category !== r.title ? r.category : "", r.date]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
              </View>
              <Text style={s.note}>{r.reason}</Text>
            </View>
          ))
        ) : (
          <Text style={s.note}>
            برای این دوره مخارجی ثبت نشده است؛ مبلغ فیش مطابق ردیف‌های محاسبه
            زیر است.
          </Text>
        )}
        <Text style={s.heading} minPresenceAhead={70}>
          ۲. محاسبه مبلغ این فیش
        </Text>
        {d.assessments.map((r, i) => (
          <View key={i} style={s.assessment} wrap={false}>
            <View style={s.amountRow}>
              <Text style={s.amount}>{formatToman(r.amountRial)}</Text>
              <Text style={s.label}>{r.title}</Text>
            </View>
            <Text style={s.note}>{r.reason}</Text>
          </View>
        ))}
        {d.notes.map((note, i) => (
          <Text key={i} style={s.note}>
            {note}
          </Text>
        ))}
        <Text style={s.heading} minPresenceAhead={50}>
          ۳. تسویه‌های ثبت‌شده برای این فیش
        </Text>
        {d.payments.length ? (
          d.payments.map((p, i) => (
            <View key={i} style={s.assessment} wrap={false}>
              <View style={s.amountRow}>
                <Text style={s.amount}>{formatToman(p.amountRial)}</Text>
                <Text style={s.label}>{p.title}</Text>
              </View>
              <Text style={s.muted}>{p.date}</Text>
            </View>
          ))
        ) : (
          <Text style={s.note}>
            هنوز پرداخت یا بستانکاری‌ای به این فیش اختصاص داده نشده است.
          </Text>
        )}
        <View wrap={false}>
          <View style={s.summary} wrap={false}>
            <View style={s.amountRow}>
              <Text>{formatToman(totalRial)}</Text>
              <Text>جمع این فیش</Text>
            </View>
            <View style={{ ...s.amountRow, marginTop: 8 }}>
              <Text>{formatToman(paidRial)}</Text>
              <Text>تسویه‌شده بابت این فیش</Text>
            </View>
            <View style={{ ...s.amountRow, ...s.payable }}>
              <Text>{formatToman(balanceRial)}</Text>
              <Text>مانده قابل پرداخت</Text>
            </View>
          </View>
          {d.accountNotes.map((n, i) => (
            <Text key={i} style={s.note}>
              {n}
            </Text>
          ))}
          <View style={s.footer} wrap={false}>
            {bankAccount && <Text>حساب دریافت: {bankAccount}</Text>}
            {bankSheba && <Text>شماره شبا: {bankSheba}</Text>}
            <Text>
              مبلغ قابل پرداخت، مانده همین فیش پس از کسر تسویه‌های ثبت‌شده است.
            </Text>
          </View>
        </View>
        <Text
          fixed
          style={{ ...s.pageNumber, height: 20, lineHeight: "12pt" }}
          render={({ pageNumber, totalPages }) =>
            `${fa(String(pageNumber))} / ${fa(String(totalPages))}`
          }
        />
      </Page>
    </Document>
  );
}
