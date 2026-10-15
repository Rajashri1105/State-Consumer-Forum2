const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const dayjs = require('dayjs');
const { getComplaintTitle } = require('../utils/complaintTitle');

const NAVY = rgb(0.031, 0.169, 0.294); // approx #0B3C5D — matches the frontend's design tokens
const GREY = rgb(0.4, 0.4, 0.4);

function pdfSafeText(value) {
  return String(value ?? '').replace(/\u20b9/g, 'Rs. ');
}

async function newDoc() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  return { doc, font, bold };
}

function drawHeader(page, bold, font, title) {
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: NAVY });
  page.drawText('State Consumer Disputes Redressal Forum', { x: 40, y: height - 40, size: 16, font: bold, color: rgb(1, 1, 1) });
  page.drawText(title, { x: 40, y: height - 62, size: 11, font, color: rgb(0.85, 0.88, 0.92) });
  return height - 120;
}

function drawField(page, font, bold, x, y, label, value) {
  page.drawText(label, { x, y, size: 9, font: bold, color: GREY });
  page.drawText(pdfSafeText(value ?? '—'), { x, y: y - 14, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
}

/**
 * Generates a one-page acknowledgment/receipt PDF for a complaint —
 * the document a consumer downloads as proof of filing and current status.
 */
async function generateComplaintReceipt(complaint) {
  const { doc, font, bold } = await newDoc();
  const page = doc.addPage([595.28, 841.89]); // A4
  const isAppeal = complaint.caseType === 'APPEAL';
  let y = drawHeader(page, bold, font, isAppeal ? 'Appeal Registration Receipt' : 'Complaint Registration Receipt');

  page.drawText(pdfSafeText(getComplaintTitle(complaint)), { x: 40, y, size: 16, font: bold, color: NAVY });
  y -= 22;
  page.drawText(complaint.complaintNumber, { x: 40, y, size: 12, font, color: GREY });
  y -= 36;

  const feeText = isAppeal
    ? 'Rs. 0 (No fee for appeals)'
    : `Rs. ${Number(complaint.courtFee || 0).toLocaleString('en-IN')}`;

  const rows = [
    ['Filing Type', isAppeal ? 'Appeal from District Order' : 'New Complaint'],
    ['Status', complaint.status.replace(/_/g, ' ')],
    ['Priority', complaint.priority],
    ['Category', complaint.category?.name],
    ['Consumer / Appellant', complaint.consumer?.name],
    ['Opposite Party', complaint.oppositePartyName],
    ['Amount in Dispute', `Rs. ${Number(complaint.complaintAmount).toLocaleString('en-IN')}`],
    ['Court Fee', feeText],
    ['Filed On', dayjs(complaint.submittedAt).format('DD MMM YYYY, hh:mm A')],
  ];

  for (let i = 0; i < rows.length; i += 2) {
    drawField(page, font, bold, 40, y, rows[i][0], rows[i][1]);
    if (rows[i + 1]) drawField(page, font, bold, 320, y, rows[i + 1][0], rows[i + 1][1]);
    y -= 40;
  }

  y -= 10;
  page.drawText('Description', { x: 40, y, size: 9, font: bold, color: GREY });
  y -= 16;
  const description = pdfSafeText(complaint.description || '');
  const words = description.split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, 10) > 515) {
      page.drawText(line, { x: 40, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
      y -= 14;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) page.drawText(line, { x: 40, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });

  page.drawText(
    `Generated on ${dayjs().format('DD MMM YYYY, hh:mm A')} — this is a system-generated document.`,
    { x: 40, y: 40, size: 8, font, color: GREY }
  );

  return doc.save();
}

/**
 * Generates a hearing notice PDF automatically when a hearing is scheduled —
 * replaces manual notice authoring with an auto-populated document.
 */
async function generateHearingNotice(hearing, complaint) {
  const { doc, font, bold } = await newDoc();
  const page = doc.addPage([595.28, 841.89]);
  let y = drawHeader(page, bold, font, 'Notice of Hearing');

  page.drawText(`Complaint No. ${complaint.complaintNumber}`, { x: 40, y, size: 14, font: bold, color: NAVY });
  y -= 20;
  page.drawText(pdfSafeText(getComplaintTitle(complaint)), { x: 40, y, size: 11, font, color: GREY });
  y -= 30;

  const rows = [
    ['Hearing Date', dayjs(hearing.scheduledDate).format('DD MMM YYYY')],
    ['Hearing Time', hearing.scheduledTime],
    ['Consumer', complaint.consumer?.name],
    ['Opposite Party', complaint.oppositePartyName],
  ];
  for (let i = 0; i < rows.length; i += 2) {
    drawField(page, font, bold, 40, y, rows[i][0], rows[i][1]);
    if (rows[i + 1]) drawField(page, font, bold, 320, y, rows[i + 1][0], rows[i + 1][1]);
    y -= 40;
  }

  y -= 10;
  const notice = 'You are hereby notified to appear before the Forum on the above date and time in connection with the above-referenced complaint. Failure to appear may result in the matter being decided ex-parte.';
  const words = notice.split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, 10) > 515) {
      page.drawText(line, { x: 40, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
      y -= 14;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) page.drawText(line, { x: 40, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });

  page.drawText(
    `This notice was auto-generated on ${dayjs().format('DD MMM YYYY, hh:mm A')} when the hearing was scheduled.`,
    { x: 40, y: 40, size: 8, font, color: GREY }
  );

  return doc.save();
}

/**
 * Generates a downloadable PDF of the AI-assisted (or manually written)
 * complaint synopsis — reuses the same header/styling pipeline as the
 * complaint receipt, per the Feature 2 implementation notes.
 */
async function generateSynopsisPdf(complaint) {
  const { doc, font, bold } = await newDoc();
  let page = doc.addPage([595.28, 841.89]);
  let y = drawHeader(page, bold, font, 'Formal Complaint Synopsis');

  page.drawText(getComplaintTitle(complaint), { x: 40, y, size: 16, font: bold, color: NAVY });
  y -= 22;
  page.drawText(complaint.complaintNumber, { x: 40, y, size: 12, font, color: GREY });
  y -= 36;

  const text = pdfSafeText(complaint.synopsisText || '');
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    if (y < 60) {
      page = doc.addPage([595.28, 841.89]);
      y = 800;
    }
    if (!para.trim()) { y -= 10; continue; }
    const isHeading = para === para.toUpperCase() && para.trim().length > 0 && /[A-Z]/.test(para);
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      const size = isHeading ? 12 : 10;
      const useFont = isHeading ? bold : font;
      if (useFont.widthOfTextAtSize(test, size) > 515) {
        page.drawText(line, { x: 40, y, size, font: useFont, color: isHeading ? NAVY : rgb(0.2, 0.2, 0.2) });
        y -= isHeading ? 18 : 14;
        line = word;
        if (y < 60) { page = doc.addPage([595.28, 841.89]); y = 800; }
      } else {
        line = test;
      }
    }
    if (line) {
      const size = isHeading ? 12 : 10;
      const useFont = isHeading ? bold : font;
      page.drawText(line, { x: 40, y, size, font: useFont, color: isHeading ? NAVY : rgb(0.2, 0.2, 0.2) });
      y -= isHeading ? 18 : 14;
    }
  }

  page.drawText(
    `Generated on ${dayjs().format('DD MMM YYYY, hh:mm A')} — AI-assisted draft; review before relying on it as a legal document.`,
    { x: 40, y: 40, size: 8, font, color: GREY }
  );

  return doc.save();
}

async function generateFinalJudgmentPdf(complaint, judgment, attendance, orderDate) {
  const { doc, font, bold } = await newDoc();
  let page = doc.addPage([595.28, 841.89]);
  let y = drawHeader(page, bold, font, 'Final Judgment');

  const ensureSpace = (minY = 55) => {
    if (y < minY) {
      page = doc.addPage([595.28, 841.89]);
      y = drawHeader(page, bold, font, 'Final Judgment');
    }
  };

  const ensureRoom = (height) => {
    if (y - height < 55) {
      page = doc.addPage([595.28, 841.89]);
      y = drawHeader(page, bold, font, 'Final Judgment');
    }
  };

  const wrapLines = (text, activeFont, size, width) => {
    const words = pdfSafeText(text ?? '—').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';

    for (const word of words) {
      const nextLine = line ? `${line} ${word}` : word;
      if (line && activeFont.widthOfTextAtSize(nextLine, size) > width) {
        lines.push(line);
        line = word;
      } else {
        line = nextLine;
      }
    }

    if (line) lines.push(line);
    return lines;
  };

  const writeWrappedText = (text, options = {}) => {
    const {
      size = 10,
      color = rgb(0.1, 0.1, 0.1),
      fontType = font,
      indent = 0,
      lineGap = 5,
    } = options;

    const words = pdfSafeText(text ?? '—').split(/\s+/).filter(Boolean);
    let line = '';

    const flushLine = (value) => {
      ensureSpace(45);
      page.drawText(value, { x: 40 + indent, y, size, font: fontType, color });
      y -= size + lineGap;
    };

    for (const word of words) {
      const nextLine = line ? `${line} ${word}` : word;
      if (line && fontType.widthOfTextAtSize(nextLine, size) > 515 - indent) {
        flushLine(line);
        line = word;
      } else {
        line = nextLine;
      }
    }

    if (line) flushLine(line);
  };

  const writeSectionHeading = (heading, size = 12) => {
    ensureSpace(55);
    page.drawText(heading, { x: 40, y, size, font: bold, color: NAVY });
    y -= size + 8;
  };

  const writeField = (label, value, options = {}) => {
    writeWrappedText(label, { size: 9, fontType: bold, color: GREY, ...options });
    writeWrappedText(value || '—', { size: 10, ...options });
  };

  const writeParticularsRow = (left, right) => {
    const columns = [
      { x: 40, ...left },
      { x: 310, ...right },
    ];
    const rendered = columns.map(({ x, label, value }) => ({
      x,
      labelLines: wrapLines(label, bold, 8, 245),
      valueLines: wrapLines(value || '—', font, 9, 245),
    }));
    const rowHeight = Math.max(...rendered.map(({ labelLines, valueLines }) => (
      labelLines.length * 10 + valueLines.length * 12
    ))) + 12;

    ensureRoom(rowHeight);
    for (const { x, labelLines, valueLines } of rendered) {
      let cellY = y;
      for (const line of labelLines) {
        page.drawText(line, { x, y: cellY, size: 8, font: bold, color: GREY });
        cellY -= 10;
      }
      for (const line of valueLines) {
        page.drawText(line, { x, y: cellY, size: 9, font, color: rgb(0.1, 0.1, 0.1) });
        cellY -= 12;
      }
    }
    y -= rowHeight;
    page.drawLine({
      start: { x: 40, y: y + 5 },
      end: { x: 555, y: y + 5 },
      thickness: 0.4,
      color: rgb(0.86, 0.88, 0.9),
    });
  };

  const courtName = 'State Consumer Disputes Redressal Forum';
  const filingDate = dayjs(complaint.submittedAt).format('DD/MM/YYYY');
  const orderDateText = dayjs(orderDate).format('DD/MM/YYYY');
  const consumerName = complaint.consumer?.name || 'Consumer / Complainant';
  const oppositePartyName = complaint.oppositePartyName || 'Opposite Party / Defendant';
  const judgeName = complaint.assignedJudge?.user?.name || "Hon'ble Judge";
  const caseTypeLabel = complaint.caseType === 'APPEAL' ? 'Appeal' : 'Complaint';
  const backgroundText = complaint.description
    ? `The complainant filed this ${caseTypeLabel.toLowerCase()} alleging that ${complaint.description}.`
    : `The complainant filed this ${caseTypeLabel.toLowerCase()} seeking appropriate relief.`;
  const defenseText = `The opposite party denied the allegations and submitted that it was not liable for the claim. The defence was examined in light of the material placed on record.`;
  const evidenceText = `The Court considered the complaint pleadings, documentary evidence, witness statement(s), advocate submissions and relevant records before arriving at its conclusion.`;
  const issuesText = `1. Whether the complaint is proved against the opposite party.\n2. Whether the complainant is entitled to the relief claimed.`;
  const verdictText = judgment.verdict || 'The complaint is decided in favour of the complainant.';
  const summaryText = judgment.summary || 'After examining the facts, evidence and record, the forum finds the complaint to be justified.';

  page.drawText(courtName, { x: 40, y, size: 18, font: bold, color: NAVY });
  y -= 26;
  page.drawText(`Case / Complaint No: ${complaint.complaintNumber || '—'}`, { x: 40, y, size: 12, font: bold, color: rgb(0.2, 0.2, 0.2) });
  y -= 22;
  page.drawText(`Date of Judgment: ${orderDateText}`, { x: 40, y, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
  y -= 26;

  page.drawText('PARTIES TO THE CASE:', { x: 40, y, size: 12, font: bold, color: NAVY });
  y -= 18;
  page.drawText(consumerName, { x: 40, y, size: 11, font: bold, color: rgb(0.15, 0.15, 0.15) });
  y -= 15;
  page.drawText('... PLAINTIFF / COMPLAINANT', { x: 40, y, size: 9, font, color: GREY });
  y -= 22;
  page.drawText('VERSUS', { x: 40, y, size: 11, font: bold, color: NAVY });
  y -= 18;
  page.drawText(oppositePartyName, { x: 40, y, size: 11, font: bold, color: rgb(0.15, 0.15, 0.15) });
  y -= 15;
  page.drawText('... DEFENDANT / OPPOSITE PARTY', { x: 40, y, size: 9, font, color: GREY });
  y -= 28;

  page.drawText('JUDGMENT / ORDER', { x: 40, y, size: 15, font: bold, color: NAVY });
  y -= 28;

  writeSectionHeading('Case particulars', 11);
  const particulars = [
    ['Case type', caseTypeLabel],
    ['Bench No.', complaint.bench?.name || '—'],
    ['Date of filing', filingDate],
    ['Date of order', orderDateText],
    ['Consumer / Complainant', consumerName],
    ['Opposite Party / Defendant', oppositePartyName],
    ['Judge', judgeName],
    ['Witness(es)', attendance?.witnessDetails || '—'],
    ['Advocate(s)', attendance?.advocateDetails || '—'],
    ['Consumer present', attendance?.consumerPresent ? 'Yes' : 'No'],
    ['Opposite party present', attendance?.oppositePartyPresent ? 'Yes' : 'No'],
  ];
  for (let index = 0; index < particulars.length; index += 2) {
    const [leftLabel, leftValue] = particulars[index];
    const [rightLabel, rightValue] = particulars[index + 1] || ['', ''];
    writeParticularsRow(
      { label: leftLabel, value: leftValue },
      { label: rightLabel, value: rightValue }
    );
  }

  writeSectionHeading('1. Introduction & Background', 11);
  writeWrappedText(backgroundText);
  writeSectionHeading('2. The Defense (Defendant\'s Version)', 11);
  writeWrappedText(defenseText);
  writeSectionHeading('3. Evidence Presented', 11);
  writeWrappedText(evidenceText);
  writeSectionHeading('4. Main Questions to Decide (Issues)', 11);
  for (const line of issuesText.split('\n')) writeWrappedText(line);
  writeSectionHeading('5. Reasoning & Findings', 11);
  writeWrappedText(summaryText);
  writeSectionHeading('6. Final Order / Relief', 11);
  writeWrappedText(verdictText);
  y -= 12;
  writeWrappedText('The case is therefore decided in accordance with the above findings and the relief as stated above.');
  y -= 18;

  page.drawText('Pronounced in Open Court on: ' + orderDateText, { x: 40, y, size: 11, font: bold, color: rgb(0.12, 0.12, 0.12) });
  y -= 20;
  page.drawText('(Signature)', { x: 40, y, size: 10, font, color: GREY });
  y -= 18;
  page.drawText(judgeName, { x: 40, y, size: 11, font: bold, color: rgb(0.12, 0.12, 0.12) });
  y -= 14;
  page.drawText('Judge / Member', { x: 40, y, size: 10, font, color: GREY });
  y -= 30;

  const signatureLines = wrapLines(`/s/ ${judgeName}`, bold, 11, 181);
  const signatureBoxHeight = 70 + signatureLines.length * 12;
  ensureRoom(signatureBoxHeight + 15);
  page.drawRectangle({
    x: 350,
    y: y - signatureBoxHeight + 10,
    width: 205,
    height: signatureBoxHeight,
    borderColor: NAVY,
    borderWidth: 1,
    color: rgb(0.97, 0.98, 0.99),
  });
  page.drawText('SAMPLE DIGITAL SIGNATURE', { x: 362, y: y - 8, size: 8, font: bold, color: NAVY });
  page.drawLine({
    start: { x: 362, y: y - 18 },
    end: { x: 543, y: y - 18 },
    thickness: 0.5,
    color: rgb(0.75, 0.79, 0.83),
  });
  signatureLines.forEach((line, index) => {
    page.drawText(line, { x: 362, y: y - 39 - index * 12, size: 11, font: bold, color: NAVY });
  });
  const signatureDetailsY = y - 39 - signatureLines.length * 12;
  page.drawText(`Signed on: ${orderDateText}`, { x: 362, y: signatureDetailsY, size: 8, font, color: GREY });
  page.drawText('Illustrative only; not a verified cryptographic signature.', {
    x: 362,
    y: signatureDetailsY - 14,
    size: 7,
    font,
    color: GREY,
  });

  for (const documentPage of doc.getPages()) {
    documentPage.drawText(
      `Generated on ${dayjs().format('DD MMM YYYY, hh:mm A')} — system-generated final judgment.`,
      { x: 40, y: 30, size: 8, font, color: GREY }
    );
  }

  return doc.save();
}

module.exports = { generateComplaintReceipt, generateHearingNotice, generateSynopsisPdf, generateFinalJudgmentPdf };
