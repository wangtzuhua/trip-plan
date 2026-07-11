/* ============================================================
   九州慶生自駕之旅 — App 邏輯
   純前端 · 無資料庫 · 天氣使用 Open-Meteo 免費 API
   ============================================================ */
(function () {
  "use strict";

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  const TYPE_LABEL = {
    spot: "景點", food: "美食", transit: "交通",
    hotel: "住宿", onsen: "溫泉", flight: "航班", shop: "購物",
  };

  const state = {
    day: 1,
    view: "itinerary",
    region: "全部",
    sort: "rating",
    shopFilter: "全部",
    userPos: null,
    weatherCache: {},
  };

  // 記住各分頁的捲動位置，切回時還原（不歸零）
  const scrollPos = { itinerary: 0, food: 0, shopping: 0, info: 0 };

  function showView(view) {
    // 離開前先記下目前分頁的捲動位置
    scrollPos[state.view] = window.scrollY || document.documentElement.scrollTop || 0;
    state.view = view;
    $$(".tab-item").forEach(t => t.classList.toggle("active", t.dataset.view === view));
    $$(".view").forEach(v => v.classList.add("hidden"));
    $(`#view-${view}`).classList.remove("hidden");
    return scrollPos[view] || 0;
  }

  /* ---------- helpers ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function navUrl(place) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place)}&travelmode=driving`;
  }
  function mapUrl(place) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
  }

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._tm);
    toast._tm = setTimeout(() => t.classList.remove("show"), 1800);
  }

  window.copyText = function (text, label) {
    (navigator.clipboard?.writeText(text) || Promise.reject())
      .then(() => toast(`已複製${label}：${text}`))
      .catch(() => {
        const ta = document.createElement("textarea");
        ta.value = text; document.body.appendChild(ta);
        ta.select(); document.execCommand("copy"); ta.remove();
        toast(`已複製${label}：${text}`);
      });
  };

  function tagsHtml(tags) {
    if (!tags || !tags.length) return "";
    return `<div class="tag-row">${tags.map(t =>
      `<span class="tag tag-${t.c}">${esc(t.t)}</span>`).join("")}</div>`;
  }

  function metaHtml(ev) {
    const chips = [];
    if (ev.mapcode) chips.push(
      `<button class="meta-chip mapcode" onclick="copyText('${ev.mapcode}','Map Code')">
        <span class="mc-label">MAP CODE</span> ${esc(ev.mapcode)} 📋</button>`);
    if (ev.mapcodeParking) chips.push(
      `<button class="meta-chip mapcode" onclick="copyText('${ev.mapcodeParking}','停車場 Map Code')">
        <span class="mc-label">🅿️ 停車場</span> ${esc(ev.mapcodeParking)} 📋</button>`);
    if (ev.phone) chips.push(
      `<a class="meta-chip phone" href="tel:${ev.phone.replace(/[^\d+#]/g, "")}">☎ ${esc(ev.phone)}</a>`);
    return chips.length ? `<div class="meta-row">${chips.join("")}</div>` : "";
  }

  function actionsHtml(ev) {
    const btns = [];
    if (ev.nav) btns.push(`<a class="btn btn-nav" href="${navUrl(ev.nav)}" target="_blank" rel="noopener">🧭 導航</a>`);
    if (ev.phone) btns.push(`<a class="btn btn-tel" href="tel:${ev.phone.replace(/[^\d+#]/g, "")}">📞 撥打</a>`);
    if (ev.foodRef && RESTAURANTS.some(r => r.id === ev.foodRef))
      btns.push(`<button class="btn btn-food" onclick="jumpToFood('${ev.foodRef}')">🍜 美食頁看詳情 →</button>`);
    return btns.length ? `<div class="action-row">${btns.join("")}</div>` : "";
  }

  function noteHtml(ev) {
    if (!ev.note) return "";
    const notes = Array.isArray(ev.note) ? ev.note : [ev.note];
    return `<div class="event-note">${notes.map(n => `<p>${esc(n)}</p>`).join("")}</div>`;
  }

  const RITUAL_STEPS = [
    "⛩️ 鳥居前輕輕一鞠躬",
    "💧 手水舍：左手→右手→漱口→沖柄杓",
    "🪙 投賽錢（5 円最吉利＝ご縁）、搖鈴",
    "🙇 深鞠躬 ×2",
    "👏 拍手 ×2，雙手合十默念心願",
    "🙇 最後再一鞠躬",
  ];

  function shrineHtml(ev) {
    if (!ev.shrine) return "";
    const s = ev.shrine;
    return `
      <div class="shrine-box">
        <div class="shrine-head">⛩️ 神社小知識 <span class="shrine-name">${esc(s.name)}</span></div>
        <div class="shrine-deity"><span class="shrine-k">主祭神</span>${esc(s.deity)}</div>
        <div class="shrine-blessings">
          ${s.blessings.map(b => `<span class="blessing-chip">${b.icon} ${esc(b.label)}</span>`).join("")}
        </div>
        <div class="shrine-tip">${esc(s.tip)}</div>
        <div class="ritual-box">
          <div class="ritual-title">🙏 參拜禮儀小抄（二拜二拍手一拜）</div>
          <ol class="ritual-steps">
            ${RITUAL_STEPS.map(st => `<li>${st}</li>`).join("")}
          </ol>
        </div>
      </div>`;
  }

  function guideHtml(ev, id) {
    if (!ev.guide) return "";
    return `
      <div class="guide-box" id="guide-${id}">
        <button class="guide-toggle" onclick="document.getElementById('guide-${id}').classList.toggle('open')">
          🏮 導遊小知識 & 攻略 <span class="arrow">▼</span>
        </button>
        <div class="guide-content"><p>${esc(ev.guide)}</p></div>
      </div>`;
  }

  /* ---------- 行程 ---------- */
  function renderDayTabs() {
    $("#dayTabs").innerHTML = DAYS.map(d => `
      <button class="day-tab ${d.id === state.day ? "active" : ""}" data-day="${d.id}">
        <b>Day ${d.id}</b>${d.date.slice(5).replace("-", "/")} (${d.week})
      </button>`).join("");
    $$("#dayTabs .day-tab").forEach(btn => btn.addEventListener("click", () => {
      state.day = +btn.dataset.day;
      renderDayTabs();
      renderDay();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }));
  }

  function eventCard(ev, i) {
    const badge = TYPE_LABEL[ev.type] || "";
    const transit = ev.transit
      ? `<div class="event-transit-note ${ev.transit.mode || "drive"}">${esc(ev.transit.text)}</div>` : "";
    const desc = ev.desc
      ? `<div class="event-desc">${ev.desc.map(p => `<p>${esc(p)}</p>`).join("")}</div>` : "";
    const options = ev.options ? `
      <div class="option-list">${ev.options.map(o => {
        const nm = (o.ref && RESTAURANTS.some(r => r.id === o.ref))
          ? `<button class="opt-name opt-link" onclick="jumpToFood('${o.ref}')">${esc(o.name)}</button>`
          : `<div class="opt-name">${esc(o.name)}</div>`;
        return `
        <div class="option-item">
          ${nm}
          <div class="opt-time">⏰ ${esc(o.time)}</div>
          <div class="opt-note">${esc(o.note)}</div>
        </div>`;
      }).join("")}
      </div>` : "";

    return `
      <article class="event-card type-${ev.type}">
        <div class="event-head">
          <div class="event-time">${esc(ev.time)}</div>
          <div class="event-title-wrap">
            <div class="event-title">${esc(ev.title)}<span class="event-badge">${badge}</span></div>
          </div>
        </div>
        <div class="event-body">
          ${tagsHtml(ev.tags)}
          ${transit}
          ${desc}
          ${options}
          ${noteHtml(ev)}
          ${shrineHtml(ev)}
          ${metaHtml(ev)}
          ${actionsHtml(ev)}
          ${guideHtml(ev, `d${state.day}-${i}`)}
        </div>
      </article>`;
  }

  function renderDay() {
    const d = DAYS.find(x => x.id === state.day);
    $("#dayContent").innerHTML = `
      <div class="day-header">
        <div class="day-header-top">
          <div class="day-header-date">DAY ${d.id} ｜ ${d.date.replace(/-/g, ".")} (${d.week})</div>
          <div class="day-header-title">${esc(d.title)}</div>
          <div class="day-header-sub">📍 ${esc(d.sub)}</div>
        </div>
        <div id="weatherSlot"><div class="weather-loading">☁️ 載入 ${esc(d.weather.name)} 天氣中…</div></div>
        ${d.outfit ? `<div class="day-outfit"><span class="day-outfit-label">👕 推薦穿著</span><span class="day-outfit-text">${esc(d.outfit)}</span></div>` : ""}
        ${d.photoColor ? `<div class="day-outfit day-photocolor"><span class="day-outfit-label">📸 拍照配色</span><span class="day-outfit-text">${esc(d.photoColor)}</span></div>` : ""}
      </div>
      <div class="timeline">${d.events.map((ev, i) => eventCard(ev, i)).join("")}</div>`;
    loadWeather(d);
  }

  /* ---------- 天氣 (Open-Meteo，免金鑰) ---------- */
  const WMO = [
    [[0], "☀️", "晴朗"], [[1], "🌤️", "大致晴朗"], [[2], "⛅", "多雲時晴"], [[3], "☁️", "陰天"],
    [[45, 48], "🌫️", "有霧"], [[51, 53, 55, 56, 57], "🌦️", "毛毛雨"],
    [[61, 63, 66], "🌧️", "有雨"], [[65, 67], "🌧️", "大雨"],
    [[71, 73, 75, 77], "🌨️", "降雪"], [[80, 81], "🌦️", "陣雨"], [[82], "⛈️", "強陣雨"],
    [[85, 86], "🌨️", "陣雪"], [[95, 96, 99], "⛈️", "雷雨"],
  ];
  function wmoInfo(code) {
    for (const [codes, icon, text] of WMO) if (codes.includes(code)) return { icon, text };
    return { icon: "🌡️", text: "—" };
  }

  async function loadWeather(d) {
    const slot = $("#weatherSlot");
    const key = `${d.weather.lat},${d.weather.lon},${d.date}`;
    try {
      let data = state.weatherCache[key];
      if (!data) {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${d.weather.lat}&longitude=${d.weather.lon}` +
          `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
          `&timezone=Asia%2FTokyo&start_date=${d.date}&end_date=${d.date}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("weather http " + res.status);
        data = await res.json();
        state.weatherCache[key] = data;
      }
      if (state.day !== d.id || !slot.isConnected) return;
      const dd = data.daily;
      if (!dd || dd.weather_code?.[0] == null) throw new Error("no data");
      const w = wmoInfo(dd.weather_code[0]);
      const rain = dd.precipitation_probability_max?.[0];
      slot.innerHTML = `
        <div class="weather-strip">
          <div class="weather-icon">${w.icon}</div>
          <div class="weather-main">
            <div class="weather-desc">${w.text}</div>
            <div class="weather-temp">${Math.round(dd.temperature_2m_min[0])}° / ${Math.round(dd.temperature_2m_max[0])}°C
              ${rain != null ? `　<span class="weather-rain">☔ ${rain}%</span>` : ""}</div>
          </div>
          <div class="weather-loc">${esc(d.weather.name)}<br>${d.date.slice(5).replace("-", "/")} 預報</div>
        </div>`;
    } catch (e) {
      if (state.day !== d.id || !slot.isConnected) return;
      slot.innerHTML = `<div class="weather-loading">🌫️ ${esc(d.weather.name)} 天氣暫時無法取得（預報僅涵蓋未來 16 天，接近出發日再開啟即可）</div>`;
    }
  }

  /* ---------- 美食 ---------- */
  const REGIONS = ["全部", ...new Set(RESTAURANTS.map(r => r.region))];

  function distKm(a, b) {
    const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2 +
      Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }

  function renderRegionChips() {
    $("#foodRegionChips").innerHTML = REGIONS.map(r =>
      `<button class="region-chip ${r === state.region ? "active" : ""}" data-region="${r}">${r}</button>`).join("");
    $$("#foodRegionChips .region-chip").forEach(c => c.addEventListener("click", () => {
      state.region = c.dataset.region;
      renderRegionChips(); renderFood();
    }));
  }

  function foodCard(r) {
    const dist = (state.sort === "distance" && state.userPos)
      ? `<span class="food-dist">📍 ${distKm(state.userPos, r).toFixed(1)} km</span>` : "";
    return `
      <div class="food-card" id="food-${esc(r.id)}">
        <div class="food-card-head">
          <div class="food-name">${esc(r.name)}
            <div><span class="food-region-badge">${esc(r.region)}</span></div>
          </div>
          <div style="text-align:right">
            <div class="food-rating">⭐ ${r.rating.toFixed(1)}</div>
            ${dist}
          </div>
        </div>
        ${tagsHtml(r.tags)}
        <div class="food-desc">${esc(r.desc)}</div>
        <div class="food-hours">🕐 <b>${esc(r.hours)}</b></div>
        <div class="action-row">
          <a class="btn btn-nav" href="${navUrl(r.nav)}" target="_blank" rel="noopener">🧭 導航</a>
          <a class="btn btn-ghost" href="${mapUrl(r.nav)}" target="_blank" rel="noopener">🗺️ 地圖 / 電話</a>
          ${r.phone ? `<a class="btn btn-tel" href="tel:${r.phone.replace(/[^\d+]/g, "")}">📞 撥打</a>` : ""}
        </div>
      </div>`;
  }

  function renderFood() {
    let list = state.region === "全部" ? [...RESTAURANTS]
      : RESTAURANTS.filter(r => r.region === state.region);

    if (state.sort === "distance" && state.userPos) {
      list.sort((a, b) => distKm(state.userPos, a) - distKm(state.userPos, b));
      $("#foodList").innerHTML = list.map(foodCard).join("");
      return;
    }
    list.sort((a, b) => b.rating - a.rating);

    if (state.region === "全部") {
      // 依區域分組顯示
      const groups = {};
      list.forEach(r => (groups[r.region] ??= []).push(r));
      $("#foodList").innerHTML = Object.entries(groups).map(([region, items]) => {
        const icon = region === "熊本市區" ? "🔴" : region === "阿蘇地區" ? "🟢" : "🔵";
        return `<div class="food-region-title">${icon} ${region}</div>` + items.map(foodCard).join("");
      }).join("");
    } else {
      $("#foodList").innerHTML = list.map(foodCard).join("");
    }
  }

  /* 從行程頁跳到美食頁的指定餐廳並高亮 */
  window.jumpToFood = function (id) {
    const r = RESTAURANTS.find(x => x.id === id);
    if (!r) return;
    // 切到美食分頁（會先記住行程頁的捲動位置）
    showView("food");
    // 切到該餐廳所屬區域、評價排序
    state.region = r.region;
    state.sort = "rating";
    $$(".sort-btn").forEach(b => b.classList.toggle("active", b.dataset.sort === "rating"));
    $("#geoHint")?.classList.add("hidden");
    renderRegionChips();
    renderFood();
    // 捲動並閃爍高亮（延遲讓新清單先完成排版）
    setTimeout(() => {
      const el = document.getElementById("food-" + id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove("flash");
      void el.offsetWidth;
      el.classList.add("flash");
    }, 80);
  };

  function setupSort() {
    $$(".sort-btn").forEach(btn => btn.addEventListener("click", () => {
      $$(".sort-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.sort = btn.dataset.sort;
      const hint = $("#geoHint");
      if (state.sort === "distance") {
        hint.classList.remove("hidden");
        hint.textContent = "📡 取得目前位置中…";
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            state.userPos = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            hint.textContent = "✅ 已依你目前位置由近到遠排序";
            renderFood();
          },
          () => {
            hint.textContent = "⚠️ 無法取得定位（請允許定位權限），改以評價排序";
            state.sort = "rating";
            $$(".sort-btn").forEach(b => b.classList.toggle("active", b.dataset.sort === "rating"));
            renderFood();
          },
          { enableHighAccuracy: false, timeout: 8000 }
        );
      } else {
        hint.classList.add("hidden");
      }
      renderFood();
    }));
  }

  /* ---------- 資訊 ---------- */
  function renderInfo() {
    const f = INFO.flights.map(fl => `
      <div class="info-card" style="--c:var(--murasaki)">
        <h3>✈️ ${esc(fl.dir)}</h3>
        <div class="info-sub">${esc(fl.airline)}</div>
        <div class="info-kv"><span class="k">航線</span><span class="v"><b>${esc(fl.route)}</b></span></div>
        <div class="info-kv"><span class="k">時間</span><span class="v">${esc(fl.detail)}</span></div>
        <div class="info-note">💡 ${esc(fl.note)}</div>
      </div>`).join("");

    const r = INFO.rental;
    const rental = `
      <div class="info-card" style="--c:var(--ai)">
        <h3>🚗 ${esc(r.company)}</h3>
        <div class="info-sub">${esc(r.car)}</div>
        <div class="info-kv"><span class="k">取車</span><span class="v"><b>${esc(r.pickup.time)}</b><br>${esc(r.pickup.place)}</span></div>
        <div class="info-kv"><span class="k">還車</span><span class="v"><b>${esc(r.dropoff.time)}</b><br>${esc(r.dropoff.place)}</span></div>
        <div class="info-kv"><span class="k">保險</span><span class="v">${esc(r.insurance)}</span></div>
        <div class="info-kv"><span class="k">證件</span><span class="v">${esc(r.docs)}</span></div>
        <div class="info-note">🔑 ${esc(r.addon)}</div>
        <div class="info-note">⛽ ${esc(r.reminder)}</div>
        <div class="action-row">
          <a class="btn btn-nav" href="${navUrl(r.pickup.nav)}" target="_blank" rel="noopener">🧭 取車點</a>
          <a class="btn btn-nav" href="${navUrl(r.dropoff.nav)}" target="_blank" rel="noopener">🧭 還車點</a>
        </div>
      </div>`;

    const hotels = INFO.hotels.map(h => `
      <div class="info-card" style="--c:var(--matcha)">
        <h3>🏨 ${esc(h.name)}</h3>
        <div class="info-sub">${esc(h.nights)} · ${esc(h.area)}</div>
        <div class="info-kv"><span class="k">備註</span><span class="v">${esc(h.note)}</span></div>
        ${h.mapcode ? `<div class="info-kv"><span class="k">Map Code</span><span class="v">${esc(h.mapcode)}</span></div>` : ""}
        ${h.phoneNote ? `<div class="info-kv"><span class="k">電話備註</span><span class="v">${esc(h.phoneNote)}</span></div>` : ""}
        <div class="action-row">
          <a class="btn btn-nav" href="${navUrl(h.nav)}" target="_blank" rel="noopener">🧭 導航</a>
          ${h.phone ? `<a class="btn btn-tel" href="tel:${h.phone.replace(/[^\d+]/g, "")}">📞 ${esc(h.phone)}</a>` : ""}
          <a class="btn btn-ghost" href="${mapUrl(h.nav)}" target="_blank" rel="noopener">🗺️ 地圖</a>
        </div>
      </div>`).join("");

    const em = `
      <div class="emergency-grid">${INFO.emergency.map(e => `
        <a class="emergency-item ${e.full ? "full" : ""}" href="tel:${e.tel}">
          <span class="em-name">${esc(e.name)}</span>
          <span class="em-num">${esc(e.num)}</span>
          <span class="em-note">${esc(e.note)}</span>
        </a>`).join("")}
      </div>`;

    const saved = JSON.parse(localStorage.getItem("trip-checklist") || "{}");
    const check = `
      <div class="info-card" style="--c:var(--kin)">
        ${INFO.checklist.map((c, i) => `
          <label class="check-item ${saved[i] ? "done" : ""}">
            <input type="checkbox" data-check="${i}" ${saved[i] ? "checked" : ""}>
            <span>${esc(c)}</span>
          </label>`).join("")}
      </div>`;

    $("#infoContent").innerHTML = `
      <div class="info-section"><div class="info-section-title">✈️ 航班資訊</div>${f}</div>
      <div class="info-section"><div class="info-section-title">🚗 租車資訊</div>${rental}</div>
      <div class="info-section"><div class="info-section-title">🏨 住宿資訊</div>${hotels}</div>
      <div class="info-section"><div class="info-section-title">🆘 緊急聯絡電話</div>${em}</div>
      <div class="info-section"><div class="info-section-title">✅ 出發前檢查清單</div>${check}</div>`;

    $$("#infoContent [data-check]").forEach(cb => cb.addEventListener("change", () => {
      const s = JSON.parse(localStorage.getItem("trip-checklist") || "{}");
      s[cb.dataset.check] = cb.checked;
      localStorage.setItem("trip-checklist", JSON.stringify(s));
      cb.closest(".check-item").classList.toggle("done", cb.checked);
    }));
  }

  /* ---------- 購買清單 ---------- */
  function renderShopping() {
    const saved = JSON.parse(localStorage.getItem("trip-shopping") || "{}");

    const chips = ["全部", ...STORES.map(s => s.name)];
    const toolbar = `
      <div class="shop-toolbar">
        <div class="chip-row" id="shopChips">
          ${chips.map(c => `<button class="region-chip ${c === state.shopFilter ? "active" : ""}" data-shop-filter="${esc(c)}">${esc(c)}</button>`).join("")}
        </div>
      </div>`;

    const visible = state.shopFilter === "全部"
      ? STORES : STORES.filter(s => s.name === state.shopFilter);

    const cards = visible.map(store => {
      const total = store.items.length;
      const done = store.items.filter((_, i) => saved[`${store.id}-${i}`]).length;
      const items = store.items.map((item, i) => {
        const k = `${store.id}-${i}`;
        return `
          <label class="check-item ${saved[k] ? "done" : ""}">
            <input type="checkbox" data-shop="${k}" ${saved[k] ? "checked" : ""}>
            <span>${esc(item)}</span>
          </label>`;
      }).join("");
      return `
        <div class="shop-card" style="--c:var(--${store.color})">
          <div class="shop-head">
            <div class="shop-icon">${store.icon}</div>
            <div class="shop-title-wrap">
              <div class="shop-name">${esc(store.name)}</div>
              <div class="shop-sub">${esc(store.sub)}</div>
            </div>
            <div class="shop-count" data-store="${store.id}">${done}/${total}</div>
          </div>
          <div class="shop-items">${items}</div>
        </div>`;
    }).join("");

    $("#shoppingContent").innerHTML = toolbar + `
      <div class="info-section">
        ${state.shopFilter === "全部" ? `<div class="shop-note">${esc(SHOPPING_NOTE)}</div>` : ""}
        ${cards}
      </div>`;

    $$("#shopChips [data-shop-filter]").forEach(c => c.addEventListener("click", () => {
      state.shopFilter = c.dataset.shopFilter;
      renderShopping();
      window.scrollTo({ top: 0 });
    }));

    $$("#shoppingContent [data-shop]").forEach(cb => cb.addEventListener("change", () => {
      const s = JSON.parse(localStorage.getItem("trip-shopping") || "{}");
      s[cb.dataset.shop] = cb.checked;
      localStorage.setItem("trip-shopping", JSON.stringify(s));
      cb.closest(".check-item").classList.toggle("done", cb.checked);
      // 更新該商店的完成數
      const storeId = cb.dataset.shop.split("-")[0];
      const store = STORES.find(x => x.id === storeId);
      const done = store.items.filter((_, i) => s[`${storeId}-${i}`]).length;
      const badge = $(`#shoppingContent .shop-count[data-store="${storeId}"]`);
      if (badge) badge.textContent = `${done}/${store.items.length}`;
    }));
  }

  /* ---------- Tab 切換 ---------- */
  function setupTabs() {
    $$(".tab-item").forEach(tab => tab.addEventListener("click", () => {
      const view = tab.dataset.view;
      const y = showView(view);
      window.scrollTo({ top: y });
    }));
  }

  /* ---------- 倒數 ---------- */
  function renderCountdown() {
    const el = $("#tripCountdown");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(TRIP.startDate + "T00:00:00");
    const end = new Date(TRIP.endDate + "T23:59:59");
    const diff = Math.ceil((start - today) / 86400000);
    if (today >= start && today <= end) {
      const dayN = Math.floor((today - start) / 86400000) + 1;
      el.textContent = `旅程中 Day ${dayN} 🎉`;
      if (dayN >= 1 && dayN <= DAYS.length) state.day = dayN;
    } else if (diff > 0) {
      el.textContent = `出發倒數 ${diff} 天`;
    } else {
      el.textContent = "旅程回憶 📷";
    }
  }

  /* ---------- Service Worker（PWA 離線支援） ---------- */
  function registerSW() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch(() => {});
      });
    }
  }

  /* ---------- init ---------- */
  renderCountdown();
  renderDayTabs();
  renderDay();
  renderRegionChips();
  renderFood();
  setupSort();
  renderShopping();
  renderInfo();
  setupTabs();
  registerSW();
})();
