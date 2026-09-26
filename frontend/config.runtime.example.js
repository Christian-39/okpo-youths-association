// Copy to config.runtime.js in a deployed/static environment if your host
// supports injecting a file before assets/js/config.js. Do not commit the
// real deployment file if it contains private hostnames or environment data.
window.OYA_RUNTIME_CONFIG = {
  API_BASE_URL: "https://api.example.org",
  API_PREFIX: "/api/v1",
  API_TIMEOUT_MS: 20000,

  // Optional — only needed if the frontend is deployed somewhere that
  // config.js cannot correctly infer its own root from (rare). Normally
  // leave these unset; assets/js/config.js derives them automatically
  // from its own <script src> so shared components resolve correctly
  // whether the site is served at a domain root, a subpath, locally via
  // `python -m http.server`, or through Vercel.
  // FRONTEND_BASE_URL: "https://oya-omega.vercel.app/",
  // COMPONENT_BASE_URL: "https://oya-omega.vercel.app/components",
};
