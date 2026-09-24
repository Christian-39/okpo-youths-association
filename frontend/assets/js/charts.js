/**
 * OYA lightweight canvas charts.
 * No CDN/framework dependency; used by dashboard.html.
 */
(function () {
  "use strict";

  function setupCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(260, Math.floor(rect.width || canvas.parentElement?.clientWidth || 320));
    const height = Math.max(180, Math.floor(rect.height || canvas.parentElement?.clientHeight || 220));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    return { ctx, width, height };
  }

  function getCss(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }

  function renderBar(canvas, labels, values, colors) {
    if (!canvas) return null;
    const { ctx, width, height } = setupCanvas(canvas);
    const text = getCss("--oya-text", "#172033");
    const muted = getCss("--oya-text-muted", "#64748b");
    const grid = getCss("--oya-border", "#d7dee8");
    const palette = colors && colors.length ? colors : ["#0a3d62", "#d4a843", "#198754", "#0ea5e9", "#7c3aed"];
    const data = (values || []).map((v) => Math.max(0, Number(v) || 0));
    const max = Math.max(1, ...data);
    const pad = { top: 20, right: 12, bottom: 46, left: 42 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;

    ctx.font = "12px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.fillStyle = muted;
    for (let i = 0; i <= 4; i += 1) {
      const y = pad.top + (chartH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      const tick = Math.round(max - (max * i) / 4);
      ctx.fillText(String(tick), 6, y + 4);
    }

    const count = Math.max(1, data.length);
    const gap = Math.min(18, chartW / count * 0.25);
    const barW = Math.max(12, (chartW - gap * (count - 1)) / count);
    data.forEach((value, i) => {
      const barH = (value / max) * chartH;
      const x = pad.left + i * (barW + gap);
      const y = pad.top + chartH - barH;
      ctx.fillStyle = palette[i % palette.length];
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, barW, barH, 7);
      else ctx.rect(x, y, barW, barH);
      ctx.fill();

      ctx.fillStyle = text;
      ctx.textAlign = "center";
      ctx.fillText(String(value), x + barW / 2, Math.max(14, y - 6));
      ctx.fillStyle = muted;
      const label = String(labels?.[i] || "").slice(0, 12);
      ctx.fillText(label, x + barW / 2, height - 16);
    });
    ctx.textAlign = "start";
    return { destroy: function () { const s = setupCanvas(canvas); s.ctx.clearRect(0, 0, s.width, s.height); } };
  }

  function renderDonut(canvas, labels, values, colors) {
    if (!canvas) return null;
    const { ctx, width, height } = setupCanvas(canvas);
    const data = (values || []).map((v) => Math.max(0, Number(v) || 0));
    const total = data.reduce((a, b) => a + b, 0);
    const palette = colors && colors.length ? colors : ["#0a3d62", "#d4a843", "#dc3545", "#198754"];
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.max(48, Math.min(width, height) / 2 - 14);
    const inner = radius * 0.62;
    let start = -Math.PI / 2;

    if (!total) {
      ctx.strokeStyle = getCss("--oya-border", "#d7dee8");
      ctx.lineWidth = radius - inner;
      ctx.beginPath();
      ctx.arc(cx, cy, (radius + inner) / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      data.forEach((value, i) => {
        const angle = (value / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.fillStyle = palette[i % palette.length];
        ctx.arc(cx, cy, radius, start, start + angle);
        ctx.closePath();
        ctx.fill();
        start += angle;
      });
    }

    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    ctx.fillStyle = getCss("--oya-text", "#172033");
    ctx.font = "700 22px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(total), cx, cy - 8);
    ctx.fillStyle = getCss("--oya-text-muted", "#64748b");
    ctx.font = "12px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText("Total", cx, cy + 14);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
    return { destroy: function () { const s = setupCanvas(canvas); s.ctx.clearRect(0, 0, s.width, s.height); } };
  }

  window.OYA_CHARTS = { renderBar, renderDonut };
})();
