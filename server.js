import express from "express";
import multer from "multer";
import { PDFDocument } from "pdf-lib";
import { exec } from "child_process";
import fs from "fs-extra";
import pdfPoppler from "pdf-poppler";
import archiver from "archiver";

import os from "os";
import path from "path";
import cors from "cors";

const app = express();
const upload = multer(); // store files in memory
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: "http://localhost:8080", // Replace with your frontend URL
  methods: ["GET", "POST"],
  credentials: true,
}));

// Merge PDFs
app.post("/merge", upload.array("files"), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0)
      throw new Error("No files uploaded");
    const mergedPdf = await PDFDocument.create();
    for (const file of req.files) {
      const pdf = await PDFDocument.load(file.buffer);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach((p) => mergedPdf.addPage(p));
    }
    const mergedBytes = await mergedPdf.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=merged.pdf`);
    res.send(Buffer.from(mergedBytes));
  } catch (err) {
    console.error("Merge Error:", err);
    res.status(500).send(err.message);
  }
});

// Split PDF
app.post("/split", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) throw new Error("No file uploaded");
    if (!req.body.ranges) throw new Error("No ranges provided");

    const ranges = req.body.ranges;
    const pdf = await PDFDocument.load(req.file.buffer);

    const pagesIndices = ranges
      .split(",")
      .map((r) => {
        const [start, end] = r.split("-").map(Number);
        return start === end
          ? [start - 1]
          : Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);
      })
      .flat();

    const newPdf = await PDFDocument.create();
    const pages = await newPdf.copyPages(pdf, pagesIndices);
    pages.forEach((p) => newPdf.addPage(p));

    const splitBytes = await newPdf.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=split.pdf");
    res.send(Buffer.from(splitBytes));
  } catch (err) {
    console.error("Split Error:", err);
    res.status(500).send(err.message);
  }
});

// Compress PDF (cross-platform)
app.post("/compress", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) throw new Error("No file uploaded");

    const tmpDir = os.tmpdir();
    const inPath = path.join(tmpDir, `input-${Date.now()}.pdf`);
    const outPath = path.join(tmpDir, `output-${Date.now()}.pdf`);

    await fs.writeFile(inPath, req.file.buffer);
    const gsCmd = `gswin64c -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/screen -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${outPath}" "${inPath}"`;


    exec(gsCmd, async (err) => {
      if (err) {
        console.error("Ghostscript Error:", err);
        return res.status(500).send("Ghostscript error: " + err.message);
      }

      const compressed = await fs.readFile(outPath);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=compressed.pdf"
      );
      res.send(compressed);

      await fs.remove(inPath);
      await fs.remove(outPath);
    });
  } catch (err) {
    console.error("Compress Error:", err);
    res.status(500).send(err.message);
  }
});

// Convert PDF → JPG (first page)
app.post("/convert", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).send("No PDF uploaded.");

  const tmpDir = os.tmpdir();
  const pdfPath = path.join(tmpDir, `input-${Date.now()}.pdf`);
  const outputDir = path.join(tmpDir, `output-${Date.now()}`);

  await fs.writeFile(pdfPath, req.file.buffer);
  await fs.ensureDir(outputDir);

  const opts = {
    format: "jpeg",
    out_dir: outputDir,
    out_prefix: "page",
    page: null, // null = all pages
  };

  try {
    await pdfPoppler.convert(pdfPath, opts);

    const zipPath = `${outputDir}.zip`;
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip");

    output.on("close", () => {
      res.download(zipPath, `${req.file.originalname}.zip`, () => {
        fs.removeSync(pdfPath);
        fs.removeSync(outputDir);
        fs.removeSync(zipPath);
      });
    });

    archive.pipe(output);
    archive.directory(outputDir, false);
    await archive.finalize();
  } catch (err) {
    console.error("Convert Error:", err);
    res.status(500).send("Conversion failed");
  }
});

app.get("/ping", (req, res) => {
  res.json({ status: "ok", message: "Backend is reachable" });
});




app.listen(PORT, () =>
  console.log(`PDF MVP API running on http://localhost:${PORT}`)
);

