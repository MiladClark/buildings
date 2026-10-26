# استقرار واحدبان روی Coolify

این نسخه از PostgreSQL 17 و Docker Compose استفاده می‌کند. برنامه، دیتابیس و پشتیبان‌گیری سه سرویس مستقل‌اند. دیتابیس پورت عمومی ندارد و فقط در شبکهٔ خصوصی Compose در دسترس است.

## تنظیمات Coolify

- مخزن: `https://github.com/MiladClark/buildings`، شاخهٔ `master`
- Build pack: `Docker Compose`، فایل `/docker-compose.coolify.yml`، Base directory: `/`
- دامنهٔ سرویس `app`: `https://vahedban.ir:3300`؛ پورت 3300 مقصد داخلی پراکسی است.
- متغیرهای runtime: `POSTGRES_PASSWORD`، `BETTER_AUTH_SECRET`، `BETTER_AUTH_URL=https://vahedban.ir`.
- رمز دیتابیس را به‌صورت hex تصادفی بسازید تا در connection URL بدون escape قابل استفاده باشد.
- build-time بودن متغیرهای واقعی و تزریق build arguments خاموش باشد. توکن Coolify در برنامه لازم نیست.
- اگر سرور به npm دسترسی پایدار ندارد، متغیر عمومی build-time به نام `NPM_REGISTRY` را به mirror قابل‌دسترسی تغییر دهید. پیش‌فرض مخزن رسمی npm است؛ `npm ci` در هر حالت integrity همان lockfile را بررسی می‌کند. این متغیر credential نیست.

Compose سه volume پایدار دارد: `postgres-data` برای PostgreSQL، `uploads` برای تصاویر، و `postgres-backups` برای بکاپ‌ها. آن‌ها را هنگام redeploy حفظ کنید. فرمان `docker compose down -v` داده‌ها را حذف می‌کند.

## انتقال اطلاعات قبلی SQLite

اطلاعات واقعی از Git و image عبور نمی‌کنند. روی دستگاه مبدأ، در حالی که کسی در برنامه دادهٔ تازه وارد نمی‌کند:

```powershell
npm run db:transfer -- file:./data/buildings.db
node scripts/verify-production.mjs data/transfer/production.bundle
```

فرمان اول از SQLite یک snapshot سازگار می‌گیرد و داده‌های ۲۵ جدول و تصاویر فعال گفتگو را در `data/transfer/production.bundle` بسته‌بندی می‌کند. رمزهای هش‌شده، شناسه‌ها، تاریخ‌ها، مبالغ، فیش‌ها و دریافت‌ها حفظ می‌شوند. اطلاعات `preview.db` وارد نمی‌شوند. فایل‌ها و بستهٔ انتقال در `.gitignore` و `.dockerignore` هستند.

برای این انتقال، بستهٔ فشرده به‌صورت مقدار مخفی runtime به نام `INITIAL_IMPORT_BUNDLE` در Coolify ذخیره می‌شود. مقدار بزرگ‌تر از محدودیت env را به این روش منتقل نکنید. برنامه قبل از شروع، migrationهای PostgreSQL را اجرا و سپس بسته را فقط روی دیتابیس خالی وارد می‌کند. در همان تراکنش، تعداد و SHA-256 محتوای تک‌تک جدول‌ها را تطبیق می‌دهد؛ خطا کل تراکنش را rollback می‌کند. برای تصاویر، checksum فایل هم بررسی می‌شود.

اثر انگشت انتقال در `_vahedban_import` ثبت می‌شود. اجرای دوبارهٔ همان بسته داده‌ها را تکرار یا بازنویسی نمی‌کند؛ بستهٔ متفاوت یا مقصد از قبل پرشده رد می‌شود. بعد از مشاهدهٔ موفقیت انتقال در لاگ، `INITIAL_IMPORT_BUNDLE` را از Coolify پاک و یک بار redeploy کنید تا دیگر در محیط کانتینر نباشد.

حساب مدیر موجود منتقل می‌شود؛ با همان شماره/ایمیل و رمز قبلی وارد شوید. به‌علت تغییر secret ممکن است ورود دوباره لازم باشد. روی دیتابیس منتقل‌شده `db:seed` یا fixtureهای preview را اجرا نکنید.

## مهاجرت و سلامت

فقط migrationهای `drizzle/postgresql` در production اجرا می‌شوند. فایل‌های SQLite قدیمی در ریشهٔ `drizzle` سابقهٔ نسخهٔ قبل‌اند. تغییر migration اجراشده یا دیتابیس فاقد تاریخچه، شروع برنامه را متوقف می‌کند. migrationها و تراکنش‌های دفتر مالی قفل PostgreSQL دارند تا اجرای هم‌زمان موجب ثبت دوگانه نشود.

`GET /api/health` اتصال به PostgreSQL و وجود schema را بررسی می‌کند. برنامه فقط بعد از healthy شدن دیتابیس شروع می‌شود و سرویس backup بعد از healthy شدن برنامه اجرا می‌شود.

## پشتیبان و بازیابی

سرویس `backup` در شروع و سپس هر ۲۴ ساعت، با `pg_dump --format=custom` یک snapshot سازگار و یک آرشیو تصاویر می‌سازد. ۱۴ snapshot آخر در volume جدا نگهداری می‌شوند. برای اجرای دستی:

```sh
docker compose -f docker-compose.coolify.yml exec backup /usr/local/bin/vahedban-backup --once
```

بکاپ‌ها در `/backups/<UTC timestamp>/database.dump` و `uploads.tar.gz` هستند. برای حفاظت در برابر خرابی کامل سرور، بکاپ volume را از Coolify به فضای بیرونی مانند S3 نیز منتقل کنید؛ بکاپ محلیِ همین سرور جای آن را نمی‌گیرد.

برای بازیابی، برنامه و backup را متوقف کنید، از مقصد فعلی backup بگیرید، dump را با `pg_restore --clean --if-exists --no-owner` در دیتابیس مقصد بازیابی کنید و تصاویر همان snapshot را به volume `uploads` برگردانید. سپس نسخهٔ سازگار برنامه را اجرا و ورود، مانده‌ها و فیش‌ها را بررسی کنید.

## دامنه

رکورد A دامنهٔ `vahedban.ir` باید به IP عمومی سرور اشاره کند. پس از انتشار DNS، صدور گواهی HTTPS و مسیرهای `/api/health` و `/login` بررسی شوند. تا پیش از تنظیم DNS، وضعیت healthy در Coolify به معنی در دسترس بودن دامنه نیست.

## بررسی محلی

```sh
npm run lint
npx tsc --noEmit
npm test
npm run test:deployment
npm run build
```

تست‌های یکپارچه از PGlite، یعنی موتور PostgreSQL محلی و جدا از داده‌های اصلی، استفاده می‌کنند. تست انتشار انتقال تمام ستون‌ها، rollback، اجرای مجدد، مبالغ بالاتر از integer 32-bit و اعتبار تاریخچه را بررسی می‌کند. می‌توان بستهٔ واقعی را نیز با آرگومان به همین تست داد؛ اطلاعاتی به شبکه ارسال نمی‌شود.
