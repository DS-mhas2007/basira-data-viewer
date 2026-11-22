#!/usr/bin/env python3
"""يولّد مكتبة الملفات الغريبة (fixtures) وملف manifest.json لها.

التشغيل من جذر المشروع:  python3 scripts/generate-messy-fixtures.py
status:
  ok     السلوك الحالي مقبول ويجب أن يبقى (الاختبار يفشل إن انكسر).
  gap    فجوة معروفة: التوقعات تصف السلوك المرغوب، والاختبار it.fails يمرّ طالما الفجوة قائمة،
         وعند إصلاحها يفشل ليذكّرك بتحويل الحالة إلى ok.
  throws الملف يجب أن يُرفض برسالة تحتوي النص المذكور.
"""
import json, os, random
from datetime import datetime
import openpyxl

OUT = os.path.join(os.path.dirname(__file__), "..", "src", "lib", "__fixtures__", "messy")
os.makedirs(OUT, exist_ok=True)
CASES = []


def add(cid, title, file, status, expect):
    CASES.append({"id": cid, "title": title, "file": file, "status": status, "expect": expect})


def write_bytes(name, data: bytes):
    with open(os.path.join(OUT, name), "wb") as f:
        f.write(data)


def csv(cid, title, text, status, expect, encoding="utf-8", bom=False, name=None):
    file = name or f"{cid}.csv"
    data = text.encode(encoding)
    if bom:
        data = b"\xef\xbb\xbf" + data
    write_bytes(file, data)
    add(cid, title, file, status, expect)


BASE_H = "الاسم,العمر,المدينة"
BASE_ROWS = ["أحمد,25,غزة", "سارة,31,رام الله", "محمد,28,الخليل", "ليلى,22,نابلس"]
BASE = "\r\n".join([BASE_H] + BASE_ROWS) + "\r\n"
BASE_COLS = ["الاسم", "العمر", "المدينة"]

# ───────── ترميز وبنية ─────────
csv("01-utf8-clean", "UTF-8 عادي (خط الأساس)", BASE, "ok",
    {"columns": BASE_COLS, "rowCount": 4, "encoding": "UTF-8", "delimiter": ",",
     "cells": [{"row": 0, "col": "العمر", "value": 25}, {"row": 3, "col": "المدينة", "value": "نابلس"}]})
csv("02-utf8-bom", "UTF-8 مع BOM (يُزال من العنوان الأول)", BASE, "ok",
    {"columns": BASE_COLS, "rowCount": 4, "encoding": "UTF-8"}, bom=True)
csv("03-windows-1256", "ترميز ويندوز العربي (Excel القديم)", BASE, "ok",
    {"columns": BASE_COLS, "rowCount": 4, "encoding": "Windows-1256",
     "cells": [{"row": 1, "col": "المدينة", "value": "رام الله"}]}, encoding="cp1256")
write_bytes("04-utf16le-bom.csv", BASE.encode("utf-16"))
add("04-utf16le-bom", "UTF-16LE مع BOM (Unicode Text من Excel)", "04-utf16le-bom.csv", "ok",
    {"columns": BASE_COLS, "rowCount": 4, "encoding": "UTF-16LE"})
csv("05-semicolon", "فاصل منقوطة (إعدادات إقليمية)", BASE.replace(",", ";"), "ok",
    {"columns": BASE_COLS, "rowCount": 4, "delimiter": ";"})
csv("06-tab-delimited", "ملف Tab باسم .csv", BASE.replace(",", "\t"), "ok",
    {"columns": BASE_COLS, "rowCount": 4, "delimiter": "\t"})
csv("07-title-rows", "سطرا عنوان فوق صف الأعمدة",
    "جامعة القدس - استبيان الطلبة 2024\r\n\r\nتاريخ التصدير: 2024-05-01\r\n" + BASE, "ok",
    {"columns": BASE_COLS, "rowCount": 4, "skippedTitleRows": 2})
csv("08-duplicate-headers", "أعمدة مكررة الاسم (يجب ألا تضيع قيمها)",
    "الدرجة,الدرجة,الدرجة\r\n10,20,30\r\n11,21,31\r\n", "ok",
    {"columnCount": 3, "distinctColumns": True, "rowCount": 2, "rowValueSet": {"row": 0, "values": [10, 20, 30]}})
csv("09-empty-header", "اسم عمود فارغ", "الاسم,,الدرجة\r\nأحمد,x,90\r\nسارة,y,85\r\n", "ok",
    {"columns": ["الاسم", "عمود 2", "الدرجة"], "rowCount": 2})
csv("10-ragged-rows", "صفوف ناقصة أو زائدة الحقول",
    "الاسم,العمر,المدينة\r\nأحمد,25\r\nسارة,31,رام الله,زيادة\r\nمحمد,28,الخليل\r\n", "ok",
    {"columns": BASE_COLS, "rowCount": 3, "warnings": ["لا يطابق عدد الأعمدة"],
     "cells": [{"row": 0, "col": "المدينة", "value": None}]})
csv("11-unclosed-quote", "علامة اقتباس غير مغلقة (تُرفض)",
    'الاسم,الملاحظة\r\nأحمد,"ملاحظة لم تُغلق\r\nسارة,جيدة\r\n', "throws",
    {"throws": "علامة اقتباس غير مغلقة"})
csv("12-embedded-newline", "سطر جديد داخل خلية مقتبسة",
    'رقم,الاسم,الملاحظة\r\n1,أحمد,جيد\r\n2,سارة,ممتاز\r\n3,محمد,"سطر1\nسطر2"\r\n4,ليلى,جيد\r\n5,خالد,جيد\r\n6,منى,جيد\r\n',
    "ok", {"columns": ["رقم", "الاسم", "الملاحظة"], "rowCount": 6,
           "cells": [{"row": 2, "col": "الملاحظة", "value": "سطر1\nسطر2"}]})
csv("13-headers-only", "أسماء أعمدة بلا صفوف (تُرفض)", "الاسم,العمر,المدينة\r\n", "throws",
    {"throws": "أسماء أعمدة فقط"})
csv("14-whitespace-only", "ملف فارغ إلا من مسافات (يُرفض)", "   \r\n\r\n", "throws",
    {"throws": "لا يحتوي على أي بيانات"})

# ───────── أرقام وقيم ─────────
csv("15-arabic-indic-digits", "أرقام هندية ٠١٢٣", "المبلغ,العمر\r\n١٢٣٤,٢٥\r\n٥٦٧٨,٣٠\r\n٩١٠,٤١\r\n", "ok",
    {"rowCount": 3, "cells": [{"row": 0, "col": "المبلغ", "value": 1234}, {"row": 2, "col": "العمر", "value": 41}]})
csv("16-persian-digits", "أرقام فارسية ۱۲۳", "الكمية\r\n۱۲۳\r\n۴۵۶\r\n۷۸۹\r\n", "ok",
    {"rowCount": 3, "cells": [{"row": 0, "col": "الكمية", "value": 123}]})
csv("17-thousands-separators", "فواصل آلاف", 'المبلغ\r\n"1,234,567"\r\n"12,500.75"\r\n980\r\n', "ok",
    {"rowCount": 3, "cells": [{"row": 0, "col": "المبلغ", "value": 1234567},
                              {"row": 1, "col": "المبلغ", "value": 12500.75}]})
csv("18-currency-units", "عملات (ر.س و$) تتحول لأرقام مع وحدة",
    "السعر,بالدولار\r\n150 ر.س,$20\r\n200 ر.س,$35\r\n99 ر.س,$7\r\n", "ok",
    {"rowCount": 3, "cells": [{"row": 0, "col": "السعر", "value": 150}, {"row": 0, "col": "بالدولار", "value": 20}],
     "meta": [{"col": "السعر", "is": {"unit": "ر.س"}}, {"col": "بالدولار", "is": {"unit": "$"}}]})
csv("19-percent", "نسب مئوية (% و٪)", "النسبة\r\n45%\r\n٧٥٪\r\n12.5%\r\n", "ok",
    {"rowCount": 3, "cells": [{"row": 0, "col": "النسبة", "value": 45}, {"row": 1, "col": "النسبة", "value": 75}],
     "meta": [{"col": "النسبة", "is": {"isPercent": True}}]})
csv("20-negative-numbers", "سالب بين قوسين وبعلامة", 'القيمة\r\n"(1,200)"\r\n-350\r\n"(45.5)"\r\n', "ok",
    {"rowCount": 3, "cells": [{"row": 0, "col": "القيمة", "value": -1200}, {"row": 1, "col": "القيمة", "value": -350},
                              {"row": 2, "col": "القيمة", "value": -45.5}]})
csv("21-leading-zero-ids", "أصفار بادئة وأرقام هواتف تبقى نصوصاً",
    "المعرف,الهاتف,الجوال_الدولي\r\n007,0501234567,+970599123456\r\n0012,0599000111,+970568123456\r\n010,0568123456,+966501234567\r\n",
    "ok", {"rowCount": 3, "cells": [{"row": 0, "col": "المعرف", "value": "007"},
                                    {"row": 0, "col": "الهاتف", "value": "0501234567"},
                                    {"row": 2, "col": "الجوال_الدولي", "value": "+966501234567"}]})

# ───────── فجوات أرقام ونصوص (سلوك مرغوب لم يتحقق بعد) ─────────
csv("22-decimal-comma", "فاصلة عشرية 3,5 (يجب أن تصير 3.5)", 'المعدل\r\n"3,5"\r\n"4,25"\r\n"2,75"\r\n', "ok",
    {"rowCount": 3, "cells": [{"row": 0, "col": "المعدل", "value": 3.5}, {"row": 1, "col": "المعدل", "value": 4.25}]})
csv("23-european-numbers", "صيغة أوروبية 1.234,56", 'المبلغ\r\n"1.234,56"\r\n"2.500,00"\r\n"980,10"\r\n', "ok",
    {"rowCount": 3, "cells": [{"row": 0, "col": "المبلغ", "value": 1234.56}, {"row": 2, "col": "المبلغ", "value": 980.1}]})
csv("24-scientific-notation", "صيغة علمية 1.5e3", "القيمة\r\n1.5e3\r\n2E4\r\n3.2e-2\r\n", "ok",
    {"rowCount": 3, "cells": [{"row": 0, "col": "القيمة", "value": 1500}, {"row": 1, "col": "القيمة", "value": 20000},
                              {"row": 2, "col": "القيمة", "value": 0.032}]})
csv("25-invisible-rtl-marks", "علامات اتجاه خفية (U+200F) في العناوين والقيم",
    "الاسم,العمر\u200f\r\nأحمد\u200f,25\u200f\r\nسارة\u200f,31\u200f\r\n", "ok",
    {"columns": ["الاسم", "العمر"], "rowCount": 2, "cells": [{"row": 0, "col": "الاسم", "value": "أحمد"}]})

# ───────── تواريخ ─────────
csv("26-dates-iso", "تواريخ ISO (مع وقت)", "التاريخ\r\n2024-05-12\r\n2024-05-13 14:30:00\r\n2024-06-01\r\n", "ok",
    {"rowCount": 3, "cells": [{"row": 0, "col": "التاريخ", "value": "2024-05-12"},
                              {"row": 1, "col": "التاريخ", "value": "2024-05-13 14:30:00"}]})
csv("27-dates-dmy", "يوم/شهر/سنة غير غامض (25/12)", "التاريخ\r\n25/12/2024\r\n03/01/2024\r\n13/02/2024\r\n", "ok",
    {"rowCount": 3, "cells": [{"row": 0, "col": "التاريخ", "value": "2024-12-25"},
                              {"row": 1, "col": "التاريخ", "value": "2024-01-03"}]})
csv("28-dates-mdy", "شهر/يوم/سنة غير غامض (12/25)", "التاريخ\r\n12/25/2024\r\n01/03/2024\r\n02/13/2024\r\n", "ok",
    {"rowCount": 3, "cells": [{"row": 0, "col": "التاريخ", "value": "2024-12-25"},
                              {"row": 1, "col": "التاريخ", "value": "2024-01-03"}]})
csv("29-dates-ambiguous", "تواريخ غامضة تُعلَّم ولا تُخمَّن", "التاريخ\r\n01/02/2024\r\n03/04/2024\r\n05/06/2024\r\n", "ok",
    {"rowCount": 3, "warnings": ["تنسيق تاريخ غامض"], "cells": [{"row": 0, "col": "التاريخ", "value": "01/02/2024"}],
     "meta": [{"col": "التاريخ", "is": {"ambiguousDate": True}}]})
csv("30-dates-arabic-digits", "تواريخ بأرقام هندية", "التاريخ\r\n٢٠٢٤-٠٥-١٢\r\n٢٠٢٤-٠٦-٠١\r\n٢٠٢٤-٠٧-١٥\r\n", "ok",
    {"rowCount": 3, "cells": [{"row": 0, "col": "التاريخ", "value": "2024-05-12"}]})
csv("31-dates-month-names", "تواريخ بأسماء الشهور العربية", "التاريخ\r\n12 مايو 2024\r\n05 يونيو 2024\r\n30 أبريل 2024\r\n", "ok",
    {"rowCount": 3, "cells": [{"row": 0, "col": "التاريخ", "value": "2024-05-12"}]})
csv("32-dates-hijri", "تواريخ هجرية لا تُحوَّل بصمت إلى ميلادية (1445-09-01)",
    "التاريخ الهجري\r\n1445/09/01\r\n1445/10/01\r\n1446/01/01\r\n", "ok",
    {"rowCount": 3, "cellsNot": [{"row": 0, "col": "التاريخ الهجري", "value": "1445-09-01"}]})

# ───────── Excel ─────────
def xlsx(cid, title, build, status, expect):
    wb = openpyxl.Workbook()
    build(wb)
    file = f"{cid}.xlsx"
    wb.save(os.path.join(OUT, file))
    add(cid, title, file, status, expect)


def b_dates(wb):
    ws = wb.active; ws.title = "البيانات"
    ws.append(["التاريخ", "المبلغ"])
    for d, v in [(datetime(2024, 5, 12), 100), (datetime(2024, 5, 13), 250), (datetime(2024, 6, 1), 75)]:
        ws.append([d, v])


def b_title(wb):
    ws = wb.active; ws.title = "التقرير"
    ws.append(["تقرير المبيعات الفصلي"]); ws.append([])
    ws.append(["الفرع", "المبيعات"]); ws.append(["غزة", 1200]); ws.append(["رام الله", 1500])


def b_text_numbers(wb):
    ws = wb.active; ws.title = "البيانات"
    ws.append(["البند", "المبلغ"]); ws.append(["أ", "1,200"]); ws.append(["ب", "٣٤٥"]); ws.append(["ج", "(75)"])


def b_multi(wb):
    ws = wb.active; ws.title = "الطلاب"
    ws.append(["الاسم", "الصف"]); ws.append(["أحمد", "العاشر"]); ws.append(["سارة", "التاسع"])
    w2 = wb.create_sheet("الدرجات")
    w2.append(["الاسم", "الدرجة"]); w2.append(["أحمد", 88]); w2.append(["سارة", 92])


def b_hidden(wb):
    ws = wb.active; ws.title = "البيانات"
    ws.append(["الاسم", "الدرجة"]); ws.append(["أحمد", 88])
    h = wb.create_sheet("مخفية"); h.append(["سري", "x"]); h.append(["1", "2"])
    h.sheet_state = "hidden"


def b_merged(wb):
    ws = wb.active; ws.title = "البيانات"
    ws.append(["الاسم", "الدرجات", None]); ws.append([None, "منتصف", "نهائي"])
    ws.append(["أحمد", 18, 45]); ws.append(["سارة", 20, 48])
    ws.merge_cells("A1:A2"); ws.merge_cells("B1:C1")


xlsx("33-xlsx-date-cells", "خلايا تاريخ حقيقية في Excel تتحول لـ ISO", b_dates, "ok",
     {"rowCount": 3, "cells": [{"row": 0, "col": "التاريخ", "value": "2024-05-12"}, {"row": 1, "col": "المبلغ", "value": 250}]})
xlsx("34-xlsx-title-rows", "عنوان فوق الجدول في Excel", b_title, "ok",
     {"columns": ["الفرع", "المبيعات"], "rowCount": 2})
xlsx("35-xlsx-numbers-as-text", "أرقام مخزّنة كنص في Excel", b_text_numbers, "ok",
     {"rowCount": 3, "cells": [{"row": 0, "col": "المبلغ", "value": 1200}, {"row": 1, "col": "المبلغ", "value": 345},
                               {"row": 2, "col": "المبلغ", "value": -75}]})
xlsx("36-xlsx-multi-sheet", "ملف بعدة أوراق", b_multi, "ok",
     {"sheetNames": ["الطلاب", "الدرجات"], "sheet": "الدرجات", "columns": ["الاسم", "الدرجة"], "rowCount": 2})
xlsx("37-xlsx-hidden-sheet", "الورقة المخفية يجب ألا تُعرض كورقة عادية", b_hidden, "ok",
     {"sheetNames": ["البيانات"]})
xlsx("38-xlsx-merged-header", "عنوان مدمج على عمودين مع صف عناوين فرعي", b_merged, "ok",
     {"columns": ["الاسم", "الدرجات - منتصف", "الدرجات - نهائي"], "rowCount": 2,
      "cells": [{"row": 0, "col": "الدرجات - نهائي", "value": 45}]})

# ───────── استبيانات (جمهور الباحثين) ─────────
labels = ["موافق بشدة", "موافق", "محايد", "غير موافق", "غير موافق بشدة"]
likert = ["الجنس,س1,س2,س3"] + [f"{g},{labels[i % 5]},{labels[(i + 1) % 5]},{labels[(i + 2) % 5]}"
                               for i, g in enumerate(["ذكر", "أنثى", "ذكر", "أنثى", "ذكر", "أنثى"])]
csv("39-likert-arabic-labels", "استبيان ليكرت بتسميات عربية (يجب أن تبقى كما هي)", "\r\n".join(likert) + "\r\n", "ok",
    {"columns": ["الجنس", "س1", "س2", "س3"], "rowCount": 6,
     "cells": [{"row": 0, "col": "س1", "value": "موافق بشدة"}, {"row": 1, "col": "الجنس", "value": "أنثى"}]})
rnd = random.Random(7)
wide = [",".join(f"س{i}" for i in range(1, 121))] + [",".join(str(rnd.randint(1, 5)) for _ in range(120)) for _ in range(30)]
csv("40-wide-survey-120", "استبيان عريض: 120 عموداً و30 صفاً", "\r\n".join(wide) + "\r\n", "ok",
    {"columnCount": 120, "rowCount": 30, "distinctColumns": True})
csv("41-mixed-headers", "عناوين مختلطة عربي/إنجليزي",
    "Age (العمر),الدخل Income,City/المدينة\r\n25,1200,غزة\r\n31,1500,رام الله\r\n", "ok",
    {"columns": ["Age (العمر)", "الدخل Income", "City/المدينة"], "rowCount": 2})
csv("42-commas-in-quotes", "فواصل داخل قيم مقتبسة", 'الاسم,الدرجة,المدينة\r\n"الخطيب, أحمد",90,غزة\r\n"سالم, ليلى",85,رام الله\r\n', "ok",
    {"columns": ["الاسم", "الدرجة", "المدينة"], "rowCount": 2,
     "cells": [{"row": 0, "col": "الاسم", "value": "الخطيب, أحمد"}]})

with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(CASES, f, ensure_ascii=False, indent=2)

from collections import Counter
print(len(CASES), "cases", dict(Counter(c["status"] for c in CASES)))
