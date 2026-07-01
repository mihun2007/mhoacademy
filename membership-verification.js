(function () {
  const SITE_URL = 'https://mhoacademysite.netlify.app';

  function randomHex(bytes = 24) {
    const array = new Uint8Array(bytes);
    crypto.getRandomValues(array);
    return Array.from(array, (value) => value.toString(16).padStart(2, '0')).join('');
  }

  function createVerificationToken() {
    return `${Date.now().toString(36)}-${randomHex(20)}`;
  }

  function normalizePastorPhone(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    let normalized = raw.replace(/[^\d+]/g, '');

    if (normalized.startsWith('+')) {
      normalized = normalized.slice(1);
    }

    if (normalized.startsWith('373')) {
      return normalized;
    }

    if (normalized.startsWith('0')) {
      return `373${normalized.slice(1)}`;
    }

    return normalized;
  }

  function getStudentFullName(registration) {
    return [registration?.firstName, registration?.lastName]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  function buildVerificationUrl(token) {
    return `${SITE_URL}/verify-membership.html?token=${encodeURIComponent(token || '')}`;
  }

  function buildWhatsAppMessage({
    pastorName,
    studentFullName,
    churchName,
    verificationToken,
  }) {
    const verificationUrl = buildVerificationUrl(verificationToken);
    return `Bună ziua, frate ${pastorName}.
Elevul ${studentFullName} s-a înscris la cursurile MHO Academy și a indicat că este membru al bisericii ${churchName}.

Vă rugăm să confirmați dacă acest elev este într-adevăr membru al bisericii.

Confirmați aici:
${verificationUrl}

Vă mulțumim,
MHO Academy

--------------------

Здравствуйте, брат ${pastorName}.
Ученик ${studentFullName} зарегистрировался на курсы MHO Academy и указал, что является членом церкви ${churchName}.

Пожалуйста, подтвердите, действительно ли этот ученик является членом указанной церкви.

Подтвердите здесь:
${verificationUrl}

Благодарим вас,
MHO Academy`;
  }

  function inferChurchMember(registration) {
    if (typeof registration?.isChurchMember === 'boolean') {
      return registration.isChurchMember;
    }

    if (typeof registration?.dirijorIsMember === 'boolean') {
      return registration.dirijorIsMember;
    }

    const courseName = String(registration?.courseType || registration?.course || '').trim().toLowerCase();
    if (courseName !== 'dirijor') {
      return false;
    }

    return Boolean(
      registration?.churchName ||
      registration?.church ||
      registration?.pastorName ||
      registration?.pastorPhone,
    );
  }

  function getMembershipStatus(registration) {
    if (!inferChurchMember(registration)) {
      return 'not_church_member';
    }

    const status = String(registration?.membershipStatus || '').trim().toLowerCase();
    if (status === 'confirmed' || status === 'rejected' || status === 'pending') {
      return status;
    }

    return 'pending';
  }

  function getMembershipBadgeMeta(status) {
    const map = {
      pending: {
        label: 'În așteptare',
        classes: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
      },
      confirmed: {
        label: 'Confirmat',
        classes: 'bg-green-100 text-green-800 border border-green-200',
      },
      rejected: {
        label: 'Respins',
        classes: 'bg-red-100 text-red-800 border border-red-200',
      },
      not_church_member: {
        label: 'Nu este membru',
        classes: 'bg-gray-100 text-gray-700 border border-gray-200',
      },
    };

    return map[status] || map.not_church_member;
  }

  function buildWhatsAppUrl(registration) {
    const phone = normalizePastorPhone(registration?.pastorPhone);
    const token = registration?.verificationToken;

    if (!phone || !token || !inferChurchMember(registration) || getMembershipStatus(registration) !== 'pending') {
      return '';
    }

    const message = buildWhatsAppMessage({
      pastorName: registration?.pastorName || 'Pastor',
      studentFullName: getStudentFullName(registration),
      churchName: registration?.churchName || registration?.church || 'Biserica necunoscută',
      verificationToken: token,
    });

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }

  window.MHOMembershipVerification = {
    SITE_URL,
    createVerificationToken,
    normalizePastorPhone,
    getStudentFullName,
    buildVerificationUrl,
    buildWhatsAppMessage,
    inferChurchMember,
    getMembershipStatus,
    getMembershipBadgeMeta,
    buildWhatsAppUrl,
  };
})();
