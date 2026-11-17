# ویدیوی رئال ۲۵ ثانیه‌ای — سالن مهسا موسوی

روند کار: **۳ کلیپ ۸ ثانیه‌ای در Google Flow (Veo) ساخته می‌شه → `assemble.py` تدوین می‌کنه** (برش ۹:۱۶، زیرنویس فارسی، ترنزیشن، کارت پایانی سالن) ← حدود **۲۵ ثانیه**.

---

## ۱) ساخت کلیپ‌ها در Google Flow

1. برو به `labs.google/flow` و با اکانت گوگل وارد شو.
2. **New project** ← حالت **Text to Video** ← نسبت تصویر **9:16 (Portrait)**.
3. مدل: **Veo 3.1 Fast** (یا **Lite** اگه کردیت کمه). هر کلیپ ۸ ثانیه.
4. پرامپت‌های پایین رو **انگلیسی و دقیقاً همین‌طور** کپی کن (Veo با انگلیسی خیلی بهتر جواب می‌ده).
5. از هر پرامپت ۲ نسخه بگیر و بهترینش رو دانلود کن (Download ← 720p یا 1080p).

**حساب کردیت (نسخه‌ی رایگان):** طبق منابع غیررسمی، سهمیه حدود ۵۰ کردیت در روزه؛ Lite ≈ ۱۰ و Fast ≈ ۲۰ کردیت برای هر کلیپ. پس:
- با **Lite**: هر ۳ کلیپ در یک روز جا می‌شه (۳۰ کردیت).
- با **Fast**: ۲ کلیپ امروز، ۱ کلیپ فردا.
عدد دقیق رو داخل خود Flow ببین؛ گوگل مرتب عوضش می‌کنه.

> نکته برای یکدست بودن: اگه کلیپ ۳ شخصیت متفاوتی نشون داد، از فریم آخر کلیپ ۲ عکس بگیر و در کلیپ ۳ از حالت **Frames to Video** استفاده کن.

### کلیپ ۱ — هوک: آرامش (۰ تا ۸ ثانیه)
```
Vertical 9:16, photorealistic cinematic commercial. Extreme close-up, slow motion: a woman's bare feet gently lowering into a white ceramic pedicure bowl filled with warm milky water, floating pink rose petals and soft bubbles. Steam rising, water ripples catching warm golden light. Luxurious modern nail salon with blush-pink and cream decor, softly blurred in the background. Slow dolly-in, shallow depth of field, 85mm lens, natural skin texture, elegant and calm mood. Ambient sound: gentle water splash, soft spa atmosphere. No text, no logos, no watermark.
```

### کلیپ ۲ — تحول: جزئیات کار (۸ تا ۱۶ ثانیه)
```
Vertical 9:16, photorealistic macro commercial shot. A professional nail technician wearing white gloves applies glossy pastel-pink polish to a client's toenails with a fine brush, smooth single strokes, then places tiny sparkling rhinestones on the big toe nail with tweezers. Perfect clean cuticles, light reflections gliding across the wet glossy polish. Soft pink and cream salon background, bokeh lights. Slow orbiting camera, 100mm macro lens, ultra-sharp detail, satisfying and precise. Ambient sound: soft brush strokes, quiet salon ambience. No text, no logos, no watermark.
```

### کلیپ ۳ — اوج: همه نگاه‌ها (۱۶ تا ۲۴ ثانیه)
```
Vertical 9:16, photorealistic cinematic street-style commercial. Low tracking shot at ankle level: a stylish woman in an elegant cream outfit walks confidently out of a chic pink nail salon onto a sunny city sidewalk, wearing strappy nude heeled sandals that show her fresh glossy pink pedicure with sparkling rhinestones. The camera slowly tilts up to reveal her confident smile. Passersby turn their heads and smile admiringly, one woman points at her sandals and mouths "wow". Golden hour sunlight, gentle breeze, fashion-commercial look, 35mm lens. Ambient sound: city atmosphere, footsteps of heels. No text, no logos, no watermark.
```

### (اختیاری) موزیک
یه موزیک بی‌کلام شاد از کتابخونه‌ی رایگان اینستاگرام یا YouTube Audio Library بگیر، یا بعداً موقع پست در اینستاگرام اضافه کن.

---

## ۲) تدوین خودکار

فایل‌ها رو `clip1.mp4`، `clip2.mp4` و `clip3.mp4` بذار کنار اسکریپت و اجرا کن:
```bash
python3 assemble.py clip1.mp4 clip2.mp4 clip3.mp4 --music music.mp3 --out final.mp4
```
(بدون `--music` هم کار می‌کنه و صدای خود کلیپ‌ها حفظ می‌شه.) نیازمندی‌ها: Python 3، Pillow و ffmpeg.

**یا ساده‌تر:** هر ۳ کلیپ رو همین‌جا برای من بفرست (آپلود در چت یا داخل ریپو)؛ من تدوین می‌کنم و نسخه‌ی نهایی رو تحویل می‌دم.

خروجی اسکریپت:
- ۸ + ۸ + ۸ ثانیه کلیپ + ۲.۶ ثانیه کارت پایانی، منهای ترنزیشن‌ها ≈ **۲۵.۴ ثانیه**
- زیرنویس‌ها: «یه لحظه فقط برای خودت...» ← «ظرافت تو جزئیات» ← «همه نگاه‌ها به توئه»
- کارت پایانی: «سالن مهسا موسوی / همین امروز نوبت بگیر / @mahsa.mosavi.nail»

---

## ۳) تحقیق: ابزارهای ساخت و تدوین ویدیوی رئال (نوامبر ۲۰۲۶)

### Google Flow / Veo
- **Flow** ابزار فیلم‌سازی گوگل با مدل Veo 3.1 است: Text to Video، Frames to Video (فریم اول و آخر)، Ingredients (ثابت نگه داشتن شخصیت و اشیا)، Extend (ادامه دادن کلیپ) و صدای همزمان.
- **نسخه‌ی رایگان:** بیشتر منابع از حدود ۵۰ کردیت روزانه حرف می‌زنن؛ اشتراک Google AI Pro حدود ۱۰۰۰ کردیت در ماه می‌ده.
- **AI Studio / Gemini API:** طبق صفحه‌ی قیمت‌گذاری (به نقل از منابع ثانویه)، Veo 3.1 از طریق API **سهمیه‌ی رایگان نداره** و پولیه. پس برای کار رایگان، راهش همون Flow از طریق مرورگره.
- **Google Meet** ابزار ساخت ویدیو نیست. منظور احتمالاً **Google Vids** بوده که برای ویدیوهای ارائه‌ای و اداریه، نه رئال سینمایی.

### Higgsfield و اسکیل‌های گیت‌هاب
- **Higgsfield** سرویس پولی و آنلاینه (مدل‌های Seedance، Kling و Cinema Studio). خودش اوپن‌سورس نیست.
- چیزی که در گیت‌هاب اوپن‌سورس شده، **اسکیل‌های پرامپت‌نویسی** برای Claudeه، نه خود مدل ویدیو:
  - [OSideMedia/higgsfield-ai-prompt-skill](https://github.com/OSideMedia/higgsfield-ai-prompt-skill) (MIT، دیگه نگهداری نمی‌شه)
  - [beshuaxian/higgsfield-seedance2-jineng](https://github.com/beshuaxian/higgsfield-seedance2-jineng) (۱۵ اسکیل؛ فریم‌ورک «هوک ۲ ثانیه‌ای»)
  - [AKCodez/higgsfield-claude-skills](https://github.com/AKCodez/higgsfield-claude-skills) (خودکارسازی مرورگر با Playwright)
  - [rediumvex/ai-video-generator-claude](https://github.com/rediumvex/ai-video-generator-claude) (MIT)
- **نتیجه:** نصب این اسکیل‌ها فقط پرامپت‌نویسی رو بهتر می‌کنه؛ برای ساختن خود ویدیو باز هم اکانت و کردیت Higgsfield یا Flow لازمه. پرامپت‌های بالا با همون اصول نوشته شدن: هوک در ۲ ثانیه‌ی اول، زبان دوربین (لنز، حرکت، عمق میدان)، نور، صدا و «No text».

### اصول پرامپت رئال (خلاصه‌ی بهترین روش‌ها)
1. **ساختار:** فرمت + سبک ← سوژه و اکشن ← محیط ← دوربین (نوع نما، لنز، حرکت) ← نور ← صدا ← ممنوعه‌ها.
2. هر کلیپ **فقط یک اکشن اصلی** داشته باشه؛ Veo با چند اتفاق پشت سر هم قاطی می‌کنه.
3. نوشتن «natural skin texture» و لنزهای واقعی (35/85/100mm) رئال‌بودن رو بیشتر می‌کنه.
4. متن و لوگو رو هیچ‌وقت از مدل نخواه (معمولاً خراب می‌شه)؛ متن فارسی رو در تدوین اضافه کن (کار `assemble.py`).
5. از هر پرامپت ۲ تا ۴ نسخه بگیر و بهترین رو انتخاب کن.

### منابع
- [GitHub topic: higgsfield](https://github.com/topics/higgsfield)
- [MindStudio — Google Flow pricing & credits](https://www.mindstudio.ai/blog/google-flow-pricing-credits-tiers-explained)
- [SaaS CRM Review — Is Google Flow free? (50 daily credits)](https://saascrmreview.com/?p=15180)
- [DIYAI — Google Veo pricing: Flow credits, free access & API](https://diyai.io/ai-tools/video-generation/google-veo-pricing/)
- [yingtu.ai — Gemini API free tier limits 2026](https://yingtu.ai/en/blog/google-gemini-api-free-tier-limits-2026)
- [BenchLM — Google AI Studio free tier](https://benchlm.ai/free-tier/google-ai-studio)
