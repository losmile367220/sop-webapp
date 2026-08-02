import { api } from "./api.js";
import {
  initGoogleLogin,
  getCurrentUser,
  logout
} from "./auth.js";

const state = {
  items: [],
  categories: ["Test", "Leader", "驗證"],
  currentItem: null,
  searchRequestId: 0,
  pendingGlobalKeyword: "",
  floatingMatches: [],
  floatingMatchIndex: -1
};

const memoryCache = new Map();
const CACHE_PREFIX = "sop_content_v4:";
const CACHE_TTL = 30 * 60 * 1000;

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

  floatingSearchToggle: document.getElementById("floatingSearchToggle"),
  floatingSearchBar: document.getElementById("floatingSearchBar"),
  floatingSearchInput: document.getElementById("floatingSearchInput"),
  floatingPrevBtn: document.getElementById("floatingPrevBtn"),
  floatingNextBtn: document.getElementById("floatingNextBtn"),
  floatingMatchPosition: document.getElementById("floatingMatchPosition"),
  floatingSearchClose: document.getElementById("floatingSearchClose")
};

document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("menuBtn").addEventListener("click", openMobileMenu);
els.mobileOverlay.addEventListener("click", closeMobileMenu);

els.floatingSearchToggle.addEventListener("click", openFloatingSearch);
els.floatingSearchClose.addEventListener("click", closeFloatingSearch);
els.floatingPrevBtn.addEventListener("click", () => moveFloatingMatch(-1));
els.floatingNextBtn.addEventListener("click", () => moveFloatingMatch(1));

els.floatingSearchInput.addEventListener("input", runFloatingSearch);
els.floatingSearchInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;

  event.preventDefault();

  if (event.shiftKey) {
    moveFloatingMatch(-1);
  } else {
    moveFloatingMatch(1);
  }
});

function openMobileMenu() {
  els.sidebar.classList.add("open");
  els.mobileOverlay.classList.remove("hidden");
}

function closeMobileMenu() {
  els.sidebar.classList.remove("open");
  els.mobileOverlay.classList.add("hidden");
}

function showOnly(view) {
  [els.homeView, els.detailView, els.searchView].forEach((element) => {
    element.classList.add("hidden");
  });

  view.classList.remove("hidden");
}

function iconFor(category, type) {
  if (type === "database") return "📊";

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

function isTextNodeAllowed(node) {
  const parent = node.parentElement;
  if (!parent) return false;

  const blockedTags = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEXTAREA",
    "INPUT",
    "BUTTON",
    "MARK"
  ]);

  return !blockedTags.has(parent.tagName);
}

function clearHighlights(container) {
  if (!container) return;

  container
    .querySelectorAll("mark.search-highlight")
    .forEach((mark) => {
      mark.replaceWith(
        document.createTextNode(mark.textContent || "")
      );
    });

  container.normalize();
}

function highlightTextInContainer(container, keyword) {
  clearHighlights(container);

  const normalizedKeyword = normalizeSearchText(keyword);
  if (!normalizedKeyword) return [];

  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.nodeValue?.trim()) {
          return NodeFilter.FILTER_REJECT;
        }

        if (!isTextNodeAllowed(node)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const textNodes = [];
  let node;

  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }

  const marks = [];

  textNodes.forEach((textNode) => {
    const sourceText = textNode.nodeValue || "";
    const normalizedSource = normalizeSearchText(sourceText);

    if (!normalizedSource.includes(normalizedKeyword)) {
      return;
    }

    const escapedKeyword = keyword.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const directRegex = new RegExp(
      escapedKeyword,
      "gi"
    );

    const directMatches = [
      ...sourceText.matchAll(directRegex)
    ];

    if (directMatches.length) {
      const fragment =
        document.createDocumentFragment();

      let cursor = 0;

      directMatches.forEach((match) => {
        const index = match.index ?? 0;

        fragment.appendChild(
          document.createTextNode(
            sourceText.slice(cursor, index)
          )
        );

        const mark =
          document.createElement("mark");

        mark.className =
          "search-highlight";

        mark.textContent = match[0];

        fragment.appendChild(mark);
        marks.push(mark);

        cursor = index + match[0].length;
      });

      fragment.appendChild(
        document.createTextNode(
          sourceText.slice(cursor)
        )
      );

      textNode.replaceWith(fragment);
      return;
    }

    /*
     * 例如搜尋 SSRM，來源是 Pre-SSRM。
     * 忽略符號後相符，但無法直接取得精準索引時，
     * 將整個文字片段標黃。
     */
    const mark =
      document.createElement("mark");

    mark.className =
      "search-highlight";

    mark.textContent = sourceText;

    textNode.replaceWith(mark);
    marks.push(mark);
  });

  return marks;
}

function setActiveMatch(matches, index) {
  matches.forEach((mark) => {
    mark.classList.remove("active-match");
  });

  if (!matches.length) {
    els.floatingMatchPosition.textContent =
      "0 / 0";

    return;
  }

  const safeIndex =
    ((index % matches.length) +
      matches.length) %
    matches.length;

  const active = matches[safeIndex];

  active.classList.add("active-match");

  active.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "nearest"
  });

  els.floatingMatchPosition.textContent =
    `${safeIndex + 1} / ${matches.length}`;
}

function getCurrentContentContainer() {
  if (
    !els.detailView.classList.contains("hidden")
  ) {
    if (
      !els.sheetContent.classList.contains("hidden")
    ) {
      return els.sheetContent;
    }

    if (
      !els.docContent.classList.contains("hidden")
    ) {
      return els.docContent;
    }
  }

  return null;
}

function showFloatingSearchButton() {
  if (
    els.detailView.classList.contains("hidden")
  ) {
    els.floatingSearchToggle.classList.add("hidden");
    els.floatingSearchBar.classList.add("hidden");
    return;
  }

  els.floatingSearchToggle.classList.remove("hidden");
}

function openFloatingSearch() {
  els.floatingSearchToggle.classList.add("hidden");
  els.floatingSearchBar.classList.remove("hidden");

  els.floatingSearchInput.focus();
  els.floatingSearchInput.select();
}

function closeFloatingSearch() {
  const container =
    getCurrentContentContainer();

  clearHighlights(container);

  state.floatingMatches = [];
  state.floatingMatchIndex = -1;

  els.floatingSearchInput.value = "";
  els.floatingMatchPosition.textContent = "0 / 0";

  els.floatingSearchBar.classList.add("hidden");

  if (
    !els.detailView.classList.contains("hidden")
  ) {
    els.floatingSearchToggle.classList.remove("hidden");
  }
}

function runFloatingSearch() {
  const container =
    getCurrentContentContainer();

  const keyword =
    els.floatingSearchInput.value.trim();

  if (!container) {
    return;
  }

  state.floatingMatches =
    keyword
      ? highlightTextInContainer(
          container,
          keyword
        )
      : [];

  state.floatingMatchIndex =
    state.floatingMatches.length
      ? 0
      : -1;

  setActiveMatch(
    state.floatingMatches,
    state.floatingMatchIndex
  );
}

function moveFloatingMatch(direction) {
  if (!state.floatingMatches.length) {
    return;
  }

  state.floatingMatchIndex =
    (
      state.floatingMatchIndex +
      direction +
      state.floatingMatches.length
    ) %
    state.floatingMatches.length;

  setActiveMatch(
    state.floatingMatches,
    state.floatingMatchIndex
  );
}

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
    console.error(
      "取得目錄失敗：",
      error
    );

    state.items = [];
    renderAll();

    els.recentList.innerHTML = `
      <div class="empty-state">
        <h3>資料讀取失敗</h3>
        <p>${escapeHtml(
          error.message ||
          "無法取得 SOP 資料"
        )}</p>
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
    const category =
      String(item.category || "")
        .trim();

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

function renderMenu(keyword = "") {
  els.menuTree.innerHTML = "";

  const homeButton =
    document.createElement("button");

  homeButton.className =
    "menu-item home-menu-item";

  homeButton.type = "button";
  homeButton.textContent = "🏠 主頁";

  homeButton.addEventListener(
    "click",
    () => {
      els.searchInput.value = "";
      state.pendingGlobalKeyword = "";

      els.pageTitle.textContent =
        "工作 SOP";

      els.breadcrumb.textContent =
        "首頁";

      renderMenu();
      closeFloatingSearch();
      showOnly(els.homeView);
      closeMobileMenu();
    }
  );

  els.menuTree.appendChild(homeButton);

  state.categories.forEach((category) => {
    const items = state.items.filter(
      (item) =>
        item.category === category
    );

    if (!items.length) return;

    const group =
      document.createElement("div");

    group.className = "menu-group";

    const title =
      document.createElement("button");

    title.className =
      "menu-group-title";

    title.type = "button";

    const categoryLabel =
      document.createElement("span");

    categoryLabel.textContent =
      `${iconFor(category)} ${category}`;

    title.appendChild(categoryLabel);

    const count =
      document.createElement("span");

    count.textContent =
      String(items.length);

    title.appendChild(count);

    if (keyword) {
      highlightTextInContainer(
        categoryLabel,
        keyword
      );
    }

    const list =
      document.createElement("div");

    list.className = "menu-items";

    items.forEach((item) => {
      const button =
        document.createElement("button");

      button.className = "menu-item";
      button.type = "button";

      button.textContent =
        `${iconFor(
          category,
          item.type
        )} ${item.name}`;

      if (keyword) {
        highlightTextInContainer(
          button,
          keyword
        );
      }

      button.addEventListener(
        "click",
        () => openItem(item, keyword)
      );

      list.appendChild(button);
    });

    group.appendChild(title);
    group.appendChild(list);

    els.menuTree.appendChild(group);
  });
}

function renderCategoryCards() {
  els.categoryCards.innerHTML = "";

  state.categories.forEach((category) => {
    const count =
      state.items.filter(
        (item) =>
          item.category === category
      ).length;

    if (!count) return;

    const card =
      document.createElement("div");

    card.className =
      "category-card";

    card.innerHTML = `
      <div class="icon">
        ${iconFor(category)}
      </div>
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

  const items =
    state.items
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

function makeItemRow(item, keyword = "") {
  const row =
    document.createElement("div");

  row.className = "item-row";

  const info =
    document.createElement("div");

  const title =
    document.createElement("strong");

  title.textContent =
    `${iconFor(
      item.category,
      item.type
    )} ${item.name}`;

  if (keyword) {
    highlightTextInContainer(
      title,
      keyword
    );
  }

  const category =
    document.createElement("small");

  category.textContent =
    item.category;

  if (keyword) {
    highlightTextInContainer(
      category,
      keyword
    );
  }

  info.append(
    title,
    document.createElement("br"),
    category
  );

  const arrow =
    document.createElement("span");

  arrow.textContent = "›";

  row.append(info, arrow);

  row.addEventListener(
    "click",
    () => openItem(item, keyword)
  );

  return row;
}

function showCategory(category) {
  els.pageTitle.textContent = category;
  els.breadcrumb.textContent =
    `首頁 / ${category}`;

  els.searchResults.innerHTML = "";
  els.searchStatus.textContent = "";

  const items =
    state.items.filter(
      (item) =>
        item.category === category
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

  closeFloatingSearch();
  showOnly(els.searchView);
}

function cacheKey(item) {
  return `${CACHE_PREFIX}${item.type}|${item.url}`;
}

function getCached(item) {
  const key = cacheKey(item);

  if (memoryCache.has(key)) {
    return memoryCache.get(key);
  }

  try {
    const raw =
      sessionStorage.getItem(key);

    if (!raw) return null;

    const parsed =
      JSON.parse(raw);

    if (
      !parsed ||
      Date.now() - parsed.time >
        CACHE_TTL
    ) {
      sessionStorage.removeItem(key);
      return null;
    }

    memoryCache.set(
      key,
      parsed.html
    );

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
    // 大型圖片超出容量時，保留記憶體快取即可。
  }
}

async function openItem(
  item,
  globalKeyword = ""
) {
  closeMobileMenu();

  state.currentItem = item;
  state.pendingGlobalKeyword =
    globalKeyword ||
    state.pendingGlobalKeyword ||
    "";

  els.pageTitle.textContent =
    item.name;

  els.breadcrumb.textContent =
    `${item.category} / ${item.name}`;

  closeFloatingSearch();
  showOnly(els.detailView);
  resetDetailView();

  if (item.isEmpty || !item.url) {
    showEmptyContent(
      "內容準備中",
      "這個項目目前尚未加入內容，之後更新後會顯示在這裡。"
    );

    return;
  }

  const cachedHtml =
    getCached(item);

  if (cachedHtml !== null) {
    showItemHtml(item, cachedHtml);
    showFloatingSearchButton();

    if (state.pendingGlobalKeyword) {
      openFloatingSearch();
      els.floatingSearchInput.value =
        state.pendingGlobalKeyword;
      runFloatingSearch();
    }

    return;
  }

  els.loadingState.classList.remove(
    "hidden"
  );

  try {
    const result =
      item.type === "database"
        ? await api.getDatabase(item.url)
        : await api.getDoc(item.url);

    const html = result.html || "";

    setCached(item, html);
    showItemHtml(item, html);
    showFloatingSearchButton();

    if (state.pendingGlobalKeyword) {
      openFloatingSearch();
      els.floatingSearchInput.value =
        state.pendingGlobalKeyword;
      runFloatingSearch();
    }
  } catch (error) {
    console.error(
      `讀取「${item.name}」失敗：`,
      error
    );

    showEmptyContent(
      "讀取失敗",
      error.message ||
      "無法讀取此項目"
    );
  } finally {
    els.loadingState.classList.add(
      "hidden"
    );
  }
}

function showItemHtml(item, html) {
  if (item.type === "database") {
    els.sheetContent.innerHTML = html;
    els.sheetContent.classList.remove(
      "hidden"
    );
  } else {
    els.docContent.innerHTML = html;
    els.docContent.classList.remove(
      "hidden"
    );
  }
}

function resetDetailView() {
  els.docContent.innerHTML = "";
  els.sheetContent.innerHTML = "";

  els.docContent.classList.add("hidden");
  els.sheetContent.classList.add("hidden");
  els.emptyContent.classList.add("hidden");
  els.loadingState.classList.add("hidden");

  state.floatingMatches = [];
  state.floatingMatchIndex = -1;

  els.floatingSearchInput.value = "";
  els.floatingMatchPosition.textContent =
    "0 / 0";

  els.floatingSearchBar.classList.add(
    "hidden"
  );

  els.floatingSearchToggle.classList.add(
    "hidden"
  );
}

function showEmptyContent(
  title,
  message
) {
  els.loadingState.classList.add(
    "hidden"
  );

  els.emptyContent
    .querySelector("h3")
    .textContent = title;

  els.emptyContent
    .querySelector("p")
    .textContent = message;

  els.emptyContent.classList.remove(
    "hidden"
  );

  els.floatingSearchToggle.classList.add(
    "hidden"
  );

  els.floatingSearchBar.classList.add(
    "hidden"
  );
}

function mergeSearchResults(...lists) {
  const map = new Map();

  lists.flat().forEach((item) => {
    if (!item) return;

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
    window.clearTimeout(
      localSearchTimer
    );

    window.clearTimeout(
      remoteSearchTimer
    );

    localSearchTimer =
      window.setTimeout(
        runLocalGlobalSearch,
        160
      );

    remoteSearchTimer =
      window.setTimeout(
        runRemoteGlobalSearch,
        850
      );
  }
);

function prepareSearchView(keyword) {
  els.pageTitle.textContent =
    `搜尋：${keyword}`;

  els.breadcrumb.textContent =
    "搜尋";

  closeFloatingSearch();
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

  state.pendingGlobalKeyword = keyword;
  renderMenu(keyword);

  if (!keyword) {
    state.searchRequestId++;

    els.pageTitle.textContent =
      "工作 SOP";

    els.breadcrumb.textContent =
      "首頁";

    renderMenu();
    closeFloatingSearch();
    showOnly(els.homeView);

    return;
  }

  prepareSearchView(keyword);

  const localResults =
    getLocalGlobalResults(keyword);

  renderSearchResults(
    localResults,
    keyword
  );

  els.searchStatus.textContent =
    "已顯示名稱搜尋結果，全文搜尋中…";
}

async function runRemoteGlobalSearch() {
  const keyword =
    els.searchInput.value.trim();

  if (!keyword) return;

  const requestId =
    ++state.searchRequestId;

  const localResults =
    getLocalGlobalResults(keyword);

  try {
    const remote =
      await api.search(keyword);

    if (
      requestId !==
        state.searchRequestId ||
      els.searchInput.value.trim() !==
        keyword
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

    renderSearchResults(
      results,
      keyword
    );

    els.searchStatus.textContent =
      `共找到 ${results.length} 個結果`;
  } catch (error) {
    if (
      requestId !==
      state.searchRequestId
    ) {
      return;
    }

    console.warn(
      "全文搜尋失敗，保留名稱搜尋：",
      error
    );

    renderSearchResults(
      localResults,
      keyword
    );

    els.searchStatus.textContent =
      "全文搜尋暫時失敗，目前顯示名稱搜尋結果";
  }
}

function renderSearchResults(
  results,
  keyword = ""
) {
  els.searchResults.innerHTML = "";

  if (!results.length) {
    els.searchResults.innerHTML =
      `<p>找不到包含「${escapeHtml(
        keyword
      )}」的結果。</p>`;

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
      makeItemRow(item, keyword)
    );
  });
}

const currentUser =
  getCurrentUser();

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
