/* ============================================================
   Fieldcheck — Shared Checklist Logic
   Each page defines: STEPS, STEP_TEXT, RECORDS, PAGE_CONFIG
   Steps can have data-na="true" to show N/A button
   Steps can have data-note="true" to show a notes field always
   ============================================================ */

function initChecklist() {
  const state = {};
  STEPS.forEach(s => state[s] = null);
  window._state = state;

  // Set today's date
  const df = document.getElementById('dateField');
  if (df) df.valueAsDate = new Date();

  updateProgress();
}

function setState(code, val) {
  window._state[code] = val;

  const row = document.getElementById('step-' + code);
  row.classList.remove('state-pass', 'state-flag');
  if (val === 'pass') row.classList.add('state-pass');
  if (val === 'flag') row.classList.add('state-flag');

  // Update button active states
  row.querySelectorAll('.btn').forEach(b => {
    b.classList.remove('active');
    if (b.classList.contains('btn-pass') && val === 'pass') b.classList.add('active');
    if (b.classList.contains('btn-flag') && val === 'flag') b.classList.add('active');
    if (b.classList.contains('btn-na')   && val === 'na')   b.classList.add('active');
  });

  // Show/hide flag reason input
  const reasonEl = document.getElementById('flag-reason-' + code);
  if (reasonEl) {
    if (val === 'flag') {
      reasonEl.classList.add('visible');
      reasonEl.querySelector('textarea').focus();
    } else {
      reasonEl.classList.remove('visible');
    }
  }

  updateProgress();
}

function updateProgress() {
  const answered = STEPS.filter(s => window._state[s] !== null).length;
  const pct = Math.round((answered / STEPS.length) * 100);
  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressLabel').textContent =
    answered + ' of ' + STEPS.length + ' steps complete';
}

function handleSubmit() {
  // Validate mandatory meta fields
  const engineer = document.getElementById('engineer').value.trim();
  const unitId   = document.getElementById('unitId').value.trim();

  if (!engineer || !unitId) {
    const wb = document.getElementById('warningBar');
    wb.textContent = 'Engineer name and Unit ID are required before submitting.';
    wb.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  // Validate all steps answered
  const unanswered = STEPS.filter(s => window._state[s] === null);
  if (unanswered.length > 0) {
    const wb = document.getElementById('warningBar');
    wb.textContent = 'Complete all steps before submitting.';
    wb.style.display = 'block';
    document.getElementById('step-' + unanswered[0])
      .scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const date   = document.getElementById('dateField').value;
  const year   = date ? new Date(date).getFullYear() : new Date().getFullYear();
  const uid    = unitId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const refNum = PAGE_CONFIG.rentmanPrefix + '-' + uid + '-service-' + year;

  // Collect records
  const records = {};
  RECORDS.forEach(r => {
    const el = document.getElementById('rec-' + r.id);
    records[r.id] = el ? el.value : '';
  });

  // Collect flag reasons
  const flagReasons = {};
  STEPS.forEach(code => {
    if (window._state[code] === 'flag') {
      const el = document.getElementById('flag-reason-input-' + code);
      flagReasons[code] = el ? el.value.trim() : '';
    }
  });

  const flagged = STEPS.filter(s => window._state[s] === 'flag');

  window._completedData = { engineer, unitId, date, refNum, records, flagged, flagReasons };

  // Show completion screen, hide checklist header elements
  document.getElementById('checklistBody').style.display = 'none';
  document.getElementById('completionScreen').classList.add('visible');
  document.getElementById('refNumber').textContent = refNum;
  document.getElementById('completionSub').textContent =
    engineer + ' · ' + unitId + ' · ' + (date || 'Today');

  // Swap header: hide progress/title, show completion nav
  const mainHeader = document.getElementById('mainHeader');
  const metaGrid = document.getElementById('metaGrid');
  const completionHeader = document.getElementById('completionHeader');
  if (mainHeader) mainHeader.style.display = 'none';
  if (metaGrid) metaGrid.style.display = 'none';
  if (completionHeader) completionHeader.classList.add('visible');

  if (flagged.length > 0) {
    document.getElementById('flaggedNotice').style.display = 'block';
    document.getElementById('flaggedList').innerHTML = flagged.map(f => {
      const reason = flagReasons[f] ? ' — ' + flagReasons[f] : '';
      return '<div class="flagged-notice-item">⚑ ' + f + ' — ' + STEP_TEXT[f] + reason + '</div>';
    }).join('');
  }

  generatePDF();
}

function generatePDF() {
  const d = window._completedData;
  if (!d) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const black  = [0, 0, 0];
  const grey   = [100, 100, 100];
  const lgrey  = [200, 200, 200];
  const red    = [180, 40, 40];
  const pw = 210, ph = 297, ml = 20, mr = 20;
  const cw = pw - ml - mr;
  let y = 20;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...black);
  doc.text(PAGE_CONFIG.title + ' Checksheet', ml, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...grey);
  doc.text('SOP: ' + PAGE_CONFIG.sopVersion, ml, y);
  y += 8;

  // Meta
  doc.setFontSize(10);
  [['Unit ID:', d.unitId], ['Engineer:', d.engineer], ['Date:', d.date || '']].forEach(([lbl, val]) => {
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...black); doc.text(lbl, ml, y);
    doc.setFont('helvetica', 'normal'); doc.text(val, ml + 28, y);
    y += 6;
  });
  y += 4;

  // Steps heading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...black);
  doc.text('Inspection & Functional Checks', ml, y);
  y += 2;
  doc.setDrawColor(...lgrey);
  doc.setLineWidth(0.3);
  doc.line(ml, y, pw - mr, y);
  y += 6;

  // Steps
  STEPS.forEach(code => {
    if (y > ph - 30) { doc.addPage(); y = 20; }

    const result = window._state[code];
    const sym = result === 'pass' ? '[PASS]' : result === 'flag' ? '[FLAG]' : result === 'na' ? '[N/A]' : '[    ]';
    const lines = doc.splitTextToSize(STEP_TEXT[code], cw - 18);

    if (result === 'flag') {
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...red);
    } else {
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...grey);
    }
    doc.text(sym, pw - mr, y, { align: 'right' });

    doc.setFont('helvetica', 'normal'); doc.setTextColor(...black);
    doc.text(lines, ml, y);
    y += lines.length * 5.5 + 1.5;

    // Flag reason inline
    if (result === 'flag' && d.flagReasons[code]) {
      if (y > ph - 20) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...red);
      const rlines = doc.splitTextToSize('Reason: ' + d.flagReasons[code], cw - 10);
      doc.text(rlines, ml + 6, y);
      doc.setFontSize(10);
      y += rlines.length * 5 + 2;
    }
  });
  y += 6;

  // Records section
  if (y > ph - 50) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...black);
  doc.text('Records / Observations', ml, y);
  y += 2;
  doc.setDrawColor(...lgrey);
  doc.line(ml, y, pw - mr, y);
  y += 7;

  RECORDS.forEach(r => {
    if (y > ph - 30) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...black);
    doc.text(r.label + ':', ml, y);
    y += 5;
    const val = d.records[r.id] || '';
    if (val) {
      doc.setFont('helvetica', 'normal');
      const vlines = doc.splitTextToSize(val, cw);
      doc.text(vlines, ml, y);
      y += vlines.length * 5.5;
    }
    doc.setDrawColor(...lgrey);
    doc.line(ml, y + 2, pw - mr, y + 2);
    y += 10;
  });

  // Flagged summary
  if (d.flagged.length > 0) {
    if (y > ph - 40) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...black);
    doc.text('Flagged items — follow up required:', ml, y);
    y += 6;
    d.flagged.forEach(f => {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...black);
      const fl = doc.splitTextToSize(f + '  —  ' + STEP_TEXT[f], cw - 6);
      doc.text('*', ml, y);
      doc.text(fl, ml + 5, y);
      y += fl.length * 5.5 + 1;
      if (d.flagReasons[f]) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(...red);
        const rl = doc.splitTextToSize('Reason: ' + d.flagReasons[f], cw - 10);
        doc.text(rl, ml + 5, y);
        doc.setFontSize(10);
        y += rl.length * 5 + 2;
      }
      doc.setTextColor(...black);
    });
  }

  // Rentman note
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...grey);
  const note = 'Upon completion, save a copy of this document to the relevant unit on Rentman using the filename: ' + d.refNum;
  doc.text(doc.splitTextToSize(note, cw), ml, ph - 14);

  doc.save(d.refNum + '.pdf');
}
