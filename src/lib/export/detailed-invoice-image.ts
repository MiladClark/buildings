import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";
import type { InvoiceImageData } from "./invoice-image";
import type { InvoiceExplanation } from "./invoice-explanation";
import { formatToman } from "@/lib/format/money";

export async function renderDetailedInvoiceImage(
  data: InvoiceImageData,
  d: InvoiceExplanation,
) {
  const width = 1200,
    padding = 64,
    content = width - padding * 2;
  const layers: OverlayOptions[] = [];
  const text = async (
    value: string,
    top: number,
    options: {
      size?: number;
      bold?: boolean;
      color?: string;
      width?: number;
      left?: number;
      right?: number;
    } = {},
  ) => {
    const escaped = value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
    const rendered = await sharp({
      text: {
        text: `<span foreground="${options.color ?? "#202c29"}">\u200F${escaped}</span>`,
        font: `Vazirmatn ${options.bold ? "Bold " : ""}${options.size ?? 24}`,
        fontfile: path.join(
          process.cwd(),
          `public/fonts/vazirmatn/ttf/Vazirmatn-${options.bold ? "Bold" : "Regular"}.ttf`,
        ),
        width: options.width ?? content,
        rgba: true,
        dpi: 72,
        align: "left",
      },
    })
      .png()
      .toBuffer({ resolveWithObject: true });
    layers.push({
      input: rendered.data,
      top,
      left:
        options.left ??
        (options.right ?? width - padding) - rendered.info.width,
    });
    return rendered.info.height;
  };
  const box = async (
    top: number,
    height: number,
    color = "#f0f4f2",
    radius = 10,
  ) =>
    layers.push({
      input: await sharp(
        Buffer.from(
          `<svg width="${content}" height="${height}"><rect width="${content}" height="${height}" rx="${radius}" fill="${color}"/></svg>`,
        ),
      )
        .png()
        .toBuffer(),
      top,
      left: padding,
    });
  const rule = async (y: number) => box(y, 1, "#e0e8e2", 0);
  let y = 52;
  y +=
    (await text("هم‌خانه.", y, { size: 39, bold: true, color: "#26745d" })) +
    24;
  y +=
    (await text(`صورت‌حساب تفصیلی واحد ${data.unitLabel}`, y, {
      size: 32,
      bold: true,
    })) + 16;
  y +=
    (await text(`${data.buildingName} · ${data.periodTitle}`, y, {
      size: 23,
      color: "#67756d",
    })) + 28;
  const identityTop = y,
    start = layers.length;
  y +=
    (await text(
      `${data.recipient.label}: ${data.recipient.name || "نام ثبت نشده"}`,
      y + 22,
      {
        size: 28,
        bold: true,
        right: width - padding - 24,
        width: content - 48,
      },
    )) + 38;
  for (const label of [
    `بازه دوره: ${d.periodRange}`,
    `سررسید: ${data.dueDate || "تعیین نشده"}`,
    d.occupancy,
  ])
    y +=
      (await text(label, y, {
        size: 20,
        color: "#67756d",
        right: width - padding - 24,
        width: content - 48,
      })) + 12;
  const identityTexts = layers.splice(start);
  await box(identityTop, y - identityTop + 10);
  layers.push(...identityTexts);
  y += 32;
  const heading = async (label: string) => {
    y += (await text(label, y, { size: 27, bold: true })) + 22;
  };
  const paragraph = async (value: string) => {
    y += (await text(value, y, { size: 21, color: "#67756d" })) + 15;
  };
  await heading("۱. ریز مخارج ساختمان و سهم محاسباتی واحد");
  await box(y, 50, "#edf4f0", 4);
  await text("سهم محاسباتی واحد", y + 15, {
    size: 19,
    left: padding + 12,
    width: 240,
  });
  await text("کل هزینه ساختمان", y + 15, {
    size: 19,
    left: padding + 282,
    width: 240,
  });
  await text("شرح هزینه و تاریخ", y + 15, {
    size: 19,
    right: width - padding - 12,
    width: 490,
  });
  y += 62;
  for (const r of d.costRows) {
    const top = y;
    const titleHeight = await text(r.title, top, {
      width: 490,
      bold: true,
      size: 24,
    });
    const dateHeight = await text(
      [r.category !== r.title ? r.category : "", r.date]
        .filter(Boolean)
        .join(" · "),
      top + titleHeight + 10,
      { width: 490, size: 18, color: "#67756d" },
    );
    const unitHeight = await text(formatToman(r.unitRial), top, {
      left: padding + 12,
      width: 240,
      size: 23,
    });
    const fundingHeight = await text(
      r.funded
        ? "داخل شارژ پایه"
        : r.unitRial === 0
          ? "سهم واحد: صفر"
          : "دریافت جداگانه",
      top + unitHeight + 10,
      {
        left: padding + 12,
        width: 240,
        size: 18,
        color: r.funded ? "#26745d" : "#67756d",
      },
    );
    const costHeight = await text(formatToman(r.buildingRial), top, {
      left: padding + 282,
      width: 240,
      size: 23,
    });
    y +=
      Math.max(
        titleHeight + dateHeight + 12,
        unitHeight + fundingHeight + 12,
        costHeight,
      ) + 16;
    y += (await text(r.reason, y, { size: 20, color: "#67756d" })) + 20;
    await rule(y);
    y += 22;
  }
  if (!d.costRows.length)
    await paragraph(
      "برای این دوره مخارجی ثبت نشده است؛ مبلغ فیش مطابق ردیف‌های محاسبه زیر است.",
    );
  y += 8;
  await heading("۲. محاسبه مبلغ این فیش");
  for (const row of d.assessments) {
    const titleHeight = await text(row.title, y, {
      size: 25,
      bold: true,
      width: 650,
    });
    const amountHeight = await text(formatToman(row.amountRial), y, {
      left: padding,
      width: 350,
      size: 25,
      bold: true,
    });
    y += Math.max(titleHeight, amountHeight) + 13;
    await paragraph(row.reason);
    await rule(y);
    y += 21;
  }
  for (const note of d.notes) await paragraph(note);
  y += 12;
  await heading("۳. تسویه‌های ثبت‌شده برای این فیش");
  if (!d.payments.length)
    await paragraph(
      "هنوز پرداخت یا بستانکاری‌ای به این فیش اختصاص داده نشده است.",
    );
  for (const p of d.payments) {
    const titleHeight = await text(p.title, y, { width: 650, size: 24 });
    const amountHeight = await text(formatToman(p.amountRial), y, {
      left: padding,
      width: 350,
      size: 24,
    });
    y += Math.max(titleHeight, amountHeight) + 10;
    await paragraph(p.date);
    await rule(y);
    y += 20;
  }
  y += 18;
  const totalRows = [
    { label: "جمع این فیش", value: data.total },
    { label: "تسویه‌شده بابت این فیش", value: data.paid },
    { label: "مانده قابل پرداخت", value: data.balance, strong: true },
  ];
  for (const row of totalRows) {
    const rowStart = layers.length;
    const color = row.strong ? "#ffffff" : "#202c29";
    const labelHeight = await text(row.label, y + 25, {
      right: width - padding - 24,
      width: 560,
      size: row.strong ? 28 : 25,
      bold: true,
      color,
    });
    const amountHeight = await text(row.value, y + 25, {
      left: padding + 24,
      width: 420,
      size: row.strong ? 29 : 26,
      bold: true,
      color,
    });
    const height = Math.max(labelHeight, amountHeight) + 50;
    const texts = layers.splice(rowStart);
    await box(y, height, row.strong ? "#26745d" : "#f0f4f2");
    layers.push(...texts);
    y += height + 12;
  }
  y += 14;
  for (const note of d.accountNotes) await paragraph(note);
  for (const note of [
    data.bankAccount ? `حساب دریافت: ${data.bankAccount}` : "",
    data.bankSheba ? `شماره شبا: ${data.bankSheba}` : "",
    "مبلغ قابل پرداخت، مانده همین فیش پس از کسر تسویه‌های ثبت‌شده است.",
  ].filter(Boolean))
    await paragraph(note);
  return sharp({
    create: { width, height: y + 40, channels: 4, background: "#ffffff" },
  })
    .composite(layers)
    .png()
    .toBuffer();
}
