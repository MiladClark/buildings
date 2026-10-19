import { renderInvoiceImage } from "../src/lib/export/invoice-image";
import { writeFile } from "node:fs/promises";
import { formatToman } from "../src/lib/format/money";
async function main() {
  const result = await renderInvoiceImage({
    buildingName: "ساختمان سرو (آزمایشی)",
    periodTitle: "شارژ مهر ۱۴۰۵",
    unitLabel: "۱",
    recipient: { name: "علی رضایی", label: "نام ساکن" },
    dueDate: "۱۴۰۵/۰۸/۱۰",
    bankAccount: "0000-0000-0000-0000",
    total: formatToman(3_887_059),
    paid: formatToman(0),
    balance: formatToman(3_887_059),
    lines: [
      {
        title: "نظافت و نگهداری",
        basis: "۱ از ۸ واحد",
        amount: formatToman(1_562_500),
      },
      { title: "آب ساختمان", basis: "۲ نفر", amount: formatToman(847_059) },
      { title: "آسانسور", basis: "۱ از ۸ واحد", amount: formatToman(725_000) },
      {
        title: "برق مشترک",
        basis: "۱ از ۸ واحد",
        amount: formatToman(437_500),
      },
      {
        title: "تجهیزات و تعمیرات",
        basis: "۱ از ۸ واحد",
        amount: formatToman(315_000),
      },
    ],
  });
  await writeFile("artifacts/invoice-persian.png", result);
  console.log("Persian invoice image rendered.");
}
main();
