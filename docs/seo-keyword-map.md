# MIZYAi — SEO keyword map

> Editorial targeting hypotheses for Arabic search intent, not search-volume or difficulty measurements. Search Console (last 28 days, checked 17 Nov 2026) currently reports 21 page-level impressions and 0 clicks: 20 for `/guide/arabic-csv-excel` (average position 5.8) and 1 for the homepage (position 1). The visible query sample contains only `ملف csv عربي` (1 impression, position 6, 0 clicks); Google may suppress low-volume queries, so this is not enough evidence to overfit titles or infer broader demand. The sitemap report still shows 11 submitted URLs, 0 errors and 0 warnings; its last submission/download was 14 Nov. The current source sitemap contains 22 URLs (home, guide index and 20 guides), but Google Search Console has not yet reported a newer sitemap fetch. Submitted URLs are not indexed-URL counts. Windsor trial access currently limits history to the last 30 days.

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
| /guide/missing-values | معالجة القيم المفقودة في Excel وCSV | حذف القيم الفارغة، تعويض القيم المفقودة، ملء الفراغات بالوسيط | Explain missingness and choose deletion, median, mode or a justified fixed value; avoid universal imputation advice |
| /guide/data-types | تحويل الأرقام المخزنة كنص إلى أرقام | الأرقام لا تُجمع في Excel، تحويل النص إلى رقم، فواصل الأرقام العربية | Diagnose text-versus-number issues and validate conversion failures; keep identifiers as text |
| /guide/date-format | تنسيق التاريخ في Excel وCSV | تحويل التاريخ، DD/MM/YYYY، MM/DD/YYYY، توحيد التاريخ | Resolve ambiguous day/month order and standardize parseable dates without silently changing ambiguous values |
| /guide/data-dictionary | قاموس البيانات وشرح أعمدة Excel وCSV | أنواع الأعمدة، وصف المتغيرات، توثيق البيانات | Explain column roles and metadata; distinguish automatic suggestions from domain definitions |
| /guide/descriptive-statistics | الإحصاء الوصفي للبيانات | المتوسط الحسابي، الوسيط، توزيع البيانات، القيم المتطرفة | Explain descriptive summaries and distribution; do not imply causal inference or claim unsupported metrics |
| /guide/choose-chart | اختيار الرسم البياني المناسب | رسم بياني بالأعمدة، رسم خطي، متى أستخدم الرسم الدائري | Match chart types and aggregation to the analytical question; avoid misleading visuals |
| /guide/outlier-detection | اكتشاف القيم المتطرفة في البيانات | IQR، درجة Z، القيم الشاذة في Excel، هل أحذف القيم المتطرفة | Explain statistical flags and contextual review; explicitly distinguish unusual observations from data errors |
| /guide/correlation-analysis | تحليل الارتباط بين المتغيرات | معامل Pearson، ارتباط Spearman، الارتباط لا يعني السببية | Explain association measures and interpretation limits; avoid causal claims and unsupported product capabilities |
| /guide/time-series-analysis | تحليل السلاسل الزمنية في Excel | الاتجاه الزمني، الموسمية، تجميع البيانات شهرياً، المتوسط المتحرك | Own exploratory time-based analysis and aggregation; distinguish trend/seasonality from forecasting |
| /guide/sql-basics | أساسيات SQL لتحليل البيانات | SELECT، WHERE، GROUP BY، COUNT، AVG | Teach core read-only analytical queries and review; connect to the Arabic question-to-SQL workflow |
| /guide/arabic-text-cleaning | تنظيف النصوص العربية في Excel وCSV | إزالة المسافات الخفية، توحيد الألف والياء، الأرقام العربية | Explain safe Arabic text normalization; preserve raw values and avoid meaning-changing blanket substitutions |
| /guide/chart-interpretation | كيف أقرأ الرسم البياني وأفسّر النتائج؟ | تفسير الرسوم البيانية، المحاور والوحدات، الرسوم المضللة | Teach interpretation and communication of visual evidence; keep chart selection on the specialist chart-choice page |

| /guide/data-analysis-arabic | تحليل البيانات بالعربية باستخدام Excel وCSV | أداة تحليل البيانات بالعربية، تحليل Excel، تحليل CSV، تحليل البيانات بالذكاء الاصطناعي | Create an Arabic-language solution landing page for dataset workflow intent; link to import, quality, analysis and question guides, and CTA to workspace |

## Cannibalization controls

- Keep the home page focused on product discovery and conversion; guides should answer a specific task or question.
- Keep one primary intent per guide. Where subjects naturally overlap, make the page boundary explicit in the introduction and link to the specialist guide.
- The CSV workflow guide may mention encoding, privacy and AI analysis, but the specialist pages own detailed troubleshooting, privacy boundaries and SQL workflow respectively.
- Do not merge or redirect pages based on the current tiny Search Console sample. Require repeated query/page overlap with meaningful impressions before taking action.
- Review query + page pairs over a longer available period as Search Console data accumulates. Search Console may omit low-volume queries, so absence from a small export is not proof of no demand.
- Use the primary phrase naturally in the title/H1 and opening paragraph. Keep title and description unique and accurate.
- Add contextual links only where they help the reader complete the next task.
- Every guide should provide one contextual action into the matching MIZYAi workspace section, and the relevant workspace section should link back to the specialist guide. Keep the destination tied to an existing capability; do not imply a dedicated SQL editor or automatic outlier detector where none exists.
- Do not add a `meta keywords` tag or invent search-volume estimates.
- Canonical URLs remain on the existing Lovable domain until a verified MIZYAi domain and migration plan are available.
