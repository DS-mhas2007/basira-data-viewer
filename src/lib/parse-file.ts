import Papa from "papaparse";

export type Row = Record<string, string | number | boolean | null>;

export interface ParsedSheet {
  columns: string[];
  rows: Row[];
}

export interface ParsedFile {
  fileName: string;
  fileSize: number;
  sheetNames: string[];
  sheets: Record<string, ParsedSheet>;
}

export const MAX_FILE_SIZE = 25 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function validateFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!["csv", "xlsx"].includes(ext)) {
    return "صيغة الملف غير مدعومة. يُسمح فقط بملفات CSV أو XLSX.";
  }
  if (file.size === 0) return "الملف فارغ، الرجاء اختيار ملف يحتوي على بيانات.";
  if (file.size > MAX_FILE_SIZE) {
    return `حجم الملف كبير جداً (${formatBytes(file.size)}). الحد الأقصى ${formatBytes(MAX_FILE_SIZE)}.`;
  }
  return null;
}

function normalize(records: Record<string, unknown>[], headers: string[]): ParsedSheet {
  const columns = headers.filter((h) => h !== "" && h != null);
  const rows = records.map((r) => {
    const out: Row = {};
    for (const c of columns) {
      const v = r[c];
      out[c] = v === undefined || v === null || v === "" ? null : (v as Row[string]);
    }
    return out;
  });
  return { columns, rows };
}

function parseCsv(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      dynamicTyping: true,
      worker: false,
      complete: (res) => {
        const headers = (res.meta.fields ?? []).map((h) => String(h).trim());
        if (headers.length === 0) {
          reject(new Error("تعذّر التعرّف على أعمدة الملف."));
          return;
        }
        resolve({
          fileName: file.name,
          fileSize: file.size,
          sheetNames: ["البيانات"],
          sheets: { ["البيانات"]: normalize(res.data, headers) },
        });
      },
      error: () => reject(new Error("فشلت قراءة ملف CSV.")),
    });
  });
}

async function parseXlsx(file: File): Promise<ParsedFile> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const sheets: Record<string, ParsedSheet> = {};
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false });
    if (matrix.length === 0) {
      sheets[name] = { columns: [], rows: [] };
      continue;
    }
    const headers = (matrix[0] as unknown[]).map((h, i) =>
      h === null || h === undefined || String(h).trim() === "" ? `عمود ${i + 1}` : String(h).trim(),
    );
    const records = matrix.slice(1).map((line) => {
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => (obj[h] = (line as unknown[])[i] ?? null));
      return obj;
    });
    sheets[name] = normalize(records, headers);
  }
  return { fileName: file.name, fileSize: file.size, sheetNames: wb.SheetNames, sheets };
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext === "csv" ? parseCsv(file) : parseXlsx(file);
}