import { api } from "./api.js";
import {
  initGoogleLogin,
  getCurrentUser,
  logout
} from "./auth.js";

/**
 * 全域狀態
 */
const state = {
  items: [],
  categories: ["Test", "Leader", "驗證"]
};

/**
 * DOM 元素
 */
const els = {
  loginView: document.getElementById("loginView"),
  appView: document.getElementById("appView"),
  loginMessage: document.getElementById("loginMessage"),

  menuTree: document.getElementById("menuTree"),
  categoryCards: document.getElementById("categoryCards"),
  recentList: document.getElementById("recentList"),

  searchInput: document.getElementById("searchInput"),
  searchResults: document.getElementById("searchResults"),

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
  mobileOverlay: document.getElementById("mobileOverlay")
};

/**
 * 初始事件
 */
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

/**
 * 手機側邊選單
 */
function openMobileMenu() {
  els.sidebar.classList.add("open");
  els.mobileOverlay.classList.remove("hidden");
}

function closeMobileMenu() {
  els.sidebar.classList.remove("open");
  els.mobileOverlay.classList.add("hidden");
}

/**
 * 切換主要畫面
 */
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

/**
 * 顯示分類與類型圖示
 */
function iconFor(category, type) {
  if (type === "database") {
    return "📊";
  }

  const categoryIcons = {
    Test: "🧪",
    Leader: "👨‍💼",
    驗證: "✅"
  };

  return categoryIcons[category] || "📄";
}

/**
 * 登入後啟動應用程式
 */
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
  } catch (error) {
    console.error("取得目錄失敗：", error);

    state.items = [];

    showGlobalError(
      error.message || "無法取得 SOP 資料"
    );
  }

  renderAll();
}

/**
 * 根據實際資料補充分類
 */
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

/**
 * 顯示全域錯誤
 */
function showGlobalError(message) {
  els.recentList.innerHTML = `
    <div class="empty-state">
      <h3>資料讀取失敗</h3>
      <p>${escapeSearchHtml(message)}</p>
    </div>
  `;
}

/**
 * 重新渲染首頁
 */
function renderAll() {
  renderMenu();
  renderCategoryCards();
  renderRecent();
}

/**
 * 左側目錄
 */
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

    const title =
      document.createElement("button");

    title.className = "menu-group-title";

    title.innerHTML = `
      <span>
        ${iconFor(category)}
        ${escapeSearchHtml(category)}
      </span>
      <span>${items.length}</span>
    `;

    const list =
      document.createElement("div");

    list.className = "menu-items";

    items.forEach((item) => {
      const button =
        document.createElement("button");

      button.className = "menu-item";

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

/**
 * 首頁分類卡片
 */
function renderCategoryCards() {
  els.categoryCards.innerHTML = "";

  state.categories.forEach((category) => {
    const count = state.items.filter(
      (item) => item.category === category
    ).length;

    if (!count) {
      return;
    }

    const card =
      document.createElement("div");

    card.className = "category-card";

    card.innerHTML = `
      <div class="icon">
        ${iconFor(category)}
      </div>

      <h3>
        ${escapeSearchHtml(category)}
      </h3>

      <p>
        ${count} 個項目
      </p>
    `;

    card.addEventListener(
      "click",
      () => showCategory(category)
    );

    els.categoryCards.appendChild(card);
  });
}

/**
 * 最近新增
 *
 * 目前沒有日期欄位，因此暫時依照
 * Google Sheet 中的資料順序，取最後六筆。
 */
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

/**
 * 建立一筆清單項目
 */
function makeItemRow(item) {
  const row =
    document.createElement("div");

  row.className = "item-row";

  row.innerHTML = `
    <div>
      <strong>
        ${iconFor(item.category, item.type)}
        ${escapeSearchHtml(item.name)}
      </strong>

      <br>

      <small>
        ${escapeSearchHtml(item.category)}
      </small>
    </div>

    <span>›</span>
  `;

  row.addEventListener(
    "click",
    () => openItem(item)
  );

  return row;
}

/**
 * 顯示指定大分類
 */
function showCategory(category) {
  els.pageTitle.textContent = category;
  els.breadcrumb.textContent =
    `首頁 / ${category}`;

  els.searchResults.innerHTML = "";

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

/**
 * 開啟 SOP 或 Database
 */
async function openItem(item) {
  closeMobileMenu();

  els.pageTitle.textContent = item.name;

  els.breadcrumb.textContent =
    `${item.category} / ${item.name}`;

  showOnly(els.detailView);

  resetDetailView();

  /**
   * 暫時內容或沒有網址時，
   * 直接顯示準備中。
   */
  if (item.isEmpty || !item.url) {
    showEmptyContent(
      "內容準備中",
      "這個項目目前尚未加入內容，之後更新後會顯示在這裡。"
    );

    return;
  }

  els.loadingState.classList.remove("hidden");

  try {
    if (item.type === "database") {
      const result =
        await api.getDatabase(item.url);

      els.sheetContent.innerHTML =
        result.html || "";

      els.sheetContent.classList.remove(
        "hidden"
      );
    } else {
      const result =
        await api.getDoc(item.url);

      els.docContent.innerHTML =
        result.html || "";

      els.docContent.classList.remove(
        "hidden"
      );
    }
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

/**
 * 重設內容顯示區
 */
function resetDetailView() {
  els.docContent.innerHTML = "";
  els.sheetContent.innerHTML = "";

  els.docContent.classList.add("hidden");
  els.sheetContent.classList.add("hidden");
  els.emptyContent.classList.add("hidden");
  els.loadingState.classList.add("hidden");
}

/**
 * 顯示空白或錯誤訊息
 */
function showEmptyContent(title, message) {
  els.loadingState.classList.add("hidden");

  const titleElement =
    els.emptyContent.querySelector("h3");

  const messageElement =
    els.emptyContent.querySelector("p");

  titleElement.textContent = title;
  messageElement.textContent = message;

  els.emptyContent.classList.remove("hidden");
}

/**
 * 搜尋文字標準化
 *
 * 特性：
 * - 不分大小寫
 * - 忽略半形／全形差異
 * - 忽略空格
 * - 忽略連字號
 * - 忽略底線、斜線與句點
 *
 * 範例：
 * SSRM
 * ssrm
 * Pre-SSRM
 * pre ssrm
 * Pre_SSRM
 *
 * 都能互相比對。
 */
function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("zh-TW")
    .replace(
      /[\s\-‐-‒–—―_./\\]+/g,
      ""
    );
}

/**
 * 合併搜尋結果並去除重複項目
 */
function mergeSearchResults(...lists) {
  const resultMap = new Map();

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

      if (!resultMap.has(key)) {
        resultMap.set(key, item);
      }
    });

  return Array.from(resultMap.values());
}

/**
 * 搜尋輸入防抖
 */
let searchTimer = null;

els.searchInput.addEventListener(
  "input",
  () => {
    window.clearTimeout(searchTimer);

    searchTimer = window.setTimeout(
      runSearch,
      350
    );
  }
);

/**
 * 執行搜尋
 */
async function runSearch() {
  const keyword =
    els.searchInput.value.trim();

  /**
   * 搜尋框清空時回首頁
   */
  if (!keyword) {
    els.pageTitle.textContent = "工作 SOP";
    els.breadcrumb.textContent = "首頁";

    showOnly(els.homeView);

    return;
  }

  els.pageTitle.textContent =
    `搜尋：${keyword}`;

  els.breadcrumb.textContent = "搜尋";

  els.searchResults.innerHTML =
    "<p>搜尋中…</p>";

  showOnly(els.searchView);

  const normalizedKeyword =
    normalizeSearchText(keyword);

  /**
   * 前端立即搜尋：
   * - 大分類
   * - SOP 名稱
   *
   * 這能確保搜尋 SSRM 時，
   * Pre-SSRM 一定會被找到。
   */
  const localResults =
    state.items.filter((item) => {
      const target =
        normalizeSearchText(
          `${item.category || ""} ${item.name || ""}`
        );

      return target.includes(
        normalizedKeyword
      );
    });

  /**
   * 後端全文搜尋：
   * - Google Docs 內文
   * - Google Sheet 內容
   */
  let remoteResults = [];

  try {
    const remote =
      await api.search(keyword);

    if (Array.isArray(remote.items)) {
      remoteResults = remote.items;
    }
  } catch (error) {
    /**
     * 後端全文搜尋失敗時，
     * 仍保留前端名稱搜尋結果。
     */
    console.warn(
      "全文搜尋失敗，改用名稱搜尋：",
      error
    );
  }

  /**
   * 合併本機與後端結果。
   *
   * 舊版本會讓後端結果覆蓋前端結果，
   * 因此可能漏掉 Pre-SSRM。
   */
  const results =
    mergeSearchResults(
      localResults,
      remoteResults
    );

  els.searchResults.innerHTML = "";

  if (!results.length) {
    els.searchResults.innerHTML = `
      <p>
        找不到包含「${escapeSearchHtml(keyword)}」的內容。
      </p>
    `;

    return;
  }

  /**
   * 排序方式：
   * 1. 名稱完全符合
   * 2. 名稱包含關鍵字
   * 3. 內文搜尋結果
   */
  results.sort((a, b) => {
    const aName =
      normalizeSearchText(a.name);

    const bName =
      normalizeSearchText(b.name);

    const aExact =
      aName === normalizedKeyword
        ? 0
        : aName.includes(normalizedKeyword)
          ? 1
          : 2;

    const bExact =
      bName === normalizedKeyword
        ? 0
        : bName.includes(normalizedKeyword)
          ? 1
          : 2;

    if (aExact !== bExact) {
      return aExact - bExact;
    }

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

/**
 * 避免搜尋內容被當成 HTML
 */
function escapeSearchHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * 檢查目前登入狀態
 */
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
        error.message || "Google 登入失敗";
    }
  );
}
