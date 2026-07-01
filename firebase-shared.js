(function () {
  const firebaseConfig = {
    apiKey: 'AIzaSyAV0_Buy_KKD4TSe-1IpByCVoZFoRJQaNE',
    authDomain: 'mho-music-academy.firebaseapp.com',
    projectId: 'mho-music-academy',
    storageBucket: 'mho-music-academy.firebasestorage.app',
    messagingSenderId: '705322739069',
    appId: '1:705322739069:web:422b6fd0c7a08ab8921814',
    measurementId: 'G-CF5HDVT6MK',
  };
  const teacherEmailAllowlist = [
    'pavlik.pirau@mail.ru',
    'nichitapalka@gmail.com',
    'sarkovavita@gmail.com',
    '0607elena1999@gmail.com',
    'akkordion0404@gmail.com',
    'pavelmanaf0@gmail.com',
    'meradji.ser09@gmail.com',
    'costas.christina95@gmail.com',
    'sharkov.oleg@internet.ru',
    'evelino4ka.069@gmail.com',
    'stefankoalina9@gmail.com',
    'leshnevskaya.05@mail.ru',
  ];

  function isTeacherEmail(email) {
    return teacherEmailAllowlist.includes(String(email || '').trim().toLowerCase());
  }

  function normalizeUserProfileData(user, serverTimestamp, extra = {}) {
    const baseRoles = Array.isArray(extra.roles) ? extra.roles : [];

    return {
      uid: user.uid,
      name: extra.name || user.displayName || user.email?.split('@')[0] || '',
      firstName: extra.firstName || '',
      lastName: extra.lastName || '',
      email: user.email || '',
      photoURL: extra.photoURL || user.photoURL || null,
      provider: extra.provider || 'password',
      role: extra.role || 'student',
      roles: baseRoles,
      isAdmin: Boolean(extra.isAdmin),
      isTeacher: Boolean(extra.isTeacher),
      updatedAt: serverTimestamp(),
    };
  }

  function userHasAdminAccess(profile, userEmail = '') {
    const email = profile?.email || userEmail;
    if (isTeacherEmail(email)) return true;
    if (!profile) return false;

    const role = typeof profile.role === 'string' ? profile.role.toLowerCase() : '';
    const roles = Array.isArray(profile.roles)
      ? profile.roles.map((value) => String(value).toLowerCase())
      : [];

    return (
      profile.isAdmin === true ||
      profile.isTeacher === true ||
      role === 'admin' ||
      role === 'teacher' ||
      roles.includes('admin') ||
      roles.includes('teacher')
    );
  }

  window.FirebaseSharedReady = (async () => {
    const [
      firebaseAppModule,
      firebaseAuthModule,
      firebaseFirestoreModule,
      firebaseStorageModule,
    ] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'),
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js'),
    ]);

    const { getApp, getApps, initializeApp } = firebaseAppModule;
    const { getAuth, onAuthStateChanged, signOut } = firebaseAuthModule;
    const {
      getFirestore,
      doc,
      getDoc,
      setDoc,
      updateDoc,
      serverTimestamp,
    } = firebaseFirestoreModule;
    const { getStorage } = firebaseStorageModule;

    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const storage = getStorage(app);

    async function ensureUserProfile(user, extra = {}) {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const merged = normalizeUserProfileData(user, serverTimestamp, extra);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          ...merged,
          createdAt: serverTimestamp(),
        });
        return { ...merged, createdAt: new Date().toISOString() };
      }

      await setDoc(userRef, merged, { merge: true });
      return {
        ...userSnap.data(),
        ...merged,
      };
    }

    async function getUserProfile(uid) {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      return userSnap.exists() ? userSnap.data() : null;
    }

    async function requireAdminAccess(options = {}) {
      const {
        redirectTo = 'login.html',
        redirectParam = 'redirect',
        fallbackPage = 'index.html',
      } = options;

      const user = auth.currentUser;
      if (!user) {
        const currentPage = window.location.pathname.split('/').pop() || 'admin.html';
        const redirectUrl = `${redirectTo}?${redirectParam}=${encodeURIComponent(currentPage)}`;
        window.location.replace(redirectUrl);
        return { allowed: false, user: null, profile: null };
      }

      const profile = await getUserProfile(user.uid);
      if (!userHasAdminAccess(profile, user.email)) {
        window.location.replace(fallbackPage);
        return { allowed: false, user, profile };
      }

      return { allowed: true, user, profile };
    }

    async function updatePresence(isOnline, user = auth.currentUser) {
      if (!user) return;

      const userPresenceRef = doc(db, 'presence', user.uid);
      if (isOnline) {
        await setDoc(
          userPresenceRef,
          {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || user.email?.split('@')[0] || '',
            photoURL: user.photoURL || null,
            lastSeen: serverTimestamp(),
            online: true,
          },
          { merge: true },
        );
        return;
      }

      await updateDoc(userPresenceRef, {
        online: false,
        lastSeen: serverTimestamp(),
      }).catch(() => {});
    }

    const shared = {
      firebaseConfig,
      app,
      auth,
      db,
      storage,
      onAuthStateChanged,
      signOut,
      serverTimestamp,
      ensureUserProfile,
      getUserProfile,
      requireAdminAccess,
      updatePresence,
      userHasAdminAccess,
      isTeacherEmail,
    };

    window.FirebaseShared = shared;
    return shared;
  })().catch((error) => {
    console.error('Failed to initialize shared Firebase helpers:', error);
    throw error;
  });
})();
