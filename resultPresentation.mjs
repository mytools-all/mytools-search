export function resultName(entry) {
  const path = String(entry.path || "");
  const clean = path.replace(/[\\/]+$/, "");
  const parts = clean.split(/[\\/]/).filter(Boolean);
  const name = parts.at(-1) || String(entry.name || "");
  if (/^[a-z]:$/i.test(clean)) return clean + "\\";
  return name || (entry.directory ? "未命名目录" : "未命名文件");
}

export function resultParent(entry) {
  const path = String(entry.path || "").replace(/[\\/]+$/, "");
  const index = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  if (index < 0) return path;
  return path.slice(0, index + (/^[a-z]:$/i.test(path.slice(0,index)) ? 1 : 0));
}

export function placeholderIcon(directory) {
  const shape = directory
    ? '<path fill="#e9b346" d="M3 8a3 3 0 0 1 3-3h7l3 4h10a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"/><path fill="#f5ca66" d="M3 13h26v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"/>'
    : '<path fill="#f3f6fb" stroke="#8eabc8" stroke-width="1.5" d="M7 3h12l7 7v19H7z"/><path fill="#c4d6e8" d="M19 3v8h7"/><path stroke="#8eabc8" stroke-width="1.5" d="M11 17h11M11 21h11"/>';
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'+shape+'</svg>');
}
