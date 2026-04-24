/* ============================================================
   Fieldcheck — Shared Checklist Logic  v2.0
   ============================================================

   HOW TO ADD A NEW CHECKLIST PAGE
   --------------------------------
   Each checklist HTML file must define the following before
   loading this script:

   const STEPS = ['XX01','XX02', ...];
     — Array of step codes in display order.

   const STEP_TEXT = { XX01: 'Step description', ... };
     — Object mapping every step code to its full text.

   const RECORDS = [
     { id: 'XXR01', label: 'Record label' },
     ...
   ];
     — Array of record/observation field definitions.
     — Each record needs a matching element with id="rec-XXR01"
       in the HTML (textarea or input).

   const PAGE_CONFIG = {
     title:         'Equipment Name — Service Type',
     sopVersion:    'v1.0',
     rentmanPrefix: 'equipmentname'
   };
     — rentmanPrefix is used in the Rentman filename:
       {prefix}-{unitid}-service-{year}.pdf

   REQUIRED HTML ELEMENT IDs
   --------------------------
   #mainHeader        — the sticky header div (progress bar etc.)
   #metaGrid          — the engineer/unit/date input grid
   #completionHeader  — the post-completion nav bar
   #engineer          — engineer name input
   #unitId            — unit ID input
   #dateField         — date input
   #progressBar       — progress bar fill div
   #progressLabel     — "X of Y steps complete" text
   #checklistBody     — wraps all steps and submit button
   #completionScreen  — the completion/PDF screen
   #completionSub     — engineer · unit · date summary line
   #refNumber         — Rentman reference display
   #flaggedNotice     — flagged items block (set display:none by default)
   #flaggedList       — inner div where flagged items are listed
   #warningBar        — validation error message bar

   Each step row: id="step-{CODE}"
   Each flag reason block: id="flag-reason-{CODE}"
   Each flag reason textarea: id="flag-reason-input-{CODE}"
   Each record input: id="rec-{RECORD_ID}"

   LOCALSTORAGE
   ------------
   State is saved automatically on every button press.
   Key format: fieldcheck-{rentmanPrefix}-{unitId}
   On load, if a saved session exists for the current page,
   it will be restored automatically (state, meta fields,
   record values).

   PDF GATE
   --------
   Navigation away from the completion screen is blocked
   until the PDF has been downloaded. A prompt fires if
   the user tries to leave early.

   ============================================================ */


/* ── LOCALSTORAGE HELPERS ─────────────────────────────────── */

function _saveKey(unitId) {
  const uid = (unitId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'default';
  return 'fieldcheck-' + PAGE_CONFIG.rentmanPrefix + '-' + uid;
}

function _saveState() {
  const unitId = (document.getElementById('unitId') || {}).value || '';
  const key = _saveKey(unitId);
  const payload = {
    state:    window._state,
    engineer: (document.getElementById('engineer') || {}).value || '',
    unitId:   unitId,
    date:     (document.getElementById('dateField') || {}).value || '',
    records:  {}
  };
  RECORDS.forEach(r => {
    const el = document.getElementById('rec-' + r.id);
    if (el) payload.records[r.id] = el.value;
  });
  // Also save flag reason text
  payload.flagReasons = {};
  STEPS.forEach(code => {
    const el = document.getElementById('flag-reason-input-' + code);
    if (el) payload.flagReasons[code] = el.value;
  });
  try { localStorage.setItem(key, JSON.stringify(payload)); } catch(e) {}
}

function _loadState() {
  // Try to find any saved session for this page prefix
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k.startsWith('fieldcheck-' + PAGE_CONFIG.rentmanPrefix + '-')) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const p = JSON.parse(raw);
      return p;
    }
  } catch(e) {}
  return null;
}

function _clearState(unitId) {
  try { localStorage.removeItem(_saveKey(unitId)); } catch(e) {}
}


/* ── INIT ─────────────────────────────────────────────────── */

function initChecklist() {
  const state = {};
  STEPS.forEach(s => state[s] = null);
  window._state = state;
  window._pdfDownloaded = false;

  // Set today's date default
  const df = document.getElementById('dateField');
  if (df) df.valueAsDate = new Date();

  // Try to restore a saved session
  const saved = _loadState();
  if (saved) {
    _restoreSession(saved);
  }

  // Auto-save on meta field changes
  ['engineer','unitId','dateField'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', _saveState);
  });
  RECORDS.forEach(r => {
    const el = document.getElementById('rec-' + r.id);
    if (el) el.addEventListener('input', _saveState);
  });

  // PDF gate: catch browser-level navigation (tab close, back button)
  window.addEventListener('beforeunload', function(e) {
    const onCompletion = document.getElementById('completionScreen').classList.contains('visible');
    if (onCompletion && !window._pdfDownloaded) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  updateProgress();
}

function _restoreSession(p) {
  // Restore meta fields
  const eng = document.getElementById('engineer');
  const uid = document.getElementById('unitId');
  const df  = document.getElementById('dateField');
  if (eng && p.engineer) eng.value = p.engineer;
  if (uid && p.unitId)   uid.value = p.unitId;
  if (df  && p.date)     df.value  = p.date;

  // Restore step states
  if (p.state) {
    STEPS.forEach(code => {
      if (p.state[code]) {
        window._state[code] = p.state[code];
        _applyStepState(code, p.state[code]);
      }
    });
  }

  // Restore flag reasons
  if (p.flagReasons) {
    STEPS.forEach(code => {
      const el = document.getElementById('flag-reason-input-' + code);
      if (el && p.flagReasons[code]) el.value = p.flagReasons[code];
    });
  }

  // Restore record values
  if (p.records) {
    RECORDS.forEach(r => {
      const el = document.getElementById('rec-' + r.id);
      if (el && p.records[r.id] !== undefined) el.value = p.records[r.id];
    });
  }
}


/* ── STEP STATE ───────────────────────────────────────────── */

function setState(code, val) {
  window._state[code] = val;
  _applyStepState(code, val);
  _saveState();
  updateProgress();
}

function _applyStepState(code, val) {
  const row = document.getElementById('step-' + code);
  if (!row) return;

  row.classList.remove('state-pass', 'state-flag');
  if (val === 'pass') row.classList.add('state-pass');
  if (val === 'flag') row.classList.add('state-flag');

  row.querySelectorAll('.btn').forEach(b => {
    b.classList.remove('active');
    if (b.classList.contains('btn-pass') && val === 'pass') b.classList.add('active');
    if (b.classList.contains('btn-flag') && val === 'flag') b.classList.add('active');
    if (b.classList.contains('btn-na')   && val === 'na')   b.classList.add('active');
  });

  const reasonEl = document.getElementById('flag-reason-' + code);
  if (reasonEl) {
    if (val === 'flag') {
      reasonEl.classList.add('visible');
      const ta = reasonEl.querySelector('textarea');
      if (ta) ta.focus();
    } else {
      reasonEl.classList.remove('visible');
    }
  }
}


/* ── PROGRESS ─────────────────────────────────────────────── */

function updateProgress() {
  const answered = STEPS.filter(s => window._state[s] !== null).length;
  const pct = Math.round((answered / STEPS.length) * 100);
  const bar = document.getElementById('progressBar');
  const lbl = document.getElementById('progressLabel');
  if (bar) bar.style.width = pct + '%';
  if (lbl) lbl.textContent = answered + ' of ' + STEPS.length + ' steps complete';
}


/* ── SUBMIT ───────────────────────────────────────────────── */

function handleSubmit() {
  const engineer = (document.getElementById('engineer') || {}).value?.trim() || '';
  const unitId   = (document.getElementById('unitId')   || {}).value?.trim() || '';

  if (!engineer || !unitId) {
    _showWarning('Engineer name and Unit ID are required before submitting.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  const unanswered = STEPS.filter(s => window._state[s] === null);
  if (unanswered.length > 0) {
    _showWarning('Complete all steps before submitting.');
    const first = document.getElementById('step-' + unanswered[0]);
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const date   = (document.getElementById('dateField') || {}).value || '';
  const year   = date ? new Date(date).getFullYear() : new Date().getFullYear();
  const uid    = unitId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const refNum = PAGE_CONFIG.rentmanPrefix + '-' + uid + '-service-' + year;

  const records = {};
  RECORDS.forEach(r => {
    const el = document.getElementById('rec-' + r.id);
    records[r.id] = el ? el.value : '';
  });

  const flagReasons = {};
  STEPS.forEach(code => {
    if (window._state[code] === 'flag') {
      const el = document.getElementById('flag-reason-input-' + code);
      flagReasons[code] = el ? el.value.trim() : '';
    }
  });

  const flagged = STEPS.filter(s => window._state[s] === 'flag');

  window._completedData = { engineer, unitId, date, refNum, records, flagged, flagReasons };
  window._pdfDownloaded = false;

  // Hide checklist, show completion screen
  const body = document.getElementById('checklistBody');
  const screen = document.getElementById('completionScreen');
  const mainHeader = document.getElementById('mainHeader');
  const metaGrid = document.getElementById('metaGrid');
  const completionHeader = document.getElementById('completionHeader');

  if (body) body.style.display = 'none';
  if (screen) screen.classList.add('visible');
  if (mainHeader) mainHeader.style.display = 'none';
  if (metaGrid) metaGrid.style.display = 'none';
  if (completionHeader) completionHeader.classList.add('visible');

  const refEl = document.getElementById('refNumber');
  const subEl = document.getElementById('completionSub');
  if (refEl) refEl.textContent = refNum;
  if (subEl) subEl.textContent = engineer + ' · ' + unitId + ' · ' + (date || 'Today');

  if (flagged.length > 0) {
    const notice = document.getElementById('flaggedNotice');
    const list   = document.getElementById('flaggedList');
    if (notice) notice.style.display = 'block';
    if (list) {
      list.innerHTML = flagged.map(f => {
        const reason = flagReasons[f] ? ' — ' + flagReasons[f] : '';
        return '<div class="flagged-notice-item">⚑ ' + f + ' — ' + STEP_TEXT[f] + reason + '</div>';
      }).join('');
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function _showWarning(msg) {
  const wb = document.getElementById('warningBar');
  if (!wb) return;
  wb.textContent = msg;
  wb.style.display = 'block';
}


/* ── NAVIGATION (completion screen) ──────────────────────── */

function goHome() {
  if (!window._pdfDownloaded) {
    if (!confirm('PDF not yet downloaded — your service record won\'t be saved to Rentman. Leave anyway?')) return;
  }
  _clearState(window._completedData?.unitId || '');
  window.location.href = 'index.html';
}

function doMore() {
  if (!window._pdfDownloaded) {
    if (!confirm('PDF not yet downloaded — your service record won\'t be saved to Rentman. Leave anyway?')) return;
  }
  _clearState(window._completedData?.unitId || '');
  window.location.reload();
}


/* ── PDF GENERATION ───────────────────────────────────────── */

function generatePDF() {
  const d = window._completedData;
  if (!d) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const black = [13, 17, 23];
  const grey  = [100, 100, 100];
  const lgrey = [210, 210, 210];
  const red   = [180, 40, 40];
  const pw = 210, ph = 297, ml = 20, mr = 20;
  const cw = pw - ml - mr;
  let y = 20;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...black);
  doc.text(PAGE_CONFIG.title + ' — Service Record', ml, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...grey);
  doc.text('SOP ' + PAGE_CONFIG.sopVersion + '  ·  Generated by Fieldcheck', ml, y);
  y += 10;

  // Meta block
  doc.setFontSize(10);
  doc.setTextColor(...black);
  [['Unit ID', d.unitId], ['Engineer', d.engineer], ['Date', d.date || '']].forEach(([lbl, val]) => {
    doc.setFont('helvetica', 'bold');   doc.text(lbl + ':', ml, y);
    doc.setFont('helvetica', 'normal'); doc.text(val, ml + 30, y);
    y += 6;
  });
  y += 4;

  // Divider
  doc.setDrawColor(...lgrey);
  doc.setLineWidth(0.4);
  doc.line(ml, y, pw - mr, y);
  y += 8;

  // Steps heading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...black);
  doc.text('Inspection Steps', ml, y);
  y += 7;

  // Steps — flag reason NOT shown inline, only [FLAG] marker
  STEPS.forEach(code => {
    if (y > ph - 30) { doc.addPage(); y = 20; }

    const result = window._state[code];
    const sym = result === 'pass' ? '[PASS]'
              : result === 'flag' ? '[FLAG]'
              : result === 'na'   ? '[N/A]'
              :                     '[    ]';

    const lines = doc.splitTextToSize(STEP_TEXT[code], cw - 22);

    // Step code
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...grey);
    doc.text(code, ml, y);

    // Step text
    doc.setFont('helvetica', result === 'flag' ? 'bold' : 'normal');
    doc.setFontSize(10);
    doc.setTextColor(result === 'flag' ? red[0] : black[0],
                     result === 'flag' ? red[1] : black[1],
                     result === 'flag' ? red[2] : black[2]);
    doc.text(lines, ml + 12, y);

    // Result marker — right aligned
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...(result === 'flag' ? red : result === 'pass' ? [30, 100, 40] : grey));
    doc.text(sym, pw - mr, y, { align: 'right' });

    y += lines.length * 5.5 + 2;
  });

  y += 4;

  // Records section
  if (y > ph - 50) { doc.addPage(); y = 20; }
  doc.setDrawColor(...lgrey);
  doc.line(ml, y, pw - mr, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...black);
  doc.text('Records / Observations', ml, y);
  y += 7;

  RECORDS.forEach(r => {
    if (y > ph - 30) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...grey);
    doc.text(r.label, ml, y);
    y += 5;

    const val = d.records[r.id] || '—';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...black);
    const vlines = doc.splitTextToSize(val, cw);
    doc.text(vlines, ml, y);
    y += vlines.length * 5.5 + 6;
  });

  // Flagged summary — reason shown here only
  if (d.flagged.length > 0) {
    if (y > ph - 50) { doc.addPage(); y = 20; }
    doc.setDrawColor(...lgrey);
    doc.line(ml, y, pw - mr, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...red);
    doc.text('⚑  Flagged Items — Follow-up Required', ml, y);
    y += 8;

    d.flagged.forEach(f => {
      if (y > ph - 25) { doc.addPage(); y = 20; }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...black);
      const fl = doc.splitTextToSize(f + '  —  ' + STEP_TEXT[f], cw - 6);
      doc.text(fl, ml + 4, y);
      y += fl.length * 5.5 + 1;

      if (d.flagReasons[f]) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(...red);
        const rl = doc.splitTextToSize('Reason: ' + d.flagReasons[f], cw - 10);
        doc.text(rl, ml + 4, y);
        y += rl.length * 5 + 4;
      } else {
        y += 2;
      }

      doc.setTextColor(...black);
    });
  }

  // Rentman footer note
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...grey);
  const note = 'Save this file to the relevant unit in Rentman using filename: ' + d.refNum;
  doc.text(doc.splitTextToSize(note, cw), ml, ph - 14);

  doc.save(d.refNum + '.pdf');

  // Mark PDF as downloaded — unlock navigation
  window._pdfDownloaded = true;
  _clearState(d.unitId);
  _showPDFConfirmed();
}

function _showPDFConfirmed() {
  const btn = document.getElementById('pdfBtn');
  if (btn) {
    btn.textContent = '✓  PDF Downloaded';
    btn.style.background = '#238636';
    btn.style.color = '#fff';
  }
  const gate = document.getElementById('pdfGateNote');
  if (gate) gate.style.display = 'none';
}
