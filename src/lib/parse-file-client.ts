import { parseFile, type ForcedEncoding, type ParsedFile } from "@/lib/parse-file";

/** حدّ الحجم الذي يستحق فتح عامل ويب (الملفات الصغيرة أسرع مباشرةً). */
const WORKER_MIN_BYTES = 512 * 1024;

function abortError(): Error {
  const error = new Error("تم إلغاء قراءة الملف لأن اختياراً أحدث بدأ التنفيذ.");
  error.name = "AbortError";
  return error;
}

/**
 * يقرأ الملف في عامل ويب عندما يكون كبيراً، مع إلغاء فوري (terminate) وتراجع تلقائي للقراءة المباشرة
 * إن لم يتوفر العامل أو فشل إنشاؤه. أخطاء القراءة نفسها (ترميز، صيغة…) تُمرَّر كما هي دون تراجع.
 */
export async function parseFileOffMainThread(
  file: File,
  options: { encoding?: ForcedEncoding | "auto"; signal?: AbortSignal } = {},
): Promise<ParsedFile> {
  if (options.signal?.aborted) throw abortError();
  if (typeof Worker === "undefined" || file.size < WORKER_MIN_BYTES) return parseFile(file, options);

  let worker: Worker;
  try {
    worker = new Worker(new URL("./parse-worker.ts", import.meta.url), { type: "module" });
  } catch {
    return parseFile(file, options);
  }

  return new Promise<ParsedFile>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener("abort", onAbort);
      worker.terminate();
      fn();
    };
    const onAbort = () => finish(() => reject(abortError()));
    options.signal?.addEventListener("abort", onAbort, { once: true });

    worker.onmessage = (e: MessageEvent<{ ok: true; result: ParsedFile } | { ok: false; name: string; message: string }>) => {
      const msg = e.data;
      if (msg.ok) finish(() => resolve(msg.result));
      else
        finish(() => {
          const error = new Error(msg.message);
          error.name = msg.name;
          reject(error);
        });
    };
    // فشل تحميل العامل نفسه (CSP/شبكة): نتراجع إلى القراءة المباشرة بدل إظهار خطأ للمستخدم.
    worker.onerror = () => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener("abort", onAbort);
      worker.terminate();
      parseFile(file, options).then(resolve, reject);
    };
    worker.postMessage({ file, encoding: options.encoding });
  });
}
