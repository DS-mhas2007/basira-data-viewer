import { describe, expect, it } from "vitest";
import { MAX_FILE_SIZE, MAX_XLSX_SIZE, MSG_TOO_LARGE, MSG_XLSX_TOO_LARGE, validateFile } from "./parse-file";

function fakeFile(name: string, size: number): File {
  const f = new File(["x"], name);
  Object.defineProperty(f, "size", { value: size });
  return f;
}

describe("validateFile", () => {
  it("يقبل CSV حتى 25MB", () => {
    expect(validateFile(fakeFile("a.csv", MAX_FILE_SIZE))).toBeNull();
  });
  it("يرفض CSV أكبر من 25MB", () => {
    expect(validateFile(fakeFile("a.csv", MAX_FILE_SIZE + 1))).toBe(MSG_TOO_LARGE);
  });
  it("يقبل XLSX حتى 10MB", () => {
    expect(validateFile(fakeFile("a.xlsx", MAX_XLSX_SIZE))).toBeNull();
  });
  it("يرفض XLSX أكبر من 10MB برسالة تقترح CSV", () => {
    const msg = validateFile(fakeFile("a.xlsx", MAX_XLSX_SIZE + 1));
    expect(msg).toBe(MSG_XLSX_TOO_LARGE);
    expect(msg).toContain("CSV");
  });
  it("يرفض الصيغ غير المدعومة والفارغ", () => {
    expect(validateFile(fakeFile("a.pdf", 10))).toContain("غير مدعومة");
    expect(validateFile(fakeFile("a.csv", 0))).toContain("فارغ");
  });
});
