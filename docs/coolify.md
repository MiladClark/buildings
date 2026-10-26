# استقرار واحدبان روی Coolify

این نسخه با Node.js 24 و Dockerfile مخزن اجرا می‌شود. SQLite و تصاویر گفتگو روی یک volume پایدار در `/app/data` قرار دارند. این معماری برای یک سرور و یک نمونهٔ برنامه است؛ volume دیتابیس را میان چند سرور به اشتراک نگذارید.

## تنظیمات برنامه

- Repository: `https://github.com/MiladClark/buildings`، شاخهٔ `master`
- Build pack: `Dockerfile`، مسیر `/Dockerfile`، Base directory برابر `/`
- پورت داخلی: `3300`، دامنه: `https://vahedban.ir`
- Persistent storage: volume روی `/app/data`؛ پیش از اولین اجرا وصل شود.
- Health check داخل تصویر: `GET /api/health`؛ سلامت اتصال دیتابیس و وجود schema را می‌سنجد.

متغیرهای زیر فقط هنگام اجرا تنظیم شوند؛ build-time و تزریق build arguments خاموش باشد:

```dotenv
DATABASE_URL=file:/app/data/buildings.db
CHAT_UPLOAD_DIR=/app/data/chat-uploads
BETTER_AUTH_URL=https://vahedban.ir
BETTER_AUTH_SECRET=<random-secret-at-least-32-characters>
```

تولید secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. مقدار واقعی را فقط در بخش Environment Variables پنل ذخیره کنید. فایل محیط، دیتابیس محلی و خروجی فیش‌ها داخل Git یا image قرار نمی‌گیرند.

## دیتابیس تازه و ارتقا

فرمان شروع، تمام migrationهای نسخه‌بندی‌شدهٔ `drizzle/` را پیش از بالا آمدن سرور اجرا می‌کند. نصب تازه فقط تنظیمات ساختمان و دسته‌های پایه دارد؛ واحد، حساب، دریافت، هزینه و فیش نمونه ساخته نمی‌شود. اسکریپت `db:seed` توسعه را روی production اجرا نکنید.

اولین ثبت‌نام از `/register` مدیر می‌شود؛ راه‌اندازی حساب مدیر را بلافاصله پس از فعال‌کردن دسترسی دامنه انجام دهید. نام ساختمان، واحدها و اطلاعات بانکی از پنل مدیر وارد می‌شوند. ورود فعلی با شمارهٔ موبایل و رمز است؛ پیامک و تأیید مالکیت شماره متصل نیست.

در استقرارهای بعدی، اطلاعات حفظ می‌شوند و پیش از migration تازه، یک snapshot سازگار در `/app/data/backups/before-migration-*.db` ساخته می‌شود. تغییر محتوای migration اجراشده یا عقب‌بردن نسخه به تاریخچهٔ نامعتبر، شروع برنامه را متوقف می‌کند. SQLite در حالت WAL اجرا می‌شود.

دیتابیس‌های محلی قدیمی که با `db:push` ساخته شده‌اند تاریخچهٔ migration ندارند؛ فرمان شروع عمداً آن‌ها را خودکار بازنویسی نمی‌کند. انتقال دیتابیس قدیمی باید با توقف برنامه، backup، اجرای اسکریپت‌های ارتقای README و تطبیق schema و دفتر مالی در محیط جدا انجام شود. فایل `data/buildings.db` توسعه به سرور منتقل نمی‌شود.

## پشتیبان‌گیری و بازیابی

در Scheduled Tasks برنامه، فرمان زیر روزانه اجرا شود:

```sh
node /app/scripts/production/backup.mjs
```

این فرمان از `VACUUM INTO` برای snapshot سازگار استفاده می‌کند و ۱۴ snapshot دوره‌ای آخر را نگه می‌دارد. snapshotهای پیش از migration خودکار حذف نمی‌شوند. تست بازیابی snapshot در `npm run test:deployment` وجود دارد.

برای تصاویر گفتگو و حفاظت در برابر خرابی سرور، از کل volume نیز در Coolify نسخه بگیرید و مقصد بیرونی S3 را در صورت دسترسی تنظیم کنید. snapshot روی همان سرور، پشتیبان خارج از سرور محسوب نمی‌شود. برای آرشیو سازگار هم‌زمان دیتابیس و تصاویر، گزینهٔ توقف برنامه حین backup را فعال کنید.

برای بازیابی، برنامه را متوقف کنید، ابتدا از volume فعلی backup بگیرید، snapshot سالم را به `/app/data/buildings.db` برگردانید و فایل‌های جانبی قدیمی `buildings.db-wal` و `buildings.db-shm` را فقط در حالت توقف کنار بگذارید. تصاویر همان backup را در `chat-uploads` بازیابی و سپس نسخهٔ سازگار برنامه را اجرا کنید. مالکیت فایل‌ها باید برای کاربر `node` با UID/GID برابر `1000` قابل‌نوشتن باشد. volume تازهٔ Docker مالکیت مسیر ساخته‌شده در image را می‌گیرد؛ bind mount دستی نیاز به تنظیم مالکیت روی سرور دارد.

## دامنه و بررسی انتشار

رکورد A دامنه باید به IP عمومی سرور Coolify اشاره کند. اگر AAAA تعریف شده، باید همان سرور را از IPv6 در دسترس کند. پس از انتشار DNS، HTTPS خودکار Coolify و این مسیرها را بررسی کنید:

```sh
curl --fail https://vahedban.ir/api/health
curl --head https://vahedban.ir/login
```

تا زمان تنظیم DNS، سلامت کانتینر را در پنل Coolify بررسی کنید. وجود تنظیم دامنه در پنل به‌تنهایی به معنی فعال‌شدن دامنه یا صدور گواهی نیست.

## بررسی پیش از انتشار

```sh
npm ci
npm run lint
npx tsc --noEmit
npm test
npm run test:deployment
npm run build
```

`test:deployment` نصب خالی، اجرای مجدد بدون تغییر اطلاعات، بازیابی backup، ارتقا همراه snapshot، تشخیص تغییر تاریخچه و جلوگیری از اجرای migration روی دیتابیس بدون تاریخچه را روی دیتابیس موقت بررسی می‌کند.
