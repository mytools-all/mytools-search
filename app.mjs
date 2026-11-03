import {
  $,
  $$,
  action,
  copy,
  status,
  ready,
  call,
  escapeHtml,
  formatBytes,
  debounce,
} from "./common.mjs";
import { buildSearchQuery } from "./searchQuery.mjs";
import { resultName, resultParent, placeholderIcon } from "./resultPresentation.mjs";
const filters = [
  ["all", "全部", ""],
  ["folder", "文件夹", "folder:"],
  ["doc", "文档", "ext:doc;docx;xls;xlsx;ppt;pptx;txt;md;csv"],
  ["pdf", "PDF", "ext:pdf"],
  ["image", "图片", "ext:png;jpg;jpeg;gif;bmp;webp;svg"],
  ["video", "视频", "ext:mp4;mkv;mov;avi;webm"],
  ["audio", "音频", "ext:mp3;wav;flac;aac;ogg"],
  ["archive", "压缩文件", "ext:zip;rar;7z;gz;tar"],
  ["exe", "程序", "ext:exe;msi;bat;cmd"],
];
let entries = [],
  selected = -1,
  total = 0,
  offset = 0,
  type = "all",
  busy = false,
  pending = false,
  generation = 0,
  previewUrl = "",
  previewGeneration = 0,
  history = [];
const limit = 100;
const iconCache = new Map();
let iconObserver;
let iconGeneration = 0;
try {
  const saved = JSON.parse(localStorage.getItem("search-custom-filters") || "[]");
  if (Array.isArray(saved)) filters.push(...saved.filter(f=>Array.isArray(f) && f.length===3 && f.every(x=>typeof x === "string") && f[0].startsWith("custom-")).slice(0,30));
} catch {}
function renderFilters() {
$("#types").innerHTML = filters
  .map(
    ([id, label]) =>
      '<button data-type="' +
      escapeHtml(id) +
      '" class="' +
      (id === type ? "active" : "") +
      '">' +
      escapeHtml(label) +
      "</button>",
  )
  .join("");
const custom = filters.filter(f=>f[0].startsWith("custom-"));
$("#custom-filter-list").innerHTML = custom.length ? custom.map(([id,label,query])=>'<div class="custom-filter"><div class="custom-filter__text"><strong>'+escapeHtml(label)+'</strong><code title="'+escapeHtml(query)+'">'+escapeHtml(query)+'</code></div><button class="filter-delete" data-remove-filter="'+escapeHtml(id)+'" aria-label="删除过滤项：'+escapeHtml(label)+'" title="删除此过滤项"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/></svg><span>删除</span></button></div>').join("") : '<p class="filter-empty">暂无自定义过滤项</p>';
}
renderFilters();
function saveFilters() {
  localStorage.setItem("search-custom-filters", JSON.stringify(filters.filter(f=>f[0].startsWith("custom-"))));
  renderFilters();
}
$("#save-filter").onclick = action(() => {
  const label=$("#filter-name").value.trim(), query=$("#filter-query").value.trim();
  if (!label || !query) throw Error("请填写名称和 Everything 条件");
  if (filters.length>=39) throw Error("最多保存30个自定义过滤项");
  filters.push(["custom-"+crypto.randomUUID(),label.slice(0,30),query.slice(0,1000)]);
  saveFilters();$("#filter-name").value="";$("#filter-query").value="";
});
$("#custom-filter-list").onclick = e => {
  const id=e.target.closest("[data-remove-filter]")?.dataset.removeFilter;
  const at=filters.findIndex(f=>f[0]===id);if(at<0)return;
  const label=filters[at][1];
  filters.splice(at,1);if(type===id){type="all";offset=0;void action(search)();}saveFilters();
  status("已删除过滤项："+label);$("#filter-name").focus();
};
function picked() {
  if (!entries[selected]) throw Error("请先选择结果");
  return entries[selected];
}
function select(index, focus = false) {
  selected = Math.max(0, Math.min(entries.length - 1, index));
  $$(".result").forEach((el, i) => {
    el.classList.toggle("selected", i === selected);
    el.setAttribute("aria-selected", String(i === selected));
  });
  const row = $$(".result")[selected];
  row?.scrollIntoView({ block: "nearest" });
  if (focus) $("#results").focus();
  if (!$("#preview").classList.contains("hidden")) void preview();
}
function render() {
  const q = $("#query").value.trim();
  const words = q
    .split(/\s+/)
    .filter((w) => w && !w.includes(":") && !/[|<>"*?]/.test(w));
  const highlight = (name) => {
    if (!words.length) return escapeHtml(name);
    const regex = new RegExp(
      words
        .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|"),
      "gi",
    );
    let output = "",
      at = 0;
    for (const match of name.matchAll(regex)) {
      output +=
        escapeHtml(name.slice(at, match.index)) +
        "<mark>" +
        escapeHtml(match[0]) +
        "</mark>";
      at = match.index + match[0].length;
    }
    return output + escapeHtml(name.slice(at));
  };
  $("#results").innerHTML = entries.length
    ? entries
        .map(
          (e, i) =>
            '<div role="option" class="result" data-index="' +
            i +
            '"><span class="file-icon">' +
            '<img alt="" src="'+(iconCache.get(e.path+"\0"+e.modified) || placeholderIcon(e.directory))+'" />' +
            '</span><div><div class="file-name">' +
            highlight(resultName(e)) +
            '</div><div class="file-path" title="' +
            escapeHtml(e.path) +
            '">' +
            escapeHtml(resultParent(e)) +
            '</div></div><div class="meta">' +
            (e.directory ? "文件夹" : formatBytes(e.size)) +
            "<br>" +
            (e.modified ? new Date(e.modified * 1000).toLocaleString() : "") +
            "</div></div>",
        )
        .join("")
    : '<div class="empty">没有匹配的文件</div>';
  $$(".result").forEach((el) => {
    el.onclick = () => select(Number(el.dataset.index), true);
    el.ondblclick = action(() =>
      call("shell.open", { path: entries[Number(el.dataset.index)].path }),
    );
    el.oncontextmenu = (e) => {
      e.preventDefault();
      select(Number(el.dataset.index), true);
      void action(() => call("shell.reveal", { path: picked().path }))();
    };
  });
  $("#count").textContent =
    (total ? offset + 1 : 0) + "–" + (offset + entries.length) + " / " + total;
  $("#previous").disabled = offset === 0;
  $("#next").disabled = offset + entries.length >= total;
  select(0);
  hydrateIcons();
}
function hydrateIcons() {
  const token = ++iconGeneration;
  iconObserver?.disconnect();
  const queue = new Map();
  let running = false;
  const applyIcons = () => {
    $$(".result").forEach(row => {
      const entry = entries[Number(row.dataset.index)];
      const image = row.querySelector(".file-icon img");
      if (!entry || !image) return;
      image.src = iconCache.get(entry.path+"\0"+entry.modified) || placeholderIcon(entry.directory);
      image.onerror = () => { image.onerror = null; image.src = placeholderIcon(entry.directory); };
    });
  };
  const load = async () => {
    if (running) return;
    running = true;
    try {
      while (queue.size && token === iconGeneration) {
        const batch = [...queue.values()].slice(0,8);
        batch.forEach(entry => queue.delete(entry.path));
        let icons;
        try { icons = await call("fs.searchicons", {paths:batch.map(entry=>entry.path)}); }
        catch { queue.clear(); return; }
        if (!Array.isArray(icons)) { queue.clear(); return; }
        if (token !== iconGeneration) return;
        for (const entry of batch) {
          const icon = icons.find(item=>item.path===entry.path)?.icon;
          iconCache.set(entry.path+"\0"+entry.modified, typeof icon === "string" && icon.startsWith("data:image/png;base64,") ? icon : null);
        }
        while (iconCache.size > 256) iconCache.delete(iconCache.keys().next().value);
        applyIcons();
      }
    } finally { running = false; }
  };
  const enqueue = row => {
    const entry = entries[Number(row.dataset.index)];
    if (entry && !iconCache.has(entry.path+"\0"+entry.modified)) queue.set(entry.path,entry);
  };
  if (typeof IntersectionObserver === "undefined") {
    $$(".result").slice(0,16).forEach(enqueue);
    void load();
  } else {
    iconObserver = new IntersectionObserver(changes=>{
      for (const change of changes) if(change.isIntersecting) {enqueue(change.target);iconObserver.unobserve(change.target);}
      void load();
    },{root:$("#results"),rootMargin:"48px"});
    $$(".result").forEach(row=>iconObserver.observe(row));
  }
}
function showConnection(message, title = "未连接到 Everything") {
  $("#connection strong").textContent = title;
  $("#connection").classList.remove("hidden");
  $("#connection-message").textContent = message;
}
async function search() {
  if (busy) {
    pending = true;
    generation++;
    return;
  }
  busy = true;
  const token = ++generation;
  $("#refresh").disabled = true;
  status("正在查询 Everything…");
  const q = $("#query").value.trim();
  try {
    const filter = filters.find((f) => f[0] === type)[2];
    const query = buildSearchQuery({query:q,category:filter,extension:$("#extension-filter").value,excluded:$("#exclude-filter").value,period:$("#modified-period").value,from:$("#modified-from").value,to:$("#modified-to").value});
    const result = await call("fs.globalsearch", {
      query,
      offset,
      limit,
      sort: Number($("#sort").value),
    });
    if (token !== generation) return;
    entries = result.entries;
    total = result.total;
    $("#connection").classList.add("hidden");
    render();
    status("Everything · " + total.toLocaleString() + " 个结果");
  } catch (e) {
    if (token === generation) {
      entries = [];
      total = 0;
      render();
      showConnection(
        e.message || String(e),
        /授权|拒绝|denied|permission/i.test(e.message || "")
          ? "搜索权限未获允许"
          : "Everything 查询失败",
      );
      status(e.message || String(e), true);
    }
  } finally {
    busy = false;
    $("#refresh").disabled = false;
    if (pending) {
      pending = false;
      void action(search)();
    }
  }
}
function remember() {
  const q = $("#query").value.trim();
  if (!q) return;
  history = [q, ...history.filter((x) => x !== q)].slice(0, 20);
  $("#history").innerHTML =
    '<option value="">搜索历史</option>' +
    history.map((q) => "<option>" + escapeHtml(q) + "</option>").join("");
  localStorage.setItem("search-history", JSON.stringify(history));
}
const schedule = debounce(() => {
  offset = 0;
  void action(search)();
}, 160);
window.mytools?.onSearch?.(event => {
  $("#query").value = event.query;
  if (event.key) $("#query").dispatchEvent(new KeyboardEvent("keydown", {key:event.key,bubbles:true}));
  else { generation++; schedule(); }
});
$("#query").oninput = () => {
  generation++;
  schedule();
};
$("#query").onkeydown = (e) => {
  if (e.isComposing) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    select(0, true);
  }
  if (e.key === "Enter") {
    e.preventDefault();
    remember();
    offset = 0;
    void action(search)();
  }
  if (e.key === "Escape") $("#query").select();
};
$("#results").onkeydown = action(async (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    select(selected + (e.key === "ArrowDown" ? 1 : -1));
  } else if (e.key === "Enter") {
    e.preventDefault();
    await call(e.ctrlKey ? "shell.reveal" : "shell.open", {
      path: picked().path,
    });
  } else if (e.key === " ") {
    e.preventDefault();
    $("#preview-toggle").click();
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
    e.preventDefault();
    await copy(picked().path);
  } else if (e.key === "Escape") {
    $("#query").focus();
    $("#query").select();
  }
});
$("#types").onclick = e => {
      const b = e.target.closest("[data-type]");
      if (!b) return;
      type = b.dataset.type;
      $$("#types button").forEach((x) => x.classList.toggle("active", x === b));
      offset = 0;
      void action(search)();
};
$("#sort").onchange = () => {
  offset = 0;
  void action(search)();
};
for (const control of $$("#advanced-filters input,#advanced-filters select")) control.onchange = () => {
  $("#date-range").classList.toggle("hidden", $("#modified-period").value !== "custom");
  offset = 0;
  void action(search)();
};
$("#filter-toggle").onclick = () => {
  const expanded = $("#advanced-filters").classList.toggle("hidden") === false;
  $("#filter-toggle").setAttribute("aria-expanded", String(expanded));
};
$("#reset-filters").onclick = () => {
  for (const input of $$("#advanced-filters input")) input.value = "";
  $("#modified-period").value = "";
  $("#date-range").classList.add("hidden");
  offset = 0;
  void action(search)();
};
$("#history").onchange = () => {
  if ($("#history").value) {
    $("#query").value = $("#history").value;
    offset = 0;
    void action(search)();
  }
};
$("#previous").onclick = () => {
  offset = Math.max(0, offset - limit);
  void action(search)();
};
$("#next").onclick = () => {
  offset += limit;
  void action(search)();
};
$("#refresh").onclick = action(search);
$("#retry").onclick = action(search);
$("#start").onclick = action(async () => {
  const apps = await call("app.list", { query: "Everything" });
  const candidates = Array.isArray(apps) ? apps : apps.apps || [];
  const app = candidates.find((a) =>
    /everything/i.test(a.name || a.title || ""),
  );
  if (!app)
    throw Error(
      "没有找到已安装的 Everything。请先安装或手动启动 Everything 后重新连接。",
    );
  await call("app.launch", { target: app.target || app.id });
  status("已启动 Everything，请稍后点击重新连接");
});
$("#open").onclick = action(() => call("shell.open", { path: picked().path }));
$("#reveal").onclick = action(() =>
  call("shell.reveal", { path: picked().path }),
);
$("#copy").onclick = action(() => copy(picked().path));
async function preview() {
  const token = ++previewGeneration;
  try {
    if (!entries[selected]) { $("#preview").textContent="选择文件查看预览"; return; }
    const file = picked();
    $("#preview").textContent = "正在读取预览…";
    const result = await call("fs.searchpreview", { path: file.path });
    if (token !== previewGeneration) return;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = "";
    }
    $("#preview").replaceChildren();
    const heading = document.createElement("strong");
    heading.textContent = resultName(file);
    $("#preview").append(heading);
    const metadata = document.createElement("div");
    metadata.className = "preview-meta";
    metadata.textContent = [file.path, file.directory ? "文件夹" : formatBytes(file.size),file.modified ? new Date(file.modified * 1000).toLocaleString() : ""].filter(Boolean).join("\n");
    $("#preview").append(metadata);
    if (["image","pdf","audio","video"].includes(result.kind)) {
      previewUrl = URL.createObjectURL(
        new Blob([new Uint8Array(result.bytes)], { type: result.mime }),
      );
      const media = result.kind === "image" ? new Image() : document.createElement(result.kind === "pdf" ? "iframe" : result.kind);
      media.src = previewUrl; media.title = file.name;
      if (result.kind === "image") media.alt = file.name;
      if (["audio","video"].includes(result.kind)) media.controls = true;
      $("#preview").append(media);
    } else {
      const pre = document.createElement("pre");
      pre.textContent = result.text;
      $("#preview").append(pre);
      if (result.truncated)
        $("#preview").append(document.createTextNode("\n仅预览前 20 KB"));
    }
  } catch (e) {
    if (token === previewGeneration)
      $("#preview").textContent = e.message || String(e);
  }
}
$("#preview-toggle").onclick = () => {
  $("#preview").classList.toggle("hidden");
  if (!$("#preview").classList.contains("hidden")) void preview();
  else { previewGeneration++; if (previewUrl) { URL.revokeObjectURL(previewUrl);previewUrl=""; } }
};
try {
  history = JSON.parse(localStorage.getItem("search-history") || "[]");
  if (!Array.isArray(history)) history = [];
} catch {
  history = [];
}
$("#history").innerHTML =
  '<option value="">搜索历史</option>' +
  history.map((q) => "<option>" + escapeHtml(q) + "</option>").join("");
ready(async (env) => {
  if (env?.hostSearch) {
    $("#query").style.display = "none";
    $("#query").setAttribute("aria-hidden", "true");
  }
  const s = await call("fs.searchstatus");
  if (s.running) await search();
  else
    showConnection(
      "请启动 Everything 1.4 / 1.5a 并等待索引完成。此插件直接使用 Everything 索引，不扫描磁盘目录。",
    );
  if (!env?.hostSearch) $("#query").focus();
});
