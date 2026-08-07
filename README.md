# Basira: Your Data Insight

أنت مهندس برمجيات Full-Stack خبير. ابنِ تطبيق ويب عربي RTL باسم "بصيرة" (Basira) لتحليل ملفات CSV وXLSX محلياً في المتصفح. استخدم Next.js وTypeScript وTailwind وshadcn/ui.

هذه أول وحدة فقط من مشروع أكبر — لا تبني أي شيء إضافي غير المطلوب هنا.

الوحدة 1: Upload وPreview

المطلوب:
1. مكون رفع ملفات بالسحب والإفلات (Drag & Drop) أو اختيار ملف يدوياً، يدعم CSV وXLSX فقط.
2. تحقق من نوع الملف وحجمه، وارفض أي امتداد غير مدعوم مع رسالة خطأ واضحة بالعربية.
3. اعرض حالة تحميل (loading state) أثناء قراءة الملف.
4. اقرأ الملف بالكامل محلياً في المتصفح (بدون رفعه لأي خادم).
5. إذا كان الملف XLSX يحتوي أكثر من ورقة عمل واحدة، اعرض قائمة منسدلة لاختيار الورقة.
6. أنشئ مكون DataTable يعرض أول 100 صف فقط من البيانات، مع إمكانية فرز (sort) بسيط عند الضغط على رأس العمود، وحقل بحث/تصفية (filter) بسيط فوق الجدول.
7. اعرض شريط معلومات فوق الجدول يوضح: اسم الملف، حجمه، عدد الصفوف الكلي، عدد الأعمدة.
8. الواجهة بالكامل RTL بالعربية، مع الحفاظ على أسماء الأعمدة والأرقام كما هي (LTR داخل الخلايا عند الحاجة).
9. لا تضف أي اتصال بالذكاء الاصطناعي أو أي معالجة تحليلية في هذه المرحلة — فقط رفع، قراءة، وعرض.
10. أضف حالات فارغة (empty state) واضحة قبل رفع أي ملف، وحالة خطأ واضحة إذا فشلت القراءة.

استخدم مكتبة مناسبة لقراءة XLSX في المتصفح (مثل SheetJS/xlsx) وPapaparse لملفات CSV.

لا تبني قاعدة بيانات أو مصادقة أو أي صفحات أخرى. فقط صفحة رئيسية واحدة تحتوي هذه الوظيفة.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ed0c2be7-a168-45eb-af37-148ee1349602).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
