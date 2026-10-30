export const notificationKinds = [
  "invoice",
  "charge_due",
  "bill_due",
  "payment",
  "announcement",
  "system",
] as const;
export type NotificationKind = (typeof notificationKinds)[number];
export const notificationLabels: Record<NotificationKind, string> = {
  invoice: "صدور و اصلاح فیش",
  charge_due: "یادآوری شارژ",
  bill_due: "سررسید قبوض ساختمان",
  payment: "وضعیت واریز و پرداخت",
  announcement: "اطلاعیه مدیر",
  system: "اطلاع حساب",
};
export type NotificationPolicy = {
  enabled: boolean;
  pushEnabled: boolean;
  invoice: boolean;
  charge_due: boolean;
  bill_due: boolean;
  payment: boolean;
  announcement: boolean;
  system: boolean;
  hour: number;
  minute: number;
  chargeLeadDays: number[];
  billLeadDays: number[];
  overdueEveryDays: number;
  maxOverdue: number;
};
export const defaultPolicy: NotificationPolicy = {
  enabled: true,
  pushEnabled: true,
  invoice: true,
  charge_due: true,
  bill_due: true,
  payment: true,
  announcement: true,
  system: true,
  hour: 9,
  minute: 0,
  chargeLeadDays: [3, 1, 0],
  billLeadDays: [3, 1, 0],
  overdueEveryDays: 7,
  maxOverdue: 3,
};
export type NotificationPreferences = {
  pushEnabled: boolean;
  invoice: boolean;
  charge_due: boolean;
  bill_due: boolean;
  payment: boolean;
  announcement: boolean;
  system: boolean;
  quietStart: number;
  quietEnd: number;
  showDetails: boolean;
};
export const defaultPreferences: NotificationPreferences = {
  pushEnabled: true,
  invoice: true,
  charge_due: true,
  bill_due: true,
  payment: true,
  announcement: true,
  system: true,
  quietStart: 22,
  quietEnd: 8,
  showDetails: false,
};
