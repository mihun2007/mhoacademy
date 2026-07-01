import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, addDoc, collection, getDocs, orderBy, query, where } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getStorage, getDownloadURL, ref, uploadBytesResumable } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

const config = window.MHO_THEORY_PAGE;
const firebaseConfig = window.MHO_EXAM_FIREBASE_CONFIG;
const helpers = window.MHO_EXAM_HELPERS;

if (!config || !firebaseConfig || !helpers) {
  throw new Error('Missing theory exam page configuration.');
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const mount = document.getElementById('theoryFormMount');

window.MHOAnalytics?.capture?.('exam_page_opened', {
  course: config.course,
  instrument: 'Teorie',
  instrumentSlug: `${safeSegment(config.course)}-teorie`,
});

const theorySessions = [
  ['Sesia 1-2', 'Curs 1-2'],
  ['Sesia 3-4', 'Curs 3-4'],
  ['Sesia 5-6', 'Curs 5-6'],
];
const orniTheorySessions = [...theorySessions, ['Sesia 7', 'Curs 7']];

const theoryGroups = [
  'G',
  'B',
  'V',
  'A',
  'Armonie',
];
const recentExamKey = `mho_recent_theory_exam_${safeSegment(config.course)}`;

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

function sessionDisplayName(session) {
  const option = (config.course === 'ORNI' ? orniTheorySessions : theorySessions)
    .find(([value]) => value === session);
  return option?.[1] || String(session || '').replace(/^Sesia/i, t('materials-session-label', 'Curs'));
}

function renderForm() {
  const sessionList = config.course === 'ORNI' ? orniTheorySessions : theorySessions;
  const sessionOptions = sessionList
    .map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`)
    .join('');
  const sessionFolderCards = sessionList
    .map(([value, label]) => `
      <button type="button" class="theory-folder-card" data-download-session="${esc(value)}">
        <span class="theory-folder-visual" aria-hidden="true">
          <span class="theory-folder-tab"></span>
          <span class="theory-folder-body">
            <span class="theory-folder-paper one"></span>
            <span class="theory-folder-paper two"></span>
            <span class="theory-folder-icon">${esc(label.replace(/^Curs\s*/i, ''))}</span>
          </span>
        </span>
        <span class="theory-folder-kicker">${tr('theory-download-folder-kicker', 'Examene pentru descarcare')}</span>
        <strong>${esc(label)}</strong>
        <small>${tr('theory-download-session-open', 'Deschide examenele pentru acest curs')}</small>
      </button>
    `)
    .join('');
  const groups = theoryGroups;
  const groupOptions = groups
    .map((value) => `<option value="${esc(value)}">${esc(groupDisplayName(value))}</option>`)
    .join('');

  mount.innerHTML = `
    <div id="theoryStatus" class="hidden mb-6 p-4 rounded-lg"></div>
    <section id="theoryFolderHub" class="theory-folder-grid">
      <button type="button" class="theory-folder-card" data-theory-folder="download">
        <span class="theory-folder-visual" aria-hidden="true">
          <span class="theory-folder-tab"></span>
          <span class="theory-folder-body">
            <span class="theory-folder-paper one"></span>
            <span class="theory-folder-paper two"></span>
            <span class="theory-folder-icon">D</span>
          </span>
        </span>
        <span class="theory-folder-kicker">${tr('theory-folder-download-kicker', 'Pasul 1')}</span>
        <strong>${tr('theory-folder-download-title', 'Examene pentru descarcare')}</strong>
        <small>${tr('theory-folder-download-desc', 'Alege cursul si grupa, apoi descarca testul.')}</small>
      </button>
      <button type="button" class="theory-folder-card" data-theory-folder="upload">
        <span class="theory-folder-visual" aria-hidden="true">
          <span class="theory-folder-tab"></span>
          <span class="theory-folder-body">
            <span class="theory-folder-paper one"></span>
            <span class="theory-folder-paper two"></span>
            <span class="theory-folder-icon">U</span>
          </span>
        </span>
        <span class="theory-folder-kicker">${tr('theory-folder-upload-kicker', 'Pasul 2')}</span>
        <strong>${tr('theory-folder-upload-title', 'Incarca examenele gata facute')}</strong>
        <small>${tr('theory-folder-upload-desc', 'Revii aici dupa ce ai completat testul.')}</small>
      </button>
    </section>

    <section id="theoryDownloadPanel" class="hidden theory-folder-view">
      <div class="theory-folder-view-header">
        <button type="button" class="theory-back-button" data-theory-back>${tr('common-back-folders', 'Inapoi la foldere')}</button>
        <div>
          <p>${tr('theory-folder-download-kicker', 'Pasul 1')}</p>
          <h3>${tr('theory-folder-download-title', 'Examene pentru descarcare')}</h3>
        </div>
      </div>
      <div id="theoryDownloadSessions" class="theory-folder-grid">
        ${sessionFolderCards}
      </div>
      <form id="theoryDownloadLookupForm" class="hidden theory-download-picker mt-6 space-y-5">
        <div>
          <button type="button" class="theory-back-button mb-4" id="theoryBackToSessions">${tr('theory-back-sessions', 'Inapoi la cursuri')}</button>
          <p class="theory-section-kicker">${tr('theory-download-selected-session', 'Curs selectat')}</p>
          <h3 id="theoryDownloadSessionTitle"></h3>
        </div>
        <div>
          <label for="theoryDownloadGroup" class="block text-sm font-medium text-gray-700 mb-2">${tr('common-group', 'Grupa')} <span class="text-red-500">*</span></label>
          <select id="theoryDownloadGroup" required class="w-full px-4 py-3 border rounded-lg">
            <option value="">${tr('exam-placeholder-group', 'Selectati grupa...')}</option>
            ${groupOptions}
          </select>
        </div>
        <button id="findTheoryDownloadBtn" type="submit" class="public-cta w-full text-white py-4 rounded-2xl font-semibold text-lg transition shadow-lg disabled:opacity-50">
          <span id="findTheoryDownloadBtnText">${tr('theory-show-downloads-button', 'Afiseaza examenele pentru descarcare')}</span>
        </button>
      </form>
      <div id="theoryDownloadResult" class="hidden theory-result mt-6 rounded-3xl p-6">
        <p class="text-sm uppercase tracking-[0.18em] font-black text-blue-700">${tr('theory-title-found', 'Examen gasit')}</p>
        <h3 id="theoryDownloadResultTitle" class="text-2xl font-black mt-2"></h3>
        <p id="theoryDownloadResultMeta" class="text-gray-700 mt-2"></p>
        <div id="theoryDownloadResultList" class="theory-result-list mt-5"></div>
      </div>
    </section>

    <section id="theoryUploadPanel" class="hidden theory-folder-view">
      <div class="theory-folder-view-header">
        <button type="button" class="theory-back-button" data-theory-back>${tr('common-back-folders', 'Inapoi la foldere')}</button>
        <div>
          <p>${tr('theory-folder-upload-kicker', 'Pasul 2')}</p>
          <h3>${tr('theory-folder-upload-title', 'Incarca examenele gata facute')}</h3>
        </div>
      </div>
      <div id="theoryResumePanel" class="hidden theory-resume-panel mb-6">
        <div>
          <p class="theory-resume-kicker">${tr('theory-resume-kicker', 'Ai descarcat deja un examen?')}</p>
          <h3 id="theoryResumeTitle"></h3>
          <p id="theoryResumeMeta"></p>
        </div>
        <button type="button" id="theoryResumeButton" class="theory-resume-button">${tr('theory-resume-button', 'Continua la incarcare')}</button>
      </div>
      <div id="theoryLookupForm" class="hidden"></div>

      <div id="theoryResult" class="hidden theory-result mt-8 rounded-3xl p-6">
        <p class="text-sm uppercase tracking-[0.18em] font-black text-blue-700">${tr('theory-title-found', 'Examen gasit')}</p>
        <h3 id="theoryResultTitle" class="text-2xl font-black mt-2"></h3>
        <p id="theoryResultMeta" class="text-gray-700 mt-2"></p>
        <div id="theoryResultList" class="theory-result-list mt-5"></div>
      </div>

      <form id="theorySubmitForm" class="theory-result mt-6 rounded-3xl p-6 space-y-5">
      <div>
        <p class="text-sm uppercase tracking-[0.18em] font-black text-blue-700">${tr('theory-submit-kicker', 'Trimite lucrarea')}</p>
        <h3 class="text-2xl font-black mt-2">${tr('theory-submit-title', 'Incarca examenul completat')}</h3>
        <p id="theorySelectedExamLabel" class="text-gray-700 mt-2">${tr('theory-submit-desc', 'Dupa ce completezi examenul descarcat, incarca fisierul aici pentru profesor.')}</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label for="theorySession" class="block text-sm font-medium text-gray-700 mb-2">${tr('common-session', 'Curs')} <span class="text-red-500">*</span></label>
          <select id="theorySession" required class="w-full px-4 py-3 border rounded-lg">
            <option value="">${tr('exam-placeholder-session', 'Selectati cursul...')}</option>
            ${sessionOptions}
          </select>
        </div>
        <div>
          <label for="theoryGroup" class="block text-sm font-medium text-gray-700 mb-2">${tr('common-group', 'Grupa')} <span class="text-red-500">*</span></label>
          <select id="theoryGroup" required class="w-full px-4 py-3 border rounded-lg">
            <option value="">${tr('exam-placeholder-group', 'Selectati grupa...')}</option>
            ${groupOptions}
          </select>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label for="theoryFirstName" class="block text-sm font-medium text-gray-700 mb-2">${tr('exam-label-family-name', 'Nume')} <span class="text-red-500">*</span></label>
          <input id="theoryFirstName" type="text" required class="w-full px-4 py-3 border rounded-lg" placeholder="${tr('exam-placeholder-family-name', 'Introduceti numele')}">
        </div>
        <div>
          <label for="theoryLastName" class="block text-sm font-medium text-gray-700 mb-2">${tr('exam-label-given-name', 'Prenume')} <span class="text-red-500">*</span></label>
          <input id="theoryLastName" type="text" required class="w-full px-4 py-3 border rounded-lg" placeholder="${tr('exam-placeholder-given-name', 'Introduceti prenumele')}">
        </div>
      </div>
      <div>
        <label for="theorySubmissionFile" class="block text-sm font-medium text-gray-700 mb-2">${tr('theory-file-label', 'Fisier examen completat')} <span class="text-red-500">*</span><span class="block text-xs text-gray-500 mt-1">PDF, DOC, DOCX, JPG, PNG (max. 5GB / fisier)</span></label>
        <label for="theorySubmissionFile" class="upload-card flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
          <span class="font-semibold text-sm text-gray-600">${tr('theory-upload-file', 'Incarca examenul completat')}</span>
          <span class="text-xs text-gray-500 mt-1">${tr('theory-upload-file-hint', 'Poti alege unul sau mai multe fisiere')}</span>
          <input id="theorySubmissionFile" type="file" accept=".pdf,.doc,.docx,.jpg,.png" required multiple class="hidden">
        </label>
        <div id="theorySubmissionFileInfo" class="mt-4 hidden bg-green-50 border-2 border-green-200 rounded-xl p-4">
          <p class="text-green-800 font-bold text-sm" id="theorySubmissionFileName"></p>
          <p class="text-green-600 text-xs" id="theorySubmissionFileSize"></p>
        </div>
      </div>
      <div id="theoryUploadProgressBox" class="exam-upload-progress hidden" aria-live="polite">
        <div class="exam-upload-progress-header">
          <span id="theoryUploadProgressLabel">${tr('exam-upload-preparing', 'Se pregateste incarcarea...')}</span>
          <strong id="theoryUploadProgressPercent">0%</strong>
        </div>
        <div class="exam-upload-progress-track">
          <span id="theoryUploadProgressBar" style="width: 0%"></span>
        </div>
      </div>
      <button id="submitTheoryBtn" type="submit" class="public-cta w-full text-white py-4 rounded-2xl font-semibold text-lg transition shadow-lg disabled:opacity-50">
        <span id="submitTheoryBtnText">${tr('theory-submit-button', 'Trimite examenul de teorie')}</span>
      </button>
      </form>
    </section>
  `;
}

renderForm();

const folderHub = document.getElementById('theoryFolderHub');
const downloadPanel = document.getElementById('theoryDownloadPanel');
const uploadPanel = document.getElementById('theoryUploadPanel');
const downloadSessions = document.getElementById('theoryDownloadSessions');
const downloadLookupForm = document.getElementById('theoryDownloadLookupForm');
const downloadGroupSelect = document.getElementById('theoryDownloadGroup');
const downloadSessionTitle = document.getElementById('theoryDownloadSessionTitle');
const downloadButton = document.getElementById('findTheoryDownloadBtn');
const downloadButtonText = document.getElementById('findTheoryDownloadBtnText');
const downloadResult = document.getElementById('theoryDownloadResult');
const downloadResultTitle = document.getElementById('theoryDownloadResultTitle');
const downloadResultMeta = document.getElementById('theoryDownloadResultMeta');
const downloadResultList = document.getElementById('theoryDownloadResultList');
const backToSessionsButton = document.getElementById('theoryBackToSessions');
const form = document.getElementById('theoryLookupForm');
const submissionForm = document.getElementById('theorySubmitForm');
const resumePanel = document.getElementById('theoryResumePanel');
const resumeTitle = document.getElementById('theoryResumeTitle');
const resumeMeta = document.getElementById('theoryResumeMeta');
const resumeButton = document.getElementById('theoryResumeButton');
const firstNameInput = document.getElementById('theoryFirstName');
const lastNameInput = document.getElementById('theoryLastName');
const sessionSelect = document.getElementById('theorySession');
const groupSelect = document.getElementById('theoryGroup');
const status = document.getElementById('theoryStatus');
const button = document.getElementById('findTheoryBtn');
const buttonText = document.getElementById('findTheoryBtnText');
const result = document.getElementById('theoryResult');
const resultTitle = document.getElementById('theoryResultTitle');
const resultMeta = document.getElementById('theoryResultMeta');
const resultList = document.getElementById('theoryResultList');
const selectedExamLabel = document.getElementById('theorySelectedExamLabel');
const submissionFileInput = document.getElementById('theorySubmissionFile');
const submissionFileInfo = document.getElementById('theorySubmissionFileInfo');
const submissionFileName = document.getElementById('theorySubmissionFileName');
const submissionFileSize = document.getElementById('theorySubmissionFileSize');
const submitTheoryBtn = document.getElementById('submitTheoryBtn');
const submitTheoryBtnText = document.getElementById('submitTheoryBtnText');
const theoryUploadProgressBox = document.getElementById('theoryUploadProgressBox');
const theoryUploadProgressLabel = document.getElementById('theoryUploadProgressLabel');
const theoryUploadProgressPercent = document.getElementById('theoryUploadProgressPercent');
const theoryUploadProgressBar = document.getElementById('theoryUploadProgressBar');
let selectedTheoryExam = null;
let foundTheoryExams = [];
let lookupRequestId = 0;
let preferredTheoryExamId = '';
let activeDownloadSession = '';
let foundDownloadExams = [];

function showStatus(message, type = 'info') {
  status.textContent = message;
  status.className = `p-4 rounded-lg ${
    type === 'success' ? 'bg-green-100 text-green-800 border border-green-300' :
    type === 'error' ? 'bg-red-100 text-red-800 border border-red-300' :
    'bg-blue-100 text-blue-800 border border-blue-300'
  }`;
  status.classList.remove('hidden');
}

function clearStatus() {
  status.classList.add('hidden');
}

function updateTheoryUploadProgress(label, percent) {
  const normalized = Math.max(0, Math.min(100, Math.round(percent || 0)));
  theoryUploadProgressBox.classList.remove('hidden');
  theoryUploadProgressLabel.textContent = label;
  theoryUploadProgressPercent.textContent = `${normalized}%`;
  theoryUploadProgressBar.style.width = `${normalized}%`;
  submitTheoryBtnText.textContent = `${label} ${normalized}%`;
}

function uploadTheoryFileWithProgress(fileRef, file) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(fileRef, file, { contentType: file.type || 'application/octet-stream' });
    task.on('state_changed', (snapshot) => {
      const percent = (snapshot.bytesTransferred / Math.max(snapshot.totalBytes, 1)) * 100;
      updateTheoryUploadProgress(tr('theory-uploading', 'Se incarca examenul...'), percent);
    }, reject, () => resolve(task.snapshot));
  });
}

function readRecentTheoryExam() {
  try {
    const raw = localStorage.getItem(recentExamKey);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (value?.course !== config.course || !value.session || !value.group) return null;
    return value;
  } catch (error) {
    return null;
  }
}

function saveRecentTheoryExam(exam, context = {}) {
  const session = context.session || sessionSelect.value;
  const group = context.group || groupSelect.value;
  if (!session || !group) return;
  try {
    localStorage.setItem(recentExamKey, JSON.stringify({
      course: config.course,
      courseLabel: config.courseLabel || config.course,
      session,
      group,
      examId: exam?.id || '',
      title: exam?.title || tr('download-exam-title', 'Examen de teorie'),
      fileName: exam?.fileName || '',
      savedAt: new Date().toISOString(),
    }));
    renderResumePanel();
  } catch (error) {
    // If storage is unavailable, the normal URL-based flow still works.
  }
}

function renderResumePanel() {
  const recent = readRecentTheoryExam();
  if (!recent || !resumePanel) {
    resumePanel?.classList.add('hidden');
    return;
  }
  resumeTitle.textContent = tr('theory-resume-title', 'Continua cu {title}', {
    title: recent.title || tr('download-exam-title', 'Examen de teorie'),
  });
  resumeMeta.textContent = `${recent.session} - ${tr('common-group', 'grupa').toLowerCase()} ${groupDisplayName(recent.group)}`;
  resumePanel.classList.remove('hidden');
}

function syncLookupUrl(session, group) {
  const url = new URL(window.location.href);
  url.searchParams.set('mode', 'upload');
  if (session) url.searchParams.set('session', session);
  else url.searchParams.delete('session');
  if (group) url.searchParams.set('group', group);
  else url.searchParams.delete('group');
  window.history.replaceState({}, '', url);
}

function syncDownloadUrl(session, group = '') {
  const url = new URL(window.location.href);
  url.searchParams.set('mode', 'download');
  if (session) url.searchParams.set('session', session);
  else url.searchParams.delete('session');
  if (group) url.searchParams.set('group', group);
  else url.searchParams.delete('group');
  window.history.replaceState({}, '', url);
}

function showTheoryFolder(folder, { preserveUrl = false } = {}) {
  clearStatus();
  folderHub.classList.toggle('hidden', folder !== '');
  downloadPanel.classList.toggle('hidden', folder !== 'download');
  uploadPanel.classList.toggle('hidden', folder !== 'upload');
  if (!preserveUrl) {
    const url = new URL(window.location.href);
    if (folder) url.searchParams.set('mode', folder);
    else {
      url.searchParams.delete('mode');
      url.searchParams.delete('session');
      url.searchParams.delete('group');
    }
    window.history.replaceState({}, '', url);
  }
  if (folder === 'upload') renderResumePanel();
}

function resetDownloadView({ keepSession = false } = {}) {
  if (!keepSession) activeDownloadSession = '';
  foundDownloadExams = [];
  downloadResult.classList.add('hidden');
  downloadResultList.innerHTML = '';
  downloadLookupForm.classList.toggle('hidden', !activeDownloadSession);
  downloadSessions.classList.toggle('hidden', Boolean(activeDownloadSession));
  if (downloadGroupSelect && !keepSession) downloadGroupSelect.value = '';
}

function updateSelectedExam(examId, { remember = true } = {}) {
  selectedTheoryExam = foundTheoryExams.find((item) => item.id === examId) || foundTheoryExams[0] || null;
  resultList.querySelectorAll('[data-theory-exam-card]').forEach((card) => {
    card.classList.toggle('is-selected', card.dataset.theoryExamCard === selectedTheoryExam?.id);
  });
  resultList.querySelectorAll('[data-theory-select]').forEach((buttonNode) => {
    const isSelected = buttonNode.dataset.theorySelect === selectedTheoryExam?.id;
    buttonNode.textContent = isSelected
      ? tr('theory-selected-for-upload', 'Ales pentru incarcare')
      : tr('theory-use-for-upload', 'Alege pentru incarcare');
    buttonNode.disabled = isSelected;
  });
  if (selectedExamLabel) {
    const title = selectedTheoryExam?.title || tr('download-exam-title', 'Examen de teorie');
    selectedExamLabel.textContent = selectedTheoryExam
      ? tr('theory-submit-selected-desc', 'Completeaza examenul "{title}", apoi incarca lucrarea aici.', { title })
      : tr('theory-submit-desc', 'Dupa ce completezi examenul descarcat, incarca fisierul aici pentru profesor.');
  }
  if (selectedTheoryExam && remember) saveRecentTheoryExam(selectedTheoryExam);
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

async function getTheoryDocs(filters) {
  const constraints = [where('course', '==', config.course)];
  Object.entries(filters).forEach(([field, value]) => constraints.push(where(field, '==', value)));
  try {
    return await getDocs(query(collection(db, 'theory_exams'), ...constraints, orderBy('createdAt', 'desc')));
  } catch (error) {
    return await getDocs(query(collection(db, 'theory_exams'), ...constraints));
  }
}

async function findTheoryExams(session, group) {
  let snapshot;
  const searches = [
    { session, group },
    { theorySession: session, group },
    { group: `${session} - ${group}` },
    { group: session },
    { group },
    { session },
  ];

  for (const filters of searches) {
    snapshot = await getTheoryDocs(filters);
    if (!snapshot.empty) break;
  }

  const exams = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  exams.sort((a, b) => {
    const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
    const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
    return bDate - aDate;
  });
  return exams;
}

function renderDownloadResults(exams, session, group) {
  const countText = exams.length === 1
    ? tr('theory-found-single', '1 examen disponibil')
    : tr('theory-found-many', `${exams.length} examene disponibile`, { count: exams.length });
  downloadResultTitle.textContent = countText;
  downloadResultMeta.textContent = `${sessionDisplayName(session)} - ${tr('common-group', 'grupa').toLowerCase()} ${groupDisplayName(group)}`;
  downloadResultList.innerHTML = exams.map((exam, index) => {
    const title = exam.title || tr('download-exam-title', 'Examen de teorie');
    const fileName = exam.fileName || `${safeSegment(config.course)}-${safeSegment(session)}-${safeSegment(group)}-${index + 1}.pdf`;
    return `
      <article class="theory-result-item">
        <div>
          <p class="theory-result-item-kicker">${esc(tr('theory-result-item-label', `Test ${index + 1}`, { number: index + 1 }))}</p>
          <h4>${esc(title)}</h4>
          <p>${esc(fileName)}</p>
        </div>
        <div class="theory-result-actions">
          <button type="button" class="public-cta theory-download-button text-white px-5 py-3 rounded-2xl font-semibold transition shadow-lg" data-download-only="${esc(exam.id)}">
            <span>${esc(tr('theory-download-named', `Descarca ${title}`, { title }))}</span>
          </button>
        </div>
      </article>
    `;
  }).join('');
}

async function loadDownloadSelection() {
  clearStatus();
  downloadResult.classList.add('hidden');
  foundDownloadExams = [];

  const session = activeDownloadSession;
  const group = downloadGroupSelect.value;
  if (!session || !group) {
    showStatus(tr('theory-error-select', 'Selecteaza cursul si grupa.'), 'error');
    syncDownloadUrl(session, group);
    return;
  }

  syncDownloadUrl(session, group);
  downloadButton.disabled = true;
  downloadButtonText.textContent = tr('theory-searching', 'Se cauta...');

  try {
    const exams = await findTheoryExams(session, group);
    if (!exams.length) {
      showStatus(tr('theory-error-missing', 'Nu exista inca examen de teorie pentru aceasta alegere.'), 'error');
      return;
    }

    foundDownloadExams = exams;
    renderDownloadResults(exams, session, group);
    downloadResult.classList.remove('hidden');
    window.MHOAnalytics?.capture?.('exam_assignment_viewed', {
      course: config.course,
      instrument: 'Teorie',
      instrumentSlug: `${safeSegment(config.course)}-teorie`,
      session,
      group,
      assignmentCount: exams.length,
      mode: 'download',
    });
  } catch (error) {
    console.error('Error loading theory exam:', error);
    showStatus(tr('theory-error-search', 'Nu am putut cauta examenul. Incearca din nou.'), 'error');
  } finally {
    downloadButton.disabled = false;
    downloadButtonText.textContent = tr('theory-show-downloads-button', 'Afiseaza examenele pentru descarcare');
  }
}

async function loadTheorySelection({ silent = false, preferredExamId = '', scrollToSubmit = false } = {}) {
  clearStatus();
  result.classList.add('hidden');
  selectedTheoryExam = null;
  foundTheoryExams = [];

  const session = sessionSelect.value;
  const group = groupSelect.value;
  if (!session || !group) {
    resultList.innerHTML = '';
    if (!silent) showStatus(tr('theory-error-select', 'Selecteaza cursul si grupa.'), 'error');
    syncLookupUrl(session, group);
    return;
  }

  const requestId = ++lookupRequestId;
  syncLookupUrl(session, group);
  if (button) button.disabled = true;
  if (buttonText) buttonText.textContent = tr('theory-searching', 'Se cauta...');

  try {
    const exams = await findTheoryExams(session, group);
    if (requestId !== lookupRequestId) return;
    if (!exams.length) {
      if (!silent) showStatus(tr('theory-error-missing', 'Nu exista inca examen de teorie pentru aceasta alegere.'), 'error');
      return;
    }

    foundTheoryExams = exams;
    updateSelectedExam(preferredExamId || preferredTheoryExamId || exams[0]?.id, { remember: false });
    if (scrollToSubmit) {
      requestAnimationFrame(() => submissionForm.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
    window.MHOAnalytics?.capture?.('exam_assignment_viewed', {
      course: config.course,
      instrument: 'Teorie',
      instrumentSlug: `${safeSegment(config.course)}-teorie`,
      session,
      group,
      assignmentCount: exams.length,
    });
  } catch (error) {
    console.error('Error loading theory exam:', error);
    showStatus(tr('theory-error-search', 'Nu am putut cauta examenul. Incearca din nou.'), 'error');
  } finally {
    if (requestId === lookupRequestId) {
      if (button) button.disabled = false;
      if (buttonText) buttonText.textContent = tr('theory-show-button', 'Afiseaza examenul pentru incarcare');
    }
  }
}

function renderTheoryResults(exams, session, group) {
  const countText = exams.length === 1
    ? tr('theory-found-single', '1 examen disponibil')
    : tr('theory-found-many', `${exams.length} examene disponibile`, { count: exams.length });
  resultTitle.textContent = countText;
  resultMeta.textContent = `${session} - ${tr('common-group', 'grupa').toLowerCase()} ${groupDisplayName(group)}`;
  resultList.innerHTML = exams.map((exam, index) => {
    const title = exam.title || tr('download-exam-title', 'Examen de teorie');
    const fileName = exam.fileName || `${safeSegment(config.course)}-${safeSegment(session)}-${safeSegment(group)}-${index + 1}.pdf`;
    return `
      <article class="theory-result-item" data-theory-exam-card="${esc(exam.id)}">
        <div>
          <p class="theory-result-item-kicker">${esc(tr('theory-result-item-label', `Test ${index + 1}`, { number: index + 1 }))}</p>
          <h4>${esc(title)}</h4>
          <p>${esc(fileName)}</p>
        </div>
        <div class="theory-result-actions">
          <button type="button" class="theory-select-button" data-theory-select="${esc(exam.id)}">
            ${esc(tr('theory-use-for-upload', 'Alege pentru incarcare'))}
          </button>
          <button type="button" class="public-cta theory-download-button text-white px-5 py-3 rounded-2xl font-semibold transition shadow-lg" data-theory-download="${esc(exam.id)}">
            <span>${esc(tr('theory-download-named', `Descarca ${title}`, { title }))}</span>
          </button>
        </div>
      </article>
    `;
  }).join('');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  loadTheorySelection();
});

folderHub.addEventListener('click', (event) => {
  const folderButton = event.target.closest('[data-theory-folder]');
  if (!folderButton) return;
  showTheoryFolder(folderButton.dataset.theoryFolder);
});

document.querySelectorAll('[data-theory-back]').forEach((backButton) => {
  backButton.addEventListener('click', () => {
    resetDownloadView();
    showTheoryFolder('');
  });
});

downloadSessions.addEventListener('click', (event) => {
  const sessionButton = event.target.closest('[data-download-session]');
  if (!sessionButton) return;
  activeDownloadSession = sessionButton.dataset.downloadSession || '';
  downloadSessionTitle.textContent = sessionDisplayName(activeDownloadSession);
  resetDownloadView({ keepSession: true });
  syncDownloadUrl(activeDownloadSession, downloadGroupSelect.value);
});

backToSessionsButton?.addEventListener('click', () => {
  resetDownloadView();
  syncDownloadUrl('', '');
});

downloadLookupForm.addEventListener('submit', (event) => {
  event.preventDefault();
  loadDownloadSelection();
});

downloadGroupSelect.addEventListener('change', () => {
  downloadResult.classList.add('hidden');
  downloadResultList.innerHTML = '';
  foundDownloadExams = [];
  if (activeDownloadSession && downloadGroupSelect.value) loadDownloadSelection();
  else syncDownloadUrl(activeDownloadSession, downloadGroupSelect.value);
});

downloadResultList.addEventListener('click', async (event) => {
  const downloadButtonNode = event.target.closest('[data-download-only]');
  if (!downloadButtonNode) return;
  const exam = foundDownloadExams.find((item) => item.id === downloadButtonNode.dataset.downloadOnly);
  if (!exam?.fileURL) return;
  saveRecentTheoryExam(exam, {
    session: activeDownloadSession,
    group: downloadGroupSelect.value,
  });
  const downloadText = downloadButtonNode.querySelector('span');
  downloadButtonNode.disabled = true;
  const originalText = downloadText?.textContent || '';
  downloadText.textContent = t('status-downloading', 'Se descarca...');

  try {
    const response = await fetch(exam.fileURL);
    if (!response.ok) throw new Error('Failed to download file');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exam.fileName || 'examen-teorie.pdf';
    link.click();
    URL.revokeObjectURL(url);
    downloadText.textContent = t('status-downloaded', 'Descarcat');
    window.MHOAnalytics?.capture?.('theory_exam_downloaded', {
      course: config.course,
      session: activeDownloadSession,
      group: downloadGroupSelect.value,
      theoryExamId: exam.id || '',
      mode: 'download-folder',
    });
  } catch (error) {
    console.error('Download failed:', error);
    downloadText.textContent = t('status-download-error', 'Eroare la descarcare');
  } finally {
    setTimeout(() => {
      downloadText.textContent = originalText;
      downloadButtonNode.disabled = false;
    }, 1800);
  }
});

resumeButton?.addEventListener('click', () => {
  const recent = readRecentTheoryExam();
  if (!recent) return;
  if (Array.from(sessionSelect.options).some((option) => option.value === recent.session)) {
    sessionSelect.value = recent.session;
  }
  if (Array.from(groupSelect.options).some((option) => option.value === recent.group)) {
    groupSelect.value = recent.group;
  }
  preferredTheoryExamId = recent.examId || '';
  loadTheorySelection({ preferredExamId: preferredTheoryExamId, scrollToSubmit: true });
});

resultList.addEventListener('click', async (event) => {
  const selectButton = event.target.closest('[data-theory-select]');
  if (selectButton) {
    updateSelectedExam(selectButton.dataset.theorySelect);
    submissionForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  const downloadButton = event.target.closest('[data-theory-download]');
  if (!downloadButton) return;
  const exam = foundTheoryExams.find((item) => item.id === downloadButton.dataset.theoryDownload);
  if (!exam) return;
  const fileUrl = exam.fileURL || '';
  if (!fileUrl) return;
  updateSelectedExam(exam.id);
  const downloadText = downloadButton.querySelector('span');

  downloadButton.disabled = true;
  const originalText = downloadText?.textContent || '';
  downloadText.textContent = t('status-downloading', 'Se descarca...');

  try {
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error('Failed to download file');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exam.fileName || 'examen-teorie.pdf';
    link.click();
    URL.revokeObjectURL(url);
    downloadText.textContent = t('status-downloaded', 'Descarcat');
    window.MHOAnalytics?.capture?.('theory_exam_downloaded', {
      course: config.course,
      session: sessionSelect.value,
      group: groupSelect.value,
      theoryExamId: exam.id || '',
    });
  } catch (error) {
    console.error('Download failed:', error);
    downloadText.textContent = t('status-download-error', 'Eroare la descarcare');
  } finally {
    setTimeout(() => {
      downloadText.textContent = originalText;
      downloadButton.disabled = false;
    }, 1800);
  }
});

submissionFileInput.addEventListener('change', () => {
  const files = Array.from(submissionFileInput.files || []);
  if (!files.length) {
    submissionFileInfo.classList.add('hidden');
    return;
  }
  submissionFileName.textContent = files.length === 1
    ? files[0].name
    : tr('theory-selected-files', '{count} fisiere selectate', { count: files.length });
  submissionFileSize.textContent = files
    .map((file, index) => `${index + 1}. ${file.name} - ${formatFileSize(file.size)}`)
    .join('\n');
  submissionFileSize.style.whiteSpace = 'pre-line';
  submissionFileInfo.classList.remove('hidden');
});

submissionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearStatus();

  const session = sessionSelect.value;
  const group = groupSelect.value;
  const firstName = firstNameInput.value.trim();
  const lastName = lastNameInput.value.trim();
  const files = Array.from(submissionFileInput.files || []);
  const maxSize = 5 * 1024 * 1024 * 1024;

  if (!firstName || !lastName || !session || !group || !files.length) {
    showStatus(tr('theory-error-submit-fill', 'Completeaza toate campurile si incarca examenul completat.'), 'error');
    return;
  }

  const oversizedFile = files.find((file) => file.size > maxSize);
  if (oversizedFile) {
    showStatus(tr('theory-error-file-too-large-named', 'Fisierul "{file}" este prea mare. Maxim 5GB.', { file: oversizedFile.name }), 'error');
    return;
  }

  submitTheoryBtn.disabled = true;
  submitTheoryBtnText.textContent = t('status-uploading', 'Se incarca...');
  window.MHOAnalytics?.capture?.('exam_submission_started', {
    course: config.course,
    instrument: 'Teorie',
    instrumentSlug: `${safeSegment(config.course)}-teorie`,
    session,
    group,
    type: 'theory',
    theoryExamId: selectedTheoryExam?.id || '',
  });

  try {
    showStatus(tr('theory-uploading-completed', 'Se incarca examenul completat...'), 'info');
    const timestamp = Date.now();
    const uploadedFiles = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `theory_submissions/${safeSegment(config.course)}/${safeSegment(session)}/${safeSegment(group)}/${timestamp}_${index + 1}_${cleanName}`;
      const fileRef = ref(storage, storagePath);
      const snapshot = await uploadTheoryFileWithProgress(fileRef, file);
      const fileURL = await getDownloadURL(snapshot.ref);
      uploadedFiles.push({
        fileName: file.name,
        fileURL,
        fileSize: file.size,
        fileType: file.type,
        filePath: storagePath,
      });
      updateTheoryUploadProgress(tr('theory-uploading-files', 'Se incarca fisierele...'), ((index + 1) / files.length) * 100);
    }
    const primaryFile = uploadedFiles[0];
    const examTitle = `Teorie - ${selectedTheoryExam?.title || session}`;
    const currentUser = auth.currentUser;

    const payload = {
      userId: currentUser?.uid || null,
      email: currentUser?.email || null,
      firstName,
      lastName,
      course: config.course,
      courseLabel: config.courseLabel || config.course,
      instrument: 'Teorie',
      instrumentSlug: `${safeSegment(config.course)}-teorie`,
      session,
      group,
      examTitle,
      title: examTitle,
      submissionType: 'theory',
      theoryExamId: selectedTheoryExam?.id || null,
      fileName: primaryFile?.fileName || '',
      fileURL: primaryFile?.fileURL || '',
      fileSize: primaryFile?.fileSize || 0,
      fileType: primaryFile?.fileType || '',
      filePath: primaryFile?.filePath || '',
      files: uploadedFiles,
      fileCount: uploadedFiles.length,
      createdAt: new Date().toISOString(),
      timestamp: new Date(),
    };

    await addDoc(collection(db, 'theory_exam_submissions'), payload);
    const examDoc = await addDoc(collection(db, 'exams'), payload);

    submissionForm.reset();
    submissionFileInfo.classList.add('hidden');
    theoryUploadProgressBox.classList.add('hidden');
    showStatus(tr('theory-success-status', 'Examenul de teorie a fost trimis cu succes.'), 'success');
    showCenteredSuccess(tr('theory-success-title', 'Examen de teorie trimis cu succes'), tr('theory-success-message', 'Lucrarea ta a fost incarcata si salvata in sistem.'));
    window.MHOAnalytics?.capture?.('exam_submission_completed', {
      course: config.course,
      instrument: 'Teorie',
      instrumentSlug: `${safeSegment(config.course)}-teorie`,
      session,
      group,
      type: 'theory',
      theoryExamId: payload.theoryExamId,
      examId: examDoc.id,
    });
  } catch (error) {
    console.error('Error submitting theory exam:', error);
    const code = error?.code ? ` (${error.code})` : '';
    showStatus(tr('theory-error-submit', `Nu am putut trimite examenul${code}. Incearca din nou.`, { code }), 'error');
  } finally {
    submitTheoryBtn.disabled = false;
    submitTheoryBtnText.textContent = tr('theory-submit-button', 'Trimite examenul de teorie');
  }
});

function resetFoundExam() {
  result.classList.add('hidden');
  selectedTheoryExam = null;
  foundTheoryExams = [];
  resultList.innerHTML = '';
  selectedExamLabel.textContent = tr('theory-submit-desc', 'Dupa ce completezi examenul descarcat, incarca fisierul aici pentru profesor.');
  clearStatus();
  preferredTheoryExamId = '';
  if (sessionSelect.value && groupSelect.value) loadTheorySelection({ silent: true });
}

sessionSelect.addEventListener('change', resetFoundExam);
groupSelect.addEventListener('change', resetFoundExam);

const params = new URLSearchParams(window.location.search);
const modeParam = params.get('mode') || '';
const sessionParam = params.get('session');
const groupParam = params.get('group');
const recentTheoryExam = readRecentTheoryExam();

if (modeParam === 'download') {
  showTheoryFolder('download', { preserveUrl: true });
  if (sessionParam && (config.course === 'ORNI' ? orniTheorySessions : theorySessions).some(([value]) => value === sessionParam)) {
    activeDownloadSession = sessionParam;
    downloadSessionTitle.textContent = sessionDisplayName(activeDownloadSession);
    resetDownloadView({ keepSession: true });
  }
  if (groupParam && Array.from(downloadGroupSelect.options).some((option) => option.value === groupParam)) {
    downloadGroupSelect.value = groupParam;
  }
  if (activeDownloadSession && downloadGroupSelect.value) {
    loadDownloadSelection();
  }
} else if (modeParam === 'upload' || sessionParam || groupParam) {
  showTheoryFolder('upload', { preserveUrl: true });
} else {
  showTheoryFolder('', { preserveUrl: true });
}

if (sessionParam && Array.from(sessionSelect.options).some((option) => option.value === sessionParam)) {
  sessionSelect.value = sessionParam;
} else if (recentTheoryExam && Array.from(sessionSelect.options).some((option) => option.value === recentTheoryExam.session)) {
  sessionSelect.value = recentTheoryExam.session;
  preferredTheoryExamId = recentTheoryExam.examId || '';
}
if (groupParam && Array.from(groupSelect.options).some((option) => option.value === groupParam)) {
  groupSelect.value = groupParam;
} else if (recentTheoryExam && Array.from(groupSelect.options).some((option) => option.value === recentTheoryExam.group)) {
  groupSelect.value = recentTheoryExam.group;
}
if (!uploadPanel.classList.contains('hidden') && sessionSelect.value && groupSelect.value) {
  loadTheorySelection({
    silent: true,
    preferredExamId: preferredTheoryExamId,
    scrollToSubmit: !sessionParam && !groupParam && Boolean(recentTheoryExam),
  });
}
renderResumePanel();

window.addEventListener('mho:language-change', () => {
  window.location.reload();
});
