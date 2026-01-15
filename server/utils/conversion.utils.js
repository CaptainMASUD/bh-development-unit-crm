import path from 'path';
import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { exec } from 'child_process';

export const imageToPdf = async (imagePath) => {
  const outputPath = path.join('uploads', `${Date.now()}.pdf`);
  const imageBuffer = await sharp(imagePath)
    .resize({ width: 800 }) // resize for optimization
    .jpeg({ quality: 80 })  // compress JPEG quality
    .toBuffer();

  const pdfDoc = await PDFDocument.create();
  const img = await pdfDoc.embedJpg(imageBuffer);
  const page = pdfDoc.addPage([img.width, img.height]);
  page.drawImage(img, {
    x: 0,
    y: 0,
    width: img.width,
    height: img.height,
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
  return outputPath;
};

export const pdfToPptx = async (pdfPath) => {
  const outputPath = path.join('uploads', `${Date.now()}.pptx`);
  // Fake conversion – replace with real tool if needed
  fs.copyFileSync(pdfPath, outputPath);
  return outputPath;
};

export const wordToPdf = async (docPath) => {
  const outputDir = path.resolve('uploads');
  return new Promise((resolve, reject) => {
    exec(`libreoffice --headless --convert-to pdf --outdir "${outputDir}" "${docPath}"`, (err) => {
      if (err) return reject(err);
      const outputPath = path.join(outputDir, path.basename(docPath).replace(/\.[^/.]+$/, '.pdf'));
      resolve(outputPath);
    });
  });
};

export const excelToPdf = async (xlsPath) => {
  const outputDir = path.resolve('uploads');
  return new Promise((resolve, reject) => {
    exec(`libreoffice --headless --convert-to pdf --outdir "${outputDir}" "${xlsPath}"`, (err) => {
      if (err) return reject(err);
      const outputPath = path.join(outputDir, path.basename(xlsPath).replace(/\.[^/.]+$/, '.pdf'));
      resolve(outputPath);
    });
  });
};

export const cleanUpTempFile = (originalPath, convertedPath) => {
  fs.unlink(originalPath, () => {});
  setTimeout(() => fs.unlink(convertedPath, () => {}), 30000);
};
