import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";
import type { InvoiceRecipient } from "./invoice-recipient";
import { formatAllocationBasis } from "@/lib/format/allocation-basis";
import type { InvoiceExplanation } from "./invoice-explanation";
import { renderDetailedInvoiceImage } from "./detailed-invoice-image";

export type InvoiceImageData = {
  buildingName: string;
  periodTitle: string;
  unitLabel: string;
  recipient: InvoiceRecipient;
  dueDate?: string;
  bankAccount?: string | null;
  bankSheba?: string | null;
  total: string;
  expensesTotal?: string;
  charge?: string;
  fund?: boolean;
  explanation?: InvoiceExplanation;
  paid: string;
  paidRial?: number;
  balance: string;
  lines: { title: string; basis: string | null; amount: string }[];
};
/** Pango + HarfBuzz shape Persian and apply the Unicode bidi algorithm. */
export async function renderInvoiceImage(data: InvoiceImageData) {
  if (data.explanation)
    return renderDetailedInvoiceImage(data, data.explanation);
  const width = 1000,
    padding = 62,
    content = width - padding * 2;
  const fontfile = path.join(
    process.cwd(),
    "public/fonts/vazirmatn/ttf/Vazirmatn-Regular.ttf",
  );
  const boldfile = path.join(
    process.cwd(),
    "public/fonts/vazirmatn/ttf/Vazirmatn-Bold.ttf",
  );
  const layers: OverlayOptions[] = [];
  const escape = (s: string) =>
    s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const text = async (
    value: string,
    size: number,
    color: string,
    maxWidth = content,
    bold = false,
  ) =>
    sharp({
      text: {
        text: `<span foreground="${color}">\u200F${escape(value)}</span>`,
        font: `Vazirmatn ${bold ? "Bold " : ""}${size}`,
        fontfile: bold ? boldfile : fontfile,
        width: maxWidth,
        rgba: true,
        dpi: 72,
        // Pango auto-direction mirrors alignment for RTL paragraphs.
        align: "left",
      },
    })
      .png()
      .toBuffer({ resolveWithObject: true });
  const right = async (
    value: string,
    top: number,
    size = 24,
    color = "#202c29",
    bold = false,
    maxWidth = content,
  ) => {
    const r = await text(value, size, color, maxWidth, bold);
    layers.push({ input: r.data, left: width - padding - r.info.width, top });
    return r.info.height;
  };
  const left = async (
    value: string,
    top: number,
    size = 23,
    color = "#202c29",
    maxWidth = 300,
  ) => {
    const r = await text(value, size, color, maxWidth);
    layers.push({ input: r.data, left: padding, top });
    return r.info.height;
  };
  const rule = async (top: number) =>
    layers.push({
      input: await sharp({
        create: {
          width: content,
          height: 1,
          channels: 4,
          background: "#e0e8e2",
        },
      })
        .png()
        .toBuffer(),
      top,
      left: padding,
    });
  let y = 58;
  y += (await right("هم‌خانه.", y, 40, "#26745d", true)) + 35;
  y += (await right(data.buildingName, y, 31, "#202c29", true)) + 23;
  y += (await right(data.periodTitle, y, 24)) + 19;
  y +=
    (await right(
      `سررسید پرداخت: ${data.dueDate || "تعیین نشده"}`,
      y,
      20,
      "#67756d",
    )) + 28;
  const identityTop = y;
  const identityLabel = await text(
    data.recipient.label,
    18,
    "#67756d",
    content - 230,
  );
  const identityName = await text(
    data.recipient.name || "نام ثبت نشده",
    28,
    "#202c29",
    content - 230,
    true,
  );
  const unitLabel = await text("واحد", 18, "#67756d", 140);
  const unitNumber = await text(data.unitLabel, 32, "#26745d", 140, true);
  const identityHeight = Math.max(
    118,
    identityLabel.info.height + identityName.info.height + 54,
    unitLabel.info.height + unitNumber.info.height + 54,
  );
  layers.push({
    input: await sharp(
      Buffer.from(
        `<svg width="${content}" height="${identityHeight}"><rect x="0.5" y="0.5" width="${content - 1}" height="${identityHeight - 1}" rx="12" fill="#f6f8f6" stroke="#e0e8e2"/><path d="M190 24V${identityHeight - 24}" stroke="#e0e8e2"/></svg>`,
      ),
    )
      .png()
      .toBuffer(),
    left: padding,
    top: identityTop,
  });
  layers.push(
    {
      input: identityLabel.data,
      left: width - padding - 24 - identityLabel.info.width,
      top: identityTop + 24,
    },
    {
      input: identityName.data,
      left: width - padding - 24 - identityName.info.width,
      top: identityTop + 38 + identityLabel.info.height,
    },
    {
      input: unitLabel.data,
      left: padding + 24 + Math.floor((140 - unitLabel.info.width) / 2),
      top: identityTop + 24,
    },
    {
      input: unitNumber.data,
      left: padding + 24 + Math.floor((140 - unitNumber.info.width) / 2),
      top: identityTop + 38 + unitLabel.info.height,
    },
  );
  y += identityHeight + 30;
  for (const line of data.lines) {
    const titleHeight = await right(
      line.title,
      y + 10,
      24,
      "#202c29",
      false,
      490,
    );
    const basisHeight = line.basis
      ? await right(
          formatAllocationBasis(line.basis)!,
          y + titleHeight + 20,
          17,
          "#67756d",
          false,
          490,
        )
      : 0;
    await left(line.amount, y + 17);
    y += Math.max(95, titleHeight + basisHeight + 45);
    await rule(y);
    y += 8;
  }
  y += 26;
  const summaryTop = y;
  const hasPayment = data.paidRial === undefined || data.paidRial > 0;
  const summaryHeight = 145 + (data.charge ? 70 : 0) + (hasPayment ? 115 : 0);
  layers.push({
    input: await sharp({
      create: {
        width: content,
        height: summaryHeight,
        channels: 4,
        background: "#f0f4f2",
      },
    })
      .png()
      .toBuffer(),
    top: summaryTop,
    left: padding,
  });
  const summary = async (
    label: string,
    value: string,
    top: number,
    color = "#202c29",
  ) => {
    const labelImage = await text(label, 22, color, 400);
    const valueImage = await text(value, 23, color, 350);
    layers.push(
      {
        input: labelImage.data,
        left: width - padding - 25 - labelImage.info.width,
        top,
      },
      { input: valueImage.data, left: padding + 25, top },
    );
  };
  await summary(
    data.fund ? "آب و هزینه‌های جداگانه" : "جمع هزینه‌ها",
    data.expensesTotal ?? data.total,
    y + 27,
  );
  let summaryY = y + 84;
  if (data.charge) {
    layers.push({
      input: await sharp({
        create: {
          width: content - 30,
          height: 58,
          channels: 4,
          background: "#ffffff",
        },
      })
        .png()
        .toBuffer(),
      left: padding + 15,
      top: summaryY - 12,
    });
    await summary("شارژ دوره", data.charge, summaryY);
    summaryY += 70;
  }
  await summary(
    hasPayment ? "جمع کل" : "جمع کل قابل پرداخت",
    data.total,
    summaryY,
    "#26745d",
  );
  if (hasPayment) {
    await summary("پرداخت‌شده", data.paid, summaryY + 57);
    await summary("قابل پرداخت", data.balance, summaryY + 114, "#26745d");
  }
  y += summaryHeight + 35;
  if (data.bankAccount)
    y +=
      (await right(`حساب دریافت شارژ: ${data.bankAccount}`, y, 20, "#67756d")) +
      18;
  if (data.bankSheba)
    y += (await right(`شبا: ${data.bankSheba}`, y, 19, "#67756d")) + 18;
  return sharp({
    create: { width, height: y + 50, channels: 4, background: "#ffffff" },
  })
    .composite(layers)
    .png()
    .toBuffer();
}
