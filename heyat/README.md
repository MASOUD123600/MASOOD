# مضیف الزهراء — سامانه تحویل نذری

وب‌اپ مستقل (بدون سرور پولی). روی GitHub Pages اجرا می‌شود و اطلاعات در یک مخزن **خصوصی** گیت‌هاب (`data.json`) ذخیره می‌شود.
روی گوشی از منوی مرورگر «Add to Home screen / افزودن به صفحه اصلی» را بزنید تا مثل اپلیکیشن با آیکون لوگو باز شود.

## راه‌اندازی (یک بار)
1. در گیت‌هاب یک مخزن جدید **Private** بسازید، مثلاً `mozif-data` (خالی، بدون فایل هم مشکلی ندارد).
2. Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token
   - Repository access: Only select repositories → `mozif-data`
   - Permissions → Repository permissions → **Contents: Read and write**
   - Expiration: مثلاً ۱ سال
3. لینک اپ را روی گوشی هر سه ادمین باز کنید، در صفحه تنظیمات: نام مخزن (`MASOUD123600/mozif-data`)، توکن و نام ادمین را وارد کنید.

همه ادمین‌ها هر ۱۵ ثانیه همگام می‌شوند. اگر دو نفر هم‌زمان یک کد را تحویل بزنند، فقط اولی ثبت می‌شود.
اگر گوشی گم شد: توکن را در گیت‌هاب Revoke کنید و توکن تازه بسازید.
