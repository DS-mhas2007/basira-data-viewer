# Basira: Your Data Insight

بصيرة منصة بيانات Full-Stack خبير. أبنى تجربة ويب RTL بأساس "بصيرة" (Basira) لتحليل ملفات CSV وXLSX محلياً في المتصفح. استخدم Next.js وTypeScript وTailwind وshadcn/ui.

هذه أول وحدة من مشروع ضخم من الميزات — لا تبني أي شيء من الصفر أكثر — لا إضافة زيادة ولا إزالة حاجة.

الوحدة 1: Upload وPreview

المشكلة:
1. مكوّن رفع ملفات بالسحب والإفلات (Drag & Drop) أو اختيار ملف يدوياً، يدعم CSV وXLSX فقط.
2. تحقق من نوع الملف وحجمه، وارفض أي امتداد غير مدعوم أو امتداد خاطئ.
3. قراءة أول 1000 صف وعرضها في جدول بيانات مع رسائل خطأ مناسبة.

الوحدة 2: DataTable مع Virtual Scrolling

مكوّن DataTable يدعم:
- Virtual scrolling لعرض آلاف الصفوف بكفاءة
- البحث والفرز
- ResizeObserver لارتفاع ديناميكي
- دعم RTL كامل

## التقنيات المستخدمة

- Next.js 14 + TypeScript
- Tailwind CSS + shadcn/ui
- Vitest للاختبارات
- GitHub Actions للـ CI/CD
