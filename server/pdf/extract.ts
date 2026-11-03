import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const execute = promisify(execFile);
let active = 0;
export async function extractPdf(bytes: Buffer): Promise<string> {
  if (!bytes.length || bytes.length > 8 * 1024 * 1024)
    throw Error("PDF must be smaller than 8 MB.");
  if (bytes.subarray(0, 5).toString() !== "%PDF-")
    throw Error("Malformed PDF. Choose a valid selectable-text PDF.");
  if (active >= 2) throw Error("PDF extraction is busy. Try again shortly.");
  active++;
  let dir: string | undefined;
  try {
    dir = await mkdtemp(join(tmpdir(), "vision-pdf-"));
    const file = join(dir, "source.pdf");
    await writeFile(file, bytes, { mode: 0o600 });
    const options = {
      timeout: 8000,
      maxBuffer: 1024 * 1024,
      env: { LC_ALL: "C.UTF-8" },
    };
    const info = await execute("/usr/bin/pdfinfo", [file], options);
    if (/^Encrypted:\s+yes/im.test(info.stdout))
      throw Error(
        "Encrypted PDFs are not supported. Export an unencrypted copy.",
      );
    const pages = Number(info.stdout.match(/^Pages:\s+(\d+)/m)?.[1]);
    if (!pages || pages > 50)
      throw Error("Choose a PDF containing 1–50 pages.");
    const text = await execute(
      "/usr/bin/pdftotext",
      ["-layout", "-nopgbrk", "-enc", "UTF-8", file, "-"],
      options,
    );
    if (text.stdout.trim().length < 10)
      throw Error(
        "No selectable text found. Scanned PDFs and OCR are not supported yet.",
      );
    if (text.stdout.length > 100000)
      throw Error("PDF contains too much text. Import a shorter document.");
    return text.stdout;
  } catch (e: any) {
    if (e.code === "ENOENT")
      throw Error(
        "Local PDF extraction is unavailable. Install Poppler utilities on the server.",
      );
    if (e.stderr || e.killed || e.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER")
      throw Error(
        /password|encrypt/i.test(e.stderr || "")
          ? "Encrypted PDFs are not supported. Export an unencrypted copy."
          : "PDF could not be read safely. It may be malformed or too complex; export a simpler selectable-text PDF.",
      );
    throw e;
  } finally {
    active--;
    if (dir) await rm(dir, { recursive: true, force: true });
  }
}
