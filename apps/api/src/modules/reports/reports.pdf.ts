import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import type { ReportData } from './reports.service.js';
import { reportFileName } from './reports.service.js';

/**
 * PDF renderer (PRD §10.20 exports). pdfkit streams the document straight
 * into the response; wide tables switch to landscape. Every page carries the
 * internal-use footer required by the build plan (no DRAP certification
 * claims).
 */

const MARGIN = 40;
const DARK = '#212529';
const MUTED = '#6c757d';

function columnWeights(report: ReportData): number[] {
  return report.columns.map((column) => {
    if (column.key === 'medicine') return 1.8;
    if (column.key === 'entityId') return 1.4;
    return 1;
  });
}

export function renderReportPdf(res: Response, report: ReportData): Promise<void> {
  return new Promise((resolve, reject) => {
    const landscape = report.columns.length > 6;
    const doc = new PDFDocument({
      size: 'A4',
      layout: landscape ? 'landscape' : 'portrait',
      margin: MARGIN,
      bufferPages: true,
      info: { Title: report.title, Author: 'PharmaGuard' },
    });

    let settled = false;
    const settle = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    doc.on('error', (cause) => {
      if (!settled) {
        settled = true;
        reject(cause instanceof Error ? cause : new Error(String(cause)));
      }
    });
    res.on('close', settle);
    res.on('finish', settle);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${reportFileName(report, 'pdf')}"`);
    doc.pipe(res);

    const usableWidth = doc.page.width - MARGIN * 2;
    const bottomLimit = doc.page.height - MARGIN;

    // --- Header ---------------------------------------------------------------
    doc.font('Helvetica-Bold').fontSize(15).fillColor(DARK).text(report.title, MARGIN, MARGIN);
    const windowLabel = report.from
      ? `Window: ${report.from} to ${report.to}`
      : 'Scope: current stock on hand';
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(MUTED)
      .text(
        `${windowLabel} - generated ${report.generatedAt.slice(0, 16).replace('T', ' ')} UTC`,
        MARGIN,
        doc.y + 2,
      );
    doc.moveDown(1);

    // --- Table ----------------------------------------------------------------
    const weights = columnWeights(report);
    const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
    const widths = weights.map((weight) => (usableWidth * weight) / weightTotal);
    const widthAt = (index: number): number => widths[index] ?? 0;
    const offsetAt = (index: number): number =>
      widths.slice(0, index).reduce((sum, width) => sum + width, 0);

    let y = doc.y;

    const drawCells = (cells: (string | number | null)[], isHeader: boolean): number => {
      doc
        .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(isHeader ? 8 : 8.5)
        .fillColor(isHeader ? DARK : '#343a40');
      let rowHeight = 12;
      cells.forEach((cell, index) => {
        const text = cell === null || cell === undefined ? '' : String(cell);
        const height = doc.heightOfString(text, { width: widthAt(index) - 6 });
        rowHeight = Math.max(rowHeight, height + 3);
      });
      return rowHeight;
    };

    const writeRow = (cells: (string | number | null)[], isHeader: boolean) => {
      const rowHeight = drawCells(cells, isHeader);
      if (y + rowHeight > bottomLimit) {
        doc.addPage();
        y = MARGIN;
        if (!isHeader) writeRow(report.columns.map((column) => column.label), true);
      }
      cells.forEach((cell, index) => {
        const text = cell === null || cell === undefined ? '' : String(cell);
        doc.text(text, MARGIN + offsetAt(index), y, {
          width: widthAt(index) - 6,
          ellipsis: true,
          lineBreak: false,
        });
      });
      y += rowHeight + (isHeader ? 4 : 2);
      if (isHeader) {
        doc
          .moveTo(MARGIN, y - 3)
          .lineTo(doc.page.width - MARGIN, y - 3)
          .lineWidth(0.75)
          .strokeColor('#dee2e6')
          .stroke();
        y += 2;
      }
    };

    writeRow(report.columns.map((column) => column.label), true);
    if (report.rows.length === 0) {
      doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('No rows in this scope.', MARGIN, y);
      y += 18;
    }
    for (const row of report.rows) {
      writeRow(row, false);
    }

    // --- Summary ---------------------------------------------------------------
    if (report.summary.length > 0) {
      y += 8;
      if (y + report.summary.length * 14 > bottomLimit) {
        doc.addPage();
        y = MARGIN;
      }
      doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK).text('Summary', MARGIN, y);
      y += 16;
      doc.font('Helvetica').fontSize(9).fillColor('#343a40');
      for (const line of report.summary) {
        doc.text(`${line.label}: ${line.value}`, MARGIN, y);
        y += 14;
      }
    }

    // --- Footers on every page ---------------------------------------------------
    const pageRange = doc.bufferedPageRange();
    for (let index = pageRange.start; index < pageRange.start + pageRange.count; index += 1) {
      doc.switchToPage(index);
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(MUTED)
        .text(
          'Internal record for review support - not official DRAP certification.',
          MARGIN,
          doc.page.height - 28,
          { width: usableWidth, align: 'center', lineBreak: false },
        );
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(MUTED)
        .text(`Page ${index - pageRange.start + 1} of ${pageRange.count}`, MARGIN, doc.page.height - 16, {
          width: usableWidth,
          align: 'center',
          lineBreak: false,
        });
    }

    doc.end();
  });
}
