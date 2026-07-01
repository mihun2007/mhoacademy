import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, query, onSnapshot, orderBy, doc, deleteDoc, addDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

const page = window.MHO_ADMIN_THEORY_PAGE;
const app = getApps().length ? getApp() : initializeApp(window.MHO_EXAM_FIREBASE_CONFIG);
const db = getFirestore(app);
const storage = getStorage(app);
const esc = (value) => window.SafeDOM.escapeHTML(value);
const safeLink = (value) => window.SafeDOM.safeURL(value);
const helpers = window.MHO_EXAM_HELPERS;
const teacherTable = document.getElementById('teacherExamsTableBody');
const form = document.getElementById('examFileUploadForm');
const statusMsg = document.getElementById('examFileStatusMessage');
const uploadBtn = document.getElementById('examFileUploadBtn');
const uploadBtnText = document.getElementById('examFileUploadBtnText');
const fileInput = document.getElementById('examFileUpload');
const fileInfo = document.getElementById('examFileInfo');
const fileNameDisplay = document.getElementById('examFileNameDisplay');
const instrumentSelect = document.getElementById('examFileInstrument');
let sessionSelect = document.getElementById('examFileSession');
const groupSelect = document.getElementById('examFileGroup');
const listInstrumentFilter = document.getElementById('teacherInstrumentFilter');
let allTheory = [];
let unsubscribeTheory = null;

const theorySessionOptions = [
  ['Sesia 1-2', 'Curs 1-2'],
  ['Sesia 3-4', 'Curs 3-4'],
  ['Sesia 5-6', 'Curs 5-6'],
];
const orniTheorySessionOptions = [...theorySessionOptions, ['Sesia 7', 'Curs 7']];
const standardGroupOptions = [
  'G',
  'B',
  'V',
  'A',
  'Armonie',
];

function t(key, fallback = key) {
  const value = window.i18n?.t?.(key);
  return value && value !== key ? value : fallback;
}

function tr(key, fallback, replacements = {}) {
  return Object.entries(replacements).reduce((text, [name, value]) => {
    return text.replaceAll('{' + name + '}', value ?? '');
  }, t(key, fallback));
}

function currentLang() {
  return window.i18n?.getLanguage?.() || localStorage.getItem('language') || 'ro';
}

function safeSegment(value) {
  return String(value || 'nespecificat').trim().replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'nespecificat';
}

function courseDisplayName(courseKey = page.course) {
  const key = String(courseKey || '').toLowerCase();
  return t('materials-course-' + key, page.label || courseKey || '');
}

function instrumentDisplayName(slug, fallback = '') {
  if (!slug) return fallback || t('common-unspecified', 'Nespecificat');
  return t('materials-folder-' + slug, fallback || helpers.labelForInstrument(slug) || slug);
}

function sessionDisplayName(session) {
  if (!session) return '';
  return String(session).replace(/^Sesia/i, t('materials-session-label', 'Curs'));
}

function formatDate(timestamp) {
  try {
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const locale = currentLang() === 'ru' ? 'ru-RU' : 'ro-RO';
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return '-';
  }
}

function showFileStatus(msg, type) {
  if (!statusMsg) return;
  statusMsg.textContent = msg;
  statusMsg.className = 'p-4 rounded-lg mb-6 ' + (type === 'success' ? 'bg-green-100 text-green-800' : type === 'info' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800');
  statusMsg.classList.remove('hidden');
  if (type !== 'info') setTimeout(() => statusMsg.classList.add('hidden'), 5000);
}

function uploadWithProgress(fileRef, file, metadata, onProgress) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(fileRef, file, metadata);
    task.on('state_changed', (snapshot) => onProgress(Math.round((snapshot.bytesTransferred / Math.max(snapshot.totalBytes, 1)) * 100)), reject, () => resolve(task.snapshot));
  });
}

function instrumentsOptions() {
  return helpers.instrumentsForCourse(page.course).map((item) => {
    return '<option value="' + esc(item.slug) + '">' + esc(instrumentDisplayName(item.slug, item.instrument)) + '</option>';
  }).join('');
}

function groupDisplayName(group) {
  const labels = {
    G: t('group-g', 'G'),
    B: t('group-b', 'B'),
    V: t('group-v', 'V'),
    A: t('group-a', 'A'),
    Armonie: t('group-harmony', 'Armonie'),
  };
  return labels[group] || group;
}

function groupOptions() {
  return standardGroupOptions.map((value) => '<option value="' + esc(value) + '">' + esc(groupDisplayName(value)) + '</option>').join('');
}

function sessionOptions() {
  const options = page?.course === 'ORNI' ? orniTheorySessionOptions : theorySessionOptions;
  return options.map(([value, label]) => '<option value="' + esc(value) + '">' + esc(sessionDisplayName(label)) + '</option>').join('');
}

function ensureSessionSelect() {
  if (sessionSelect || !groupSelect) return;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = '<label for="examFileSession" class="block text-lg font-medium text-gray-700 mb-2"></label><select id="examFileSession" required class="w-full px-6 py-4 border border-gray-300 rounded-xl text-lg"></select>';
  groupSelect.closest('div')?.before(wrapper);
  sessionSelect = wrapper.querySelector('#examFileSession');
}

function setLabel(selector, text) {
  const node = document.querySelector(selector);
  if (node) node.textContent = text;
}

function updateStaticText() {
  const courseName = courseDisplayName();
  document.title = tr('admin-theory-page-browser-title', 'Examene de Teorie {course} - MHO Music Academy', { course: courseName });

  setLabel('.admin-course-shell h2', tr('admin-theory-page-title', 'Examene de Teorie - {course}', { course: courseName }));
  setLabel('.admin-course-shell h2 + p', t('admin-theory-page-desc', 'Incarca fisierele de examen pentru studenti, separat pe curs si grupa.'));

  const selectedLabel = document.querySelector('.admin-course-shell .p-8.flex.justify-between.items-center p.text-base');
  if (selectedLabel) selectedLabel.textContent = t('admin-theory-selected-course', 'Curs selectat');
  const selectedCourse = selectedLabel?.parentElement?.querySelector('p.text-3xl');
  if (selectedCourse) selectedCourse.textContent = courseName;

  const backLink = document.querySelector('.admin-course-shell .p-8.flex.justify-between.items-center a');
  if (backLink) {
    backLink.textContent = tr('admin-exams-back-course-menu', 'Inapoi la meniul {course}', { course: courseName });
    backLink.href = 'admin-' + String(page.course || '').toLowerCase() + '.html';
  }

  const uploadTitle = document.querySelector('#examFileUploadForm')?.closest('.bg-white')?.querySelector('h3');
  if (uploadTitle) uploadTitle.textContent = t('admin-theory-upload-title', 'Incarcare examen nou pentru studenti');

  setLabel('label[for="examFileInstrument"]', t('common-instrument', 'Instrument') + ' *');
  setLabel('label[for="examFileSession"]', t('common-session', 'Curs') + ' *');
  setLabel('label[for="examFileGroup"]', t('common-group', 'Grupa') + ' *');
  setLabel('label[for="examFileName"]', t('admin-theory-exam-title-label', 'Titlu examen'));

  const examNameInput = document.getElementById('examFileName');
  if (examNameInput) examNameInput.placeholder = tr('admin-theory-title-placeholder', 'Ex: Examen Teorie {course}', { course: courseName });

  const fileBlock = fileInput?.closest('div');
  const fileLabel = fileBlock?.querySelector('label.block');
  if (fileLabel) fileLabel.textContent = t('admin-theory-file-label', 'Fisier examen') + ' *';
  const fileDropLabel = fileInput?.closest('label');
  const fileMainText = fileDropLabel?.querySelector('span.font-semibold');
  const fileHintText = fileDropLabel?.querySelector('span.text-sm');
  if (fileMainText) fileMainText.textContent = t('admin-theory-pick-file', 'Apasa pentru a alege fisierul');
  if (fileHintText) fileHintText.textContent = t('admin-theory-file-hint', 'PDF, DOC, DOCX, JPG, PNG (max. 5GB)');
  if (uploadBtnText && !uploadBtn?.disabled) uploadBtnText.textContent = t('admin-theory-upload-button', 'Incarca examenul');

  const listTitle = document.querySelector('#teacherInstrumentFilter')?.closest('.bg-white')?.querySelector('h3');
  if (listTitle) listTitle.textContent = t('admin-theory-list-title', 'Examene incarcate de profesori');

  const headers = document.querySelectorAll('#teacherExamsTableBody')?.[0]?.closest('table')?.querySelectorAll('thead th');
  const headerTexts = [
    t('common-instrument', 'Instrument'),
    t('common-group', 'Grupa'),
    t('admin-theory-exam-name', 'Nume examen'),
    t('admin-theory-upload-date', 'Data incarcarii'),
    t('admin-exams-actions', 'Actiuni'),
  ];
  headers?.forEach((header, index) => {
    header.textContent = headerTexts[index] || header.textContent;
  });

  const footerRights = document.querySelector('footer p');
  if (footerRights) footerRights.innerHTML = '&copy; 2025 MHO Music Academy. ' + t('footer-rights', 'Toate drepturile rezervate.');
}

function fillFilters() {
  const options = instrumentsOptions();
  ensureSessionSelect();
  updateStaticText();

  if (instrumentSelect) {
    instrumentSelect.closest('div')?.classList.add('hidden');
    instrumentSelect.required = false;
    instrumentSelect.innerHTML = '<option value="">' + esc(t('common-theory', 'Teorie')) + '</option>' + options;
  }
  if (sessionSelect) sessionSelect.innerHTML = '<option value="">' + esc(t('exam-placeholder-session', 'Selectati cursul...')) + '</option>' + sessionOptions();
  if (groupSelect) groupSelect.innerHTML = '<option value="">' + esc(t('exam-placeholder-group', 'Selectati grupa...')) + '</option>' + groupOptions();
  if (listInstrumentFilter) {
    const previousValue = listInstrumentFilter.value || 'all';
    listInstrumentFilter.innerHTML = '<option value="all">' + esc(t('admin-theory-all', 'Toate examenele de teorie')) + '</option><option value="__missing__">' + esc(t('common-unspecified', 'Nespecificat')) + '</option><option value="' + esc(safeSegment(page.course) + '-teorie') + '">' + esc(t('common-theory', 'Teorie')) + '</option>' + options;
    if ([...listInstrumentFilter.options].some((option) => option.value === previousValue)) listInstrumentFilter.value = previousValue;
    listInstrumentFilter.removeEventListener('change', renderTheoryList);
    listInstrumentFilter.addEventListener('change', renderTheoryList);
  }
}

function rowInstrument(row) {
  if (row.session) return t('common-theory', 'Teorie') + ' - ' + sessionDisplayName(row.session);
  return instrumentDisplayName(row.instrumentSlug, row.instrument || t('common-theory', 'Teorie'));
}

function renderTheoryList() {
  const selected = listInstrumentFilter?.value || 'all';
  const rows = allTheory
    .filter((row) => String(row.course || '').toLowerCase() === String(page.course).toLowerCase())
    .filter((row) => selected === 'all' || (selected === '__missing__' ? !row.instrumentSlug : row.instrumentSlug === selected));

  if (!teacherTable) return;
  if (!rows.length) {
    teacherTable.innerHTML = '<tr><td colspan="5" class="px-8 py-10 text-center text-gray-500 italic text-xl">' + esc(t('admin-theory-no-exams', 'Nu sunt examene incarcate.')) + '</td></tr>';
    return;
  }

  teacherTable.innerHTML = rows.map((row) => {
    const url = safeLink(row.fileURL);
    const groupText = row.session ? sessionDisplayName(row.session) + ' / ' + (row.group || '-') : (row.group || '-');
    const title = row.title || t('admin-theory-default-title', 'Examen de teorie');
    return '<tr class="hover:bg-gray-50"><td class="px-8 py-6 font-semibold">' + esc(rowInstrument(row)) + '</td><td class="px-8 py-6">' + esc(groupText) + '</td><td class="px-8 py-6"><div class="font-bold">' + esc(title) + '</div><div class="text-sm text-gray-500">' + esc(row.fileName || t('admin-theory-file-label', 'Fisier examen')) + '</div></td><td class="px-8 py-6">' + esc(formatDate(row.createdAt)) + '</td><td class="px-8 py-6 flex gap-2 flex-wrap">' + (url ? '<a href="' + url + '" target="_blank" rel="noopener" class="bg-indigo-50 px-4 py-2 rounded-lg font-semibold text-indigo-700 hover:bg-indigo-100">' + esc(t('admin-materials-view-file', 'Vezi fisier')) + '</a>' : '') + '<button data-edit-theory="' + esc(row.id) + '" data-group="' + esc(row.group || '') + '" data-title="' + esc(title) + '" class="bg-blue-50 px-4 py-2 rounded-lg font-semibold text-blue-700">' + esc(t('common-edit', 'Editeaza')) + '</button><button data-delete-theory="' + esc(row.id) + '" data-path="' + esc(row.filePath || '') + '" class="bg-red-50 px-4 py-2 rounded-lg font-semibold text-red-700">' + esc(t('common-delete', 'Sterge')) + '</button></td></tr>';
  }).join('');
}

fileInput?.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (!file) {
    fileInfo?.classList.add('hidden');
    if (fileNameDisplay) fileNameDisplay.textContent = '';
    return;
  }
  fileInfo?.classList.remove('hidden');
  if (fileNameDisplay) fileNameDisplay.textContent = file.name + ' (' + Math.round(file.size / 1024) + ' KB)';
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const file = fileInput.files?.[0];
  const session = sessionSelect?.value || '';
  const group = groupSelect?.value || '';
  if (!session || !group || !file) {
    showFileStatus(t('admin-theory-fill-error', 'Selecteaza cursul, grupa si fisierul.'), 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024 * 1024) {
    showFileStatus(t('admin-theory-size-error', 'Fisierul este prea mare. Maxim 5GB.'), 'error');
    return;
  }
  const previousText = uploadBtnText.textContent;
  uploadBtn.disabled = true;
  try {
    const storagePath = 'theory_exams/' + safeSegment(page.course) + '/' + safeSegment(session) + '/' + safeSegment(group) + '/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileRef = ref(storage, storagePath);
    const snapshot = await uploadWithProgress(fileRef, file, { contentType: file.type || 'application/octet-stream' }, (percent) => {
      uploadBtnText.textContent = t('admin-theory-uploading', 'Se incarca...') + ' ' + percent + '%';
      showFileStatus(t('admin-theory-uploading-file', 'Se incarca fisierul...') + ' ' + percent + '%', 'info');
    });
    const url = await getDownloadURL(snapshot.ref);
    await addDoc(collection(db, 'theory_exams'), {
      course: page.course,
      instrument: t('common-theory', 'Teorie'),
      instrumentSlug: safeSegment(page.course) + '-teorie',
      session,
      group,
      title: document.getElementById('examFileName').value || t('admin-theory-default-title', 'Examen de teorie'),
      fileURL: url,
      fileName: file.name,
      filePath: storagePath,
      fileSize: file.size,
      fileType: file.type,
      createdAt: serverTimestamp(),
    });
    showFileStatus(t('admin-theory-upload-success', 'Examen incarcat cu succes!'), 'success');
    form.reset();
    fileInfo?.classList.add('hidden');
  } catch (error) {
    console.error(error);
    showFileStatus(t('admin-theory-upload-error', 'Nu am putut incarca examenul.'), 'error');
  } finally {
    uploadBtn.disabled = false;
    uploadBtnText.textContent = previousText || t('admin-theory-upload-button', 'Incarca examenul');
  }
});

teacherTable?.addEventListener('click', async (event) => {
  const edit = event.target.closest('[data-edit-theory]');
  const del = event.target.closest('[data-delete-theory]');
  if (edit) {
    const group = prompt(t('admin-theory-edit-group-prompt', 'Grupa pentru examen:'), edit.dataset.group || '');
    if (group === null) return;
    const title = prompt(t('admin-theory-edit-title-prompt', 'Titlul examenului:'), edit.dataset.title || t('admin-theory-default-title', 'Examen de teorie'));
    if (title === null) return;
    try {
      await updateDoc(doc(db, 'theory_exams', edit.dataset.editTheory), { group: group.trim(), title: title.trim() || t('admin-theory-default-title', 'Examen de teorie') });
      showFileStatus(t('admin-theory-edit-success', 'Examen redactat cu succes.'), 'success');
    } catch (error) {
      console.error(error);
      showFileStatus(t('admin-theory-edit-error', 'Nu am putut redacta examenul.'), 'error');
    }
  }
  if (del) {
    if (!confirm(t('admin-theory-delete-confirm', 'Sigur stergi acest examen?'))) return;
    try {
      if (del.dataset.path) {
        try {
          await deleteObject(ref(storage, del.dataset.path));
        } catch (e) {
          console.warn('File delete skipped:', e);
        }
      }
      await deleteDoc(doc(db, 'theory_exams', del.dataset.deleteTheory));
      showFileStatus(t('admin-theory-delete-success', 'Examen sters cu succes.'), 'success');
    } catch (error) {
      console.error(error);
      showFileStatus(t('admin-theory-delete-error', 'Nu am putut sterge examenul.'), 'error');
    }
  }
});

async function initialize() {
  await window.AdminAccessReady;
  ensureSessionSelect();
  fillFilters();
  unsubscribeTheory = onSnapshot(query(collection(db, 'theory_exams'), orderBy('createdAt', 'desc')), (snapshot) => {
    allTheory = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderTheoryList();
  }, (error) => {
    console.error(error);
    if (teacherTable) teacherTable.innerHTML = '<tr><td colspan="5" class="px-8 py-10 text-center text-red-600 italic">' + esc(t('admin-theory-load-error', 'Nu am putut incarca examenele.')) + '</td></tr>';
  });
}

window.addEventListener('mho:language-change', () => {
  fillFilters();
  renderTheoryList();
});

window.addEventListener('beforeunload', () => {
  if (typeof unsubscribeTheory === 'function') unsubscribeTheory();
});

initialize().catch((error) => {
  console.error(error);
  if (teacherTable) teacherTable.innerHTML = '<tr><td colspan="5" class="px-8 py-10 text-center text-red-600 italic">' + esc(t('admin-theory-init-error', 'Nu am putut porni pagina de administrare.')) + '</td></tr>';
});
