import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, query, onSnapshot, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = window.MHO_EXAM_FIREBASE_CONFIG;
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const esc = (value) => window.SafeDOM?.escapeHTML ? window.SafeDOM.escapeHTML(value) : String(value ?? '');
const safeLink = (value) => window.SafeDOM?.safeURL ? window.SafeDOM.safeURL(value) : String(value || '');
const baseSessions = ['Sesia 1-2', 'Sesia 3-4', 'Sesia 5-6'];
const orniSessions = [...baseSessions, 'Sesia 7'];
const courseAliases = {
  'Viori / Coarde': 'Coarde',
  'Dirijor de cor': 'Dirijor',
};
let activeSessions = {};
let materials = [];
let activeFolderSlug = null;
let activeSessionFolder = null;

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

function syncStateFromParams() {
  const params = new URLSearchParams(window.location.search);
  activeFolderSlug = params.get('folder') || params.get('instrument') || activeFolderSlug;
  activeSessionFolder = params.get('session') || activeSessionFolder;
}

function courseParam() {
  return new URLSearchParams(window.location.search).get('course') || '';
}

function courseCatalog() {
  return window.MHO_EXAM_CATALOG || [];
}

function courseDisplayName(course) {
  const courseKey = String(course?.course || '').toLowerCase();
  return t(`materials-course-${courseKey}`, course?.courseLabel || course?.course || '');
}

function folderDisplayName(item) {
  if (!item) return '';
  return t(`materials-folder-${item.slug}`, item.instrument || '');
}

function sessionDisplayName(session) {
  return String(session || '').replace('Sesia', t('materials-session-label', 'Curs'));
}

function sessionsForCourse(course) {
  return course?.course === 'ORNI' ? orniSessions : baseSessions;
}

function normalizedCourse(course) {
  return courseAliases[course] || course;
}

function currentCourse() {
  const param = normalizedCourse(courseParam());
  return courseCatalog().find((item) => item.course === param || item.courseLabel === param) || courseCatalog()[0];
}

function updateMaterialUrl(course, folderSlug, session) {
  const params = new URLSearchParams(window.location.search);
  params.set('course', course.course);
  if (folderSlug) params.set('folder', folderSlug);
  else params.delete('folder');
  if (session) params.set('session', session);
  else params.delete('session');
  window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
}

function materialDate(timestamp) {
  try {
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(window.i18n?.getLanguage?.() === 'ru' ? 'ru-RU' : 'ro-RO', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (error) {
    return '';
  }
}

function renderCourseHub() {
  const grid = document.getElementById('materialsCourseGrid');
  if (!grid) return;
  document.title = t('page-title-materials', 'Materiale de curs - MHO Music Academy');
  grid.innerHTML = courseCatalog().map((course) => `
    <a class="materials-card" href="materiale-curs.html?course=${encodeURIComponent(course.course)}">
      <span>${esc(courseDisplayName(course))}</span>
      <h3 class="text-2xl">${esc(courseDisplayName(course))}</h3>
      <p>${t('materials-course-card-desc', 'Alege instrumentul, cursul si categoria de materiale.')}</p>
      <strong class="materials-action">${t('materials-open-course', 'Deschide cursul')}</strong>
    </a>
  `).join('');
}

function matchingMaterials(course, instrument, session) {
  return materials.filter((item) => {
    const sameCourse = String(item.course || '').toLowerCase() === String(course.course).toLowerCase();
    const allowedCategories = instrument.category === 'instrument' ? ['cantari', 'note'] : [instrument.category];
    const sameCategory = allowedCategories.includes(item.category || 'cantari');
    if (!sameCategory) return false;
    const instrumentSlug = instrument.slug;
    const sameInstrument = item.instrumentSlug === instrumentSlug || item.instrumentSlug === '__general__';
    const sameSession = item.session === session || item.session === '__all__';
    return sameCourse && sameCategory && sameInstrument && sameSession;
  });
}

function renderMaterialList(rows) {
  if (!rows.length) return `<div class="materials-empty">${t('materials-empty-selection', 'Nu sunt materiale incarcate pentru aceasta selectie.')}</div>`;
  return `<div class="materials-list">${rows.map((item) => {
    const url = safeLink(item.fileURL);
    const fileName = esc(item.fileName || item.title || 'material');
    return `
      <article class="materials-item">
        <h4>${esc(item.title || item.fileName || t('nav-materials', 'Material'))}</h4>
        <p>${esc(item.description || '')}</p>
        <p>${esc([item.categoryLabel, item.fileName].filter(Boolean).join(' / '))}${item.createdAt ? ' · ' + esc(materialDate(item.createdAt)) : ''}</p>
        ${url ? `
          <div class="materials-item-actions">
            <a href="${url}" target="_blank" rel="noopener" data-open-material="${esc(item.id)}" data-course="${esc(item.course || '')}" data-instrument="${esc(item.instrument || '')}" data-instrument-slug="${esc(item.instrumentSlug || '')}" data-session="${esc(item.session || '')}" data-category="${esc(item.category || '')}">${t('common-open', 'Deschide')}</a>
            <button type="button" class="materials-download-button" data-download-material="${url}" data-file-name="${fileName}" data-material-id="${esc(item.id)}" data-course="${esc(item.course || '')}" data-instrument="${esc(item.instrument || '')}" data-instrument-slug="${esc(item.instrumentSlug || '')}" data-session="${esc(item.session || '')}" data-category="${esc(item.category || '')}">${t('common-download', 'Descarca')}</button>
          </div>
        ` : ''}
      </article>
    `;
  }).join('')}</div>`;
}

async function downloadMaterial(url, fileName, button) {
  const previous = button.textContent;
  button.disabled = true;
  button.textContent = t('materials-downloading', 'Se descarca...');
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Download failed');
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName || 'material';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
    button.textContent = t('materials-downloaded', 'Descarcat');
    window.MHOAnalytics?.capture?.('material_downloaded', {
      materialId: button.dataset.materialId || '',
      course: button.dataset.course || '',
      instrument: button.dataset.instrument || '',
      instrumentSlug: button.dataset.instrumentSlug || '',
      session: button.dataset.session || '',
      category: button.dataset.category || '',
    });
  } catch (error) {
    console.error(error);
    button.textContent = t('materials-download-error', 'Eroare');
  } finally {
    setTimeout(() => {
      button.textContent = previous;
      button.disabled = false;
    }, 1500);
  }
}

function courseItems(course) {
  return [
    { slug: '__theory__', instrument: t('common-theory', 'Teorie'), category: 'teorie', materialSlug: '__general__', icon: 'T' },
    { slug: '__solfegiu__', instrument: t('materials-solfeggio', 'Solfegiu'), category: 'solfegiu', materialSlug: '__general__', icon: 'S' },
    ...(course.items || []).map((item) => ({ ...item, category: 'instrument', materialSlug: item.slug, icon: item.instrument.slice(0, 1).toUpperCase() })),
  ];
}

function renderCoursePage() {
  const sectionMount = document.getElementById('materialsInstrumentSections');
  if (!sectionMount) return;
  const course = currentCourse();
  if (!course) {
    sectionMount.innerHTML = `<div class="materials-empty">${t('materials-course-not-found', 'Nu am gasit cursul.')}</div>`;
    return;
  }
  const displayCourse = courseDisplayName(course);
  document.title = `${tr('materials-page-title', `Materiale - ${displayCourse}`, { course: displayCourse })} - MHO Music Academy`;
  document.getElementById('courseTitle').textContent = tr('materials-page-title', `Materiale - ${displayCourse}`, { course: displayCourse });
  document.getElementById('courseKicker').textContent = displayCourse;
  const courseDesc = document.querySelector('#courseTitle')?.closest('section')?.querySelector('p:not(#courseKicker)');
  if (courseDesc) courseDesc.textContent = t('materials-page-desc', 'Alege teorie, solfegiu sau instrumentul dorit, apoi cursul pentru materiale.');
  const items = courseItems(course);
  if (activeFolderSlug && !items.some((item) => item.slug === activeFolderSlug)) {
    activeFolderSlug = null;
    activeSessionFolder = null;
    updateMaterialUrl(course, null, null);
  }
  const activeFolder = items.find((item) => item.slug === activeFolderSlug);
  if (!activeFolder) {
    sectionMount.innerHTML = `
      <div class="materials-folder-grid">
        ${items.map((instrument) => `
          <button type="button" class="materials-folder-card" data-open-folder="${esc(instrument.slug)}">
            <span class="materials-folder-visual" aria-hidden="true">
              <span class="materials-folder-tab"></span>
              <span class="materials-folder-body">
                <span class="materials-folder-paper one"></span>
                <span class="materials-folder-paper two"></span>
                <span class="materials-folder-icon">${esc(instrument.icon || '')}</span>
              </span>
            </span>
            <span class="materials-folder-kicker">${esc(displayCourse)}</span>
            <strong>${esc(folderDisplayName(instrument))}</strong>
            <small>${t('materials-open-folder', 'Deschide folderul')}</small>
          </button>
        `).join('')}
      </div>
    `;
    return;
  }

  sectionMount.innerHTML = `
    <section class="materials-folder-view">
      <div class="materials-folder-view-header">
        <button type="button" class="materials-back-button" ${activeSessionFolder ? 'data-close-session' : 'data-close-folder'}>${activeSessionFolder ? t('common-back-sessions', 'Inapoi la cursuri') : t('common-back-folders', 'Inapoi la foldere')}</button>
        <div>
          <p class="text-sm uppercase tracking-[0.22em] font-black text-blue-700">${esc(displayCourse)}</p>
          <h2>${esc(activeSessionFolder ? `${folderDisplayName(activeFolder)} - ${sessionDisplayName(activeSessionFolder)}` : folderDisplayName(activeFolder))}</h2>
        </div>
      </div>
      ${(() => {
        const instrument = activeFolder;
        if (!activeSessionFolder) {
          return `
            <div class="materials-folder-grid materials-session-folder-grid">
              ${sessionsForCourse(course).map((session) => `
                <button type="button" class="materials-folder-card materials-session-folder-card" data-open-session="${esc(session)}">
                  <span class="materials-folder-visual" aria-hidden="true">
                    <span class="materials-folder-tab"></span>
                    <span class="materials-folder-body">
                      <span class="materials-folder-paper one"></span>
                      <span class="materials-folder-paper two"></span>
                      <span class="materials-folder-icon">${esc(session.replace('Sesia ', ''))}</span>
                    </span>
                  </span>
                  <span class="materials-folder-kicker">${esc(folderDisplayName(activeFolder))}</span>
                  <strong>${esc(sessionDisplayName(session))}</strong>
                  <small>${t('materials-open-session', 'Deschide cursul')}</small>
                </button>
              `).join('')}
            </div>
          `;
        }
        const rows = matchingMaterials(course, { ...instrument, slug: instrument.materialSlug }, activeSessionFolder);
        return `
          <div class="materials-section-body">
            ${renderMaterialList(rows)}
          </div>
        `;
      })()}
    </section>
  `;
}

function initializeCourseMaterialsListener() {
  const sectionMount = document.getElementById('materialsInstrumentSections');
  if (!sectionMount) return;
  onSnapshot(query(collection(db, 'courseMaterials'), orderBy('createdAt', 'desc')), (snapshot) => {
    materials = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderCoursePage();
  }, (error) => {
    console.error(error);
    materials = [];
    renderCoursePage();
  });
}

document.addEventListener('click', (event) => {
  const openMaterialLink = event.target.closest('[data-open-material]');
  if (openMaterialLink) {
    window.MHOAnalytics?.capture?.('material_opened', {
      materialId: openMaterialLink.dataset.openMaterial || '',
      course: openMaterialLink.dataset.course || '',
      instrument: openMaterialLink.dataset.instrument || '',
      instrumentSlug: openMaterialLink.dataset.instrumentSlug || '',
      session: openMaterialLink.dataset.session || '',
      category: openMaterialLink.dataset.category || '',
    });
    return;
  }
  const downloadButton = event.target.closest('[data-download-material]');
  if (downloadButton) {
    downloadMaterial(downloadButton.dataset.downloadMaterial, downloadButton.dataset.fileName, downloadButton);
    return;
  }
  const folderButton = event.target.closest('[data-open-folder]');
  if (folderButton) {
    const course = currentCourse();
    activeFolderSlug = folderButton.dataset.openFolder;
    activeSessionFolder = null;
    if (course) updateMaterialUrl(course, activeFolderSlug, null);
    renderCoursePage();
    return;
  }
  const sessionFolderButton = event.target.closest('[data-open-session]');
  if (sessionFolderButton) {
    const course = currentCourse();
    activeSessionFolder = sessionFolderButton.dataset.openSession;
    if (course) updateMaterialUrl(course, activeFolderSlug, activeSessionFolder);
    renderCoursePage();
    return;
  }
  const closeSessionButton = event.target.closest('[data-close-session]');
  if (closeSessionButton) {
    const course = currentCourse();
    activeSessionFolder = null;
    if (course) updateMaterialUrl(course, activeFolderSlug, null);
    renderCoursePage();
    return;
  }
  const closeButton = event.target.closest('[data-close-folder]');
  if (closeButton) {
    const course = currentCourse();
    activeFolderSlug = null;
    activeSessionFolder = null;
    if (course) updateMaterialUrl(course, null, null);
    renderCoursePage();
    return;
  }
  const sessionButton = event.target.closest('[data-session][data-instrument]');
  if (sessionButton) {
    activeSessions[sessionButton.dataset.instrument] = sessionButton.dataset.session;
    renderCoursePage();
  }
});

syncStateFromParams();
renderCourseHub();
renderCoursePage();
initializeCourseMaterialsListener();

window.addEventListener('mho:language-change', () => {
  renderCourseHub();
  renderCoursePage();
});
