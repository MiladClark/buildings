import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import "./fonts";
import {
  formatToman,
  formatTomanNumber,
  toPersianDigits as fa,
} from "@/lib/format/money";
import type { PeriodExpensesReport } from "@/lib/export/period-expenses";
import { periodExpenseSummaries } from "@/lib/export/period-expenses-summary";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Vazirmatn",
    padding: 38,
    paddingBottom: 48,
    fontSize: 9,
    lineHeight: "14pt",
    color: "#202c29",
    textAlign: "right",
  },
  brand: {
    fontSize: 21,
    lineHeight: "30pt",
    fontWeight: 700,
    color: "#26745d",
  },
  title: { fontSize: 17, lineHeight: "25pt", fontWeight: 700, marginTop: 8 },
  building: { fontSize: 10, marginTop: 5, color: "#67756d" },
  meta: {
    marginTop: 15,
    padding: 12,
    backgroundColor: "#f0f4f2",
    borderRadius: 7,
  },
  metaLine: { lineHeight: "16pt" },
  period: {
    fontSize: 11,
    lineHeight: "18pt",
    fontWeight: 700,
    marginBottom: 3,
  },
  manualCharge: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#d8e4dc",
    paddingTop: 8,
    marginTop: 8,
    fontSize: 10,
    lineHeight: "16pt",
    fontWeight: 700,
    color: "#26745d",
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#edf4f0",
    paddingVertical: 9,
    paddingHorizontal: 6,
    marginTop: 16,
    fontSize: 8,
    fontWeight: 700,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e6ece8",
  },
  amount: { width: "25%", textAlign: "left" },
  date: { width: "19%", textAlign: "center", fontSize: 8 },
  description: { width: "49%", paddingHorizontal: 10, textAlign: "right" },
  index: { width: "7%", textAlign: "center", color: "#67756d", fontSize: 8 },
  detail: { fontSize: 8, color: "#67756d", marginTop: 3, lineHeight: "12pt" },
  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#edf4f0",
    borderRadius: 7,
    padding: 15,
    marginTop: 18,
    color: "#26745d",
    fontWeight: 700,
    fontSize: 12,
  },
  footer: { marginTop: 12, fontSize: 8, color: "#67756d" },
  note: { lineHeight: "13pt" },
  pageNumber: {
    position: "absolute",
    bottom: 22,
    left: 38,
    fontSize: 8,
    color: "#67756d",
  },
});

export function PeriodExpensesPdfDocument({
  report,
}: {
  report: PeriodExpensesReport;
}) {
  return (
    <Document title={`ریز هزینه‌های ${report.periodTitle}`} author="هم‌خانه">
      <Page size="A4" style={styles.page}>
        <View fixed>
          <Text style={styles.brand}>هم‌خانه.</Text>
          <Text style={styles.title}>ریز هزینه‌های دوره</Text>
          <Text style={styles.building}>{report.buildingName}</Text>
          <View style={styles.meta}>
            <Text style={styles.period}>{report.periodTitle}</Text>
            <Text style={styles.metaLine}>
              بازه دوره: {report.startDate} تا {report.endDate}
            </Text>
            <Text style={styles.metaLine}>
              وضعیت دوره: {report.statusLabel}
            </Text>
          </View>
          <View style={styles.headerRow}>
            <Text style={styles.amount}>مبلغ (تومان)</Text>
            <Text style={styles.date}>تاریخ</Text>
            <Text style={styles.description}>شرح و دسته هزینه</Text>
            <Text style={styles.index}>ردیف</Text>
          </View>
        </View>
        {report.items.length ? (
          report.items.map((item, index) => (
            <View
              key={index}
              style={styles.row}
              wrap={item.description.length > 500}
            >
              <Text style={styles.amount}>
                {formatTomanNumber(item.amountRial)}
              </Text>
              <Text style={styles.date}>{item.date}</Text>
              <View style={styles.description}>
                <Text style={{ lineHeight: "15pt" }}>{item.description}</Text>
                {(item.category !== item.description || item.fundingLabel) && (
                  <Text style={styles.detail}>
                    {[
                      item.category !== item.description ? item.category : "",
                      item.fundingLabel,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                )}
              </View>
              <Text style={styles.index}>{fa(String(index + 1))}</Text>
            </View>
          ))
        ) : (
          <Text style={{ padding: 24, color: "#67756d" }}>
            برای این دوره هنوز هزینه‌ای ثبت نشده است.
          </Text>
        )}
        <View wrap={false}>
          {periodExpenseSummaries(report).map((row, index) => (
            <View
              key={index}
              style={{
                ...styles.summary,
                marginTop: index ? 8 : 18,
                backgroundColor: row.strong ? "#26745d" : "#edf4f0",
                color: row.strong ? "#ffffff" : "#202c29",
                flexDirection: "column",
                padding: 12,
                fontSize: 11,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text>{formatToman(row.amount)}</Text>
                <Text>{row.label}</Text>
              </View>
              {row.note && (
                <Text
                  style={{
                    fontSize: 8,
                    lineHeight: "14pt",
                    color: "#67756d",
                    marginTop: 8,
                  }}
                >
                  {row.note}
                </Text>
              )}
            </View>
          ))}
        </View>
        <Text
          fixed
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `${fa(String(pageNumber))} / ${fa(String(totalPages))}`
          }
        />
      </Page>
    </Document>
  );
}
