# MIZYAi — SEO keyword map

> Editorial targeting hypotheses for Arabic search intent, not search-volume or difficulty measurements. The current Search Console sample is too small to establish keyword cannibalization: in the latest 30-day pull, only one query/page row was returned ("ملف csv عربي" → /guide/arabic-csv-excel, 1 impression, 0 clicks). Treat this as an observed example, not proof that other queries do not exist.

| Page | Primary intent / target phrase | Supporting phrases | Page boundary (what this page should own) |
|---|---|---|---|
| / | أداة تحليل البيانات بالعربية | تحليل ملفات البيانات، أداة تحليل Excel، تحليل CSV أونلاين | Product discovery and conversion; explain what MIZYAi does and lead to the app |
| /guide/arabic-csv-excel | طريقة تحليل ملف CSV عربي وExcel داخل المتصفح | استيراد CSV عربي، قراءة ملف Excel، فحص ملف CSV | End-to-end import and first analysis workflow; do not own encoding-only troubleshooting |
| /guide/fix-arabic-encoding | حل مشكلة ترميز CSV العربي | الحروف العربية تظهر رموزاً، UTF-8 في Excel، Windows-1256 | Troubleshooting broken Arabic characters and choosing the correct encoding |
| /guide/data-quality-score | قياس جودة البيانات | درجة جودة البيانات، اكتمال البيانات، اتساق البيانات، القيم الشاذة | Assess data quality and interpret quality dimensions; link to cleaning tasks rather than targeting generic cleaning |
| /guide/ask-data-in-arabic | تحليل البيانات بسؤال عربي وتحويله إلى SQL | اسأل بياناتك بالعربية، تحويل السؤال إلى SQL، مراجعة استعلام SQL | Conversational/AI analysis workflow and verification of generated queries |
| /guide/pivot-alternative | بديل Pivot Table للتقارير المتكررة | بدائل الجداول المحورية، تجميع البيانات، تقارير Excel آلية | Reusable reporting and aggregation when recurring workflows outgrow manual pivots |
| /guide/csv-vs-excel | الفرق بين CSV وExcel | CSV أم XLSX، مقارنة صيغ الملفات، متى أستخدم CSV | Format selection and feature comparison; not a step-by-step import or encoding repair guide |
| /guide/remove-duplicates | إزالة الصفوف المكررة من Excel وCSV | كشف التكرارات، التكرار حسب المفتاح، معالجة الصفوف المكررة | Deduplication decisions and safe cleaning; distinguish from broad quality scoring |
| /guide/data-privacy-browser | خصوصية تحليل البيانات داخل المتصفح | هل يتم رفع ملف Excel، معالجة البيانات محلياً، بيانات الذكاء الاصطناعي | Explain local processing boundaries and what AI features may send to providers |

## Cannibalization controls

- Keep the home page focused on product discovery and conversion; guides should answer a specific task or question.
- Keep one primary intent per guide. Where subjects naturally overlap, make the page boundary explicit in the introduction and link to the specialist guide.
- The CSV workflow guide may mention encoding, privacy and AI analysis, but the specialist pages own detailed troubleshooting, privacy boundaries and SQL workflow respectively.
- Do not merge or redirect pages based on the current tiny Search Console sample. Require repeated query/page overlap with meaningful impressions before taking action.
- Review query + page pairs over a longer available period as Search Console data accumulates. Search Console may omit low-volume queries, so absence from a small export is not proof of no demand.
- Use the primary phrase naturally in the title/H1 and opening paragraph. Keep title and description unique and accurate.
- Add contextual links only where they help the reader complete the next task.
- Do not add a `meta keywords` tag or invent search-volume estimates.
- Canonical URLs remain on the existing Lovable domain until a verified MIZYAi domain and migration plan are available.
