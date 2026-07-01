import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, query, onSnapshot, orderBy, doc, deleteDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const page = window.MHO_ADMIN_EXAMS_PAGE;
const app = getApps().length ? getApp() : initializeApp(window.MHO_EXAM_FIREBASE_CONFIG);
const db = getFirestore(app);
const esc = (value) => window.SafeDOM.escapeHTML(value);
const safeLink = (value) => window.SafeDOM.safeURL(value);
const helpers = window.MHO_EXAM_HELPERS;
const table = document.getElementById('examsTableBody');
const total = document.getElementById('totalExams');
const instrumentFilter = document.getElementById('instrumentFilter');
const filterControls = instrumentFilter?.closest('div.flex');
const filterLabelWrapper = instrumentFilter?.closest('label');
const parentTable = table?.closest('table');
let allRows = [];
const openSections = new Set();
let activeExamFolder = new URLSearchParams(window.location.search).get('folder') || '';

function t(key, fallback) {
  const value = window.i18n ? window.i18n.t(key) : '';
  return value && value !== key ? value : fallback;
}

function tr(key, fallback, vars = {}) {
  let value = t(key, fallback);
  Object.entries(vars).forEach(([name, replacement]) => {
    value = String(value).replaceAll(`{${name}}`, replacement);
  });
  return value;
}

function courseDisplayName(courseKey = page.course) {
  return t(`materials-course-${String(courseKey).toLowerCase()}`, page.label || courseKey || '');
}

function instrumentDisplayName(slug, fallback = '') {
  if (!slug) return fallback || t('common-unspecified', 'Nespecificat');
  return t(`materials-folder-${slug}`, fallback || helpers.labelForInstrument(slug) || slug);
}

function sessionDisplayName(session) {
  return String(session || '').replace('Sesia', t('materials-session-label', 'Curs'));
}

function safeSegment(value) { return String(value || 'nespecificat').trim().replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'nespecificat'; }
function formatDate(timestamp) {
  if (!timestamp) return '-';
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString(window.i18n ? (window.i18n.getLanguage() === 'ru' ? 'ru-RU' : 'ro-RO') : 'ro-RO', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) { return '-'; }
}
function getInstrumentLabel(row) { return instrumentDisplayName(row.instrumentSlug, row.instrument || helpers.labelForInstrument(row.instrumentSlug) || t('common-unspecified', 'Nespecificat')); }
function belongsToCourse(row) { return String(row.course || row.courseType || '').toLowerCase().includes(String(page.course).toLowerCase()); }
function isReviewed(row) { return row.reviewed === true || row.status === 'reviewed'; }
function sessionGroupLabel(row) {
  return row.session ? sessionDisplayName(row.session) + ' / ' + (row.group || '-') : (row.group || '-');
}
function courseRows() {
  return allRows.filter(belongsToCourse);
}
function rowsForActiveFolderBase() {
  const rows = courseRows();
  if (page.course !== 'ORNI') return rows;
  if (activeExamFolder === 'theory') return rows.filter(isTheoryExamRow);
  if (activeExamFolder === 'instrument') return rows.filter((row) => !isTheoryExamRow(row));
  return rows;
}
function filteredRows() {
  const selected = instrumentFilter ? instrumentFilter.value : 'all';
  const rows = rowsForActiveFolderBase();
  if (page.course === 'ORNI' && activeExamFolder === 'theory') {
    return rows.filter((row) => selected === 'all' || (selected === '__missing_session__' ? !row.session : row.session === selected));
  }
  return rows.filter((row) => selected === 'all' || (selected === '__missing__' ? !row.instrumentSlug : row.instrumentSlug === selected));
}
function isTheoryExamRow(row) {
  return row.submissionType === 'theory' || row.instrumentSlug === safeSegment(page.course) + '-teorie' || String(row.instrument || '').toLowerCase() === 'teorie';
}
function folderHubCardMarkup(key, title, description, rows) {
  const pendingCount = rows.filter((row) => !isReviewed(row)).length;
  const icon = key === 'theory' ? 'T' : 'I';
  return '<button type="button" class="admin-exam-folder-card" data-admin-exam-folder="' + esc(key) + '">' +
    '<span class="admin-exam-folder-visual" aria-hidden="true">' +
      '<span class="admin-exam-folder-tab"></span>' +
      '<span class="admin-exam-folder-body">' +
        '<span class="admin-exam-folder-paper one"></span>' +
        '<span class="admin-exam-folder-paper two"></span>' +
        '<span class="admin-exam-folder-icon">' + esc(icon) + '</span>' +
      '</span>' +
    '</span>' +
    '<span class="admin-exam-folder-kicker">' + esc(courseDisplayName()) + '</span>' +
    '<strong>' + esc(title) + '</strong>' +
    '<small>' + pendingCount + ' / ' + rows.length + ' · ' + esc(description) + '</small>' +
  '</button>';
}
function folderHubMarkup(rows) {
  const theoryRows = rows.filter(isTheoryExamRow);
  const instrumentRows = rows.filter((row) => !isTheoryExamRow(row));
  const cards = [
    folderHubCardMarkup(
      'theory',
      t('admin-exams-folder-theory', 'Examene de teorie'),
      t('admin-exams-folder-theory-desc', 'Deschide trimiterile de teorie.'),
      theoryRows
    ),
    folderHubCardMarkup(
      'instrument',
      t('admin-exams-folder-instrument', 'Examene de instrument'),
      t('admin-exams-folder-instrument-desc', 'Deschide trimiterile pe instrumente.'),
      instrumentRows
    )
  ].join('');
  return '<tr class="admin-exam-folder-row"><td colspan="10"><div class="admin-exam-folder-grid">' + cards + '</div></td></tr>';
}
function folderBackMarkup() {
  return '<tr class="admin-exam-folder-back-row"><td colspan="10"><button type="button" class="admin-exam-folder-back" data-admin-exam-folder-back>&larr; ' + t('admin-exams-back-folders', 'Inapoi la foldere') + '</button></td></tr>';
}
function setActiveExamFolder(folder) {
  activeExamFolder = folder || '';
  const url = new URL(window.location.href);
  if (activeExamFolder) url.searchParams.set('folder', activeExamFolder);
  else url.searchParams.delete('folder');
  window.history.replaceState({}, '', url);
  openSections.clear();
  fillInstrumentFilter();
  applyFilter();
}
function csvCell(value) {
  return '"' + String(value ?? '').replaceAll('"', '""') + '"';
}
function exportFilteredExamsToExcel() {
  const rows = filteredRows();
  if (!rows.length) {
    alert(t('admin-exams-export-empty', 'Nu exista examene de exportat pentru selectia curenta.'));
    return;
  }
  const headers = [
    t('admin-exams-export-full-name', 'Nume complet'),
    t('label-first-name-profile', 'Prenume'),
    t('label-last-name-profile', 'Nume'),
    t('label-email', 'Email'),
    t('common-course', 'Curs'),
    t('common-instrument', 'Instrument'),
    t('admin-exams-student-group', 'Grupa'),
    t('admin-exams-exam', 'Examen'),
    t('common-status', 'Status'),
    t('admin-exams-grade', 'Nota'),
    t('admin-exams-comment', 'Comentariu profesor'),
    t('common-file', 'Fisier'),
    t('admin-exams-performance', 'Interpretare'),
    t('admin-exams-scales', 'Game'),
    t('admin-exams-sent-at', 'Trimis la'),
  ];
  const csvRows = rows.map((row) => [
    `${row.firstName || ''} ${row.lastName || ''}`.trim(),
    row.firstName || '',
    row.lastName || '',
    row.email || row.userEmail || '',
    courseDisplayName(row.course || page.course),
    getInstrumentLabel(row),
    sessionGroupLabel(row),
    row.examTitle || '',
    isReviewed(row) ? t('admin-exams-reviewed', 'Controlat') : t('admin-exams-pending', 'In asteptare'),
    row.grade || '',
    row.teacherNote || '',
    row.fileURL || '',
    row.performanceFileURL || '',
    row.scalesFileURL || '',
    formatDate(row.timestamp || row.createdAt),
  ]);
  const csvContent = '\uFEFF' + [headers, ...csvRows].map((row) => row.map(csvCell).join(';')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  const selectedOption = instrumentFilter?.selectedOptions?.[0]?.textContent || t('admin-exams-all-instruments', 'Toate instrumentele');
  const scope = instrumentFilter?.value === 'all' ? 'toate_instrumentele' : safeSegment(selectedOption);
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `examene_${safeSegment(page.course)}_${scope}_${date}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  window.MHOAnalytics?.capture?.('admin_exams_exported', {
    course: page.course,
    folder: activeExamFolder || 'all',
    instrumentFilter: instrumentFilter?.value || 'all',
    count: rows.length,
  });
}
function ensureExportButton() {
  if (!filterControls || document.getElementById('exportExamsExcelBtn')) return;
  const backLink = filterControls.querySelector(`a[href="admin-${String(page.course).toLowerCase()}.html"]`);
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'exportExamsExcelBtn';
  button.className = 'text-emerald-700 hover:text-emerald-900 font-bold text-lg px-6 py-3 bg-emerald-50 rounded-xl transition shadow-sm';
  button.addEventListener('click', exportFilteredExamsToExcel);
  if (backLink) filterControls.insertBefore(button, backLink);
  else filterControls.appendChild(button);
}
function examFiles(row) {
  const seen = new Set();
  const files = [];
  const addFile = (file, index = files.length) => {
    const url = safeLink(typeof file === 'string' ? file : file?.fileURL || file?.url || file?.downloadURL || file?.href);
    if (!url || seen.has(url)) return;
    seen.add(url);
    files.push({
      fileURL: url,
      fileName: typeof file === 'string' ? '' : (file?.fileName || file?.name || ''),
      index,
    });
  };

  if (Array.isArray(row.files)) row.files.forEach(addFile);
  if (Array.isArray(row.uploadedFiles)) row.uploadedFiles.forEach(addFile);
  if (Array.isArray(row.fileURLs)) row.fileURLs.forEach(addFile);
  addFile({
    fileURL: row.fileURL,
    fileName: row.fileName,
  });
  return files;
}
function examFileLinksMarkup(row, missingText = t('admin-exams-file-missing', 'Fisier lipsa')) {
  const files = examFiles(row);
  if (files.length) {
    return '<div class="admin-exam-file-list" aria-label="' + esc(t('admin-exams-files', 'Fisiere examen')) + '">' + files.map((file, index) => {
      const label = files.length === 1
        ? t('label-exam-file', 'Descarca fisierul examenului')
        : tr('admin-exams-file-number', 'Fisier {number}', { number: index + 1 });
      const title = file.fileName ? ' title="' + esc(file.fileName) + '"' : '';
      return '<a href="' + file.fileURL + '" target="_blank" rel="noopener"' + title + '>' + esc(label) + '</a>';
    }).join('') + '</div>';
  }
  return '<span>' + missingText + '</span>';
}
function rowMarkup(row) {
  const files = examFiles(row);
  const fileUrl = files[0]?.fileURL || '';
  const performanceUrl = safeLink(row.performanceFileURL);
  const scalesUrl = safeLink(row.scalesFileURL);
  const checked = isReviewed(row);
  const grade = row.grade || '';
  const teacherNote = row.teacherNote || '';
  return '<tr class="hover:bg-gray-50 transition-colors">' +
    '<td class="px-8 py-6 whitespace-nowrap text-lg font-semibold text-gray-900">' + esc(row.firstName) + ' ' + esc(row.lastName) + '</td>' +
    '<td class="px-8 py-6 whitespace-nowrap text-base text-gray-600">' + esc(getInstrumentLabel(row)) + '</td>' +
    '<td class="px-8 py-6 whitespace-nowrap text-base text-gray-600">' + esc(sessionGroupLabel(row)) + '</td>' +
    '<td class="px-8 py-6 whitespace-nowrap text-base text-gray-600">' + esc(row.examTitle || '-') + '</td>' +
    '<td class="px-8 py-6 min-w-72"><div class="admin-review-box"><label><input type="checkbox" data-review-checked="' + esc(row.id) + '"' + (checked ? ' checked' : '') + '> ' + t('admin-exams-reviewed', 'Controlat') + '</label><input type="text" data-review-grade="' + esc(row.id) + '" value="' + esc(grade) + '" placeholder="' + t('admin-exams-grade', 'Nota') + '" class="admin-review-grade"><input type="text" data-review-note="' + esc(row.id) + '" value="' + esc(teacherNote) + '" placeholder="' + t('admin-exams-comment', 'Comentariu') + '" class="admin-review-note"><button type="button" data-save-review="' + esc(row.id) + '">' + t('common-save', 'Salveaza') + '</button></div></td>' +
    '<td class="px-8 py-6 whitespace-nowrap">' + (fileUrl ? '<a href="' + fileUrl + '" target="_blank" rel="noopener" class="text-amber-600 font-bold hover:underline">' + t('common-file', 'Fisier') + (files.length > 1 ? ' ' + esc(files.length) : '') + '</a>' : '-') + '</td>' +
    '<td class="px-8 py-6 whitespace-nowrap">' + (performanceUrl ? '<a href="' + performanceUrl + '" target="_blank" rel="noopener" class="text-green-600 font-bold hover:underline">Video</a>' : '-') + '</td>' +
    '<td class="px-8 py-6 whitespace-nowrap">' + (scalesUrl ? '<a href="' + scalesUrl + '" target="_blank" rel="noopener" class="text-blue-600 font-bold hover:underline">' + t('admin-exams-scales', 'Game') + '</a>' : '-') + '</td>' +
    '<td class="px-8 py-6 whitespace-nowrap text-base text-gray-500">' + formatDate(row.timestamp || row.createdAt) + '</td>' +
    '<td class="px-8 py-6 whitespace-nowrap"><button data-delete-exam="' + esc(row.id) + '" class="text-red-600 hover:text-red-900 bg-red-50 px-4 py-2 rounded-lg transition-colors">' + t('common-delete', 'Sterge') + '</button></td>' +
    '</tr>';
}
function examCardMarkup(row) {
  const performanceUrl = safeLink(row.performanceFileURL);
  const scalesUrl = safeLink(row.scalesFileURL);
  const checked = isReviewed(row);
  const grade = row.grade || '';
  const teacherNote = row.teacherNote || '';
  const sessionGroup = sessionGroupLabel(row);
  return '<article class="admin-exam-card">' +
    '<div class="admin-exam-card-header">' +
      '<div>' +
        '<p class="admin-exam-card-kicker">' + esc(getInstrumentLabel(row)) + '</p>' +
        '<h3>' + esc(row.firstName) + ' ' + esc(row.lastName) + '</h3>' +
      '</div>' +
      '<span class="admin-exam-status ' + (checked ? 'is-reviewed' : '') + '">' + (checked ? t('admin-exams-reviewed', 'Controlat') : t('admin-exams-pending', 'In asteptare')) + '</span>' +
    '</div>' +
    '<dl class="admin-exam-card-meta">' +
      '<div><dt>' + t('admin-exams-student-group', 'Grupa') + '</dt><dd>' + esc(sessionGroup) + '</dd></div>' +
      '<div><dt>' + t('admin-exams-exam', 'Examen') + '</dt><dd>' + esc(row.examTitle || '-') + '</dd></div>' +
      '<div><dt>' + t('admin-exams-sent-at', 'Trimis la') + '</dt><dd>' + esc(formatDate(row.timestamp || row.createdAt)) + '</dd></div>' +
    '</dl>' +
    '<div class="admin-review-box admin-review-box-card">' +
      '<label><input type="checkbox" data-review-checked="' + esc(row.id) + '"' + (checked ? ' checked' : '') + '> ' + t('admin-exams-reviewed', 'Controlat') + '</label>' +
      '<input type="text" data-review-grade="' + esc(row.id) + '" value="' + esc(grade) + '" placeholder="' + t('admin-exams-grade', 'Nota') + '" class="admin-review-grade">' +
      '<input type="text" data-review-note="' + esc(row.id) + '" value="' + esc(teacherNote) + '" placeholder="' + t('admin-exams-comment', 'Comentariu') + '" class="admin-review-note">' +
      '<button type="button" data-save-review="' + esc(row.id) + '">' + t('common-save', 'Salveaza') + '</button>' +
    '</div>' +
    '<div class="admin-exam-card-actions">' +
      '<div class="admin-exam-card-links">' +
        examFileLinksMarkup(row) +
        (performanceUrl ? '<a href="' + performanceUrl + '" target="_blank" rel="noopener">' + t('admin-exams-performance', 'Interpretare') + '</a>' : '<span>' + t('admin-exams-performance-missing', 'Interpretare lipsa') + '</span>') +
        (scalesUrl ? '<a href="' + scalesUrl + '" target="_blank" rel="noopener">' + t('admin-exams-scales', 'Game') + '</a>' : '<span>' + t('admin-exams-scales-missing', 'Game lipsa') + '</span>') +
      '</div>' +
      '<button type="button" data-delete-exam="' + esc(row.id) + '" class="admin-delete-exam-button">' + t('common-delete', 'Sterge') + '</button>' +
    '</div>' +
  '</article>';
}
function studentExamRowMarkup(row) {
  const checked = isReviewed(row);
  return '<button type="button" class="admin-student-exam-row" data-open-exam-review="' + esc(row.id) + '">' +
    '<span class="admin-student-exam-main">' +
      '<strong>' + esc(row.firstName) + ' ' + esc(row.lastName) + '</strong>' +
      '<small>' + esc(getInstrumentLabel(row)) + ' · ' + esc(sessionGroupLabel(row)) + ' · ' + esc(row.examTitle || '-') + '</small>' +
    '</span>' +
    '<span class="admin-exam-status ' + (checked ? 'is-reviewed' : '') + '">' + (checked ? t('admin-exams-reviewed', 'Controlat') : t('admin-exams-pending', 'In asteptare')) + '</span>' +
    '<span class="admin-student-exam-date">' + esc(formatDate(row.timestamp || row.createdAt)) + '</span>' +
  '</button>';
}
function studentExamListMarkup(rows, title) {
  const sortedRows = [...rows].sort((a, b) => Number(isReviewed(a)) - Number(isReviewed(b)));
  return '<tr class="admin-student-exam-list-row"><td colspan="10">' +
    '<section class="admin-student-exam-list">' +
      '<header><h3>' + esc(title) + '</h3><span>' + rows.filter((row) => !isReviewed(row)).length + ' / ' + rows.length + '</span></header>' +
      '<div class="admin-student-exam-items">' + sortedRows.map(studentExamRowMarkup).join('') + '</div>' +
    '</section>' +
  '</td></tr>';
}
function examReviewModalMarkup(row) {
  const performanceUrl = safeLink(row.performanceFileURL);
  const scalesUrl = safeLink(row.scalesFileURL);
  const checked = isReviewed(row);
  const grade = row.grade || '';
  const teacherNote = row.teacherNote || '';
  return '<div class="admin-exam-modal-backdrop" data-exam-modal-backdrop>' +
    '<section class="admin-exam-modal" role="dialog" aria-modal="true" aria-label="' + esc(t('admin-exams-evaluation', 'Evaluare')) + '">' +
      '<button type="button" class="admin-exam-modal-close" data-close-exam-modal>&times;</button>' +
      '<div class="admin-exam-card-header">' +
        '<div>' +
          '<p class="admin-exam-card-kicker">' + esc(getInstrumentLabel(row)) + '</p>' +
          '<h3>' + esc(row.firstName) + ' ' + esc(row.lastName) + '</h3>' +
        '</div>' +
        '<span class="admin-exam-status ' + (checked ? 'is-reviewed' : '') + '">' + (checked ? t('admin-exams-reviewed', 'Controlat') : t('admin-exams-pending', 'In asteptare')) + '</span>' +
      '</div>' +
      '<dl class="admin-exam-card-meta">' +
        '<div><dt>' + t('admin-exams-student-group', 'Grupa') + '</dt><dd>' + esc(sessionGroupLabel(row)) + '</dd></div>' +
        '<div><dt>' + t('admin-exams-exam', 'Examen') + '</dt><dd>' + esc(row.examTitle || '-') + '</dd></div>' +
        '<div><dt>' + t('admin-exams-sent-at', 'Trimis la') + '</dt><dd>' + esc(formatDate(row.timestamp || row.createdAt)) + '</dd></div>' +
      '</dl>' +
      '<div class="admin-review-box admin-review-box-card">' +
        '<label><input type="checkbox" data-review-checked="' + esc(row.id) + '"' + (checked ? ' checked' : '') + '> ' + t('admin-exams-reviewed', 'Controlat') + '</label>' +
        '<input type="text" data-review-grade="' + esc(row.id) + '" value="' + esc(grade) + '" placeholder="' + t('admin-exams-grade', 'Nota') + '" class="admin-review-grade">' +
        '<input type="text" data-review-note="' + esc(row.id) + '" value="' + esc(teacherNote) + '" placeholder="' + t('admin-exams-comment', 'Comentariu') + '" class="admin-review-note">' +
        '<button type="button" data-save-review="' + esc(row.id) + '">' + t('common-save', 'Salveaza') + '</button>' +
      '</div>' +
      '<div class="admin-exam-card-links admin-exam-modal-links">' +
        examFileLinksMarkup(row) +
        (performanceUrl ? '<a href="' + performanceUrl + '" target="_blank" rel="noopener">' + t('admin-exams-performance', 'Interpretare') + '</a>' : '<span>' + t('admin-exams-performance-missing', 'Interpretare lipsa') + '</span>') +
        (scalesUrl ? '<a href="' + scalesUrl + '" target="_blank" rel="noopener">' + t('admin-exams-scales', 'Game') + '</a>' : '<span>' + t('admin-exams-scales-missing', 'Game lipsa') + '</span>') +
      '</div>' +
      '<button type="button" data-delete-exam="' + esc(row.id) + '" class="admin-delete-exam-button admin-exam-modal-delete">' + t('common-delete', 'Sterge') + '</button>' +
    '</section>' +
  '</div>';
}
function openExamReviewModal(id) {
  const row = allRows.find((item) => item.id === id);
  if (!row) return;
  document.getElementById('adminExamReviewModal')?.remove();
  const holder = document.createElement('div');
  holder.id = 'adminExamReviewModal';
  holder.innerHTML = examReviewModalMarkup(row);
  document.body.appendChild(holder);
  holder.querySelector('[data-review-grade="' + id + '"]')?.focus();
}
function closeExamReviewModal() {
  document.getElementById('adminExamReviewModal')?.remove();
}
function reviewedExamMarkup(row) {
  const performanceUrl = safeLink(row.performanceFileURL);
  const scalesUrl = safeLink(row.scalesFileURL);
  const grade = row.grade || '';
  const teacherNote = row.teacherNote || '';
  const sessionGroup = sessionGroupLabel(row);
  return '<div class="admin-reviewed-row">' +
    '<div class="admin-reviewed-main">' +
      '<strong>' + esc(row.firstName) + ' ' + esc(row.lastName) + '</strong>' +
      '<span>' + esc(sessionGroup) + ' · ' + esc(row.examTitle || '-') + '</span>' +
    '</div>' +
    '<label class="admin-reviewed-check"><input type="checkbox" data-review-checked="' + esc(row.id) + '" checked> ' + t('admin-exams-reviewed', 'Controlat') + '</label>' +
    '<input type="text" data-review-grade="' + esc(row.id) + '" value="' + esc(grade) + '" placeholder="' + t('admin-exams-grade', 'Nota') + '" class="admin-review-grade admin-reviewed-grade">' +
    '<input type="text" data-review-note="' + esc(row.id) + '" value="' + esc(teacherNote) + '" placeholder="' + t('admin-exams-comment', 'Comentariu') + '" class="admin-review-note admin-reviewed-note">' +
    '<div class="admin-reviewed-links">' +
      examFileLinksMarkup(row, '') +
      (performanceUrl ? '<a href="' + performanceUrl + '" target="_blank" rel="noopener">' + t('admin-exams-performance', 'Interpretare') + '</a>' : '') +
      (scalesUrl ? '<a href="' + scalesUrl + '" target="_blank" rel="noopener">' + t('admin-exams-scales', 'Game') + '</a>' : '') +
    '</div>' +
    '<button type="button" data-save-review="' + esc(row.id) + '" class="admin-reviewed-save">' + t('common-save', 'Salveaza') + '</button>' +
    '<button type="button" data-delete-exam="' + esc(row.id) + '" class="admin-reviewed-delete">' + t('common-delete', 'Sterge') + '</button>' +
  '</div>';
}
function groupedMarkup(rows) {
  const known = helpers.instrumentsForCourse(page.course);
  const groups = known.map((item) => ({
    key: item.slug,
    label: instrumentDisplayName(item.slug, item.instrument),
    rows: rows.filter((row) => row.instrumentSlug === item.slug)
  }));
  const theoryRows = rows.filter((row) => row.submissionType === 'theory' || row.instrumentSlug === safeSegment(page.course) + '-teorie');
  if (theoryRows.length) groups.unshift({ key: '__theory__', label: t('admin-exams-theory', 'Examene de teorie'), rows: theoryRows });
  const knownKeys = new Set(known.map((item) => item.slug));
  const otherRows = rows.filter((row) => !knownKeys.has(row.instrumentSlug) && row.submissionType !== 'theory' && row.instrumentSlug !== safeSegment(page.course) + '-teorie');
  if (otherRows.length) groups.push({ key: '__other__', label: t('common-unspecified', 'Nespecificat'), rows: otherRows });
  return groups.filter((group) => group.rows.length).map((group) => {
    const key = 'admin-section-' + safeSegment(group.key);
    const pendingRows = group.rows.filter((row) => !isReviewed(row));
    const reviewedRows = group.rows.filter(isReviewed);
    const isOpen = openSections.has(key);
    const pendingMarkup = pendingRows.length
      ? '<div class="admin-exam-card-grid">' + pendingRows.map(examCardMarkup).join('') + '</div>'
      : '<div class="admin-empty-pending">' + t('admin-exams-no-pending', 'Nu sunt examene noi de verificat in aceasta sectiune.') + '</div>';
    const reviewedMarkup = reviewedRows.length
      ? '<details class="admin-reviewed-section"><summary><span>' + t('admin-exams-reviewed', 'Controlate') + '</span><strong>' + reviewedRows.length + '</strong></summary><div class="admin-reviewed-list">' + reviewedRows.map(reviewedExamMarkup).join('') + '</div></details>'
      : '';
    return '<tr class="admin-instrument-section-row"><td colspan="10" class="px-8 py-5"><button type="button" class="admin-instrument-section-title" data-admin-section-toggle="' + esc(key) + '" aria-expanded="' + (isOpen ? 'true' : 'false') + '"><span>' + esc(group.label) + '</span><strong>' + pendingRows.length + ' / ' + group.rows.length + '</strong></button></td></tr>' +
      '<tr class="admin-section-content-row ' + (isOpen ? '' : 'hidden') + '" data-admin-section-row="' + esc(key) + '"><td colspan="10">' + pendingMarkup + reviewedMarkup + '</td></tr>';
  }).join('');
}
function applyFilter() {
  fillInstrumentFilter();
  const rows = filteredRows();
  if (total) total.textContent = String(rows.length);
  if (!table) return;
  if (!rows.length) { table.innerHTML = '<tr><td colspan="10" class="px-8 py-10 text-center text-gray-500 italic">' + t('admin-exams-no-submissions', 'Nu s-au gasit trimiteri de examene.') + '</td></tr>'; return; }
  if (page.course === 'ORNI') {
    const theoryRows = rows.filter(isTheoryExamRow);
    const instrumentRows = rows.filter((row) => !isTheoryExamRow(row));
    if (!activeExamFolder) {
      table.innerHTML = folderHubMarkup(rows);
      return;
    }
    if (activeExamFolder === 'theory') {
      table.innerHTML = folderBackMarkup() + (theoryRows.length ? studentExamListMarkup(theoryRows, t('admin-exams-folder-theory', 'Examene de teorie')) : '<tr><td colspan="10" class="px-8 py-10 text-center text-gray-500 italic">' + t('admin-exams-no-submissions', 'Nu s-au gasit trimiteri de examene.') + '</td></tr>');
      return;
    }
    table.innerHTML = folderBackMarkup() + (instrumentRows.length ? studentExamListMarkup(instrumentRows, t('admin-exams-folder-instrument', 'Examene de instrument')) : '<tr><td colspan="10" class="px-8 py-10 text-center text-gray-500 italic">' + t('admin-exams-no-submissions', 'Nu s-au gasit trimiteri de examene.') + '</td></tr>');
    return;
  }
  table.innerHTML = rows.map(rowMarkup).join('');
}
function setTopControlsVisibility() {
  const exportButton = document.getElementById('exportExamsExcelBtn');
  const shouldShowScopedControls = page.course !== 'ORNI' || Boolean(activeExamFolder);
  if (filterLabelWrapper) filterLabelWrapper.style.display = shouldShowScopedControls ? 'block' : 'none';
  if (exportButton) exportButton.style.display = shouldShowScopedControls ? 'inline-flex' : 'none';
}
function filterOption(value, label) {
  return '<option value="' + esc(value) + '">' + esc(label) + '</option>';
}
function fillInstrumentFilter() {
  if (!instrumentFilter) return;
  const previous = instrumentFilter.value || 'all';
  const filterLabel = filterLabelWrapper?.querySelector('span');
  if (page.course === 'ORNI' && !activeExamFolder) {
    instrumentFilter.innerHTML = filterOption('all', t('admin-exams-all-instruments', 'Toate instrumentele'));
    setTopControlsVisibility();
    return;
  }
  if (page.course === 'ORNI' && activeExamFolder === 'theory') {
    const theoryRows = courseRows().filter(isTheoryExamRow);
    const sessions = [...new Set(theoryRows.map((row) => row.session).filter(Boolean))];
    const sessionOptions = sessions.map((session) => filterOption(session, sessionDisplayName(session))).join('');
    const missingOption = theoryRows.some((row) => !row.session) ? filterOption('__missing_session__', t('common-unspecified', 'Nespecificat')) : '';
    if (filterLabel) filterLabel.textContent = t('common-course', 'Curs');
    instrumentFilter.innerHTML = filterOption('all', t('admin-materials-all-sessions', 'Toate cursurile')) + sessionOptions + missingOption;
    instrumentFilter.value = [...sessions, '__missing_session__'].includes(previous) ? previous : 'all';
    setTopControlsVisibility();
    return;
  }
  if (filterLabel) filterLabel.textContent = t('common-instrument', 'Instrument');
  const options = helpers.instrumentsForCourse(page.course).map((item) => filterOption(item.slug, instrumentDisplayName(item.slug, item.instrument))).join('');
  instrumentFilter.innerHTML = filterOption('all', t('admin-exams-all-instruments', 'Toate instrumentele')) + filterOption('__missing__', t('common-unspecified', 'Nespecificat')) + options;
  if ([...instrumentFilter.options].some((option) => option.value === previous)) instrumentFilter.value = previous;
  setTopControlsVisibility();
}
function updateStaticText() {
  ensureExportButton();
  const courseName = courseDisplayName();
  document.title = tr('admin-exams-page-browser-title', 'Examene {course} - MHO Music Academy', { course: courseName });
  const heading = document.querySelector('.admin-course-shell h2');
  if (heading) heading.textContent = tr('admin-exams-page-title', 'Examene - {course}', { course: courseName });
  const desc = document.querySelector('.admin-course-shell h2 + p');
  if (desc) desc.textContent = tr('admin-exams-page-desc', 'Acceseaza trimiterile de examene ale studentilor inscrisi la cursul {course}.', { course: courseName });
  const totalLabel = total?.parentElement?.querySelector('p');
  if (totalLabel) totalLabel.textContent = t('admin-exams-total', 'Total examene');
  const filterLabel = document.querySelector('label[for="instrumentFilter"], #instrumentFilter')?.closest('label')?.querySelector('span');
  if (filterLabel) filterLabel.textContent = t('common-instrument', 'Instrument');
  const backLink = document.querySelector(`a[href="admin-${String(page.course).toLowerCase()}.html"]`);
  if (backLink) backLink.textContent = tr('admin-exams-back-course-menu', 'Inapoi la meniul {course}', { course: courseName });
  const exportButton = document.getElementById('exportExamsExcelBtn');
  if (exportButton) exportButton.textContent = t('btn-export-excel', 'Export Excel');
  const headers = [
    ['admin-exams-student-name', 'Nume Student'],
    ['common-instrument', 'Instrument'],
    ['admin-exams-student-group', 'Grupa'],
    ['admin-exams-exam', 'Examen'],
    ['admin-exams-evaluation', 'Evaluare'],
    ['common-file', 'Fisier'],
    ['admin-exams-performance', 'Interpretare'],
    ['admin-exams-scales', 'Game'],
    ['admin-exams-sent-at', 'Trimis la'],
    ['admin-exams-actions', 'Actiuni'],
  ];
  document.querySelectorAll('thead th').forEach((th, index) => {
    const item = headers[index];
    if (item) th.textContent = t(item[0], item[1]);
  });
  const footerRights = document.querySelector('footer p');
  if (footerRights) footerRights.innerHTML = '&copy; 2025 MHO Music Academy. ' + t('footer-rights', 'Toate drepturile rezervate.');
}
async function initialize() {
  await window.AdminAccessReady;
  updateStaticText();
  if (page.course === 'ORNI') parentTable?.classList.add('admin-card-table');
  fillInstrumentFilter();
  instrumentFilter?.addEventListener('change', applyFilter);
  onSnapshot(query(collection(db, 'exams'), orderBy('timestamp', 'desc')), (snapshot) => { allRows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })); applyFilter(); }, (error) => { console.error('Failed to load exams:', error); if (table) table.innerHTML = '<tr><td colspan="10" class="px-8 py-10 text-center text-red-600 italic">' + t('admin-exams-load-error', 'Nu am putut incarca examenele.') + '</td></tr>'; });
}
table?.addEventListener('click', async (event) => { const button = event.target.closest('[data-delete-exam]'); if (!button || !confirm(t('admin-exams-delete-confirm', 'Sigur doriti sa stergeti?'))) return; try { await deleteDoc(doc(db, 'exams', button.dataset.deleteExam)); } catch (error) { console.error(error); } });
table?.addEventListener('click', async (event) => { const button = event.target.closest('[data-save-review]'); if (!button) return; const id = button.dataset.saveReview; const checked = table.querySelector('[data-review-checked="' + id + '"]')?.checked || false; const grade = table.querySelector('[data-review-grade="' + id + '"]')?.value.trim() || ''; const note = table.querySelector('[data-review-note="' + id + '"]')?.value.trim() || ''; const row = allRows.find((item) => item.id === id) || {}; button.disabled = true; const previous = button.textContent; button.textContent = t('admin-assignments-saving', 'Se salveaza...'); try { await updateDoc(doc(db, 'exams', id), { reviewed: checked, status: checked ? 'reviewed' : 'submitted', grade, teacherNote: note, reviewedAt: checked ? serverTimestamp() : null, updatedAt: serverTimestamp() }); window.MHOAnalytics?.capture?.('admin_exam_reviewed', { examId: id, course: row.course || page.course, instrument: row.instrument || '', instrumentSlug: row.instrumentSlug || '', session: row.session || row.group || '', reviewed: checked, hasGrade: Boolean(grade), hasComment: Boolean(note) }); button.textContent = t('admin-exams-saved', 'Salvat'); setTimeout(() => { button.textContent = previous; button.disabled = false; }, 1200); } catch (error) { console.error(error); button.textContent = t('common-error', 'Eroare'); setTimeout(() => { button.textContent = previous; button.disabled = false; }, 1600); } });
table?.addEventListener('click', (event) => { const toggle = event.target.closest('[data-admin-section-toggle]'); if (!toggle) return; const key = toggle.dataset.adminSectionToggle; const rows = table.querySelectorAll('[data-admin-section-row="' + key + '"]'); const isOpen = toggle.getAttribute('aria-expanded') === 'true'; toggle.setAttribute('aria-expanded', String(!isOpen)); if (isOpen) openSections.delete(key); else openSections.add(key); rows.forEach((row) => row.classList.toggle('hidden', isOpen)); });
table?.addEventListener('click', (event) => {
  const student = event.target.closest('[data-open-exam-review]');
  if (student) {
    openExamReviewModal(student.dataset.openExamReview);
    return;
  }
  const folder = event.target.closest('[data-admin-exam-folder]');
  if (folder) {
    setActiveExamFolder(folder.dataset.adminExamFolder);
    return;
  }
  const back = event.target.closest('[data-admin-exam-folder-back]');
  if (back) setActiveExamFolder('');
});
document.addEventListener('click', async (event) => {
  const modal = event.target.closest('#adminExamReviewModal');
  if (!modal) return;
  if (event.target.closest('[data-close-exam-modal]') || event.target.matches('[data-exam-modal-backdrop]')) {
    closeExamReviewModal();
    return;
  }
  const deleteButton = event.target.closest('[data-delete-exam]');
  if (deleteButton) {
    if (!confirm(t('admin-exams-delete-confirm', 'Sigur doriti sa stergeti?'))) return;
    try {
      await deleteDoc(doc(db, 'exams', deleteButton.dataset.deleteExam));
      closeExamReviewModal();
    } catch (error) {
      console.error(error);
    }
    return;
  }
  const saveButton = event.target.closest('[data-save-review]');
  if (!saveButton) return;
  const id = saveButton.dataset.saveReview;
  const checked = modal.querySelector('[data-review-checked="' + id + '"]')?.checked || false;
  const grade = modal.querySelector('[data-review-grade="' + id + '"]')?.value.trim() || '';
  const note = modal.querySelector('[data-review-note="' + id + '"]')?.value.trim() || '';
  const row = allRows.find((item) => item.id === id) || {};
  saveButton.disabled = true;
  const previous = saveButton.textContent;
  saveButton.textContent = t('admin-assignments-saving', 'Se salveaza...');
  try {
    await updateDoc(doc(db, 'exams', id), { reviewed: checked, status: checked ? 'reviewed' : 'submitted', grade, teacherNote: note, reviewedAt: checked ? serverTimestamp() : null, updatedAt: serverTimestamp() });
    window.MHOAnalytics?.capture?.('admin_exam_reviewed', { examId: id, course: row.course || page.course, instrument: row.instrument || '', instrumentSlug: row.instrumentSlug || '', session: row.session || row.group || '', reviewed: checked, hasGrade: Boolean(grade), hasComment: Boolean(note) });
    saveButton.textContent = t('admin-exams-saved', 'Salvat');
    setTimeout(() => { saveButton.textContent = previous; saveButton.disabled = false; }, 1200);
  } catch (error) {
    console.error(error);
    saveButton.textContent = t('common-error', 'Eroare');
    setTimeout(() => { saveButton.textContent = previous; saveButton.disabled = false; }, 1600);
  }
});
initialize().catch((error) => { console.error('Failed to initialize exams admin page:', error); if (table) table.innerHTML = '<tr><td colspan="10" class="px-8 py-10 text-center text-red-600 italic">' + t('admin-exams-init-error', 'Nu am putut porni pagina de administrare.') + '</td></tr>'; });

window.addEventListener('mho:language-change', () => {
  window.location.reload();
});
