(function () {
  "use strict";
  try {
    var t = localStorage.getItem("oya_theme");
    var d = (t === "dark" || t === "light") ? t : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", d);
  } catch (e) {}
})();
