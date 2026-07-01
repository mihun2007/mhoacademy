import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, collection, addDoc, doc, getDoc, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

const config = window.MHO_EXAM_PAGE;
const firebaseConfig = window.MHO_EXAM_FIREBASE_CONFIG;

if (!config || !firebaseConfig) {
  throw new Error('Missing exam page configuration.');
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const mount = document.getElementById('examFormMount');

window.MHOAnalytics?.capture?.('exam_page_opened', {
  course: config.course,
  instrument: config.instrument,
  instrumentSlug: config.instrumentSlug,
});

const dirijorGroups = [
  ['Sesia 1 (grupa B)', 'Curs 1 (grupa B)'],
  ['Sesia 2 (grupa A)', 'Curs 2 (grupa A)'],
  ['Sesia 3 (armonie)', 'Curs 3 (armonie)'],
  ['Sesia 4 (armonie)', 'Curs 4 (armonie)'],
  ['Sesia 5 (armonie)', 'Curs 5 (armonie)'],
  ['Sesia 6 (armonie)', 'Curs 6 (armonie)'],
];

const orniGroups = [
  ['Sesia 1-2', 'Curs 1-2'],
  ['Sesia 3-4', 'Curs 3-4'],
  ['Sesia 5-6', 'Curs 5-6'],
  ['Sesia 7', 'Curs 7'],
];

const standardGroups = [
  'G',
  'B',
  'V',
  'A',
  'Armonie',
];

function t(key, fallback) {
  const translated = window.i18n ? window.i18n.t(key) : '';
  return translated && translated !== key ? translated : fallback;
}

function tr(key, fallback, vars = {}) {
  let value = t(key, fallback);
  Object.entries(vars).forEach(([name, replacement]) => {
    value = String(value).replaceAll(`{${name}}`, replacement);
  });
  return value;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function safeSegment(value) {
  return String(value || 'nespecificat')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'nespecificat';
}

function formatFileSize(bytes) {
  if (!bytes) return '0 Bytes';
  const units = ['Bytes', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
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

function renderForm() {
  const groupSets = {
    Dirijor: dirijorGroups,
    ORNI: orniGroups,
  };
  const groupLabel = config.course === 'ORNI' ? tr('exam-label-session', 'Curs') : tr('common-group', 'Grupa');
  const groupPlaceholder = config.course === 'ORNI' ? tr('exam-placeholder-session', 'Selectati cursul...') : tr('exam-placeholder-group', 'Selectati grupa...');
  const groupEntries = (groupSets[config.course] || standardGroups).map((entry) => {
    const value = Array.isArray(entry) ? entry[0] : entry;
    const label = Array.isArray(entry) ? entry[1] : groupDisplayName(entry);
    return { value, label };
  });
  const groupOptions = groupEntries.map((entry) => `<option value="${esc(entry.value)}">${esc(entry.label)}</option>`).join('');
  const groupPickerListHtml = groupEntries.map((entry) => `<button type="button" class="exam-picker-option" data-group-value="${esc(entry.value)}">${esc(entry.label)}</button>`).join('');

  mount.innerHTML = `
    <div id="statusMessage" class="hidden mb-6 p-4 rounded-lg"></div>
    <form id="examForm" class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label for="firstName" class="block text-sm font-medium text-gray-700 mb-2">${tr('exam-label-family-name', 'Nume')} <span class="text-red-500">*</span></label>
          <input id="firstName" type="text" required class="w-full px-4 py-3 border rounded-lg" placeholder="${tr('exam-placeholder-family-name', 'Introduceti numele')}">
        </div>
        <div>
          <label for="lastName" class="block text-sm font-medium text-gray-700 mb-2">${tr('exam-label-given-name', 'Prenume')} <span class="text-red-500">*</span></label>
          <input id="lastName" type="text" required class="w-full px-4 py-3 border rounded-lg" placeholder="${tr('exam-placeholder-given-name', 'Introduceti prenumele')}">
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">${tr('common-course', 'Curs')}</label>
          <input type="text" value="${esc(config.courseLabel || config.course)}" disabled class="w-full px-4 py-3 border rounded-lg font-bold">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">${tr('common-instrument', 'Instrument')}</label>
          <input type="text" value="${esc(config.instrument)}" disabled class="w-full px-4 py-3 border rounded-lg font-bold">
        </div>
        <div>
          <label for="groupDisplayButton" class="block text-sm font-medium text-gray-700 mb-2">${groupLabel} <span class="text-red-500">*</span></label>
          <select id="group" class="hidden" tabindex="-1" aria-hidden="true">
            <option value="">${groupPlaceholder}</option>
            ${groupOptions}
          </select>
          <button type="button" id="groupDisplayButton" class="exam-group-trigger w-full px-4 py-3 border rounded-lg">
            <span id="groupDisplayText">${groupPlaceholder}</span>
            <span class="exam-group-caret" aria-hidden="true"></span>
          </button>
        </div>
      </div>

      <section id="examAssignmentBox" class="exam-assignment-box hidden" aria-live="polite">
        <div class="exam-assignment-header">
          <div>
            <p class="exam-assignment-kicker">${tr('exam-assignment-kicker', 'Sarcina pentru examen')}</p>
            <h3 id="examAssignmentTitle">${tr('exam-assignment-default-title', 'Cerinta profesorului')}</h3>
          </div>
          <span id="examAssignmentDeadline" class="hidden"></span>
        </div>
        <button type="button" id="examAssignmentToggle" class="exam-assignment-toggle" aria-expanded="true">
          <span id="examAssignmentToggleText">${tr('exam-assignment-collapse', 'Ascunde cerinta')}</span>
          <span class="exam-assignment-toggle-caret" aria-hidden="true"></span>
        </button>
        <div id="examAssignmentBody" class="exam-assignment-body">
          <div id="examAssignmentMessage" class="exam-assignment-message"></div>
          <a id="examAssignmentMaterialsLink" class="exam-assignment-materials-link" href="#" target="_blank" rel="noopener">
            ${tr('exam-assignment-materials-link', 'Deschide materialele pentru acest curs')}
          </a>
        </div>
      </section>

      <section id="examDeadlineNotice" class="exam-deadline-notice hidden" aria-live="polite">
        <div>
          <p>${tr('exam-deadline-notice-kicker', 'Termen limita examen')}</p>
          <strong id="examDeadlineNoticeDate"></strong>
        </div>
        <span id="examDeadlineNoticeCountdown"></span>
      </section>

      <div id="performanceUploadSection">
        <label for="performanceFile" class="block text-sm font-medium text-gray-700 mb-2">${tr('exam-performance-label', 'Video/Audio interpretare instrument')} <span id="performanceRequired" class="text-red-500">*</span><span class="block text-xs text-gray-500 mt-1">MP3, MP4, MOV (max. 5GB)</span></label>
        <label for="performanceFile" class="upload-card flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
          <span class="font-semibold text-sm text-gray-600">${tr('exam-performance-upload', 'Incarca interpretarea')}</span>
          <span class="text-xs text-gray-500 mt-1">${tr('exam-performance-file-hint', 'Fisierul interpretarii tale')}</span>
          <input id="performanceFile" type="file" accept=".mp3,.mp4,.mov" class="hidden">
        </label>
        <div id="performanceFileInfo" class="mt-4 hidden bg-green-50 border-2 border-green-200 rounded-xl p-4">
          <p class="text-green-800 font-bold text-sm truncate" id="performanceFileName"></p>
          <p class="text-green-600 text-xs" id="performanceFileSize"></p>
        </div>
      </div>

      <div id="scalesUploadSection">
        <label for="scalesFile" class="block text-sm font-medium text-gray-700 mb-2">${tr('exam-scales-label', 'Video/Audio game')} <span class="text-red-500">*</span><span class="block text-xs text-gray-500 mt-1">MP3, MP4, MOV (max. 5GB)</span></label>
        <label for="scalesFile" class="upload-card flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
          <span class="font-semibold text-sm text-gray-600">${tr('exam-scales-upload', 'Incarca gamele')}</span>
          <span class="text-xs text-gray-500 mt-1">${tr('exam-scales-file-hint', 'Fisierul cu gamele tale')}</span>
          <input id="scalesFile" type="file" accept=".mp3,.mp4,.mov" class="hidden">
        </label>
        <div id="scalesFileInfo" class="mt-4 hidden bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
          <p class="text-blue-800 font-bold text-sm truncate" id="scalesFileName"></p>
          <p class="text-blue-600 text-xs" id="scalesFileSize"></p>
        </div>
      </div>

      <div id="uploadProgressBox" class="exam-upload-progress hidden" aria-live="polite">
        <div class="exam-upload-progress-header">
          <span id="uploadProgressLabel">${tr('exam-upload-preparing', 'Se pregateste incarcarea...')}</span>
          <strong id="uploadProgressPercent">0%</strong>
        </div>
        <div class="exam-upload-progress-track">
          <span id="uploadProgressBar" style="width: 0%"></span>
        </div>
      </div>

      <button id="submitBtn" type="submit" class="public-cta w-full text-white py-4 rounded-2xl font-semibold text-lg transition shadow-lg disabled:opacity-50">
        <span id="submitBtnText">${tr('btn-submit-exam', 'Trimite examenul')}</span>
      </button>
    </form>
  `;

  let groupPickerModal = document.getElementById('groupPickerModal');
  if (!groupPickerModal) {
    groupPickerModal = document.createElement('div');
    groupPickerModal.id = 'groupPickerModal';
    groupPickerModal.className = 'exam-picker-backdrop hidden';
    groupPickerModal.setAttribute('data-group-picker-backdrop', '');
    document.body.appendChild(groupPickerModal);
  }
  groupPickerModal.innerHTML = `
    <section class="exam-picker-modal" role="dialog" aria-modal="true" aria-label="${groupLabel}">
      <button type="button" class="exam-picker-close" data-group-picker-close aria-label="${t('common-close', 'Inchide')}">&times;</button>
      <p class="exam-picker-title">${groupLabel}</p>
      <div class="exam-picker-list">${groupPickerListHtml}</div>
    </section>
  `;
}

renderForm();

const form = document.getElementById('examForm');
const statusMessage = document.getElementById('statusMessage');
const submitBtn = document.getElementById('submitBtn');
const submitBtnText = document.getElementById('submitBtnText');
const groupSelect = document.getElementById('group');
const groupDisplayButton = document.getElementById('groupDisplayButton');
const groupDisplayText = document.getElementById('groupDisplayText');
const groupPickerModal = document.getElementById('groupPickerModal');
const performanceFileInput = document.getElementById('performanceFile');
const performanceFileInfo = document.getElementById('performanceFileInfo');
const performanceFileName = document.getElementById('performanceFileName');
const performanceFileSize = document.getElementById('performanceFileSize');
const scalesFileInput = document.getElementById('scalesFile');
const scalesFileInfo = document.getElementById('scalesFileInfo');
const scalesFileName = document.getElementById('scalesFileName');
const scalesFileSize = document.getElementById('scalesFileSize');
const uploadProgressBox = document.getElementById('uploadProgressBox');
const uploadProgressLabel = document.getElementById('uploadProgressLabel');
const uploadProgressPercent = document.getElementById('uploadProgressPercent');
const uploadProgressBar = document.getElementById('uploadProgressBar');
const assignmentBox = document.getElementById('examAssignmentBox');
const assignmentTitle = document.getElementById('examAssignmentTitle');
const assignmentDeadline = document.getElementById('examAssignmentDeadline');
const assignmentMessage = document.getElementById('examAssignmentMessage');
const assignmentMaterialsLink = document.getElementById('examAssignmentMaterialsLink');
const assignmentToggle = document.getElementById('examAssignmentToggle');
const assignmentToggleText = document.getElementById('examAssignmentToggleText');
const assignmentBody = document.getElementById('examAssignmentBody');
const deadlineNotice = document.getElementById('examDeadlineNotice');
const deadlineNoticeDate = document.getElementById('examDeadlineNoticeDate');
const deadlineNoticeCountdown = document.getElementById('examDeadlineNoticeCountdown');
let selectedAssignmentState = { expired: false, message: '' };
let assignmentCollapsed = false;

function setAssignmentCollapsed(collapsed) {
  assignmentCollapsed = collapsed;
  assignmentBox.classList.toggle('is-collapsed', collapsed);
  assignmentToggle.setAttribute('aria-expanded', String(!collapsed));
  assignmentToggleText.textContent = collapsed
    ? t('exam-assignment-expand', 'Arata cerinta')
    : t('exam-assignment-collapse', 'Ascunde cerinta');
  if (collapsed) {
    assignmentBody.style.maxHeight = `${assignmentBody.scrollHeight}px`;
    requestAnimationFrame(() => {
      assignmentBody.style.maxHeight = '0px';
    });
  } else {
    assignmentBody.style.maxHeight = `${assignmentBody.scrollHeight}px`;
    const onEnd = (event) => {
      if (event.propertyName !== 'max-height') return;
      assignmentBody.style.maxHeight = '';
      assignmentBody.removeEventListener('transitionend', onEnd);
    };
    assignmentBody.addEventListener('transitionend', onEnd);
  }
}

assignmentToggle.addEventListener('click', () => setAssignmentCollapsed(!assignmentCollapsed));

function resetAssignmentCollapse() {
  assignmentCollapsed = false;
  assignmentBox.classList.remove('is-collapsed');
  assignmentToggle.setAttribute('aria-expanded', 'true');
  assignmentToggleText.textContent = t('exam-assignment-collapse', 'Ascunde cerinta');
  assignmentBody.style.maxHeight = '';
}

function syncGroupDisplay() {
  const selected = groupSelect.selectedOptions[0] || groupSelect.options[0];
  groupDisplayText.textContent = selected ? selected.textContent : '';
}

function openGroupPicker() {
  groupPickerModal.querySelectorAll('[data-group-value]').forEach((button) => {
    button.classList.toggle('is-selected', button.dataset.groupValue === groupSelect.value);
  });
  groupPickerModal.classList.remove('hidden');
}

function closeGroupPicker() {
  groupPickerModal.classList.add('hidden');
}

groupDisplayButton.addEventListener('click', openGroupPicker);

groupPickerModal.addEventListener('click', (event) => {
  if (event.target.closest('[data-group-picker-close]') || event.target.matches('[data-group-picker-backdrop]') || event.target === groupPickerModal) {
    closeGroupPicker();
    return;
  }
  const optionButton = event.target.closest('[data-group-value]');
  if (optionButton) {
    groupSelect.value = optionButton.dataset.groupValue;
    syncGroupDisplay();
    groupSelect.dispatchEvent(new Event('change'));
    closeGroupPicker();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !groupPickerModal.classList.contains('hidden')) closeGroupPicker();
});

syncGroupDisplay();

function showStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = `p-4 rounded-lg ${
    type === 'success' ? 'bg-green-100 text-green-800 border border-green-300' :
    type === 'error' ? 'bg-red-100 text-red-800 border border-red-300' :
    'bg-blue-100 text-blue-800 border border-blue-300'
  }`;
  statusMessage.classList.remove('hidden');
}

function hideStatus() {
  statusMessage.classList.add('hidden');
}

function updateUploadProgress(label, percent) {
  const normalized = Math.max(0, Math.min(100, Math.round(percent || 0)));
  uploadProgressBox.classList.remove('hidden');
  uploadProgressLabel.textContent = label;
  uploadProgressPercent.textContent = `${normalized}%`;
  uploadProgressBar.style.width = `${normalized}%`;
  submitBtnText.textContent = `${label} ${normalized}%`;
}

function uploadFileWithProgress(fileRef, file, label, startPercent = 0, endPercent = 100) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(fileRef, file, { contentType: file.type || 'application/octet-stream' });
    task.on('state_changed', (snapshot) => {
      const filePercent = (snapshot.bytesTransferred / Math.max(snapshot.totalBytes, 1)) * 100;
      const totalPercent = startPercent + ((endPercent - startPercent) * filePercent / 100);
      updateUploadProgress(label, totalPercent);
    }, reject, () => resolve(task.snapshot));
  });
}

function showCenteredSuccess(title, message) {
  let overlay = document.getElementById('examCenteredSuccess');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'examCenteredSuccess';
    overlay.className = 'exam-centered-success hidden';
    overlay.innerHTML = `
      <div class="exam-centered-success-card">
        <h3 id="examCenteredSuccessTitle"></h3>
        <p id="examCenteredSuccessMessage"></p>
        <button type="button" id="examCenteredSuccessClose" class="public-cta text-white px-6 py-3 rounded-2xl font-bold">${tr('common-close', 'Inchide')}</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#examCenteredSuccessClose')?.addEventListener('click', () => overlay.classList.add('hidden'));
  }
  overlay.querySelector('#examCenteredSuccessTitle').textContent = title;
  overlay.querySelector('#examCenteredSuccessMessage').textContent = message;
  overlay.classList.remove('hidden');
}

function assignmentId(course, instrumentSlug, session) {
  return `${safeSegment(course)}_${safeSegment(instrumentSlug)}_${safeSegment(session)}`;
}

function formatDeadline(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(window.i18n?.getLanguage?.() === 'ru' ? 'ru-RU' : 'ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function assignmentDeadlineEnd(item) {
  if (!item?.deadline) return null;
  const date = new Date(`${item.deadline}T23:59:59`);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + Number(item.extensionDays || 0));
  return date;
}

function formatDeadlineDateTime(date) {
  if (!date) return '';
  return date.toLocaleDateString(window.i18n?.getLanguage?.() === 'ru' ? 'ru-RU' : 'ro-RO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function effectiveAssignmentState(assignments = []) {
  const deadlines = assignments
    .map((item) => assignmentDeadlineEnd(item))
    .filter(Boolean)
    .sort((a, b) => b - a);
  if (!deadlines.length) return { expired: false, message: '', date: null };
  const deadline = deadlines[0];
  const dateText = formatDeadlineDateTime(deadline);
  const diffMs = deadline - new Date();
  if (diffMs < 0) {
    return {
      expired: true,
      date: deadline,
      message: tr('exam-deadline-expired-message', `Termenul pentru acest examen a expirat pe ${dateText}. Contacteaza profesorul pentru o prelungire.`, { date: dateText }),
    };
  }
  const daysLeft = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
  return {
    expired: false,
    date: deadline,
    daysLeft,
    message: daysLeft === 0
      ? tr('exam-deadline-today-message', `Termenul expira astazi (${dateText}).`, { date: dateText })
      : tr('exam-deadline-days-message', `Mai ai ${daysLeft} zile pana la termen (${dateText}).`, { count: daysLeft, date: dateText }),
  };
}

function renderDeadlineNotice(state) {
  if (!deadlineNotice || !deadlineNoticeDate || !deadlineNoticeCountdown || !state?.date) {
    deadlineNotice?.classList.add('hidden');
    return;
  }
  deadlineNotice.classList.toggle('exam-deadline-notice-expired', Boolean(state.expired));
  deadlineNoticeDate.textContent = formatDeadlineDateTime(state.date);
  deadlineNoticeCountdown.textContent = state.expired
    ? tr('exam-deadline-countdown-expired', 'Acces inchis')
    : state.daysLeft === 0
      ? tr('exam-deadline-countdown-today', 'Expira astazi')
      : tr('exam-deadline-countdown-days', `${state.daysLeft} zile ramase`, { count: state.daysLeft });
  deadlineNotice.classList.remove('hidden');
}

function setExamClosedState(state) {
  selectedAssignmentState = state || { expired: false, message: '' };
  renderDeadlineNotice(selectedAssignmentState);
  const closed = Boolean(selectedAssignmentState.expired);
  performanceFileInput.disabled = closed;
  scalesFileInput.disabled = closed;
  submitBtn.disabled = closed;
  submitBtnText.textContent = closed ? tr('exam-closed-button', 'Termen expirat') : t('btn-submit-exam', 'Trimite examenul');
  if (closed) showStatus(selectedAssignmentState.message, 'error');
}

function materialLinkForSession(session) {
  const url = new URL('materiale-curs.html', window.location.origin);
  url.searchParams.set('course', config.course);
  url.searchParams.set('folder', config.instrumentSlug);
  url.searchParams.set('session', session);
  return url.toString();
}

async function loadAssignmentForSelectedSession() {
  const session = groupSelect.value;
  if (!session) {
    assignmentBox.classList.add('hidden');
    setExamClosedState({ expired: false, message: '' });
    return;
  }
  assignmentMaterialsLink.href = materialLinkForSession(session);
  assignmentTitle.textContent = tr('exam-assignment-loading', 'Se incarca cerinta...');
  assignmentMessage.textContent = '';
  assignmentDeadline.classList.add('hidden');
  assignmentBox.classList.remove('hidden');
  resetAssignmentCollapse();

  try {
    const snapshot = await getDocs(collection(db, 'examAssignments'));
    let assignments = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((item) => item.course === config.course && item.instrumentSlug === config.instrumentSlug && item.session === session);
    if (!assignments.length) {
      const legacySnapshot = await getDoc(doc(db, 'examAssignments', assignmentId(config.course, config.instrumentSlug, session)));
      assignments = legacySnapshot.exists() ? [{ id: legacySnapshot.id, ...legacySnapshot.data() }] : [];
    }
    if (!assignments.length) {
      assignmentTitle.textContent = tr('exam-assignment-empty-title', 'Nu exista inca sarcina publicata');
      assignmentMessage.textContent = tr('exam-assignment-empty-message', 'Profesorul nu a publicat inca o cerinta speciala pentru acest curs.');
      setExamClosedState({ expired: false, message: '' });
      return;
    }
    window.MHOAnalytics?.capture?.('exam_assignment_viewed', {
      course: config.course,
      instrument: config.instrument,
      instrumentSlug: config.instrumentSlug,
      session,
      assignmentCount: assignments.length,
    });
    assignments.sort((a, b) => (b.updatedAt?.seconds || b.createdAt?.seconds || 0) - (a.updatedAt?.seconds || a.createdAt?.seconds || 0));
    const deadlineState = effectiveAssignmentState(assignments);
    setExamClosedState(deadlineState);
    assignmentTitle.textContent = assignments.length === 1 ? (assignments[0].title || tr('exam-assignment-title-single', `Sarcina pentru ${config.instrument}`, { instrument: config.instrument })) : tr('exam-assignment-title-many', `Sarcini pentru ${config.instrument}`, { instrument: config.instrument });
    assignmentMessage.innerHTML = assignments.map((data, index) => `
      <article class="exam-assignment-item">
        <h4>${assignments.length > 1 ? tr('exam-assignment-item-label', `Sarcina ${index + 1}: `, { number: index + 1 }) : ''}${esc(data.title || tr('exam-assignment-title-single', `Sarcina pentru ${config.instrument}`, { instrument: config.instrument }))}</h4>
        ${data.deadline ? `<p class="exam-assignment-item-deadline">${tr('exam-deadline-label', 'Termen')}: ${esc(formatDeadline(data.deadline))}${Number(data.extensionDays || 0) > 0 ? ` (+${Number(data.extensionDays)} zile)` : ''}</p>` : ''}
        <div>${esc(data.message || '').replace(/\n/g, '<br>')}</div>
      </article>
    `).join('') + (deadlineState.message ? `<article class="exam-assignment-item"><strong>${esc(deadlineState.message)}</strong></article>` : '');
    const deadlines = assignments.filter((item) => item.deadline).map((item) => item.deadline).sort();
    if (deadlines.length) {
      assignmentDeadline.textContent = assignments.length === 1 ? `${tr('exam-deadline-label', 'Termen')}: ${formatDeadline(deadlines[0])}` : tr('exam-deadlines-count', `${deadlines.length} termene`, { count: deadlines.length });
      assignmentDeadline.classList.remove('hidden');
    } else {
      assignmentDeadline.classList.add('hidden');
    }
  } catch (error) {
    console.error('Failed to load exam assignment:', error);
    assignmentTitle.textContent = tr('exam-assignment-load-error-title', 'Nu am putut incarca sarcina');
    assignmentMessage.textContent = tr('exam-assignment-load-error-message', 'Incearca sa reincarci pagina sau contacteaza profesorul.');
    setExamClosedState({ expired: false, message: '' });
  }
}

const requestedGroup = new URLSearchParams(window.location.search).get('session') ||
  new URLSearchParams(window.location.search).get('group');
if (requestedGroup && Array.from(groupSelect.options).some((option) => option.value === requestedGroup)) {
  groupSelect.value = requestedGroup;
  syncGroupDisplay();
}
loadAssignmentForSelectedSession();

groupSelect.addEventListener('change', loadAssignmentForSelectedSession);

performanceFileInput.addEventListener('change', () => {
  const file = performanceFileInput.files?.[0];
  if (!file) {
    performanceFileInfo.classList.add('hidden');
    return;
  }
  performanceFileName.textContent = file.name;
  performanceFileSize.textContent = formatFileSize(file.size);
  performanceFileInfo.classList.remove('hidden');
});

scalesFileInput.addEventListener('change', () => {
  const file = scalesFileInput.files?.[0];
  if (!file) {
    scalesFileInfo.classList.add('hidden');
    return;
  }
  scalesFileName.textContent = file.name;
  scalesFileSize.textContent = formatFileSize(file.size);
  scalesFileInfo.classList.remove('hidden');
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideStatus();

  const firstName = document.getElementById('firstName').value.trim();
  const lastName = document.getElementById('lastName').value.trim();
  const group = groupSelect.value;
  const performanceFile = performanceFileInput.files?.[0];
  const scalesFile = scalesFileInput.files?.[0];
  const maxSize = 5 * 1024 * 1024 * 1024;

  if (selectedAssignmentState.expired) {
    showStatus(selectedAssignmentState.message, 'error');
    return;
  }

  if (!firstName || !lastName || !group || !performanceFile || !scalesFile) {
    showStatus(t('error-fill-all-fields', 'Completeaza toate campurile obligatorii.'), 'error');
    return;
  }

  if (performanceFile.size > maxSize || scalesFile.size > maxSize) {
    showStatus(t('error-file-too-large', 'Fisierul este prea mare. Maxim 5GB.'), 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtnText.textContent = t('status-uploading', 'Se incarca...');
  window.MHOAnalytics?.capture?.('exam_submission_started', {
    course: config.course,
    instrument: config.instrument,
    instrumentSlug: config.instrumentSlug,
    session: group,
    type: 'practice',
    hasScalesFile: Boolean(scalesFile),
  });

  try {
    showStatus(t('status-uploading-performance', 'Se incarca interpretarea...'), 'info');
    const timestamp = Date.now();
    const performanceCleanName = performanceFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const performancePath = `exams/${safeSegment(config.course)}/${config.instrumentSlug}/${safeSegment(group)}/performance/${timestamp}_${performanceCleanName}`;
    const performanceRef = ref(storage, performancePath);
    const performanceSnapshot = await uploadFileWithProgress(performanceRef, performanceFile, t('status-uploading-performance', 'Se incarca interpretarea...'), 0, 50);
    const performanceFileURL = await getDownloadURL(performanceSnapshot.ref);

    showStatus(tr('exam-upload-scales', 'Se incarca gamele...'), 'info');
    const scalesCleanName = scalesFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const scalesPath = `exams/${safeSegment(config.course)}/${config.instrumentSlug}/${safeSegment(group)}/scales/${timestamp}_${scalesCleanName}`;
    const scalesRef = ref(storage, scalesPath);
    const scalesSnapshot = await uploadFileWithProgress(scalesRef, scalesFile, tr('exam-upload-scales', 'Se incarca gamele...'), 50, 100);
    const scalesFileURL = await getDownloadURL(scalesSnapshot.ref);

    const examTitle = `Interpretare ${config.instrument}`;
    const currentUser = auth.currentUser;

    showStatus(t('status-saving-exam', 'Se salveaza datele examenului...'), 'info');
    const docRef = await addDoc(collection(db, 'exams'), {
      userId: currentUser?.uid || null,
      email: currentUser?.email || null,
      firstName,
      lastName,
      course: config.course,
      courseLabel: config.courseLabel || config.course,
      instrument: config.instrument,
      instrumentSlug: config.instrumentSlug,
      group,
      examTitle,
      fileName: performanceFile.name,
      fileURL: performanceFileURL,
      fileSize: performanceFile.size,
      fileType: performanceFile.type,
      filePath: performancePath,
      performanceFileURL,
      performanceFileName: performanceFile.name,
      performanceFileSize: performanceFile.size,
      performanceFileType: performanceFile.type,
      scalesFileURL,
      scalesFileName: scalesFile.name,
      scalesFileSize: scalesFile.size,
      scalesFileType: scalesFile.type,
      scalesFilePath: scalesPath,
      createdAt: new Date().toISOString(),
      timestamp: new Date(),
    });

    form.reset();
    performanceFileInfo.classList.add('hidden');
    scalesFileInfo.classList.add('hidden');
    uploadProgressBox.classList.add('hidden');
    showStatus(t('status-exam-success', 'Examen trimis cu succes.'), 'success');
    showCenteredSuccess(tr('exam-success-title', 'Examen trimis cu succes'), tr('exam-success-message', 'Examenul tau a fost incarcat si salvat in sistem.'));
    window.MHOAnalytics?.capture?.('exam_submission_completed', {
      course: config.course,
      instrument: config.instrument,
      instrumentSlug: config.instrumentSlug,
      session: group,
      type: 'practice',
      hasScalesFile: Boolean(scalesFile),
      examId: docRef.id,
    });
  } catch (error) {
    console.error('Error submitting exam:', error);
    showStatus(t('error-exam-submit', 'Eroare la trimiterea examenului. Incearca din nou.'), 'error');
  } finally {
    submitBtn.disabled = Boolean(selectedAssignmentState.expired);
    submitBtnText.textContent = selectedAssignmentState.expired ? tr('exam-closed-button', 'Termen expirat') : t('btn-submit-exam', 'Trimite examenul');
  }
});

document.getElementById('successModalClose')?.addEventListener('click', () => {
  const modal = document.getElementById('successModal');
  const content = document.getElementById('successModalContent');
  content?.classList.add('scale-95', 'opacity-0');
  setTimeout(() => {
    modal?.classList.add('hidden');
    modal?.classList.remove('flex');
  }, 160);
});

window.addEventListener('mho:language-change', () => {
  window.location.reload();
});
