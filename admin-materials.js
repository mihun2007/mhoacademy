import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, query, onSnapshot, orderBy, addDoc, deleteDoc, doc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

const app = getApps().length ? getApp() : initializeApp(window.MHO_EXAM_FIREBASE_CONFIG);
const db = getFirestore(app);
const storage = getStorage(app);
const esc = (value) => window.SafeDOM.escapeHTML(value);
const safeLink = (value) => window.SafeDOM.safeURL(value);
const courses = window.MHO_EXAM_CATALOG || [];
const baseSessions = ['Sesia 1-2', 'Sesia 3-4', 'Sesia 5-6'];
const orniSessions = [...baseSessions, 'Sesia 7'];
const form = document.getElementById('materialUploadForm');
const courseSelect = document.getElementById('materialCourse');
const instrumentSelect = document.getElementById('materialInstrument');
const sessionSelect = document.getElementById('materialSession');
const categorySelect = document.getElementById('materialCategory');
const titleInput = document.getElementById('materialTitle');
const descriptionInput = document.getElementById('materialDescription');
const fileInput = document.getElementById('materialFile');
const statusMessage = document.getElementById('materialStatusMessage');
const uploadButton = document.getElementById('materialUploadButton');
const uploadButtonText = document.getElementById('materialUploadButtonText');
const listCourseSelect = document.getElementById('materialListCourse');
const listMount = document.getElementById('adminMaterialsList');
const folderMount = document.getElementById('adminMaterialFolderBrowser');
const uploadPanel = document.getElementById('adminMaterialUploadPanel');
const coursePicker = document.getElementById('adminMaterialCoursePicker');
const courseTitle = document.getElementById('adminMaterialCourseTitle');
const courseContext = document.getElementById('adminMaterialContext');
const uploadTitle = document.getElementById('adminMaterialUploadTitle');
const uploadContext = document.getElementById('adminMaterialUploadContext');
const listTitle = document.getElementById('adminMaterialListTitle');
const listContext = document.getElementById('adminMaterialListContext');
const categoryChoiceWrap = document.getElementById('adminMaterialCategoryChoiceWrap');
const categoryChoice = document.getElementById('adminMaterialCategoryChoice');
let allMaterials = [];
let activeCourseKey = new URLSearchParams(window.location.search).get('course') || '';
let activeFolderSlug = null;
let activeSession = null;

function t(key, fallback) {
  const value = window.i18n?.t?.(key);
  return value && value !== key ? value : fallback;
}

function tr(key, fallback, vars = {}) {
  let value = t(key, fallback);
  Object.entries(vars).forEach(([name, replacement]) => {
    value = String(value).replaceAll(`{${name}}`, replacement);
  });
  return value;
}

function safeSegment(value) {
  return String(value || 'nespecificat').trim().replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'nespecificat';
}

function courseDisplayName(course) {
  const key = String(course?.course || course || '').toLowerCase();
  return t('materials-course-' + key, course?.courseLabel || course?.course || course || '');
}

function folderDisplayName(item) {
  if (!item) return '';
  return t('materials-folder-' + item.slug, item.instrument || item.slug);
}

function sessionDisplayName(session) {
  if (!session) return '';
  if (session === '__all__') return t('admin-materials-all-sessions', 'Toate cursurile');
  return String(session).replace(/^Sesia/i, t('materials-session-label', 'Curs'));
}

function sessionsForCourse(course) {
  return course?.course === 'ORNI' ? orniSessions : baseSessions;
}

function updateStaticText() {
  document.title = t('admin-materials-browser-title', 'Administrare materiale - MHO Music Academy');
  const heroTitle = document.querySelector('.admin-course-shell > section:first-child h1');
  const heroDesc = document.querySelector('.admin-course-shell > section:first-child h1 + p');
  const heroActions = document.querySelectorAll('.admin-course-shell > section:first-child .materials-action');
  if (heroTitle) heroTitle.textContent = t('admin-materials-hero-title', 'Materiale de curs');
  if (heroDesc) heroDesc.textContent = t('admin-materials-hero-desc', 'Incarca pentru elevi cantari, note, lectii de teorie si lectii de solfegiu.');
  if (heroActions[0]) heroActions[0].textContent = t('admin-back-main', 'Inapoi la admin');
  if (heroActions[1]) heroActions[1].textContent = t('admin-materials-view-student-page', 'Vezi pagina elevilor');

  const folderKicker = document.querySelector('.materials-panel p.text-sm');
  if (folderKicker) folderKicker.textContent = t('nav-materials', 'Materiale');
  const coursePickerLabel = document.querySelector('.admin-material-course-picker');
  if (coursePickerLabel?.firstChild) coursePickerLabel.firstChild.textContent = t('common-course', 'Curs') + ' ';

  const uploadKicker = document.querySelector('#adminMaterialUploadPanel p.text-sm');
  if (uploadKicker) uploadKicker.textContent = t('admin-materials-upload-kicker', 'Incarcare');
  const uploadPanelContext = document.querySelector('#adminMaterialUploadContext');
  if (uploadPanelContext && !activeFolderSlug) uploadPanelContext.textContent = t('admin-materials-upload-context-default', 'Materialul va fi salvat in folderul ales.');

  const labels = form?.querySelectorAll('label') || [];
  const labelTexts = [
    t('common-course', 'Curs'),
    t('admin-materials-instrument-section', 'Instrument / sectiune'),
    t('common-session', 'Curs'),
    t('admin-materials-category', 'Categorie'),
    t('admin-materials-material-type', 'Tip material'),
    t('admin-materials-material-title', 'Titlu material'),
    t('admin-materials-description', 'Descriere'),
    t('common-file', 'Fisier'),
  ];
  labels.forEach((label, index) => {
    const firstText = Array.from(label.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
    if (firstText && labelTexts[index]) firstText.textContent = labelTexts[index] + ' ';
  });

  if (titleInput) titleInput.placeholder = t('admin-materials-title-placeholder', 'Ex: Lectia 1 - game majore');
  if (descriptionInput) descriptionInput.placeholder = t('admin-materials-description-placeholder', 'Optional: detalii pentru elevi');
  if (uploadButtonText && !uploadButton?.disabled) uploadButtonText.textContent = t('admin-materials-upload-button', 'Incarca materialul');

  if (!activeFolderSlug && listTitle) listTitle.textContent = t('admin-materials-list-title', 'Materiale incarcate');
  const footerRights = document.querySelector('footer p');
  if (footerRights) footerRights.innerHTML = '&copy; 2025 MHO Music Academy. ' + t('footer-rights', 'Toate drepturile rezervate.');
}

function showStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = 'p-4 rounded-lg mb-6 ' + (type === 'success' ? 'bg-green-100 text-green-800' : type === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800');
  statusMessage.classList.remove('hidden');
  if (type !== 'info') setTimeout(() => statusMessage.classList.add('hidden'), 5000);
}

function uploadWithProgress(fileRef, file, metadata, onProgress) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(fileRef, file, metadata);
    task.on('state_changed', (snapshot) => onProgress(Math.round((snapshot.bytesTransferred / Math.max(snapshot.totalBytes, 1)) * 100)), reject, () => resolve(task.snapshot));
  });
}

function courseByKey(key) {
  return courses.find((course) => course.course === key || course.courseLabel === key);
}

function selectedCourse() {
  return courseByKey(activeCourseKey) || courses[0];
}

function courseItems(course) {
  return [
    { slug: '__theory__', instrument: t('common-theory', 'Teorie'), category: 'teorie', materialSlug: '__general__', icon: 'T' },
    { slug: '__solfegiu__', instrument: t('materials-solfeggio', 'Solfegiu'), category: 'solfegiu', materialSlug: '__general__', icon: 'S' },
    ...(course?.items || []).map((item) => ({ ...item, category: 'instrument', materialSlug: item.slug, icon: item.instrument.slice(0, 1).toUpperCase() })),
  ];
}

function activeFolder() {
  return courseItems(selectedCourse()).find((item) => item.slug === activeFolderSlug);
}

function materialDate(timestamp) {
  try {
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString(window.i18n?.getLanguage?.() === 'ru' ? 'ru-RU' : 'ro-RO', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    return '-';
  }
}

function categoryLabel(value) {
  return {
    cantari: t('materials-category-songs', 'Cantari'),
    note: t('materials-category-notes', 'Note'),
    teorie: t('materials-category-theory', 'Lectii de teorie'),
    solfegiu: t('materials-category-solfeggio', 'Lectii de solfegiu'),
  }[value] || value || t('nav-materials', 'Material');
}

function fillCourses() {
  const options = courses.map((course) => `<option value="${esc(course.course)}">${esc(courseDisplayName(course))}</option>`).join('');
  courseSelect.innerHTML = options;
  coursePicker.innerHTML = options;
  listCourseSelect.innerHTML = `<option value="all">${t('admin-materials-all-courses', 'Toate cursurile')}</option>` + options;
  if (!courseByKey(activeCourseKey) && courses[0]) activeCourseKey = courses[0].course;
  courseSelect.value = activeCourseKey;
  coursePicker.value = activeCourseKey;
  listCourseSelect.value = activeCourseKey;
}

function fillInstruments() {
  const course = selectedCourse();
  instrumentSelect.innerHTML = `<option value="__general__">${t('admin-materials-general', 'General pentru curs')}</option>` + (course?.items || []).map((item) => `<option value="${esc(item.slug)}">${esc(folderDisplayName(item))}</option>`).join('');
  sessionSelect.innerHTML = sessionsForCourse(course).map((session) => `<option value="${esc(session)}">${esc(sessionDisplayName(session))}</option>`).join('') + `<option value="__all__">${esc(t('admin-materials-all-sessions', 'Toate cursurile'))}</option>`;
  categorySelect.innerHTML = ['cantari', 'note', 'teorie', 'solfegiu'].map((category) => `<option value="${esc(category)}">${esc(categoryLabel(category))}</option>`).join('');
  categoryChoice.innerHTML = ['cantari', 'note'].map((category) => `<option value="${esc(category)}">${esc(categoryLabel(category))}</option>`).join('');
}

function applySelectionToForm() {
  const course = selectedCourse();
  const folder = activeFolder();
  if (!course || !folder || !activeSession) {
    uploadPanel.classList.add('hidden');
    return;
  }
  courseSelect.value = course.course;
  instrumentSelect.value = folder.materialSlug;
  sessionSelect.value = activeSession;
  if (folder.category === 'instrument') {
    categoryChoiceWrap.classList.remove('hidden');
    categorySelect.value = categoryChoice.value || 'cantari';
  } else {
    categoryChoiceWrap.classList.add('hidden');
    categorySelect.value = folder.category;
  }
  uploadPanel.classList.remove('hidden');
  const folderName = folderDisplayName(folder);
  uploadTitle.textContent = tr('admin-materials-upload-title', `Incarca material pentru ${folderName}`, { folder: folderName });
  uploadContext.textContent = `${courseDisplayName(course)} / ${folderName} / ${sessionDisplayName(activeSession)}`;
}

function selectedMaterialRows() {
  const course = selectedCourse();
  const folder = activeFolder();
  if (!course) return [];
  if (!folder || !activeSession) {
    const selected = listCourseSelect.value || activeCourseKey || 'all';
    return allMaterials.filter((item) => selected === 'all' || item.course === selected);
  }
  const allowedCategories = folder.category === 'instrument' ? ['cantari', 'note'] : [folder.category];
  return allMaterials.filter((item) => {
    const sameCourse = item.course === course.course;
    const sameInstrument = item.instrumentSlug === folder.materialSlug;
    const sameSession = item.session === activeSession || item.session === '__all__';
    const sameCategory = allowedCategories.includes(item.category || 'cantari');
    return sameCourse && sameInstrument && sameSession && sameCategory;
  });
}

function renderList() {
  const rows = selectedMaterialRows();
  const course = selectedCourse();
  const folder = activeFolder();
  if (folder && activeSession) {
    const folderName = folderDisplayName(folder);
    listTitle.textContent = tr('admin-materials-list-selected', `Materiale: ${folderName}`, { folder: folderName });
    listContext.textContent = `${courseDisplayName(course)} / ${folderName} / ${sessionDisplayName(activeSession)}`;
  } else {
    listTitle.textContent = t('admin-materials-list-title', 'Materiale incarcate');
    listContext.textContent = t('admin-materials-list-context-default', 'Alege un folder si un curs pentru a vedea materialele din acel loc.');
  }
  if (!rows.length) {
    listMount.innerHTML = `<div class="materials-empty">${t('admin-materials-no-materials', 'Nu sunt materiale incarcate pentru aceasta selectie.')}</div>`;
    return;
  }
  listMount.innerHTML = rows.map((item) => {
    const url = safeLink(item.fileURL);
    return `
      <article class="materials-item">
        <h4>${esc(item.title || item.fileName || t('nav-materials', 'Material'))}</h4>
        <p>${esc([courseDisplayName(item.course), folderDisplayName({ slug: item.instrumentSlug, instrument: item.instrument }), sessionDisplayName(item.session), categoryLabel(item.category)].filter(Boolean).join(' / '))}</p>
        <p>${esc(item.fileName || '')} · ${esc(materialDate(item.createdAt))}</p>
        ${url ? `<a href="${url}" target="_blank" rel="noopener">${t('admin-materials-view-file', 'Vezi fisier')}</a>` : ''}
        <button type="button" class="materials-delete" data-delete-material="${esc(item.id)}" data-path="${esc(item.filePath || '')}">${t('common-delete', 'Sterge')}</button>
      </article>
    `;
  }).join('');
}

function renderFolderBrowser() {
  const course = selectedCourse();
  const folder = activeFolder();
  if (!course) {
    folderMount.innerHTML = `<div class="materials-empty">${t('materials-course-not-found', 'Nu am gasit cursul.')}</div>`;
    return;
  }
  const courseName = courseDisplayName(course);
  const folderName = folderDisplayName(folder);
  const courseSessions = sessionsForCourse(course);
  if (activeSession && !courseSessions.includes(activeSession)) activeSession = null;
  courseTitle.textContent = tr('admin-materials-title', `Materiale - ${courseName}`, { course: courseName });
  courseContext.textContent = folder ? tr('admin-materials-context-selected', `Folder selectat: ${folderName}`, { folder: `${folderName}${activeSession ? ` / ${sessionDisplayName(activeSession)}` : ''}` }) : t('admin-materials-context-default', 'Alege Teorie, Solfegiu sau instrumentul dorit.');

  if (!folder) {
    uploadPanel.classList.add('hidden');
    folderMount.innerHTML = `
      <div class="materials-folder-grid">
        ${courseItems(course).map((item) => `
          <button type="button" class="materials-folder-card" data-admin-open-folder="${esc(item.slug)}">
            <span class="materials-folder-visual" aria-hidden="true">
              <span class="materials-folder-tab"></span>
              <span class="materials-folder-body">
                <span class="materials-folder-paper one"></span>
                <span class="materials-folder-paper two"></span>
                <span class="materials-folder-icon">${esc(item.icon || '')}</span>
              </span>
            </span>
            <span class="materials-folder-kicker">${esc(courseName)}</span>
            <strong>${esc(folderDisplayName(item))}</strong>
            <small>${t('materials-open-folder', 'Deschide folderul')}</small>
          </button>
        `).join('')}
      </div>
    `;
    renderList();
    return;
  }

  if (!activeSession) {
    uploadPanel.classList.add('hidden');
    folderMount.innerHTML = `
      <div class="admin-material-folder-actions">
        <button type="button" class="materials-back-button" data-admin-close-folder>${t('common-back-folders', 'Inapoi la foldere')}</button>
        <span class="admin-material-selection-note">${esc(courseName)} / ${esc(folderName)}</span>
      </div>
      <div class="materials-folder-grid materials-session-folder-grid">
        ${courseSessions.map((session) => `
          <button type="button" class="materials-folder-card materials-session-folder-card" data-admin-open-session="${esc(session)}">
            <span class="materials-folder-visual" aria-hidden="true">
              <span class="materials-folder-tab"></span>
              <span class="materials-folder-body">
                <span class="materials-folder-paper one"></span>
                <span class="materials-folder-paper two"></span>
                <span class="materials-folder-icon">${esc(session.replace('Sesia ', ''))}</span>
              </span>
            </span>
            <span class="materials-folder-kicker">${esc(folderName)}</span>
            <strong>${esc(sessionDisplayName(session))}</strong>
            <small>${t('admin-materials-open-upload', 'Incarca materiale')}</small>
          </button>
        `).join('')}
      </div>
    `;
    renderList();
    return;
  }

  folderMount.innerHTML = `
    <div class="admin-material-folder-actions">
      <button type="button" class="materials-back-button" data-admin-close-session>${t('common-back-sessions', 'Inapoi la cursuri')}</button>
      <button type="button" class="materials-back-button" data-admin-close-folder>${t('common-back-folders', 'Inapoi la foldere')}</button>
      <span class="admin-material-selection-note">${esc(courseName)} / ${esc(folderName)} / ${esc(sessionDisplayName(activeSession))}</span>
    </div>
  `;
  applySelectionToForm();
  renderList();
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const file = fileInput.files?.[0];
  const course = selectedCourse();
  const folder = activeFolder();
  if (!file || !course || !folder || !activeSession) {
    showStatus(t('admin-materials-choose-error', 'Alege folderul, cursul si fisierul.'), 'error');
    return;
  }
  if (file.size > 80 * 1024 * 1024) {
    showStatus(t('admin-materials-size-error', 'Fisierul este prea mare. Maxim 80MB.'), 'error');
    return;
  }
  applySelectionToForm();
  const instrument = (course.items || []).find((item) => item.slug === instrumentSelect.value);
  const category = categorySelect.value;
  const storagePath = `course_materials/${safeSegment(course.course)}/${safeSegment(instrumentSelect.value)}/${safeSegment(sessionSelect.value)}/${safeSegment(category)}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  uploadButton.disabled = true;
  try {
    const fileRef = ref(storage, storagePath);
    const snapshot = await uploadWithProgress(fileRef, file, { contentType: file.type || 'application/octet-stream' }, (percent) => {
      uploadButtonText.textContent = `${t('admin-materials-uploading', 'Se incarca...')} ${percent}%`;
      showStatus(`${t('admin-materials-uploading-file', 'Se incarca fisierul...')} ${percent}%`, 'info');
    });
    const fileURL = await getDownloadURL(snapshot.ref);
    await addDoc(collection(db, 'courseMaterials'), {
      course: course.course,
      courseLabel: course.courseLabel || course.course,
      instrument: instrument?.instrument || folder.instrument,
      instrumentSlug: instrumentSelect.value,
      session: sessionSelect.value,
      category,
      categoryLabel: categoryLabel(category),
      title: titleInput.value.trim() || file.name,
      description: descriptionInput.value.trim(),
      fileName: file.name,
      filePath: storagePath,
      fileURL,
      fileSize: file.size,
      fileType: file.type,
      createdAt: serverTimestamp(),
    });
    showStatus(t('admin-materials-upload-success', 'Material incarcat cu succes.'), 'success');
    window.MHOAnalytics?.capture?.('admin_material_uploaded', {
      course: course.course,
      instrument: instrument?.instrument || folder.instrument,
      instrumentSlug: instrumentSelect.value,
      session: sessionSelect.value,
      category,
      fileType: file.type || '',
      fileSize: file.size,
    });
    titleInput.value = '';
    descriptionInput.value = '';
    fileInput.value = '';
  } catch (error) {
    console.error(error);
    showStatus(t('admin-materials-upload-error', 'Nu am putut incarca materialul.'), 'error');
  } finally {
    uploadButton.disabled = false;
    uploadButtonText.textContent = t('admin-materials-upload-button', 'Incarca materialul');
  }
});

listMount?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-delete-material]');
  if (!button || !confirm(t('admin-materials-delete-confirm', 'Sigur stergi acest material?'))) return;
  try {
    if (button.dataset.path) {
      try { await deleteObject(ref(storage, button.dataset.path)); } catch (error) { console.warn(error); }
    }
    await deleteDoc(doc(db, 'courseMaterials', button.dataset.deleteMaterial));
    showStatus(t('admin-materials-delete-success', 'Material sters.'), 'success');
  } catch (error) {
    console.error(error);
    showStatus(t('admin-materials-delete-error', 'Nu am putut sterge materialul.'), 'error');
  }
});

document.addEventListener('click', (event) => {
  const folderButton = event.target.closest('[data-admin-open-folder]');
  if (folderButton) {
    activeFolderSlug = folderButton.dataset.adminOpenFolder;
    activeSession = null;
    renderFolderBrowser();
    return;
  }
  const sessionButton = event.target.closest('[data-admin-open-session]');
  if (sessionButton) {
    activeSession = sessionButton.dataset.adminOpenSession;
    renderFolderBrowser();
    return;
  }
  if (event.target.closest('[data-admin-close-session]')) {
    activeSession = null;
    renderFolderBrowser();
    return;
  }
  if (event.target.closest('[data-admin-close-folder]')) {
    activeFolderSlug = null;
    activeSession = null;
    renderFolderBrowser();
  }
});

async function initialize() {
  await window.AdminAccessReady;
  updateStaticText();
  fillCourses();
  fillInstruments();
  coursePicker.addEventListener('change', () => {
    activeCourseKey = coursePicker.value;
    activeFolderSlug = null;
    activeSession = null;
    courseSelect.value = activeCourseKey;
    listCourseSelect.value = activeCourseKey;
    fillInstruments();
    renderFolderBrowser();
  });
  listCourseSelect.addEventListener('change', renderList);
  categoryChoice.addEventListener('change', () => {
    categorySelect.value = categoryChoice.value;
    renderList();
  });
  renderFolderBrowser();
  onSnapshot(query(collection(db, 'courseMaterials'), orderBy('createdAt', 'desc')), (snapshot) => {
    allMaterials = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderList();
  }, (error) => {
    console.error(error);
    listMount.innerHTML = `<div class="materials-empty">${t('admin-materials-upload-error', 'Nu am putut incarca materialele.')}</div>`;
  });
}

initialize().catch((error) => {
  console.error(error);
  if (listMount) listMount.innerHTML = `<div class="materials-empty">${t('admin-exams-init-error', 'Nu am putut porni pagina de administrare.')}</div>`;
});

window.addEventListener('mho:language-change', () => {
  updateStaticText();
  fillCourses();
  fillInstruments();
  renderFolderBrowser();
});
