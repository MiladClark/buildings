import { Building2, Receipt, ShieldCheck, Users } from "lucide-react";
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden border-l border-border bg-secondary/70 px-14 py-12 lg:flex xl:px-20">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 size={28} strokeWidth={2.5} />
          </span>
          <span className="text-2xl font-extrabold">واحدبان.</span>
        </div>
        <div className="my-14">
          <span className="mb-8 inline-block border-r-2 border-primary pr-3 text-xs text-primary">
            مدیریت ساختمان، با خیال راحت
          </span>
          <p className="text-[54px] font-extrabold leading-[1.65] tracking-tight xl:text-[64px]">
            حساب روشن.
            <br />
            همسایگی آرام.
          </p>
          <p className="mt-7 max-w-sm text-sm leading-8 text-muted-foreground">
            هزینه‌ها را منصفانه تقسیم کنید، شارژ را به‌موقع بگیرید و حساب‌وکتاب
            ساختمان را همیشه در دسترس داشته باشید.
          </p>
          <div className="mt-12 space-y-5">
            {[
              {
                icon: Receipt,
                title: "سهم دقیق هر واحد",
                text: "بر اساس نفرات، واحدها و شرایط سکونت",
              },
              {
                icon: Users,
                title: "همه در جریان حساب‌ها",
                text: "فیش و سابقه پرداخت در پنل هر همسایه",
              },
              {
                icon: ShieldCheck,
                title: "گزارش‌های قابل پیگیری",
                text: "از قبض آب تا هزینه تعمیرات و نظافت",
              },
            ].map((r) => (
              <div key={r.title} className="flex items-center gap-4">
                <r.icon size={23} strokeWidth={1.75} className="text-primary" />
                <div>
                  <p className="text-[13px] font-semibold">{r.title}</p>
                  <p className="mt-1.5 text-[13px] text-muted-foreground">
                    {r.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[13px] text-muted-foreground">
          توسعه و طراحی با میلاد رضاپور
        </p>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[370px]">
          <div className="mb-10 flex items-center gap-2 text-lg font-bold lg:hidden">
            <Building2 size={24} className="text-primary" />
            واحدبان.
          </div>
          {children}
          <p className="mt-8 text-center text-[12px] text-muted-foreground lg:hidden">
            توسعه و طراحی با میلاد رضاپور
          </p>
        </div>
      </section>
    </div>
  );
}
