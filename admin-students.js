import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, query, onSnapshot, orderBy, doc, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const app = getApps().length ? getApp() : initializeApp(window.MHO_EXAM_FIREBASE_CONFIG);
const db = getFirestore(app);
const helpers = window.MHO_EXAM_HELPERS;
const esc = (value) => window.SafeDOM.escapeHTML(value);

const courseFilter = document.getElementById('courseFilter');
const courseTitle = document.getElementById('courseTitle');
const backToCourseMenu = document.getElementById('backToCourseMenu');
const totalStudents = document.getElementById('totalStudents');
const studentForm = document.getElementById('studentForm');
const studentStatus = document.getElementById('studentStatus');
const tableBody = document.getElementById('studentsTableBody');
const searchFilter = document.getElementById('searchFilter');
const instrumentFilter = document.getElementById('instrumentFilter');
const groupFilter = document.getElementById('groupFilter');
const formInstrument = document.getElementById('instrument');
const formGroup = document.getElementById('group');
const exportStudentsExcelBtn = document.getElementById('exportStudentsExcelBtn');

const courses = ['ORNI', 'Aerofone', 'Coarde', 'Dirijor'];
const defaultCourse = new URLSearchParams(window.location.search).get('course') || 'ORNI';
let activeCourse = courses.includes(defaultCourse) ? defaultCourse : 'ORNI';
let registrations = [];
let directoryRows = [];

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

function safeSegment(value) {
  return String(value || 'nespecificat').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'nespecificat';
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function courseName(course = activeCourse) {
  return t(`materials-course-${course.toLowerCase()}`, helpers.courseLabel(course));
}

function courseMatches(row, course = activeCourse) {
  const source = String(row.course || row.courseType || row.selectedCourse || '').toLowerCase();
  return source.includes(String(course).toLowerCase());
}

function groupOptions(course = activeCourse) {
  if (course === 'Dirijor') {
    return [
      'Sesia 1 (grupa B)',
      'Sesia 2 (grupa A)',
      'Sesia 3 (armonie)',
      'Sesia 4 (armonie)',
      'Sesia 5 (armonie)',
      'Sesia 6 (armonie)',
    ];
  }
  return ['Pentru prima data', 'G', 'B', 'V', 'A', 'Armonie'];
}

function groupLabel(group) {
  const labels = {
    'Pentru prima data': t('group-first-time', 'Pentru prima dată'),
    'Sesia 1 (grupa B)': t('dirijor-group-option-1', 'Curs 1 (grupa B)'),
    'Sesia 2 (grupa A)': t('dirijor-group-option-2', 'Curs 2 (grupa A)'),
    'Sesia 3 (armonie)': t('dirijor-group-option-3', 'Curs 3 (armonie)'),
    'Sesia 4 (armonie)': t('dirijor-group-option-4', 'Curs 4 (armonie)'),
    'Sesia 5 (armonie)': t('dirijor-group-option-5', 'Curs 5 (armonie)'),
    'Sesia 6 (armonie)': t('dirijor-group-option-6', 'Curs 6 (armonie)'),
    Armonie: t('group-harmony', 'Armonie'),
  };
  return labels[group] || group;
}

function instrumentOptions(course = activeCourse) {
  return helpers.instrumentsForCourse(course);
}

function instrumentLabel(slug, fallback = '') {
  if (!slug) return fallback || t('common-unspecified', 'Nespecificat');
  return t(`materials-folder-${slug}`, fallback || helpers.labelForInstrument(slug) || slug);
}

function courseLevelLabel(value, fallback = '') {
  const labels = {
    'Sesia 1-2': t('course-level-1-2', 'Curs 1-2'),
    'Sesia 3-4': t('course-level-3-4', 'Curs 3-4'),
    'Sesia 5-6': t('course-level-5-6', 'Curs 5-6'),
  };
  return labels[value] || fallback || value || '';
}

function previousCourseSummary(row) {
  if (!row.hasPreviousCourse) return '';
  const course = row.previousCourseTypeLabel || (row.previousCourseType ? courseName(row.previousCourseType) : '');
  const level = courseLevelLabel(row.previousCourseLevel, row.previousCourseLevelLabel);
  return [course, level].filter(Boolean).join(' / ');
}

function rowKey(row) {
  const email = normalize(row.email);
  return email || `id:${row.registrationId || row.id || ''}`;
}

function directoryDocId(row) {
  const key = normalize(row.email) || row.registrationId || row.id || `${row.firstName}-${row.lastName}-${Date.now()}`;
  return `${safeSegment(activeCourse)}__${safeSegment(key)}`;
}

function mergeRows() {
  const directoryByKey = new Map();
  directoryRows.filter((row) => courseMatches(row)).forEach((row) => {
    const key = rowKey(row);
    if (key) directoryByKey.set(key, row);
  });

  const merged = new Map();
  registrations.filter((row) => courseMatches(row)).forEach((registration) => {
    const key = rowKey(registration);
    const override = directoryByKey.get(key);
    const item = {
      id: override?.id || registration.id,
      registrationId: registration.id,
      directoryId: override?.id || '',
      firstName: override?.firstName || registration.firstName || '',
      lastName: override?.lastName || registration.lastName || registration.name || '',
      email: override?.email || registration.email || '',
      phone: override?.phone || registration.phone || '',
      course: activeCourse,
      instrumentSlug: override?.instrumentSlug || registration.instrumentSlug || '',
      instrument: override?.instrument || registration.instrument || '',
      group: override?.group || registration.group || registration.studentGroup || '',
      hasPreviousCourse: Boolean(registration.hasPreviousCourse),
      previousCourseType: registration.previousCourseType || '',
      previousCourseTypeLabel: registration.previousCourseTypeLabel || '',
      previousCourseLevel: registration.previousCourseLevel || '',
      previousCourseLevelLabel: registration.previousCourseLevelLabel || '',
      notes: override?.notes || '',
      source: override?.source || 'registration',
      fromRegistration: true,
    };
    merged.set(key || `reg:${registration.id}`, item);
  });

  directoryRows.filter((row) => courseMatches(row)).forEach((row) => {
    const key = rowKey(row);
    if (!merged.has(key)) {
      merged.set(key || `manual:${row.id}`, {
        ...row,
        directoryId: row.id,
        source: row.source || 'manual',
        fromRegistration: false,
      });
    }
  });

  return Array.from(merged.values()).sort((a, b) => {
    const last = normalize(a.lastName).localeCompare(normalize(b.lastName), window.i18n?.getLanguage?.() === 'ru' ? 'ru' : 'ro');
    if (last) return last;
    return normalize(a.firstName).localeCompare(normalize(b.firstName), window.i18n?.getLanguage?.() === 'ru' ? 'ru' : 'ro');
  });
}

function renderSelectOptions() {
  const allInstruments = `<option value="all">${t('admin-exams-all-instruments', 'Toate instrumentele')}</option>`;
  const noInstrument = `<option value="none">${t('common-unspecified', 'Nespecificat')}</option>`;
  const instrumentMarkup = instrumentOptions().map((item) => `<option value="${esc(item.slug)}">${esc(instrumentLabel(item.slug, item.instrument))}</option>`).join('');
  const blankInstrument = `<option value="">${t('admin-students-select-instrument', 'Alege instrumentul...')}</option>`;
  if (instrumentFilter) instrumentFilter.innerHTML = allInstruments + noInstrument + instrumentMarkup;
  if (formInstrument) formInstrument.innerHTML = blankInstrument + instrumentMarkup;

  const allGroups = `<option value="all">${t('admin-students-all-groups', 'Toate grupele')}</option>`;
  const noGroup = `<option value="none">${t('common-unspecified', 'Nespecificat')}</option>`;
  const groupMarkup = groupOptions().map((group) => `<option value="${esc(group)}">${esc(groupLabel(group))}</option>`).join('');
  const blankGroup = `<option value="">${t('placeholder-group-select', 'Selectati grupa...')}</option>`;
  if (groupFilter) groupFilter.innerHTML = allGroups + noGroup + groupMarkup;
  if (formGroup) formGroup.innerHTML = blankGroup + groupMarkup;
}

function inlineInstrumentSelect(row) {
  const options = [`<option value="">${t('common-unspecified', 'Nespecificat')}</option>`]
    .concat(instrumentOptions().map((item) => `<option value="${esc(item.slug)}" ${row.instrumentSlug === item.slug ? 'selected' : ''}>${esc(instrumentLabel(item.slug, item.instrument))}</option>`));
  return `<select data-row-instrument="${esc(row.id)}" class="px-4 py-2 rounded-xl border border-gray-300 min-w-44">${options.join('')}</select>`;
}

function inlineGroupSelect(row) {
  const options = [`<option value="">${t('common-unspecified', 'Nespecificat')}</option>`]
    .concat(groupOptions().map((group) => `<option value="${esc(group)}" ${row.group === group ? 'selected' : ''}>${esc(groupLabel(group))}</option>`));
  return `<select data-row-group="${esc(row.id)}" class="px-4 py-2 rounded-xl border border-gray-300 min-w-36">${options.join('')}</select>`;
}

function filteredRows() {
  const search = normalize(searchFilter?.value);
  const instrument = instrumentFilter?.value || 'all';
  const group = groupFilter?.value || 'all';
  return mergeRows().filter((row) => {
    const haystack = normalize(`${row.firstName} ${row.lastName} ${row.email}`);
    const matchesSearch = !search || haystack.includes(search);
    const matchesInstrument = instrument === 'all' || (instrument === 'none' ? !row.instrumentSlug : row.instrumentSlug === instrument);
    const matchesGroup = group === 'all' || (group === 'none' ? !row.group : row.group === group);
    return matchesSearch && matchesInstrument && matchesGroup;
  });
}

function renderTable() {
  const rows = filteredRows();
  if (totalStudents) totalStudents.textContent = String(rows.length);
  if (!tableBody) return;
  if (!rows.length) {
    tableBody.innerHTML = `<tr><td colspan="6" class="px-8 py-10 text-center text-gray-500 text-xl italic">${t('admin-students-empty', 'Nu sunt studenti pentru selectia curenta.')}</td></tr>`;
    return;
  }
  tableBody.innerHTML = rows.map((row) => {
    const sourceLabel = row.fromRegistration ? t('admin-students-source-registration', 'Inscriere') : t('admin-students-source-manual', 'Adaugat manual');
    const canDelete = !row.fromRegistration && row.directoryId;
    const previousCourse = previousCourseSummary(row);
    return `<tr class="hover:bg-gray-50 transition-colors">
      <td class="px-6 py-5 whitespace-nowrap">
        <div class="font-black text-gray-900">${esc(row.lastName)} ${esc(row.firstName)}</div>
        ${row.phone ? `<div class="text-sm text-gray-500">${esc(row.phone)}</div>` : ''}
        ${previousCourse ? `<div class="mt-2 text-xs font-bold uppercase tracking-wide text-sky-700">${esc(t('admin-students-previous-course', 'Curs anterior'))}: ${esc(previousCourse)}</div>` : ''}
      </td>
      <td class="px-6 py-5 whitespace-nowrap text-gray-600">${esc(row.email || '-')}</td>
      <td class="px-6 py-5 whitespace-nowrap">${inlineInstrumentSelect(row)}</td>
      <td class="px-6 py-5 whitespace-nowrap">${inlineGroupSelect(row)}</td>
      <td class="px-6 py-5 whitespace-nowrap"><span class="px-3 py-1 rounded-full bg-sky-50 text-sky-800 font-bold text-sm">${esc(sourceLabel)}</span></td>
      <td class="px-6 py-5 whitespace-nowrap">
        <button type="button" data-save-student="${esc(row.id)}" class="text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-4 py-2 rounded-xl font-black">${t('common-save', 'Salveaza')}</button>
        ${canDelete ? `<button type="button" data-delete-student="${esc(row.directoryId)}" class="ml-2 text-red-700 hover:text-red-900 bg-red-50 px-4 py-2 rounded-xl font-black">${t('common-delete', 'Sterge')}</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function exportStudentsToExcel() {
  const rows = filteredRows();
  if (!rows.length) {
    alert(t('admin-students-export-empty', 'Nu exista studenti de exportat pentru selectia curenta.'));
    return;
  }
  const headers = [
    t('admin-exams-export-full-name', 'Nume complet'),
    t('label-last-name-profile', 'Nume'),
    t('label-first-name-profile', 'Prenume'),
    t('csv-email', 'Email'),
    t('profile-phone-label', 'Telefon'),
    t('common-course', 'Curs'),
    t('common-instrument', 'Instrument'),
    t('common-group', 'Grupa'),
    t('admin-students-previous-course', 'Curs anterior'),
    t('admin-students-source', 'Sursa'),
  ];
  const dataRows = rows.map((row) => [
    `${row.lastName || ''} ${row.firstName || ''}`.trim(),
    row.lastName || '',
    row.firstName || '',
    row.email || '',
    row.phone || '',
    courseName(),
    row.instrumentSlug ? instrumentLabel(row.instrumentSlug, row.instrument) : t('common-unspecified', 'Nespecificat'),
    row.group ? groupLabel(row.group) : t('common-unspecified', 'Nespecificat'),
    previousCourseSummary(row),
    row.fromRegistration ? t('admin-students-source-registration', 'Inscriere') : t('admin-students-source-manual', 'Adaugat manual'),
  ]);
  const csv = [headers, ...dataRows].map((row) => row.map(csvCell).join(';')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  const instrumentScope = instrumentFilter?.value && !['all', 'none'].includes(instrumentFilter.value) ? `_${safeSegment(instrumentFilter.value)}` : '';
  const groupScope = groupFilter?.value && !['all', 'none'].includes(groupFilter.value) ? `_${safeSegment(groupFilter.value)}` : '';
  link.href = URL.createObjectURL(blob);
  link.download = `studenti_${safeSegment(activeCourse)}${instrumentScope}${groupScope}_${date}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
  window.MHOAnalytics?.capture?.('admin_students_exported', {
    course: activeCourse,
    instrument: instrumentFilter?.value || 'all',
    group: groupFilter?.value || 'all',
    count: rows.length,
  });
}

function showStatus(message, type = 'success') {
  if (!studentStatus) return;
  studentStatus.textContent = message;
  studentStatus.className = `mx-8 mb-8 p-4 rounded-xl text-center font-bold ${type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`;
  studentStatus.classList.remove('hidden');
  setTimeout(() => studentStatus.classList.add('hidden'), 2600);
}

async function saveStudentRow(row) {
  const instrumentSlug = tableBody.querySelector(`[data-row-instrument="${CSS.escape(row.id)}"]`)?.value || '';
  const instrumentItem = instrumentOptions().find((item) => item.slug === instrumentSlug);
  const group = tableBody.querySelector(`[data-row-group="${CSS.escape(row.id)}"]`)?.value || '';
  const targetDocId = row.directoryId || directoryDocId(row);
  await setDoc(doc(db, 'studentDirectory', targetDocId), {
    course: activeCourse,
    registrationId: row.registrationId || '',
    firstName: row.firstName || '',
    lastName: row.lastName || '',
    email: row.email || '',
    phone: row.phone || '',
    instrumentSlug,
    instrument: instrumentItem?.instrument || '',
    group,
    source: row.fromRegistration ? 'registration' : 'manual',
    updatedAt: serverTimestamp(),
  }, { merge: true });
  showStatus(t('admin-students-save-success', 'Studentul a fost salvat.'));
}

async function addStudent(event) {
  event.preventDefault();
  const firstName = document.getElementById('firstName')?.value.trim() || '';
  const lastName = document.getElementById('lastName')?.value.trim() || '';
  const email = document.getElementById('email')?.value.trim() || '';
  const instrumentSlug = formInstrument?.value || '';
  const instrumentItem = instrumentOptions().find((item) => item.slug === instrumentSlug);
  const group = formGroup?.value || '';
  if (!firstName || !lastName) {
    showStatus(t('admin-students-required-error', 'Completeaza numele si prenumele studentului.'), 'error');
    return;
  }
  const payload = {
    course: activeCourse,
    firstName,
    lastName,
    email,
    instrumentSlug,
    instrument: instrumentItem?.instrument || '',
    group,
    source: 'manual',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const targetDocId = email ? `${safeSegment(activeCourse)}__${safeSegment(email)}` : `${safeSegment(activeCourse)}__manual__${safeSegment(firstName)}_${safeSegment(lastName)}_${Date.now()}`;
  await setDoc(doc(db, 'studentDirectory', targetDocId), payload, { merge: true });
  studentForm.reset();
  showStatus(t('admin-students-add-success', 'Studentul a fost adaugat.'));
}

function updatePageChrome() {
  const name = courseName();
  document.title = tr('admin-students-browser-title', 'Lista studenti {course} - MHO Music Academy', { course: name });
  if (courseTitle) courseTitle.textContent = name;
  if (backToCourseMenu) {
    backToCourseMenu.href = `admin-${safeSegment(activeCourse)}.html`;
    backToCourseMenu.textContent = tr('admin-students-back-course-name', 'Inapoi la meniul {course}', { course: name });
  }
}

function applyStaticTranslations() {
  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    const key = node.dataset.i18nPlaceholder;
    const translated = t(key, node.getAttribute('placeholder') || '');
    if (translated) node.setAttribute('placeholder', translated);
  });
}

function setCourse(course) {
  activeCourse = courses.includes(course) ? course : 'ORNI';
  const url = new URL(window.location.href);
  url.searchParams.set('course', activeCourse);
  window.history.replaceState({}, '', url);
  updatePageChrome();
  renderSelectOptions();
  renderTable();
}

async function initialize() {
  await window.AdminAccessReady;
  if (courseFilter) {
    courseFilter.innerHTML = courses.map((course) => `<option value="${course}">${esc(courseName(course))}</option>`).join('');
    courseFilter.value = activeCourse;
    courseFilter.addEventListener('change', () => setCourse(courseFilter.value));
  }
  renderSelectOptions();
  updatePageChrome();
  applyStaticTranslations();
  studentForm?.addEventListener('submit', addStudent);
  exportStudentsExcelBtn?.addEventListener('click', exportStudentsToExcel);
  [searchFilter, instrumentFilter, groupFilter].forEach((element) => element?.addEventListener('input', renderTable));
  tableBody?.addEventListener('click', async (event) => {
    const saveButton = event.target.closest('[data-save-student]');
    const deleteButton = event.target.closest('[data-delete-student]');
    if (saveButton) {
      const row = filteredRows().find((item) => item.id === saveButton.dataset.saveStudent);
      if (!row) return;
      saveButton.disabled = true;
      try { await saveStudentRow(row); } catch (error) { console.error(error); showStatus(t('admin-students-save-error', 'Nu am putut salva studentul.'), 'error'); }
      saveButton.disabled = false;
    }
    if (deleteButton && confirm(t('admin-students-delete-confirm', 'Stergi acest student din lista?'))) {
      try { await deleteDoc(doc(db, 'studentDirectory', deleteButton.dataset.deleteStudent)); } catch (error) { console.error(error); showStatus(t('admin-students-delete-error', 'Nu am putut sterge studentul.'), 'error'); }
    }
  });
  onSnapshot(query(collection(db, 'registrations'), orderBy('timestamp', 'desc')), (snapshot) => {
    registrations = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderTable();
  }, (error) => {
    console.error(error);
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="px-8 py-10 text-center text-red-600 text-xl italic">${t('admin-students-load-error', 'Nu am putut incarca studentii.')}</td></tr>`;
  });
  onSnapshot(query(collection(db, 'studentDirectory')), (snapshot) => {
    directoryRows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderTable();
  }, (error) => console.error(error));
}

window.addEventListener('mho:language-change', () => window.location.reload());
initialize().catch((error) => {
  console.error(error);
  if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="px-8 py-10 text-center text-red-600 text-xl italic">${t('admin-students-init-error', 'Nu am putut porni pagina.')}</td></tr>`;
});
