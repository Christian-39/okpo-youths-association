// Copy to config.runtime.js in a deployed/static environment if your host
// supports injecting a file before assets/js/config.js. Do not commit the
// real deployment file if it contains private hostnames or environment data.
window.OYA_RUNTIME_CONFIG = {
  API_BASE_URL: "https://api.example.org",
  API_PREFIX: "/api/v1",
  API_TIMEOUT_MS: 20000
};
