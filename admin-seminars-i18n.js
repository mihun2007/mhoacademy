(function () {
  const COURSE_BY_FILE = {
    'admin-orni-seminare.html': 'orni',
    'admin-aerofone-seminare.html': 'aerofone',
    'admin-coarde-seminare.html': 'coarde',
    'admin-dirijor-seminare.html': 'dirijor',
  };

  const fileName = window.location.pathname.split('/').pop();
  const courseKey = COURSE_BY_FILE[fileName] || 'orni';

  function t(key, fallback) {
    const value = window.i18n?.t?.(key);
    return value && value !== key ? value : fallback;
  }

  function tr(key, fallback, vars = {}) {
    return Object.entries(vars).reduce((text, [name, value]) => {
      return String(text).replaceAll(`{${name}}`, value ?? '');
    }, t(key, fallback));
  }

  function courseName() {
    return t(`materials-course-${courseKey}`, courseKey.toUpperCase());
  }

  function setText(selector, text) {
    const node = document.querySelector(selector);
    if (node && node.textContent !== text) node.textContent = text;
  }

  function setPlaceholder(selector, text) {
    const node = document.querySelector(selector);
    if (node && node.placeholder !== text) node.placeholder = text;
  }

  function setHeader(index, text) {
    const headers = document.querySelectorAll('thead th');
    if (headers[index] && headers[index].textContent !== text) headers[index].textContent = text;
  }

  function translateExactText() {
    if (window.i18n?.getLanguage?.() !== 'ru') return;
    const map = {
      'Nu sunt înscrieri.': 'Регистраций пока нет.',
      'Nu sunt inscrieri.': 'Регистраций пока нет.',
      'Nu sunt seminare.': 'Семинаров пока нет.',
      'Se încarcă seminarele...': 'Загрузка семинаров...',
      'Se incarca seminarele...': 'Загрузка семинаров...',
      'Se încarcă înscrierile...': 'Загрузка регистраций...',
      'Se incarca inscrierile...': 'Загрузка регистраций...',
      'Link': 'Ссылка',
      'Tip': 'Тип',
      'Date': 'Даты',
      'Titlu': 'Название',
      'Locație': 'Место проведения',
      'Acțiuni': 'Действия',
    };

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || ['SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return map[node.nodeValue.trim()] ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const original = node.nodeValue.trim();
      node.nodeValue = node.nodeValue.replace(original, map[original]);
    });
  }

  function updateSeminarPage() {
    const course = courseName();
    document.title = tr('admin-seminars-browser-title', 'Seminare {course} - MHO Music Academy', { course });

    const titleSpan = document.querySelector('h2 span:last-child');
    const pageTitle = tr('admin-seminars-page-title', 'Seminare - {course}', { course });
    if (titleSpan && titleSpan.textContent !== pageTitle) titleSpan.textContent = pageTitle;
    setText('h2 + p span', tr('admin-seminars-page-desc', 'Gestionati seminarele si inregistrarile studentilor pentru cursul {course}.', { course }));
    setText('[data-i18n="admin-panel-seminars-section-label"]', t('admin-seminars-section-label', 'Sectiune Seminare'));

    const backLabel = document.querySelector('a[href^="admin-"][href$=".html"] span[data-i18n="admin-panel-back-to"]');
    const backText = tr('admin-seminars-back-menu', 'Inapoi la meniul {course}', { course });
    if (backLabel && backLabel.textContent !== backText) backLabel.textContent = backText;

    setPlaceholder('#seminarTitle', tr('admin-seminars-title-placeholder', 'Ex: Masterclass {course}', { course }));
    setPlaceholder('#seminarLocation', t('placeholder-location-example', 'Ex: Sangerei Noi'));
    setPlaceholder('#seminarDescription', t('admin-seminars-description-placeholder', 'Descrieti seminarul...'));
    setPlaceholder('#seminarLink', 'https://...');

    setHeader(1, t('admin-seminars-table-type', 'Tip'));
    setHeader(2, t('admin-seminars-table-dates', 'Date'));
    setHeader(4, t('admin-seminars-table-link', 'Link'));

    const listTitles = document.querySelectorAll('.mt-16 h3');
    const seminarListText = t('admin-panel-seminar-list', 'Lista Seminare');
    const registrationsText = tr('admin-seminars-registrations-title', 'Inscrieri Studenti la Seminare {course}', { course });
    if (listTitles[0] && listTitles[0].textContent !== seminarListText) listTitles[0].textContent = seminarListText;
    if (listTitles[1] && listTitles[1].textContent !== registrationsText) listTitles[1].textContent = registrationsText;

    const submitButton = document.querySelector('#seminarForm button[type="submit"]');
    const submitText = t('btn-add-seminar', 'Adauga Seminar');
    if (submitButton && submitButton.textContent.trim() !== '...' && submitButton.textContent !== submitText) submitButton.textContent = submitText;

    const typeSelect = document.getElementById('seminarType');
    if (typeSelect) {
      Array.from(typeSelect.options).forEach((option) => {
        const key = String(option.value || '').toLowerCase();
        let nextText = option.textContent;
        if (key === 'orni') nextText = t('materials-course-orni', 'ORNI');
        if (key === 'dirijor') nextText = t('materials-course-dirijor', 'Dirijor de cor');
        if (key === 'coarde') nextText = t('materials-course-coarde', 'Viori / Coarde');
        if (key === 'aerofone') nextText = t('materials-course-aerofone', 'Aerofone');
        if (key === 'vioriști') nextText = window.i18n?.getLanguage?.() === 'ru' ? 'Скрипачи' : 'Vioristi';
        if (key === 'general') nextText = window.i18n?.getLanguage?.() === 'ru' ? 'Общее' : 'General';
        if (option.textContent !== nextText) option.textContent = nextText;
      });
    }

    translateExactText();
  }

  let observerTimer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(observerTimer);
    observerTimer = setTimeout(updateSeminarPage, 50);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateSeminarPage);
  } else {
    updateSeminarPage();
  }

  window.addEventListener('mho:language-change', updateSeminarPage);
  observer.observe(document.body, { childList: true, subtree: true });
})();
