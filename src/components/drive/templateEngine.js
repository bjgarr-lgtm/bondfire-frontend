function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date, fmt) {
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return String(fmt || "")
    .replace(/dddd/g, weekdays[date.getDay()])
    .replace(/YYYY/g, String(date.getFullYear()))
    .replace(/MM/g, pad(date.getMonth() + 1))
    .replace(/DD/g, pad(date.getDate()))
    .replace(/HH/g, pad(date.getHours()))
    .replace(/mm/g, pad(date.getMinutes()))
    .replace(/ss/g, pad(date.getSeconds()));
}

export function renderTemplate(raw, context = {}) {
  let out = String(raw || "");
  const now = new Date();

  out = out.replace(/<%\s*tp\.date\.now\(\s*["']([^"']+)["']\s*\)\s*%>/g, (_m, fmt) => formatDate(now, fmt));
  out = out.replace(/<%\s*tp\.date\.now\(\s*\)\s*%>/g, formatDate(now, "YYYY-MM-DD"));
  out = out.replace(/<%\s*tp\.file\.title\s*%>/g, String(context.title || ""));

  return out;
}
