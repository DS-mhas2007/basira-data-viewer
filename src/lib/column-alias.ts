/** خريطة أسماء الأعمدة الإنجليزية → العربية (قابلة للتوسعة). */
export const COLUMN_ALIASES: Record<string, string> = {
  unit_price: "سعر الوحدة",
  price: "السعر",
  revenue: "الإيراد",
  sales: "المبيعات",
  quantity: "الكمية",
  qty: "الكمية",
  profit: "الربح",
  cost: "التكلفة",
  cogs: "كلفة البضاعة",
  date: "التاريخ",
  order_date: "تاريخ الطلب",
  customer: "العميل",
  customer_id: "معرف العميل",
  product: "المنتج",
  product_name: "اسم المنتج",
  category: "الفئة",
  region: "المنطقة",
  branch: "الفرع",
  city: "المدينة",
  country: "الدولة",
  store: "المتجر",
  inventory: "المخزون",
  stock: "المخزون",
  discount: "الخصم",
  total: "الإجمالي",
  amount: "المبلغ",
  rating: "التقييم",
  segment: "الشريحة",
  channel: "القناة",
  employee: "الموظف",
  department: "القسم",
  salary: "الراتب",
  age: "العمر",
  gender: "الجنس",
};

function key(name: string): string {
  return name.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/** الاسم المعروض للعمود (عربي إن وُجد، وإلا الاسم الأصلي). */
export function columnLabel(name: string): string {
  return COLUMN_ALIASES[key(name)] ?? name;
}

/** هل للعمود اسم عربي بديل؟ (لعرض الاسم الأصلي بجانبه بخط باهت) */
export function hasAlias(name: string): boolean {
  return Boolean(COLUMN_ALIASES[key(name)]);
}
