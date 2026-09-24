(async function () {
      try {
        const user = await window.OYA_AUTH.getCurrentUser({ redirect: false });
        window.location.href = user ? window.OYA_CONFIG.ROUTES.dashboard : window.OYA_CONFIG.ROUTES.login;
      } catch (error) {
        window.location.href = navigator.onLine ? window.OYA_CONFIG.ROUTES.login : "offline.html";
      }
    })();
