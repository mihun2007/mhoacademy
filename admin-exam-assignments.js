import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, query, orderBy, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const app = getApps().length ? getApp() : initializeApp(window.MHO_EXAM_FIREBASE_CONFIG);
const db = getFirestore(app);
const esc = (value) => window.SafeDOM.escapeHTML(value);
const courses = window.MHO_EXAM_CATALOG || [];
const orniSessions = ['Sesia 1-2', 'Sesia 3-4', 'Sesia 5-6', 'Sesia 7'];
const dirijorSessions = ['Sesia 1 (grupa B)', 'Sesia 2 (grupa A)', 'Sesia 3 (armonie)', 'Sesia 4 (armonie)', 'Sesia 5 (armonie)', 'Sesia 6 (armonie)'];
const standardGroups = ['G', 'B', 'V', 'A', 'Armonie'];
const coursePicker = document.getElementById('assignmentCoursePicker');
const folderMount = document.getElementById('assignmentFolderBrowser');
const courseTitle = document.getElementById('assignmentCourseTitle');
const context = document.getElementById('assignmentContext');
const editorPanel = document.getElementById('assignmentEditorPanel');
const editorTitle = document.getElementById('assignmentEditorTitle');
const editorContext = document.getElementById('assignmentEditorContext');
const form = document.getElementById('assignmentForm');
const titleInput = document.getElementById('assignmentTitle');
const deadlineInput = document.getElementById('assignmentDeadline');
const messageInput = document.getElementById('assignmentMessage');
const statusMessage = document.getElementById('assignmentStatusMessage');
const saveButton = document.getElementById('assignmentSaveButton');
const saveButtonText = document.getElementById('assignmentSaveButtonText');
const savedListMount = document.getElementById('assignmentSavedList');
const savedTitle = document.getElementById('assignmentSavedTitle');
const savedContext = document.getElementById('assignmentSavedContext');
const bulkExtendButton = document.getElementById('assignmentBulkExtendButton');
let savedNotice = '';
let editorVisible = false;
let editorMode = null;
let editingAssignmentId = null;
let activeCourseKey = new URLSearchParams(window.location.search).get('course') || '';
let activeInstrumentSlug = null;
let activeSession = null;
let assignments = [];

function t(key, fallback) {
  return window.i18n ? window.i18n.t(key) : fallback;
}

function tr(key, fallback, vars = {}) {
  let value = t(key, fallback);
  Object.entries(vars).forEach(([name, replacement]) => {
    value = String(value).replaceAll(`{${name}}`, replacement);
  });
  return value;
}

function courseDisplayName(course) {
  const courseKey = String(course?.course || '').toLowerCase();
  return t(`materials-course-${courseKey}`, course?.courseLabel || course?.course || '');
}

function instrumentDisplayName(item) {
  return t(`materials-folder-${item?.slug}`, item?.instrument || '');
}

function sessionDisplayName(session) {
  return String(session || '').replace('Sesia', t('materials-session-label', 'Curs'));
}

function showEditorPanel(mode = 'create') {
  editorVisible = true;
  editorMode = mode;
  editorPanel.classList.remove('hidden');
  editorPanel.style.display = '';
}

function hideEditorPanel() {
  editorVisible = false;
  editorMode = null;
  editingAssignmentId = null;
  editorPanel.classList.add('hidden');
  editorPanel.style.display = 'none';
}

function hasCurrentAssignment() {
  const course = selectedCourse();
  const instrument = activeInstrument();
  return Boolean(course && instrument && activeSession && assignmentsFor(course.course, instrument.slug, activeSession).length);
}

function safeSegment(value) {
  return String(value || 'nespecificat').trim().replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'nespecificat';
}

function assignmentId(course, instrumentSlug, session) {
  return `${safeSegment(course)}_${safeSegment(instrumentSlug)}_${safeSegment(session)}`;
}

function courseByKey(key) {
  return courses.find((course) => course.course === key || course.courseLabel === key);
}

function selectedCourse() {
  return courseByKey(activeCourseKey) || courses[0];
}

function courseItems(course) {
  return (course?.items || []).map((item) => ({ ...item, icon: item.instrument.slice(0, 1).toUpperCase() }));
}

function assignmentSessions(course) {
  if (course?.course === 'ORNI') return orniSessions;
  if (course?.course === 'Dirijor') return dirijorSessions;
  return standardGroups;
}

function activeInstrument() {
  return courseItems(selectedCourse()).find((item) => item.slug === activeInstrumentSlug);
}

function showStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = 'p-4 rounded-lg mb-6 ' + (type === 'success' ? 'bg-green-100 text-green-800' : type === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800');
  statusMessage.classList.remove('hidden');
  if (type !== 'info') setTimeout(() => statusMessage.classList.add('hidden'), 5000);
}

function assignmentFor(course, instrumentSlug, session) {
  return assignments.find((item) => item.course === course && item.instrumentSlug === instrumentSlug && item.session === session);
}

function assignmentsFor(course, instrumentSlug, session) {
  return assignments
    .filter((item) => item.course === course && item.instrumentSlug === instrumentSlug && item.session === session)
    .sort((a, b) => String(b.updatedAt?.seconds || b.createdAt?.seconds || '').localeCompare(String(a.updatedAt?.seconds || a.createdAt?.seconds || '')));
}

function formatDeadline(value) {
  if (!value) return t('admin-assignments-no-deadline', 'Fara termen');
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(window.i18n?.getLanguage?.() === 'ru' ? 'ru-RU' : 'ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function deadlineWithExtension(item) {
  if (!item?.deadline) return t('admin-assignments-no-deadline', 'Fara termen');
  const extraDays = Number(item.extensionDays || 0);
  const date = new Date(`${item.deadline}T12:00:00`);
  if (Number.isNaN(date.getTime())) return item.deadline;
  date.setDate(date.getDate() + extraDays);
  const formatted = date.toLocaleDateString(window.i18n?.getLanguage?.() === 'ru' ? 'ru-RU' : 'ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
  return extraDays > 0 ? `${formatted} (+${extraDays} zile)` : formatted;
}

function fillCourses() {
  const options = courses.map((course) => `<option value="${esc(course.course)}">${esc(courseDisplayName(course))}</option>`).join('');
  coursePicker.innerHTML = options;
  if (!courseByKey(activeCourseKey) && courses[0]) activeCourseKey = courses[0].course;
  coursePicker.value = activeCourseKey;
}

function renderFolderBrowser() {
  const course = selectedCourse();
  const instrument = activeInstrument();
  if (!course) {
    folderMount.innerHTML = `<div class="materials-empty">${t('materials-course-not-found', 'Nu am gasit cursul.')}</div>`;
    return;
  }
  const displayCourse = courseDisplayName(course);
  const displayInstrument = instrumentDisplayName(instrument);
  const displaySession = sessionDisplayName(activeSession);
  courseTitle.textContent = tr('admin-assignments-title', `Sarcini - ${displayCourse}`, { course: displayCourse });
  context.textContent = instrument
    ? tr('admin-assignments-context-selected', `Instrument selectat: ${displayInstrument}`, { instrument: `${displayInstrument}${activeSession ? ` / ${displaySession}` : ''}` })
    : t('admin-assignments-context-default', 'Alege instrumentul pentru care scrii cerinta.');

  if (!instrument) {
    hideEditorPanel();
    folderMount.innerHTML = `
      <div class="materials-folder-grid">
        ${courseItems(course).map((item) => `
          <button type="button" class="materials-folder-card" data-open-assignment-instrument="${esc(item.slug)}">
            <span class="materials-folder-visual" aria-hidden="true">
              <span class="materials-folder-tab"></span>
              <span class="materials-folder-body">
                <span class="materials-folder-paper one"></span>
                <span class="materials-folder-paper two"></span>
                <span class="materials-folder-icon">${esc(item.icon || '')}</span>
              </span>
            </span>
            <span class="materials-folder-kicker">${esc(displayCourse)}</span>
            <strong>${esc(instrumentDisplayName(item))}</strong>
            <small>${t('admin-assignments-open-instrument', 'Deschide instrumentul')}</small>
          </button>
        `).join('')}
      </div>
    `;
    return;
  }

  if (!activeSession) {
    hideEditorPanel();
    folderMount.innerHTML = `
      <div class="admin-material-folder-actions">
        <button type="button" class="materials-back-button" data-close-assignment-instrument>${t('common-back-instruments', 'Inapoi la instrumente')}</button>
        <span class="admin-material-selection-note">${esc(displayCourse)} / ${esc(displayInstrument)}</span>
      </div>
      <div class="materials-folder-grid materials-session-folder-grid">
        ${assignmentSessions(course).map((session) => {
          const currentCount = assignmentsFor(course.course, instrument.slug, session).length;
          return `
            <button type="button" class="materials-folder-card materials-session-folder-card" data-open-assignment-session="${esc(session)}">
              <span class="materials-folder-visual" aria-hidden="true">
                <span class="materials-folder-tab"></span>
                <span class="materials-folder-body">
                  <span class="materials-folder-paper one"></span>
                  <span class="materials-folder-paper two"></span>
                  <span class="materials-folder-icon">${esc(session.replace('Sesia ', ''))}</span>
                </span>
              </span>
                <span class="materials-folder-kicker">${currentCount ? tr('admin-assignments-saved-count', `${currentCount} sarcini salvate`, { count: currentCount }) : t('admin-assignments-no-task', 'Fara sarcina')}</span>
              <strong>${esc(sessionDisplayName(session))}</strong>
              <small>${currentCount ? t('admin-assignments-open-list', 'Deschide lista') : t('admin-assignments-write-task', 'Scrie cerinta')}</small>
            </button>
          `;
        }).join('')}
      </div>
    `;
    return;
  }

  folderMount.innerHTML = `
    <div class="admin-material-folder-actions">
      <button type="button" class="materials-back-button" data-close-assignment-session>${t('common-back-sessions', 'Inapoi la cursuri')}</button>
      <button type="button" class="materials-back-button" data-close-assignment-instrument>${t('common-back-instruments', 'Inapoi la instrumente')}</button>
      <span class="admin-material-selection-note">${esc(displayCourse)} / ${esc(displayInstrument)} / ${esc(displaySession)}</span>
    </div>
  `;
  if (editorVisible) {
    loadAssignmentIntoEditor();
  } else {
    hideEditorPanel();
  }
}

function renderSavedList() {
  const course = selectedCourse();
  if (!savedListMount || !course) return;
  const instrument = activeInstrument();
  if (!instrument) {
    savedTitle.textContent = t('admin-assignments-pick-instrument-title', 'Alege instrumentul');
    savedContext.textContent = t('admin-assignments-pick-instrument-desc', 'Sarcinile pentru editare apar doar dupa ce intri in instrumentul lor.');
    savedListMount.innerHTML = `${savedNotice}<div class="materials-empty">${t('admin-assignments-pick-instrument-empty', 'Alege un instrument de mai sus pentru a vedea sarcina salvata.')}</div>`;
    savedNotice = '';
    return;
  }
  if (!activeSession) {
    savedTitle.textContent = tr('admin-assignments-for-instrument', `Sarcini pentru ${instrumentDisplayName(instrument)}`, { instrument: instrumentDisplayName(instrument) });
    savedContext.textContent = t('admin-assignments-pick-session-desc', 'Alege cursul exact pentru a vedea sarcina lui salvata.');
    savedListMount.innerHTML = `${savedNotice}<div class="materials-empty">${t('admin-assignments-pick-session-empty', 'Alege un curs. Sarcinile nu sunt listate toate aici, ca sa nu se amestece intre ele.')}</div>`;
    savedNotice = '';
    return;
  }
  const displayCourse = courseDisplayName(course);
  const displayInstrument = instrumentDisplayName(instrument);
  const displaySession = sessionDisplayName(activeSession);
  savedTitle.textContent = `${displayInstrument} / ${displaySession}`;
  savedContext.textContent = `${displayCourse} / ${displayInstrument} / ${displaySession}`;
  const items = assignmentsFor(course.course, instrument.slug, activeSession);
  if (!items.length) {
    savedListMount.innerHTML = `
      ${savedNotice}
      <div class="materials-empty">${t('admin-assignments-empty-current', 'Nu exista inca o sarcina salvata pentru acest instrument si acest curs.')}</div>
      <div class="assignment-current-actions">
        <button type="button" class="assignment-add-button" data-new-assignment>${t('admin-assignments-add-new', 'Adauga sarcina noua')}</button>
      </div>
    `;
    savedNotice = '';
    return;
  }
  savedListMount.innerHTML = `
    ${savedNotice}
    <div class="assignment-current-actions">
      <button type="button" class="assignment-add-button" data-new-assignment>${t('admin-assignments-add-new', 'Adauga sarcina noua')}</button>
      <span class="assignment-current-hint">${t('admin-assignments-add-hint', 'Poti adauga mai multe sarcini pentru acelasi curs. Elevii le vor vedea pe toate.')}</span>
    </div>
    <div class="assignment-saved-grid assignment-current-grid">
      ${items.map((item, index) => `
        <article class="assignment-saved-card assignment-saved-card-current">
          <div>
            <p class="assignment-saved-kicker">${esc(sessionDisplayName(item.session || activeSession))} / ${tr('exam-assignment-item-label', `Sarcina ${index + 1}: `, { number: index + 1 }).replace(': ', '')}</p>
            <h3>${esc(item.title || tr('exam-assignment-title-single', `Sarcina pentru ${displayInstrument}`, { instrument: displayInstrument }))}</h3>
            <p>${t('exam-deadline-label', 'Termen')}: ${esc(deadlineWithExtension(item))}</p>
          </div>
          <p class="assignment-saved-preview assignment-saved-compact-note">${t('admin-assignments-current-note', 'Sarcina este salvata. Textul complet apare doar cand apesi pe Editeaza.')}</p>
          <div class="assignment-saved-actions">
            <button type="button" data-edit-assignment="${esc(item.id)}">${t('common-edit', 'Editeaza')}</button>
            <button type="button" data-extend-assignment="${esc(item.id)}">${t('admin-assignments-extend-deadline', 'Adauga zile')}</button>
            <button type="button" data-delete-assignment="${esc(item.id)}">${t('common-delete', 'Sterge')}</button>
          </div>
        </article>
      `).join('')}
      </div>
  `;
  savedNotice = '';
}

async function loadAssignmentIntoEditor() {
  const course = selectedCourse();
  const instrument = activeInstrument();
  if (!course || !instrument || !activeSession) return;
  editorPanel.classList.remove('hidden');
  editorPanel.style.display = '';
  const displayInstrument = instrumentDisplayName(instrument);
  editorTitle.textContent = editorMode === 'edit'
    ? tr('admin-assignments-edit-title', `Editeaza sarcina pentru ${displayInstrument}`, { instrument: displayInstrument })
    : tr('admin-assignments-new-title', `Sarcina noua pentru ${displayInstrument}`, { instrument: displayInstrument });
  editorContext.textContent = `${courseDisplayName(course)} / ${displayInstrument} / ${sessionDisplayName(activeSession)}`;
  titleInput.value = '';
  deadlineInput.value = '';
  messageInput.value = '';
  if (editorMode === 'edit' && editingAssignmentId) {
    const current = assignments.find((item) => item.id === editingAssignmentId);
    let data = current;
    if (!data) {
      const snapshot = await getDoc(doc(db, 'examAssignments', editingAssignmentId));
      data = snapshot.exists() ? snapshot.data() : null;
    }
    if (data) {
      titleInput.value = data.title || '';
      deadlineInput.value = data.deadline || '';
      messageInput.value = data.message || '';
    }
  }
}

function extendDaysModalMarkup(subtitle) {
  return `
    <div class="admin-exam-modal-backdrop" data-extend-modal-backdrop>
      <section class="admin-exam-modal admin-extend-modal" role="dialog" aria-modal="true" aria-label="${esc(t('admin-assignments-extend-prompt', 'Cate zile adaugi la termen?'))}">
        <button type="button" class="admin-exam-modal-close" data-close-extend-modal>&times;</button>
        <div>
          <p class="admin-extend-modal-kicker">${esc(t('admin-assignments-extend-deadline', 'Adauga zile'))}</p>
          <h3 class="admin-extend-modal-title">${esc(t('admin-assignments-extend-prompt', 'Cate zile adaugi la termen?'))}</h3>
          ${subtitle ? `<p class="admin-extend-modal-subtitle">${esc(subtitle)}</p>` : ''}
        </div>
        <label class="admin-extend-modal-field">
          <span>${esc(t('admin-assignments-extend-days-label', 'Numar de zile'))}</span>
          <input type="number" id="extendDaysInput" min="1" max="365" step="1" value="1" inputmode="numeric">
        </label>
        <div class="admin-extend-modal-actions">
          <button type="button" class="materials-action" data-close-extend-modal>${esc(t('common-cancel', 'Anuleaza'))}</button>
          <button type="button" class="materials-admin-button" data-confirm-extend-modal>${esc(t('common-confirm', 'Confirma'))}</button>
        </div>
      </section>
    </div>
  `;
}

let extendModalResolve = null;

function openExtendDaysModal(subtitle) {
  closeExtendDaysModal(null);
  const holder = document.createElement('div');
  holder.id = 'extendDaysModal';
  holder.innerHTML = extendDaysModalMarkup(subtitle);
  document.body.appendChild(holder);
  const input = holder.querySelector('#extendDaysInput');
  input?.focus();
  input?.select();
  return new Promise((resolve) => {
    extendModalResolve = resolve;
  });
}

function closeExtendDaysModal(days) {
  const modal = document.getElementById('extendDaysModal');
  modal?.remove();
  if (extendModalResolve) {
    const resolve = extendModalResolve;
    extendModalResolve = null;
    resolve(days);
  }
}

function readExtendDaysInput(modal) {
  const input = modal.querySelector('#extendDaysInput');
  return Math.max(0, Math.min(365, Number.parseInt(input?.value, 10) || 0));
}

document.addEventListener('click', (event) => {
  const modal = event.target.closest('#extendDaysModal');
  if (!modal) return;
  if (event.target.closest('[data-close-extend-modal]') || event.target.matches('[data-extend-modal-backdrop]')) {
    closeExtendDaysModal(null);
    return;
  }
  if (event.target.closest('[data-confirm-extend-modal]')) {
    closeExtendDaysModal(readExtendDaysInput(modal));
  }
});

document.addEventListener('keydown', (event) => {
  const modal = document.getElementById('extendDaysModal');
  if (!modal) return;
  if (event.key === 'Escape') {
    closeExtendDaysModal(null);
  } else if (event.key === 'Enter' && event.target.id === 'extendDaysInput') {
    closeExtendDaysModal(readExtendDaysInput(modal));
  }
});

bulkExtendButton?.addEventListener('click', async () => {
  const course = selectedCourse();
  if (!course) return;
  const rows = assignments.filter((item) => item.course === course.course && item.deadline);
  if (!rows.length) {
    showStatus(t('admin-assignments-extend-course-no-deadline', 'Nu exista sarcini cu termen setat pentru acest curs.'), 'error');
    return;
  }
  const days = await openExtendDaysModal(tr('admin-assignments-extend-course-subtitle', `Se aplica la toate sarcinile cu termen din cursul ${courseDisplayName(course)}.`, { course: courseDisplayName(course) }));
  if (days === null) return;
  if (!days) {
    showStatus(t('admin-assignments-extend-invalid', 'Introdu un numar de zile mai mare decat 0.'), 'error');
    return;
  }
  bulkExtendButton.disabled = true;
  try {
    await Promise.all(rows.map((row) => updateDoc(doc(db, 'examAssignments', row.id), {
      extensionDays: Number(row.extensionDays || 0) + days,
      extensionUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })));
    showStatus(tr('admin-assignments-extend-course-success', `Termenul a fost prelungit pentru ${rows.length} sarcini din cursul ${courseDisplayName(course)}.`, { count: rows.length, course: courseDisplayName(course) }), 'success');
  } catch (error) {
    console.error(error);
    showStatus(t('admin-assignments-extend-error', 'Nu am putut prelungi termenul.'), 'error');
  } finally {
    bulkExtendButton.disabled = false;
  }
});

document.addEventListener('click', (event) => {
  const extendButton = event.target.closest('[data-extend-assignment]');
  if (extendButton) {
    const row = assignments.find((item) => item.id === extendButton.dataset.extendAssignment);
    if (!row) return;
    if (!row.deadline) {
      showStatus(t('admin-assignments-extend-no-deadline', 'Seteaza mai intai un termen pentru aceasta sarcina.'), 'error');
      return;
    }
    openExtendDaysModal().then((days) => {
      if (days === null) return;
      if (!days) {
        showStatus(t('admin-assignments-extend-invalid', 'Introdu un numar de zile mai mare decat 0.'), 'error');
        return;
      }
      extendButton.disabled = true;
      updateDoc(doc(db, 'examAssignments', row.id), {
        extensionDays: Number(row.extensionDays || 0) + days,
        extensionUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).then(() => {
        showStatus(t('admin-assignments-extend-success', 'Termenul a fost prelungit.'), 'success');
      }).catch((error) => {
        console.error(error);
        showStatus(t('admin-assignments-extend-error', 'Nu am putut prelungi termenul.'), 'error');
      }).finally(() => {
        extendButton.disabled = false;
      });
    });
    return;
  }
  const newButton = event.target.closest('[data-new-assignment]');
  if (newButton) {
    editingAssignmentId = null;
    showEditorPanel('create');
    renderFolderBrowser();
    editorPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const editButton = event.target.closest('[data-edit-assignment]');
  if (editButton) {
    const row = assignments.find((item) => item.id === editButton.dataset.editAssignment);
    if (!row) return;
    activeCourseKey = row.course;
    activeInstrumentSlug = row.instrumentSlug;
    activeSession = row.session;
    editingAssignmentId = row.id;
    showEditorPanel('edit');
    coursePicker.value = activeCourseKey;
    renderFolderBrowser();
    editorPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const deleteButton = event.target.closest('[data-delete-assignment]');
  if (deleteButton) {
    if (!confirm(t('admin-assignments-delete-confirm', 'Sigur stergi aceasta sarcina?'))) return;
    if (editingAssignmentId === deleteButton.dataset.deleteAssignment) hideEditorPanel();
    deleteDoc(doc(db, 'examAssignments', deleteButton.dataset.deleteAssignment))
      .catch((error) => {
        console.error(error);
        showStatus(t('admin-assignments-delete-error', 'Nu am putut sterge sarcina.'), 'error');
      });
    return;
  }
  const instrumentButton = event.target.closest('[data-open-assignment-instrument]');
  if (instrumentButton) {
    activeInstrumentSlug = instrumentButton.dataset.openAssignmentInstrument;
    activeSession = null;
    hideEditorPanel();
    renderFolderBrowser();
    renderSavedList();
    return;
  }
  const sessionButton = event.target.closest('[data-open-assignment-session]');
  if (sessionButton) {
    activeSession = sessionButton.dataset.openAssignmentSession;
    if (hasCurrentAssignment()) {
      hideEditorPanel();
    } else {
      showEditorPanel('create');
    }
    renderFolderBrowser();
    renderSavedList();
    return;
  }
  if (event.target.closest('[data-close-assignment-session]')) {
    activeSession = null;
    hideEditorPanel();
    renderFolderBrowser();
    renderSavedList();
    return;
  }
  if (event.target.closest('[data-close-assignment-instrument]')) {
    activeInstrumentSlug = null;
    activeSession = null;
    hideEditorPanel();
    renderFolderBrowser();
    renderSavedList();
  }
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const course = selectedCourse();
  const instrument = activeInstrument();
  if (!course || !instrument || !activeSession || !messageInput.value.trim()) {
    showStatus(t('admin-assignments-save-error-required', 'Alege instrumentul, cursul si scrie cerinta.'), 'error');
    return;
  }
  saveButton.disabled = true;
  saveButtonText.textContent = t('admin-assignments-saving', 'Se salveaza...');
  try {
    const payload = {
      course: course.course,
      courseLabel: course.courseLabel || course.course,
      instrument: instrument.instrument,
      instrumentSlug: instrument.slug,
      session: activeSession,
      title: titleInput.value.trim() || tr('exam-assignment-title-single', `Sarcina pentru ${instrumentDisplayName(instrument)}`, { instrument: instrumentDisplayName(instrument) }),
      deadline: deadlineInput.value,
      message: messageInput.value.trim(),
      updatedAt: serverTimestamp(),
    };
    if (editorMode === 'edit' && editingAssignmentId) {
      await setDoc(doc(db, 'examAssignments', editingAssignmentId), payload, { merge: true });
    } else {
      await addDoc(collection(db, 'examAssignments'), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
    savedNotice = `<div class="assignment-save-notice">${t('admin-assignments-save-success', 'Sarcina a fost salvata cu succes.')}</div>`;
    window.MHOAnalytics?.capture?.('admin_assignment_saved', {
      course: course.course,
      instrument: instrument.instrument,
      instrumentSlug: instrument.slug,
      session: activeSession,
      mode: editorMode === 'edit' ? 'edit' : 'create',
      hasDeadline: Boolean(deadlineInput.value),
    });
    hideEditorPanel();
    titleInput.value = '';
    deadlineInput.value = '';
    messageInput.value = '';
    renderSavedList();
    savedListMount?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (error) {
    console.error(error);
    showStatus(t('admin-assignments-save-error', 'Nu am putut salva sarcina.'), 'error');
  } finally {
    saveButton.disabled = false;
    saveButtonText.textContent = t('admin-assignments-save-button', 'Salveaza sarcina');
  }
});

async function initialize() {
  await window.AdminAccessReady;
  fillCourses();
  coursePicker.addEventListener('change', () => {
    activeCourseKey = coursePicker.value;
    activeInstrumentSlug = null;
    activeSession = null;
    hideEditorPanel();
    renderFolderBrowser();
    renderSavedList();
  });
  renderFolderBrowser();
  renderSavedList();
  onSnapshot(query(collection(db, 'examAssignments'), orderBy('updatedAt', 'desc')), (snapshot) => {
    assignments = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (editorVisible && editorMode === 'create' && hasCurrentAssignment()) {
      hideEditorPanel();
    }
    renderFolderBrowser();
    renderSavedList();
  });
}

initialize().catch((error) => {
  console.error(error);
  folderMount.innerHTML = `<div class="materials-empty">${t('admin-exams-init-error', 'Nu am putut porni pagina.')}</div>`;
});

window.addEventListener('mho:language-change', () => {
  window.location.reload();
});
