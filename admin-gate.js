(function () {
  const dashboard = document.getElementById('adminDashboard');
  const loginOverlay = document.getElementById('loginOverlay');
  const loadingState = document.getElementById('adminAccessLoading');
  const contentRoot = dashboard || document.body;
  let resolveAccessReady;
  let rejectAccessReady;

  window.AdminAccessReady = new Promise((resolve, reject) => {
    resolveAccessReady = resolve;
    rejectAccessReady = reject;
  });

  document.documentElement.classList.remove('admin-authenticated');

  function showAuthorizedState() {
    document.documentElement.classList.add('admin-authenticated');
    if (dashboard) {
      dashboard.classList.remove('hidden');
    }
    if (loginOverlay) {
      loginOverlay.classList.add('hidden');
    }
    if (loadingState) {
      loadingState.classList.add('hidden');
    }
    if (contentRoot) {
      contentRoot.removeAttribute('aria-hidden');
    }
  }

  function showLoadingState() {
    if (dashboard) {
      dashboard.classList.add('hidden');
    }
    if (loginOverlay) {
      loginOverlay.classList.add('hidden');
    }
    if (loadingState) {
      loadingState.classList.remove('hidden');
    }
    if (contentRoot) {
      contentRoot.setAttribute('aria-hidden', 'true');
    }
  }

  showLoadingState();

  window.FirebaseSharedReady
    .then(({ auth, onAuthStateChanged, requireAdminAccess }) => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          await requireAdminAccess();
          return;
        }

        try {
          await user.getIdToken(true);
        } catch (error) {
          console.warn('Could not refresh auth token before admin check:', error);
        }

        const { allowed } = await requireAdminAccess();
        if (allowed) {
          showAuthorizedState();
          resolveAccessReady?.(true);
        }
      });
    })
    .catch((error) => {
      console.error('Failed to initialize admin gate:', error);
      rejectAccessReady?.(error);
    });
})();