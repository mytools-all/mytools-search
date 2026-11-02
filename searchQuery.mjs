export function buildSearchQuery({ query = "", category = "", extension = "", excluded = "", from = "", to = "", period = "" }) {
  if ((!period || period === "custom") && from && to && from > to) throw Error("开始日期不能晚于结束日期");
  const parts = [category, query.trim() ? `<${query.trim()}>` : ""];
  const extensions = extension.split(/[;,，\s]+/).map(x => x.replace(/^\./, "")).filter(Boolean);
  if (extensions.some(x => !/^[\w-]+$/.test(x))) throw Error("扩展名仅填写字母、数字，例如 txt;md");
  if (extensions.length) parts.push("ext:" + extensions.join(";"));
  for (const word of excluded.split(/[;；\n]+/).map(x => x.trim()).filter(Boolean)) {
    if (word.includes('"')) throw Error("排除内容不能包含双引号");
    parts.push('!"' + word + '"');
  }
  if (period && period !== "custom") parts.push("dm:" + period);
  else {
    if (from) parts.push("dm:>=" + from);
    if (to) parts.push("dm:<" + nextDay(to));
  }
  return parts.filter(Boolean).join(" ");
}
function nextDay(value) {
  const date = new Date(value + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
