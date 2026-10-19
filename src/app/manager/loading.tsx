export default function Loading() {
  return (
    <div
      role="status"
      aria-label="در حال بارگذاری اطلاعات ساختمان"
      className="space-y-6 motion-safe:animate-pulse"
    >
      <div className="h-10 w-52 rounded-xl bg-muted" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div className="panel h-40 bg-muted/40" key={i} />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.85fr_1fr]">
        <div className="panel h-[350px] bg-muted/40" />
        <div className="panel h-[350px] bg-muted/40" />
      </div>
      <span className="sr-only">در حال دریافت اطلاعات</span>
    </div>
  );
}
