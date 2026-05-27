/* ============================================================
   Fieldcheck — Shared Checklist Logic  v2.2
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

   Each step row:             id="step-{CODE}"
   Each flag reason block:    id="flag-reason-{CODE}"
   Each flag reason textarea: id="flag-reason-input-{CODE}"
   Each record input:         id="rec-{RECORD_ID}"

   Photo UI is injected automatically into each flag-reason
   block by the JS — no extra HTML needed in the checklist.

   LOCALSTORAGE
   ------------
   State is saved automatically on every button press.
   Key format: fieldcheck-{rentmanPrefix}
   On load, if a saved session exists for the current page,
   it is restored automatically (state, meta fields, records).
   Photos are NOT persisted to localStorage — they must be
   re-attached if the page reloads before submission.

   PDF GATE
   --------
   Navigation away from the completion screen is blocked
   until the PDF has been downloaded. A prompt fires if
   the user tries to leave early.

   PHOTO UPLOAD
   ------------
   When a step is flagged, a photo upload button appears
   alongside the reason text field. Photos are compressed
   automatically (max 1000px longest side, JPEG 75%) and
   held in memory as base64. On PDF generation, each photo
   is embedded under its flagged item in the summary section.

   ============================================================ */


/* ── IMAGE STORE (in-memory, not persisted) ───────────────── */
window._flagPhotos = {};


/* ── IMAGE COMPRESSION ────────────────────────────────────── */

function _compressImage(file, callback) {
  const MAX_PX  = 1000;
  const QUALITY = 0.75;

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      let w = img.width;
      let h = img.height;
      if (w > MAX_PX || h > MAX_PX) {
        if (w >= h) { h = Math.round(h * MAX_PX / w); w = MAX_PX; }
        else        { w = Math.round(w * MAX_PX / h); h = MAX_PX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', QUALITY));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}


/* ── PHOTO UI (injected into each flag-reason block) ─────── */

function _injectPhotoUI(code) {
  const reasonBlock = document.getElementById('flag-reason-' + code);
  if (!reasonBlock || document.getElementById('flag-photo-wrap-' + code)) return;

  const wrap = document.createElement('div');
  wrap.className = 'flag-photo-wrap';
  wrap.id = 'flag-photo-wrap-' + code;
  wrap.innerHTML =
    '<label class="flag-photo-btn" id="flag-photo-label-' + code + '" for="flag-photo-input-' + code + '">' +
      '<span class="flag-photo-icon">&#128247;</span> Attach photo' +
    '</label>' +
    '<input type="file" accept="image/*" capture="environment" ' +
      'class="flag-photo-input-hidden" ' +
      'id="flag-photo-input-' + code + '" ' +
      'onchange="_handlePhotoInput(\'' + code + '\')">' +
    '<img class="flag-photo-preview" id="flag-photo-preview-' + code + '" src="" style="display:none;">' +
    '<button class="flag-photo-remove" id="flag-photo-remove-' + code + '" ' +
      'style="display:none;" onclick="_removePhoto(\'' + code + '\')">Remove photo</button>';

  reasonBlock.appendChild(wrap);
}

function _handlePhotoInput(code) {
  const input = document.getElementById('flag-photo-input-' + code);
  if (!input || !input.files || !input.files[0]) return;

  _compressImage(input.files[0], function(dataURL) {
    window._flagPhotos[code] = dataURL;

    const preview = document.getElementById('flag-photo-preview-' + code);
    const label   = document.getElementById('flag-photo-label-' + code);
    const remove  = document.getElementById('flag-photo-remove-' + code);

    if (preview) { preview.src = dataURL; preview.style.display = 'block'; }
    if (label)   { label.innerHTML = '<span class="flag-photo-icon">&#10003;</span> Photo attached — tap to change'; label.style.color = '#3fb950'; }
    if (remove)  { remove.style.display = 'inline-block'; }
  });
}

function _removePhoto(code) {
  delete window._flagPhotos[code];
  const input   = document.getElementById('flag-photo-input-' + code);
  const preview = document.getElementById('flag-photo-preview-' + code);
  const label   = document.getElementById('flag-photo-label-' + code);
  const remove  = document.getElementById('flag-photo-remove-' + code);
  if (input)   input.value = '';
  if (preview) { preview.src = ''; preview.style.display = 'none'; }
  if (label)   { label.innerHTML = '<span class="flag-photo-icon">&#128247;</span> Attach photo'; label.style.color = ''; }
  if (remove)  { remove.style.display = 'none'; }
}


/* ── LOCALSTORAGE HELPERS ─────────────────────────────────── */

function _saveKey() {
  return 'fieldcheck-' + PAGE_CONFIG.rentmanPrefix;
}

function _saveState() {
  const key = _saveKey();
  const payload = {
    state:    window._state,
    engineer: (document.getElementById('engineer')  || {}).value || '',
    unitId:   (document.getElementById('unitId')    || {}).value || '',
    date:     (document.getElementById('dateField') || {}).value || '',
    records:  {},
    flagReasons: {}
  };
  RECORDS.forEach(r => {
    const el = document.getElementById('rec-' + r.id);
    if (el) payload.records[r.id] = el.value;
  });
  STEPS.forEach(code => {
    const el = document.getElementById('flag-reason-input-' + code);
    if (el) payload.flagReasons[code] = el.value;
  });
  try { localStorage.setItem(key, JSON.stringify(payload)); } catch(e) {}
}

function _loadState() {
  try {
    const raw = localStorage.getItem(_saveKey());
    if (!raw) return null;
    return JSON.parse(raw);
  } catch(e) {}
  return null;
}

function _clearState() {
  try { localStorage.removeItem(_saveKey()); } catch(e) {}
}


/* ── INIT ─────────────────────────────────────────────────── */

function initChecklist() {
  const state = {};
  STEPS.forEach(s => state[s] = null);
  window._state       = state;
  window._pdfDownloaded = false;
  window._flagPhotos  = {};

  const df = document.getElementById('dateField');
  if (df) df.valueAsDate = new Date();

  const saved = _loadState();
  if (saved) _restoreSession(saved);

  ['engineer','unitId','dateField'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', _saveState);
  });
  RECORDS.forEach(r => {
    const el = document.getElementById('rec-' + r.id);
    if (el) el.addEventListener('input', _saveState);
  });

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
  const eng = document.getElementById('engineer');
  const uid = document.getElementById('unitId');
  const df  = document.getElementById('dateField');
  if (eng && p.engineer) eng.value = p.engineer;
  if (uid && p.unitId)   uid.value = p.unitId;
  if (df  && p.date)     df.value  = p.date;

  if (p.state) {
    STEPS.forEach(code => {
      if (p.state[code]) {
        window._state[code] = p.state[code];
        _applyStepState(code, p.state[code]);
      }
    });
  }
  if (p.flagReasons) {
    STEPS.forEach(code => {
      const el = document.getElementById('flag-reason-input-' + code);
      if (el && p.flagReasons[code]) el.value = p.flagReasons[code];
    });
  }
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
      _injectPhotoUI(code);
      const ta = reasonEl.querySelector('textarea');
      if (ta) ta.focus();
    } else {
      reasonEl.classList.remove('visible');
      _removePhoto(code);
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

  const body             = document.getElementById('checklistBody');
  const screen           = document.getElementById('completionScreen');
  const mainHeader       = document.getElementById('mainHeader');
  const metaGrid         = document.getElementById('metaGrid');
  const completionHeader = document.getElementById('completionHeader');

  if (body)             body.style.display = 'none';
  if (screen)           screen.classList.add('visible');
  if (mainHeader)       mainHeader.style.display = 'none';
  if (metaGrid)         metaGrid.style.display = 'none';
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
        const photo  = window._flagPhotos[f]
          ? '<div class="flagged-thumb-wrap"><img class="flagged-thumb" src="' + window._flagPhotos[f] + '"></div>'
          : '';
        return '<div class="flagged-notice-item">\u26F3 ' + f + ' \u2014 ' + STEP_TEXT[f] + reason + photo + '</div>';
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


/* ── NAVIGATION ───────────────────────────────────────────── */

function goHome() {
  if (!window._pdfDownloaded) {
    if (!confirm('PDF not yet downloaded \u2014 your service record won\'t be saved to Rentman. Leave anyway?')) return;
  }
  _clearState();
  window.location.href = 'index.html';
}

function doMore() {
  if (!window._pdfDownloaded) {
    if (!confirm('PDF not yet downloaded \u2014 your service record won\'t be saved to Rentman. Leave anyway?')) return;
  }
  _clearState();
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

  function checkPage(needed) {
    if (y + (needed || 15) > ph - 20) { doc.addPage(); y = 20; }
  }

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...black);
  doc.text(PAGE_CONFIG.title + ' \u2014 Service Record', ml, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...grey);
  doc.text('SOP ' + PAGE_CONFIG.sopVersion + '  \u00B7  Generated by Fieldcheck', ml, y);
  y += 10;

  // Meta
  doc.setFontSize(10);
  doc.setTextColor(...black);
  [['Unit ID', d.unitId], ['Engineer', d.engineer], ['Date', d.date || '']].forEach(([lbl, val]) => {
    doc.setFont('helvetica', 'bold');   doc.text(lbl + ':', ml, y);
    doc.setFont('helvetica', 'normal'); doc.text(val, ml + 30, y);
    y += 6;
  });
  y += 4;

  // Steps
  doc.setDrawColor(...lgrey);
  doc.setLineWidth(0.4);
  doc.line(ml, y, pw - mr, y);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...black);
  doc.text('Inspection Steps', ml, y);
  y += 7;

  STEPS.forEach(code => {
    checkPage(12);
    const result = window._state[code];
    const sym = result === 'pass' ? '[PASS]'
              : result === 'flag' ? '[FLAG]'
              : result === 'na'   ? '[N/A]'
              :                     '[    ]';
    const lines = doc.splitTextToSize(STEP_TEXT[code], cw - 22);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...grey);
    doc.text(code, ml, y);

    doc.setFont('helvetica', result === 'flag' ? 'bold' : 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...(result === 'flag' ? red : black));
    doc.text(lines, ml + 12, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...(result === 'flag' ? red : result === 'pass' ? [30, 100, 40] : grey));
    doc.text(sym, pw - mr, y, { align: 'right' });

    y += lines.length * 5.5 + 2;
  });

  y += 4;

  // Records
  checkPage(20);
  doc.setDrawColor(...lgrey);
  doc.line(ml, y, pw - mr, y);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...black);
  doc.text('Records / Observations', ml, y);
  y += 7;

  RECORDS.forEach(r => {
    checkPage(16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...grey);
    doc.text(r.label, ml, y);
    y += 5;
    const val = d.records[r.id] || '\u2014';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...black);
    const vlines = doc.splitTextToSize(val, cw);
    doc.text(vlines, ml, y);
    y += vlines.length * 5.5 + 6;
  });

  // Flagged summary — reasons + photos
  if (d.flagged.length > 0) {
    checkPage(20);
    doc.setDrawColor(...lgrey);
    doc.line(ml, y, pw - mr, y);
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...red);
    doc.text('Flagged Items \u2014 Follow-up Required', ml, y);
    y += 9;

    d.flagged.forEach(f => {
      checkPage(18);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...black);
      const fl = doc.splitTextToSize(f + '  \u2014  ' + STEP_TEXT[f], cw - 6);
      doc.text(fl, ml + 4, y);
      y += fl.length * 5.5 + 1;

      if (d.flagReasons[f]) {
        checkPage(10);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(...red);
        const rl = doc.splitTextToSize('Reason: ' + d.flagReasons[f], cw - 10);
        doc.text(rl, ml + 4, y);
        y += rl.length * 5 + 3;
      }

      const photo = window._flagPhotos[f];
      if (photo) {
        const tmpImg = new Image();
        tmpImg.src = photo;
        const nw = tmpImg.naturalWidth  || 1000;
        const nh = tmpImg.naturalHeight || 750;
        const mmPerPx = 25.4 / 150;
        let imgW = Math.min(nw * mmPerPx, cw - 4);
        let imgH = nh * (imgW / (nw * mmPerPx)) * mmPerPx;
        const maxH = (ph - 40) * 0.66;
        if (imgH > maxH) { imgW = imgW * (maxH / imgH); imgH = maxH; }
        checkPage(imgH + 8);
        doc.addImage(photo, 'JPEG', ml + 4, y, imgW, imgH);
        y += imgH + 6;
      }

      doc.setTextColor(...black);
      y += 3;
    });
  }

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...grey);
  const note = 'Save this file to the relevant unit in Rentman using filename: ' + d.refNum;
  doc.text(doc.splitTextToSize(note, cw), ml, ph - 14);

  doc.save(d.refNum + '.pdf');

  window._pdfDownloaded = true;
  _clearState();
  _showPDFConfirmed();
}

function _showPDFConfirmed() {
  const btn = document.getElementById('pdfBtn');
  if (btn) {
    btn.textContent = '\u2713  PDF Downloaded';
    btn.style.background = '#238636';
    btn.style.color = '#fff';
  }
  const gate = document.getElementById('pdfGateNote');
  if (gate) gate.style.display = 'none';
}
