import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";
import {
  formatToman,
  formatTomanNumber,
  toPersianDigits as fa,
} from "@/lib/format/money";
import type { PeriodExpensesReport } from "./period-expenses";
import { periodExpenseSummaries } from "./period-expenses-summary";

export async function renderPeriodExpensesImage(report: PeriodExpensesReport) {
  const width = 1200,
    padding = 64,
    content = width - padding * 2;
  const layers: OverlayOptions[] = [];
  const text = async (
    value: string,
    top: number,
    options: {
      right?: number;
      left?: number;
      center?: number;
      width?: number;
      size?: number;
      bold?: boolean;
      color?: string;
    } = {},
  ) => {
    const escaped = value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
    const bold = options.bold ?? false;
    const rendered = await sharp({
      text: {
        text: `<span foreground="${options.color ?? "#202c29"}">\u200F${escaped}</span>`,
        font: `Vazirmatn ${bold ? "Bold " : ""}${options.size ?? 23}`,
        fontfile: path.join(
          process.cwd(),
          `public/fonts/vazirmatn/ttf/Vazirmatn-${bold ? "Bold" : "Regular"}.ttf`,
        ),
        width: options.width ?? content,
        rgba: true,
        dpi: 72,
        align: "left",
      },
    })
      .png()
      .toBuffer({ resolveWithObject: true });
    const left =
      options.left ??
      (options.center !== undefined
        ? Math.round(options.center - rendered.info.width / 2)
        : (options.right ?? width - padding) - rendered.info.width);
    layers.push({ input: rendered.data, left, top });
    return rendered.info.height;
  };
  const box = async (top: number, height: number, fill: string, radius = 0) => {
    layers.push({
      input: await sharp(
        Buffer.from(
          `<svg width="${content}" height="${height}"><rect width="${content}" height="${height}" rx="${radius}" fill="${fill}"/></svg>`,
        ),
      )
        .png()
        .toBuffer(),
      left: padding,
      top,
    });
  };
  let y = 52;
  y +=
    (await text("هم‌خانه.", y, { size: 38, bold: true, color: "#26745d" })) +
    24;
  y += (await text("ریز هزینه‌های دوره", y, { size: 32, bold: true })) + 15;
  y +=
    (await text(report.buildingName, y, { size: 23, color: "#67756d" })) + 26;
  const metaTop = y,
    metaStart = layers.length;
  y += 22;
  y +=
    (await text(report.periodTitle, y, {
      size: 26,
      bold: true,
      right: width - padding - 24,
      width: content - 48,
    })) + 13;
  y +=
    (await text(`بازه دوره: ${report.startDate} تا ${report.endDate}`, y, {
      size: 20,
      right: width - padding - 24,
      width: content - 48,
    })) + 13;
  y +=
    (await text(`وضعیت دوره: ${report.statusLabel}`, y, {
      size: 19,
      right: width - padding - 24,
      color: report.draft ? "#956925" : "#26745d",
    })) + 22;
  const metaText = layers.splice(metaStart);
  await box(metaTop, y - metaTop, "#f0f4f2", 12);
  layers.push(...metaText);
  y += 26;
  const descriptionRight = width - padding - 68,
    descriptionWidth = descriptionRight - 514,
    dateCenter = 409,
    indexCenter = width - padding - 22;
  await box(y, 48, "#edf4f0", 6);
  await text("مبلغ (تومان)", y + 14, {
    left: padding + 12,
    size: 18,
    width: 230,
  });
  await text("تاریخ", y + 14, { center: dateCenter, size: 18, width: 170 });
  await text("شرح و دسته هزینه", y + 14, {
    right: descriptionRight,
    size: 18,
    width: descriptionWidth,
  });
  await text("ردیف", y + 14, { center: indexCenter, size: 16, width: 48 });
  y += 48;
  for (const [index, item] of report.items.entries()) {
    const top = y + 20;
    const descriptionHeight = await text(item.description, top, {
      right: descriptionRight,
      width: descriptionWidth,
      size: 22,
    });
    const caption = [
      item.category !== item.description ? item.category : "",
      item.fundingLabel,
    ]
      .filter(Boolean)
      .join(" · ");
    const categoryHeight = caption
      ? (await text(caption, top + descriptionHeight + 10, {
          right: descriptionRight,
          width: descriptionWidth,
          size: 17,
          color: "#67756d",
        })) + 10
      : 0;
    const amountHeight = await text(formatTomanNumber(item.amountRial), top, {
      left: padding + 12,
      width: 230,
      size: 22,
    });
    const dateHeight = await text(item.date, top, {
      center: dateCenter,
      width: 170,
      size: 18,
      color: "#67756d",
    });
    await text(fa(String(index + 1)), top, {
      center: indexCenter,
      width: 48,
      size: 18,
      color: "#67756d",
    });
    y += Math.max(
      78,
      descriptionHeight + categoryHeight + 40,
      amountHeight + 40,
      dateHeight + 40,
    );
    await box(y, 1, "#e0e8e2");
    y += 1;
  }
  if (!report.items.length)
    y +=
      (await text("برای این دوره هنوز هزینه‌ای ثبت نشده است.", y + 28, {
        size: 22,
        color: "#67756d",
      })) + 60;
  y += 24;
  const summary = async (
    label: string,
    amount: number,
    strong = false,
    note?: string,
  ) => {
    const start = layers.length;
    const color = strong ? "#ffffff" : "#202c29";
    const labelHeight = await text(label, y + 25, {
      right: width - padding - 24,
      width: 500,
      size: 25,
      bold: true,
      color,
    });
    const amountHeight = await text(formatToman(amount), y + 25, {
      left: padding + 24,
      width: 460,
      size: 27,
      bold: true,
      color,
    });
    let height = Math.max(86, labelHeight + 50, amountHeight + 50);
    if (note)
      height +=
        (await text(note, y + height - 8, {
          right: width - padding - 24,
          width: content - 48,
          size: 19,
          color: "#67756d",
        })) + 18;
    const texts = layers.splice(start);
    await box(y, height, strong ? "#26745d" : "#f0f4f2", 12);
    layers.push(...texts);
    y += height + 12;
  };
  for (const row of periodExpenseSummaries(report))
    await summary(row.label, row.amount, row.strong, row.note);
  y += 36;
  return sharp({
    create: { width, height: y, channels: 4, background: "#ffffff" },
  })
    .composite(layers)
    .png()
    .toBuffer();
}
