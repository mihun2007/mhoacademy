const orniSessions = [
  'Sesia 1-2',
  'Sesia 3-4',
  'Sesia 5-6',
  'Sesia 7',
];

const theoryPagesByCourse = {
  ORNI: 'exam/teorie-orni.html',
  Aerofone: 'exam/teorie-aerofone.html',
  Coarde: 'exam/teorie-coarde.html',
  Dirijor: 'exam/teorie-dirijor.html',
};

const orniTeacherContacts = {
  'orni-acordeon': [
    { name: 'Mihail Borinschi', phone: '+37369597497' },
    { name: 'Pavel Manaf', phone: '+37360129910' },
    { name: 'Pavel Pîrău', phone: '+37378497798' },
    { name: 'Anatolie Palca', phone: '+37378556827' },
  ],
  'orni-domre': [
    { name: 'Elena Crivoșeev', phone: '+37377739688' },
  ],
  'orni-balalaici': [
    { name: 'Anatolie Vulpe', phone: '+37378251378' },
  ],
  'orni-flaut': [
    { name: 'Meleștean Evelina', phone: '+37361004340' },
  ],
  'orni-kontrabas': [
    { name: 'Verminciuc Ruslan', phone: '+37367603433' },
  ],
};

const orniTheoryContacts = [
  { name: 'Oleg Șarcov', phone: '+37369430494' },
  { name: 'Alina Stefanco', phone: '+37378315989' },
  { name: 'Nichita Palca', phone: '+37360661882' },
];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

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

function sessionDisplayName(session) {
  return String(session || '').replace('Sesia', t('materials-session-label', 'Curs'));
}

function courseDisplayName(course) {
  const courseKey = String(course?.course || '').toLowerCase();
  return t(`materials-course-${courseKey}`, course?.courseLabel || course?.course || '');
}

function instrumentDisplayName(item) {
  return t(`materials-folder-${item.slug}`, item.instrument || '');
}

function phoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function contactMessage(title) {
  return `Buna ziua, am o intrebare despre examenul ORNI - ${title}.`;
}

function renderContactList(contacts, title) {
  if (!contacts?.length) return '';
  return `
    <div class="orni-teacher-contacts">
      <p class="orni-teacher-contacts-title">${escapeHtml(t('exam-teacher-contact-title', 'Profesor contact'))}</p>
      <div class="orni-teacher-contact-list">
        ${contacts.map((contact) => {
          const digits = phoneDigits(contact.phone);
          const whatsappUrl = `https://wa.me/${digits}?text=${encodeURIComponent(contactMessage(title))}`;
          const telegramUrl = `tg://resolve?phone=${digits}`;
          return `
            <div class="orni-teacher-contact">
              <strong>${escapeHtml(contact.name)}</strong>
              <div class="orni-teacher-contact-actions">
                <a href="${escapeHtml(whatsappUrl)}" target="_blank" rel="noopener" aria-label="${escapeHtml(`WhatsApp ${contact.name}`)}">${escapeHtml(contact.phone)}</a>
                <a href="${escapeHtml(telegramUrl)}" aria-label="${escapeHtml(`Telegram ${contact.name}`)}">Telegram</a>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderTheoryCard(course, displayCourse) {
  const href = theoryPagesByCourse[course.course];
  if (!href) return '';
  const contacts = course.course === 'ORNI' ? orniTheoryContacts : [];
  if (contacts.length) {
    return `
      <article class="theory-section-card theory-section-card-with-contacts">
        <div>
          <span class="text-xs font-black uppercase tracking-[0.18em] text-blue-700">${escapeHtml(t('exam-hub-theory-eyebrow', 'Examene de teorie'))}</span>
          <h4 class="text-xl font-black mt-2 text-gray-900">${escapeHtml(tr('exam-hub-theory-title', 'Teorie - {course}', { course: displayCourse }))}</h4>
          <p class="text-sm text-gray-600 mt-2">${escapeHtml(t('exam-hub-theory-desc', 'Aici descarci examenul de teorie separat de formularul practic.'))}</p>
          ${renderContactList(contacts, tr('exam-hub-theory-title', 'Teorie - {course}', { course: displayCourse }))}
        </div>
        <a class="theory-section-action" href="${escapeHtml(href)}">${escapeHtml(t('exam-hub-open-theory', 'Deschide teoria'))}</a>
      </article>
    `;
  }
  return `
    <a class="theory-section-card" href="${escapeHtml(href)}">
      <div>
        <span class="text-xs font-black uppercase tracking-[0.18em] text-blue-700">${escapeHtml(t('exam-hub-theory-eyebrow', 'Examene de teorie'))}</span>
        <h4 class="text-xl font-black mt-2 text-gray-900">${escapeHtml(tr('exam-hub-theory-title', 'Teorie - {course}', { course: displayCourse }))}</h4>
        <p class="text-sm text-gray-600 mt-2">${escapeHtml(t('exam-hub-theory-desc', 'Aici descarci examenul de teorie separat de formularul practic.'))}</p>
      </div>
      <span class="theory-section-action">${escapeHtml(t('exam-hub-open-theory', 'Deschide teoria'))}</span>
    </a>
  `;
}

function renderInstrumentCard(course, item) {
  const title = instrumentDisplayName(item);
  if (course.course === 'ORNI') {
    const contacts = orniTeacherContacts[item.slug] || [];
    const sessionLinks = orniSessions.map((session) => {
      const url = `${item.href}?session=${encodeURIComponent(session)}`;
      return `<a class="session-link" href="${escapeHtml(url)}">${escapeHtml(sessionDisplayName(session))}</a>`;
    }).join('');
    return `
      <article class="instrument-card orni-session-card">
        <span class="text-xs font-black uppercase tracking-[0.18em] text-blue-700">${escapeHtml(courseDisplayName(course))}</span>
        <h4 class="text-xl font-black mt-2 text-gray-900">${escapeHtml(title)}</h4>
        <p class="text-sm text-gray-600 mt-2">${escapeHtml(t('exam-hub-choose-session', 'Alege cursul pentru formular.'))}</p>
        <div class="session-links" aria-label="${escapeHtml(tr('exam-hub-session-links-label', 'Cursuri pentru {instrument}', { instrument: title }))}">
          ${sessionLinks}
        </div>
        ${renderContactList(contacts, title)}
      </article>
    `;
  }

  return `
    <a class="instrument-card block" href="${escapeHtml(item.href)}">
      <span class="text-xs font-black uppercase tracking-[0.18em] text-blue-700">${escapeHtml(t('nav-exam', 'Examen'))}</span>
      <h4 class="text-xl font-black mt-2 text-gray-900">${escapeHtml(title)}</h4>
      <p class="text-sm text-gray-600 mt-2">${escapeHtml(t('exam-hub-open-dedicated-form', 'Deschide formularul dedicat.'))}</p>
    </a>
  `;
}

function params() {
  return new URLSearchParams(window.location.search);
}

function selectedCourse(catalog) {
  const courseParam = params().get('course') || '';
  return catalog.find((course) => course.course === courseParam || course.courseLabel === courseParam) || null;
}

function selectedInstrument(course) {
  const instrumentParam = params().get('instrument') || params().get('folder') || '';
  if (instrumentParam === '__theory__') {
    return {
      slug: '__theory__',
      instrument: t('common-theory', 'Teorie'),
      href: theoryPagesByCourse[course?.course],
      icon: 'T',
    };
  }
  return (course?.items || []).find((item) => item.slug === instrumentParam) || null;
}

function examHubUrl(course, instrumentSlug = '') {
  const next = new URL('exam.html', window.location.origin);
  next.searchParams.set('course', course.course);
  if (instrumentSlug) next.searchParams.set('instrument', instrumentSlug);
  return `${next.pathname}${next.search}`;
}

function folderIcon(item) {
  if (item?.slug === '__theory__') return 'T';
  return String(item?.instrument || item?.slug || '').slice(0, 1).toUpperCase();
}

function renderFolderCard({ href, kicker, title, subtitle, icon }) {
  return `
    <a class="materials-folder-card" href="${escapeHtml(href)}">
      <span class="materials-folder-visual" aria-hidden="true">
        <span class="materials-folder-tab"></span>
        <span class="materials-folder-body">
          <span class="materials-folder-paper one"></span>
          <span class="materials-folder-paper two"></span>
          <span class="materials-folder-icon">${escapeHtml(icon || '')}</span>
        </span>
      </span>
      <span class="materials-folder-kicker">${escapeHtml(kicker)}</span>
      <strong>${escapeHtml(title)}</strong>
      <small>${escapeHtml(subtitle)}</small>
    </a>
  `;
}

function renderCourseCards(catalog) {
  return catalog.map((course) => {
    const displayCourse = courseDisplayName(course);
    return `
      <a class="materials-card" href="${escapeHtml(examHubUrl(course))}">
        <span>${escapeHtml(displayCourse)}</span>
        <h3 class="text-2xl">${escapeHtml(displayCourse)}</h3>
        <p>${escapeHtml(t('exam-course-card-desc', 'Alege examenul de teorie sau instrumentul pentru examenul practic.'))}</p>
        <strong class="materials-action">${escapeHtml(t('common-open', 'Deschide'))}</strong>
      </a>
    `;
  }).join('');
}

function renderCourseExamPage(course) {
  const displayCourse = courseDisplayName(course);
  const items = [
    {
      slug: '__theory__',
      instrument: t('common-theory', 'Teorie'),
      href: theoryPagesByCourse[course.course],
      icon: 'T',
    },
    ...(course.items || []).map((item) => ({ ...item, icon: folderIcon(item) })),
  ].filter((item) => item.href || item.slug !== '__theory__');

  return `
    <section class="materials-folder-view">
      <div class="materials-folder-view-header">
        <a class="materials-back-button" href="exam.html">${escapeHtml(t('common-back-courses', 'Inapoi la cursuri'))}</a>
        <div>
          <p class="text-sm uppercase tracking-[0.22em] font-black text-blue-700">${escapeHtml(displayCourse)}</p>
          <h2>${escapeHtml(tr('exam-course-page-title', 'Examene - {course}', { course: displayCourse }))}</h2>
        </div>
      </div>
      <div class="materials-folder-grid">
        ${items.map((item) => {
          const title = item.slug === '__theory__' ? t('common-theory', 'Teorie') : instrumentDisplayName(item);
          const href = item.slug === '__theory__'
            ? course.course === 'ORNI' ? examHubUrl(course, '__theory__') : item.href
            : course.course === 'ORNI'
              ? examHubUrl(course, item.slug)
              : item.href;
          const subtitle = item.slug === '__theory__'
            ? t('exam-hub-open-theory', 'Deschide teoria')
            : course.course === 'ORNI'
              ? t('exam-hub-choose-session', 'Alege cursul pentru formular.')
              : t('exam-hub-open-dedicated-form', 'Deschide formularul dedicat.');
          return renderFolderCard({
            href,
            kicker: displayCourse,
            title,
            subtitle,
            icon: item.icon || folderIcon(item),
          });
        }).join('')}
      </div>
    </section>
  `;
}

function renderTheoryInsideFolder(course, instrument) {
  const displayCourse = courseDisplayName(course);
  const title = t('common-theory', 'Teorie');
  const contacts = course.course === 'ORNI' ? orniTheoryContacts : [];
  return `
    <section class="materials-folder-view">
      <div class="materials-folder-view-header">
        <a class="materials-back-button" href="${escapeHtml(examHubUrl(course))}">${escapeHtml(t('common-back-folders', 'Inapoi la foldere'))}</a>
        <div>
          <p class="text-sm uppercase tracking-[0.22em] font-black text-blue-700">${escapeHtml(displayCourse)}</p>
          <h2>${escapeHtml(title)}</h2>
        </div>
      </div>
      <div class="materials-folder-grid materials-session-folder-grid">
        ${renderFolderCard({
          href: instrument.href,
          kicker: displayCourse,
          title: tr('exam-hub-theory-title', 'Teorie - {course}', { course: displayCourse }),
          subtitle: t('exam-hub-open-theory', 'Deschide teoria'),
          icon: 'T',
        })}
      </div>
      ${renderContactList(contacts, tr('exam-hub-theory-title', 'Teorie - {course}', { course: displayCourse }))}
    </section>
  `;
}

function renderOrniInstrumentPage(course, instrument) {
  if (instrument.slug === '__theory__') return renderTheoryInsideFolder(course, instrument);
  const displayCourse = courseDisplayName(course);
  const title = instrumentDisplayName(instrument);
  const contacts = orniTeacherContacts[instrument.slug] || [];
  return `
    <section class="materials-folder-view">
      <div class="materials-folder-view-header">
        <a class="materials-back-button" href="${escapeHtml(examHubUrl(course))}">${escapeHtml(t('common-back-folders', 'Inapoi la foldere'))}</a>
        <div>
          <p class="text-sm uppercase tracking-[0.22em] font-black text-blue-700">${escapeHtml(displayCourse)}</p>
          <h2>${escapeHtml(title)}</h2>
        </div>
      </div>
      <div class="materials-folder-grid materials-session-folder-grid">
        ${orniSessions.map((session) => renderFolderCard({
          href: `${instrument.href}?session=${encodeURIComponent(session)}`,
          kicker: title,
          title: sessionDisplayName(session),
          subtitle: t('materials-open-session', 'Deschide cursul'),
          icon: session.replace('Sesia ', ''),
        })).join('')}
      </div>
      ${renderContactList(contacts, title)}
    </section>
  `;
}

function updateCourseToggle(section) {
  const toggle = section.querySelector('.exam-course-toggle');
  if (!toggle) return;
  toggle.textContent = section.open ? t('common-close', 'Inchide') : t('common-open', 'Deschide');
}

function renderExamHub() {
  document.title = t('page-title-exam-hub', 'Examene - MHO Music Academy');

  const title = document.querySelector('[data-exam-hub-title]');
  title?.removeAttribute('data-i18n');
  if (title) title.textContent = t('exam-hub-title', 'Alege pagina de examen');

  const desc = document.querySelector('[data-exam-hub-desc]');
  desc?.removeAttribute('data-i18n');
  if (desc) desc.textContent = t('exam-hub-desc', 'Alege examenul de practica pe instrument sau pagina separata pentru examenul de teorie al cursului tau.');

  const grid = document.getElementById('examCourseGrid');
  if (!grid) return;
  const catalog = window.MHO_EXAM_CATALOG || [];
  const course = selectedCourse(catalog);
  const instrument = selectedInstrument(course);
  if (!course) {
    grid.className = 'materials-course-grid';
    grid.innerHTML = renderCourseCards(catalog);
    return;
  }

  const displayCourse = courseDisplayName(course);
  if (title) title.textContent = tr('exam-course-page-title', 'Examene - {course}', { course: displayCourse });
  if (desc) desc.textContent = t('exam-course-page-desc', 'Alege teorie sau instrumentul dorit pentru examen.');
  grid.className = 'materials-grid';
  grid.innerHTML = course.course === 'ORNI' && instrument
    ? renderOrniInstrumentPage(course, instrument)
    : renderCourseExamPage(course);
}

renderExamHub();

window.addEventListener('mho:language-change', () => {
  renderExamHub();
});
