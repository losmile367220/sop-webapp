import { api } from "./api.js";
import {
  initGoogleLogin,
  getCurrentUser,
  logout
} from "./auth.js";

/* =========================================================
   狀態與快取
   ========================================================= */

const state = {
  items: [],
  categories: ["Test", "Leader", "驗證"],
  currentItem: null,
  searchRequestId: 0
};

/*
 * 記憶體快取：
 * 同一頁面內第二次打開同一份 SOP／測項時，不再重新呼叫 Apps Script。
 */
const memoryCache = new Map();

/*
 * sessionStorage 快取：
 * 同一個瀏覽器分頁重新整理後，30 分鐘內仍可快速開啟。
 */
const CACHE_PREFIX = "sop_content_v2:";
const CACHE_TTL = 30 * 60 * 1000;

/* =========================================================
   DOM
   ========================================================= */

const els = {
  loginView: document.getElementById("loginView"),
  appView: document.getElementById("appView"),
  loginMessage: document.getElementById("loginMessage"),

  menuTree: document.getElementById("menuTree"),
  categoryCards: document.getElementById("categoryCards"),
  recentList: document.getElementById("recentList"),

  searchInput: document.getElementById("searchInput"),
  searchResults: document.getElementById("searchResults"),
  searchStatus: document.getElementById("searchStatus"),

  homeView: document.getElementById("homeView"),
  detailView: document.getElementById("detailView"),
  searchView: document.getElementById("searchView"),

  docContent: document.getElementById("docContent"),
  sheetContent: document.getElementById("sheetContent"),
  emptyContent: document.getElementById("emptyContent"),
  loadingState: document.getElementById("loadingState"),

  pageTitle: document.getElementById("pageTitle"),
  breadcrumb: document.getElementById("breadcrumb"),
  userEmail: document.getElementById("userEmail"),

  sidebar: document.querySelector(".sidebar"),
  mobileOverlay: document.getElementById("mobileOverlay"),

  localTableSearchWrap: document.getElementById("localTableSearchWrap"),
  localTableSearch: document.getElementById("localTableSearch"),
  localSearchTitle: document.getElementById("localSearchTitle"),
  localSearchCount: document.getElementById("localSearchCount")
};

/* =========================================================
   基本事件
   ========================================================= */

document
  .getElementById("logoutBtn")
  .addEventListener("click", logout);

document
  .getElementById("menuBtn")
  .addEventListener("click", openMobileMenu);

els.mobileOverlay.addEventListener(
  "click",
  closeMobileMenu
);

function openMobileMenu() {
  els.sidebar.classList.add("open");
  els.mobileOverlay.classList.remove("hidden");
}

function closeMobileMenu() {
  els.sidebar.classList.remove("open");
  els.mobileOverlay.classList.add("hidden");
}

function showOnly(view) {
  [
    els.homeView,
    els.detailView,
    els.searchView
  ].forEach((element) => {
    element.classList.add("hidden");
  });

  view.classList.remove("hidden");
}

/* =========================================================
   顯示輔助
   ========================================================= */

function iconFor(category, type) {
  if (type === "database") {
    return "📊";
  }

  const icons = {
    Test: "🧪",
    Leader: "👨‍💼",
    驗證: "✅"
  };

  return icons[category] || "📄";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("zh-TW")
    .replace(/[\s\-‐-‒–—―_./\\]+/g, "");
}

/* =========================================================
   啟動
   ========================================================= */

async function start(user) {
  els.loginView.classList.add("hidden");
  els.appView.classList.remove("hidden");
  els.userEmail.textContent = user.email || "";

  try {
    const result = await api.getIndex();

    state.items = Array.isArray(result.items)
      ? result.items
      : [];

    updateCategoryList();
    renderAll();
  } catch (error) {
    console.error("取得目錄失敗：", error);

    state.items = [];
    renderAll();

    els.recentList.innerHTML = `
      <div class="empty-state">
        <h3>資料讀取失敗</h3>
        <p>${escapeHtml(error.message || "無法取得 SOP 資料")}</p>
      </div>
    `;
  }
}

function updateCategoryList() {
  const categories = [
    "Test",
    "Leader",
    "驗證"
  ];

  state.items.forEach((item) => {
    const category = String(
      item.category || ""
    ).trim();

    if (
      category &&
      !categories.includes(category)
    ) {
      categories.push(category);
    }
  });

  state.categories = categories;
}

function renderAll() {
  renderMenu();
  renderCategoryCards();
  renderRecent();
}

/* =========================================================
   左側目錄
   ========================================================= */

function renderMenu() {
  els.menuTree.innerHTML = "";

  state.categories.forEach((category) => {
    const items = state.items.filter(
      (item) => item.category === category
    );

    if (!items.length) {
      return;
    }

    const group = document.createElement("div");
    group.className = "menu-group";

    const title = document.createElement("button");
    title.className = "menu-group-title";
    title.type = "button";
    title.innerHTML = `
      <span>
        ${iconFor(category)}
        ${escapeHtml(category)}
      </span>
      <span>${items.length}</span>
    `;

    const list = document.createElement("div");
    list.className = "menu-items";

    items.forEach((item) => {
      const button = document.createElement("button");
      button.className = "menu-item";
      button.type = "button";
      button.textContent =
        `${iconFor(category, item.type)} ${item.name}`;

      button.addEventListener(
        "click",
        () => openItem(item)
      );

      list.appendChild(button);
    });

    group.appendChild(title);
    group.appendChild(list);
    els.menuTree.appendChild(group);
  });
}

/* =========================================================
   首頁
   ========================================================= */

function renderCategoryCards() {
  els.categoryCards.innerHTML = "";

  state.categories.forEach((category) => {
    const count = state.items.filter(
      (item) => item.category === category
    ).length;

    if (!count) {
      return;
    }

    const card = document.createElement("div");
    card.className = "category-card";

    card.innerHTML = `
      <div class="icon">${iconFor(category)}</div>
      <h3>${escapeHtml(category)}</h3>
      <p>${count} 個項目</p>
    `;

    card.addEventListener(
      "click",
      () => showCategory(category)
    );

    els.categoryCards.appendChild(card);
  });
}

function renderRecent() {
  els.recentList.innerHTML = "";

  const items = state.items
    .slice(-6)
    .reverse();

  if (!items.length) {
    els.recentList.innerHTML =
      "<p>目前沒有資料。</p>";

    return;
  }

  items.forEach((item) => {
    els.recentList.appendChild(
      makeItemRow(item)
    );
  });
}

function makeItemRow(item) {
  const row = document.createElement("div");
  row.className = "item-row";

  row.innerHTML = `
    <div>
      <strong>
        ${iconFor(item.category, item.type)}
        ${escapeHtml(item.name)}
      </strong>
      <br>
      <small>${escapeHtml(item.category)}</small>
    </div>
    <span>›</span>
  `;

  row.addEventListener(
    "click",
    () => openItem(item)
  );

  return row;
}

function showCategory(category) {
  els.pageTitle.textContent = category;
  els.breadcrumb.textContent =
    `首頁 / ${category}`;

  els.searchResults.innerHTML = "";
  els.searchStatus.textContent = "";

  const items = state.items.filter(
    (item) => item.category === category
  );

  if (!items.length) {
    els.searchResults.innerHTML =
      "<p>目前沒有項目。</p>";
  } else {
    items.forEach((item) => {
      els.searchResults.appendChild(
        makeItemRow(item)
      );
    });
  }

  showOnly(els.searchView);
}

/* =========================================================
   內容快取
   ========================================================= */

function cacheKey(item) {
  return `${CACHE_PREFIX}${item.type}|${item.url}`;
}

function getCached(item) {
  const key = cacheKey(item);

  if (memoryCache.has(key)) {
    return memoryCache.get(key);
  }

  try {
    const raw = sessionStorage.getItem(key);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);

    if (
      !parsed ||
      Date.now() - parsed.time > CACHE_TTL
    ) {
      sessionStorage.removeItem(key);
      return null;
    }

    memoryCache.set(key, parsed.html);

    return parsed.html;
  } catch {
    return null;
  }
}

function setCached(item, html) {
  const key = cacheKey(item);

  memoryCache.set(key, html);

  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        time: Date.now(),
        html
      })
    );
  } catch {
    /*
     * 文件含大量 Base64 圖片時，可能超過 sessionStorage 容量。
     * 此時保留記憶體快取即可，不影響功能。
     */
  }
}

/* =========================================================
   開啟 SOP／Database
   ========================================================= */

async function openItem(item) {
  closeMobileMenu();

  state.currentItem = item;

  els.pageTitle.textContent = item.name;
  els.breadcrumb.textContent =
    `${item.category} / ${item.name}`;

  showOnly(els.detailView);
  resetDetailView();

  if (item.isEmpty || !item.url) {
    showEmptyContent(
      "內容準備中",
      "這個項目目前尚未加入內容，之後更新後會顯示在這裡。"
    );

    return;
  }

  const cachedHtml = getCached(item);

  if (cachedHtml !== null) {
    showItemHtml(item, cachedHtml);
    return;
  }

  els.loadingState.classList.remove("hidden");

  try {
    const result =
      item.type === "database"
        ? await api.getDatabase(item.url)
        : await api.getDoc(item.url);

    const html = result.html || "";

    setCached(item, html);
    showItemHtml(item, html);
  } catch (error) {
    console.error(
      `讀取「${item.name}」失敗：`,
      error
    );

    showEmptyContent(
      "讀取失敗",
      error.message || "無法讀取此項目"
    );
  } finally {
    els.loadingState.classList.add("hidden");
  }
}

function showItemHtml(item, html) {
  if (item.type === "database") {
    els.sheetContent.innerHTML = html;
    els.sheetContent.classList.remove("hidden");

    setupLocalTableSearch(item);
  } else {
    els.docContent.innerHTML = html;
    els.docContent.classList.remove("hidden");

    els.localTableSearchWrap.classList.add("hidden");
  }
}

function resetDetailView() {
  els.docContent.innerHTML = "";
  els.sheetContent.innerHTML = "";

  els.docContent.classList.add("hidden");
  els.sheetContent.classList.add("hidden");
  els.emptyContent.classList.add("hidden");
  els.loadingState.classList.add("hidden");

  els.localTableSearchWrap.classList.add("hidden");
  els.localTableSearch.value = "";
  els.localSearchCount.textContent = "";
}

function showEmptyContent(title, message) {
  els.loadingState.classList.add("hidden");

  els.emptyContent
    .querySelector("h3")
    .textContent = title;

  els.emptyContent
    .querySelector("p")
    .textContent = message;

  els.emptyContent.classList.remove("hidden");
  els.localTableSearchWrap.classList.add("hidden");
}

/* =========================================================
   Test「有在測項／沒在測項」獨立搜尋
   ========================================================= */

/*
 * 只針對 Test 底下的 database 類型顯示。
 *
 * 也就是：
 * - Test → 有在測項
 * - Test → 沒在測項
 *
 * 搜尋只篩選目前開啟的這張表格，
 * 不會搜尋 Leader、驗證或另一張測項表。
 */
function shouldShowLocalSearch(item) {
  return (
    item &&
    item.category === "Test" &&
    item.type === "database"
  );
}

function setupLocalTableSearch(item) {
  if (!shouldShowLocalSearch(item)) {
    els.localTableSearchWrap.classList.add("hidden");
    return;
  }

  const table =
    els.sheetContent.querySelector("table");

  if (!table) {
    els.localTableSearchWrap.classList.add("hidden");
    return;
  }

  els.localTableSearchWrap.classList.remove("hidden");
  els.localTableSearch.value = "";

  els.localSearchTitle.textContent =
    `搜尋「${item.name}」`;

  const rows =
    Array.from(table.querySelectorAll("tr"));

  const dataRows = rows.slice(1);

  els.localSearchCount.textContent =
    `共 ${dataRows.length} 筆`;

  /*
   * 預先整理每列搜尋文字。
   * 使用者每輸入一個字時，不必重新組合所有欄位，速度較快。
   */
  dataRows.forEach((row) => {
    row.dataset.searchText =
      normalizeSearchText(row.textContent);
  });

  els.localTableSearch.oninput = () => {
    const keyword =
      normalizeSearchText(
        els.localTableSearch.value
      );

    let visibleCount = 0;

    dataRows.forEach((row) => {
      const matched =
        !keyword ||
        row.dataset.searchText.includes(keyword);

      row.classList.toggle(
        "row-hidden",
        !matched
      );

      if (matched) {
        visibleCount++;
      }
    });

    els.localSearchCount.textContent =
      keyword
        ? `找到 ${visibleCount} 筆`
        : `共 ${dataRows.length} 筆`;

    let emptyRow =
      table.querySelector(
        ".local-search-empty-row"
      );

    if (keyword && visibleCount === 0) {
      if (!emptyRow) {
        emptyRow =
          document.createElement("tr");

        emptyRow.className =
          "local-search-empty-row";

        const cell =
          document.createElement("td");

        cell.colSpan = Math.max(
          1,
          rows[0]?.children.length || 1
        );

        cell.textContent =
          "找不到符合的測項";

        emptyRow.appendChild(cell);
        table.appendChild(emptyRow);
      }
    } else if (emptyRow) {
      emptyRow.remove();
    }
  };
}

/* =========================================================
   全站搜尋
   ========================================================= */

function mergeSearchResults(...lists) {
  const map = new Map();

  lists
    .flat()
    .forEach((item) => {
      if (!item) {
        return;
      }

      const key = [
        item.type || "",
        item.category || "",
        item.name || "",
        item.url || ""
      ].join("|");

      if (!map.has(key)) {
        map.set(key, item);
      }
    });

  return Array.from(map.values());
}

let localSearchTimer = null;
let remoteSearchTimer = null;

els.searchInput.addEventListener(
  "input",
  () => {
    window.clearTimeout(localSearchTimer);
    window.clearTimeout(remoteSearchTimer);

    /*
     * 名稱搜尋先顯示，幾乎立即完成。
     */
    localSearchTimer = window.setTimeout(
      runLocalGlobalSearch,
      160
    );

    /*
     * Google Docs／Google Sheet 全文搜尋較慢。
     * 等使用者停止輸入 850ms 後才呼叫 Apps Script，
     * 避免每打一個字就跑一次後端。
     */
    remoteSearchTimer = window.setTimeout(
      runRemoteGlobalSearch,
      850
    );
  }
);

function prepareSearchView(keyword) {
  els.pageTitle.textContent =
    `搜尋：${keyword}`;

  els.breadcrumb.textContent = "搜尋";

  showOnly(els.searchView);
}

function getLocalGlobalResults(keyword) {
  const normalizedKeyword =
    normalizeSearchText(keyword);

  return state.items.filter((item) => {
    const target =
      normalizeSearchText(
        `${item.category || ""} ${item.name || ""}`
      );

    return target.includes(
      normalizedKeyword
    );
  });
}

function runLocalGlobalSearch() {
  const keyword =
    els.searchInput.value.trim();

  if (!keyword) {
    state.searchRequestId++;

    els.pageTitle.textContent =
      "工作 SOP";

    els.breadcrumb.textContent =
      "首頁";

    showOnly(els.homeView);

    return;
  }

  prepareSearchView(keyword);

  const localResults =
    getLocalGlobalResults(keyword);

  renderSearchResults(localResults);

  els.searchStatus.textContent =
    "已顯示名稱搜尋結果，全文搜尋中…";
}

async function runRemoteGlobalSearch() {
  const keyword =
    els.searchInput.value.trim();

  if (!keyword) {
    return;
  }

  const requestId =
    ++state.searchRequestId;

  const localResults =
    getLocalGlobalResults(keyword);

  try {
    const remote =
      await api.search(keyword);

    /*
     * 使用者已經輸入新關鍵字時，
     * 不顯示上一筆較慢的回應。
     */
    if (
      requestId !== state.searchRequestId ||
      els.searchInput.value.trim() !== keyword
    ) {
      return;
    }

    const remoteResults =
      Array.isArray(remote.items)
        ? remote.items
        : [];

    const results =
      mergeSearchResults(
        localResults,
        remoteResults
      );

    renderSearchResults(results);

    els.searchStatus.textContent =
      `共找到 ${results.length} 個結果`;
  } catch (error) {
    if (requestId !== state.searchRequestId) {
      return;
    }

    console.warn(
      "全文搜尋失敗，保留名稱搜尋：",
      error
    );

    renderSearchResults(localResults);

    els.searchStatus.textContent =
      "全文搜尋暫時失敗，目前顯示名稱搜尋結果";
  }
}

function renderSearchResults(results) {
  els.searchResults.innerHTML = "";

  if (!results.length) {
    els.searchResults.innerHTML =
      "<p>目前沒有符合的結果。</p>";

    return;
  }

  results.sort((a, b) => {
    return String(a.name || "")
      .localeCompare(
        String(b.name || ""),
        "zh-TW"
      );
  });

  results.forEach((item) => {
    els.searchResults.appendChild(
      makeItemRow(item)
    );
  });
}

/* =========================================================
   登入狀態
   ========================================================= */

const currentUser = getCurrentUser();

if (currentUser) {
  start(currentUser);
} else {
  initGoogleLogin(
    start,
    (error) => {
      console.error(
        "Google 登入失敗：",
        error
      );

      els.loginMessage.textContent =
        error.message ||
        "Google 登入失敗";
    }
  );
}
