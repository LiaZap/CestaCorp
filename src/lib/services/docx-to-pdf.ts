/**
 * Conversor .docx → .pdf via LibreOffice headless.
 *
 * Produção (EasyPanel): instalar libreoffice no Dockerfile.
 * Fallback: se LibreOffice não estiver disponível, retorna o próprio .docx
 * e o chamador decide se permite download do Word.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const existsAsync = promisify(fs.exists);

export async function docxParaPdf(docxPath: string, outputDir?: string): Promise<{ pdfPath: string | null; fallback?: "docx"; error?: string }> {
  if (!(await existsAsync(docxPath))) return { pdfPath: null, error: "Arquivo .docx não encontrado" };
  const outDir = outputDir || path.dirname(docxPath);
  fs.mkdirSync(outDir, { recursive: true });

  return new Promise((resolve) => {
    const p = spawn("libreoffice", [
      "--headless",
      "--convert-to", "pdf",
      "--outdir", outDir,
      docxPath,
    ]);

    let stderr = "";
    p.stderr.on("data", (d) => (stderr += String(d)));

    p.on("error", () => {
      resolve({ pdfPath: null, fallback: "docx", error: "LibreOffice indisponível no ambiente — disponibilizando .docx" });
    });

    p.on("close", (code) => {
      if (code === 0) {
        const base = path.basename(docxPath, path.extname(docxPath));
        const pdfPath = path.join(outDir, `${base}.pdf`);
        resolve({ pdfPath });
      } else {
        resolve({ pdfPath: null, fallback: "docx", error: stderr || `libreoffice exit ${code}` });
      }
    });
  });
}
