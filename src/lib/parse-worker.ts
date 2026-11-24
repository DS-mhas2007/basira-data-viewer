// عامل ويب: يقرأ CSV/XLSX بعيداً عن خيط الواجهة كي لا تتجمّد الصفحة مع الملفات الكبيرة.
import { parseFile, type ForcedEncoding } from "@/lib/parse-file";

interface Req {
  file: File;
  encoding?: ForcedEncoding | "auto";
}

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<Req>) => void) | null;
  postMessage: (msg: unknown) => void;
};

scope.onmessage = async (e: MessageEvent<Req>) => {
  try {
    const result = await parseFile(e.data.file, e.data.encoding ? { encoding: e.data.encoding } : {});
    scope.postMessage({ ok: true, result });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    scope.postMessage({ ok: false, name: error.name, message: error.message });
  }
};
