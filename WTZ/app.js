/* World Time Zones v1.8.3 (same logic as v1.8.2; only CSS hides custom TZ button) */
(() => {
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const CITY_TZ = {
    "New York, USA": "America/New_York",
    "Los Angeles, USA": "America/Los_Angeles",
    "Chicago, USA": "America/Chicago",
    "Denver, USA": "America/Denver",
    "Toronto, Canada": "America/Toronto",
    "Vancouver, Canada": "America/Vancouver",
    "Mexico City, Mexico": "America/Mexico_City",

    "London, UK": "Europe/London",
    "Dublin, Ireland": "Europe/Dublin",
    "Lisbon, Portugal": "Europe/Lisbon",
    "Madrid, Spain": "Europe/Madrid",
    "Paris, France": "Europe/Paris",
    "Berlin, Germany": "Europe/Berlin",
    "Rome, Italy": "Europe/Rome",
    "Zurich, Switzerland": "Europe/Zurich",
    "Stockholm, Sweden": "Europe/Stockholm",
    "Oslo, Norway": "Europe/Oslo",
    "Copenhagen, Denmark": "Europe/Copenhagen",
    "Warsaw, Poland": "Europe/Warsaw",
    "Bucharest, Romania": "Europe/Bucharest",
    "Athens, Greece": "Europe/Athens",
    "Helsinki, Finland": "Europe/Helsinki",
    "Istanbul, Türkiye": "Europe/Istanbul",
    "Moscow, Russia": "Europe/Moscow",

    "Dubai, UAE": "Asia/Dubai",
    "Tel Aviv, Israel": "Asia/Jerusalem",
    "Riyadh, Saudi Arabia": "Asia/Riyadh",
    "Tehran, Iran": "Asia/Tehran",
    "Karachi, Pakistan": "Asia/Karachi",
    "Mumbai, India": "Asia/Kolkata",
    "New Delhi, India": "Asia/Kolkata",
    "Dhaka, Bangladesh": "Asia/Dhaka",
    "Bangkok, Thailand": "Asia/Bangkok",
    "Jakarta, Indonesia": "Asia/Jakarta",
    "Singapore, Singapore": "Asia/Singapore",
    "Kuala Lumpur, Malaysia": "Asia/Kuala_Lumpur",
    "Hong Kong, China": "Asia/Hong_Kong",
    "Taipei, Taiwan": "Asia/Taipei",
    "Seoul, South Korea": "Asia/Seoul",
    "Tokyo, Japan": "Asia/Tokyo",
    "Shanghai, China": "Asia/Shanghai",
    "Beijing, China": "Asia/Shanghai",

    "Sydney, Australia": "Australia/Sydney",
    "Melbourne, Australia": "Australia/Melbourne",
    "Perth, Australia": "Australia/Perth",
    "Auckland, New Zealand": "Pacific/Auckland",

    "Johannesburg, South Africa": "Africa/Johannesburg",
    "Cairo, Egypt": "Africa/Cairo",
    "Nairobi, Kenya": "Africa/Nairobi",

    "Sao Paulo, Brazil": "America/Sao_Paulo",
    "Buenos Aires, Argentina": "America/Argentina/Buenos_Aires",
    "Santiago, Chile": "America/Santiago",

    "Honolulu, USA": "Pacific/Honolulu",
    "Anchorage, USA": "America/Anchorage",
    "Phoenix, USA": "America/Phoenix",
    "Reykjavik, Iceland": "Atlantic/Reykjavik"
  };

  // DOM
  const grid = $("#timeGrid");
  const rowTemplate = $("#rowTemplate");
  const datePicker = $("#datePicker");
  const todayBtn = $("#resetDateBtn");
  const addCityForm = $("#addCityForm");
  const cityInput = $("#cityInput");
  const cityList = $("#cityList");
  const timeFormatSelect = $("#timeFormatSelect");
  const themeSelect = $("#themeSelect");
  const customTzBtn = $("#customTzBtn");

  // Storage
  const STORAGE_KEY = "wtb_lite_state";
  const storage = {
    get() {
      try { const s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s); } catch(e) {}
      const match = document.cookie.match(new RegExp('(^| )' + STORAGE_KEY + '=([^;]+)'));
      if (match) { try { return JSON.parse(decodeURIComponent(match[2])); } catch(e){} }
      return null;
    },
    set(obj) {
      const s = JSON.stringify(obj);
      try { localStorage.setItem(STORAGE_KEY, s); }
      catch(e) {
        const d = new Date(); d.setTime(d.getTime() + 365*24*60*60*1000);
        document.cookie = STORAGE_KEY + '=' + encodeURIComponent(s) + ';expires=' + d.toUTCString() + ';path=/';
      }
    }
  };

  // State
  let state = {
    dateISO: toISODate(new Date()),
    rows: [],
    timeFormat: "24",
    theme: 0,
    focusHour: new Date().getHours()
  };

  function persist() {
    storage.set({ version: window.__APP_VERSION__, ...state });
  }
  function loadPersisted() {
    const obj = storage.get();
    if (!obj) return;
    state = { ...state, ...obj };
  }

  function toISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  function applyTheme(index) {
    document.documentElement.setAttribute("data-theme", String(index));
  }

  function labelForRowSub(dateISO, tz) {
    const dt = makeZoned(dateISO, 12, tz);
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset', year:'numeric', month:'short', day:'2-digit' }).formatToParts(dt);
    const tzName = parts.find(p => p.type === 'timeZoneName')?.value ?? '';
    const dateStr = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: tz }).format(dt);
    return `${dateStr} • ${tzName}`;
  }

  function makeZoned(dateISO, hour, tz) {
    const [y,m,d] = dateISO.split("-").map(Number);
    return new Date(Date.UTC(y, m-1, d, hour, 0, 0));
  }

  function formatCell(dateISO, hour, tz) {
    const dt = makeZoned(dateISO, hour, tz);
    const dateStr = new Intl.DateTimeFormat(undefined, { month:'short', day:'2-digit', timeZone: tz }).format(dt);
    const timeFmt = state.timeFormat === "12"
      ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute:'2-digit', hour12: true, timeZone: tz })
      : new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute:'2-digit', hour12: false, timeZone: tz });
    const timeStr = timeFmt.format(dt);
    return { dateStr, timeStr };
  }

  function getCellWidth() {
    const firstRow = $(".row", grid);
    if (!firstRow) return 50;
    const tl = $(".timeline", firstRow);
    return Math.round(tl.scrollWidth / 24);
  }

  function updateFocusBar() {
    const bar = $(".focus-bar", grid) || (() => {
      const el = document.createElement("div");
      el.className = "focus-bar";
      grid.appendChild(el);
      return el;
    })();

    const firstRow = $(".row", grid);
    if (!firstRow) return;
    const tl = $(".timeline", firstRow);
    const tlRect = tl.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    const cellW = getCellWidth();
    const leftWithinGrid = (tlRect.left - gridRect.left) + state.focusHour * cellW;
    bar.style.left = `${leftWithinGrid}px`;
    bar.style.width = `${cellW}px`;
  }

  function render() {
    datePicker.value = state.dateISO;
    timeFormatSelect.value = state.timeFormat;
    themeSelect.value = String(state.theme);
    applyTheme(state.theme);

    grid.innerHTML = "";
    state.rows.forEach((row, idx) => {
      const node = rowTemplate.content.firstElementChild.cloneNode(true);
      $(".city-name", node).textContent = row.city;
      $(".city-sub", node).textContent = labelForRowSub(state.dateISO, row.tz);
      const tl = $(".timeline", node);

      for (let h=0; h<24; h++) {
        const hourEl = document.createElement("div");
        hourEl.className = "hour";

        const dLabel = document.createElement("div");
        dLabel.className = "date";
        const tLabel = document.createElement("div");
        tLabel.className = "time";

        const { dateStr, timeStr } = formatCell(state.dateISO, h, row.tz);
        dLabel.textContent = dateStr;
        tLabel.textContent = timeStr;

        hourEl.appendChild(dLabel);
        hourEl.appendChild(tLabel);
        tl.appendChild(hourEl);
      }

      // Mouse-driven focus
      tl.addEventListener("mousemove", (e) => {
        const rect = tl.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const col = Math.min(23, Math.max(0, Math.floor((x / rect.width) * 24)));
        if (col !== state.focusHour) {
          state.focusHour = col;
          updateFocusBar();
          debouncedPersist();
        }
      });
      tl.addEventListener("click", persist);

      $(".remove-row", node).addEventListener("click", () => {
        state.rows.splice(idx,1);
        persist();
        render();
      });

      grid.appendChild(node);
    });

    updateFocusBar();
  }

  let persistTimer = null;
  function debouncedPersist() { clearTimeout(persistTimer); persistTimer = setTimeout(persist, 500); }

  // smart city completion + tz detection
  let debounceTimer = null;
  let smartCache = new Map();
  function debounce(fn, ms){ return (...a)=>{ clearTimeout(debounceTimer); debounceTimer=setTimeout(()=>fn(...a), ms); }; }

  const smartSearch = debounce(async function(query) {
    if (!query || query.length < 2) { refreshCityDatalist([], query); return; }
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&q=${encodeURIComponent(query)}`;
      const resp = await fetch(url, { headers: { "Accept":"application/json" }});
      if (!resp.ok) throw new Error("geocode failed");
      const data = await resp.json();
      const suggestions = data.map(item => {
          const addr = item.address || {};
          const name = addr.city || addr.town || addr.village || addr.hamlet || addr.municipality || addr.county || item.display_name.split(",")[0];
          const region = addr.state || addr.region || addr.county || addr.province || "";
          const country = addr.country || "";
          const label = [name, region, country].filter(Boolean).join(", ");
          return { label, lat: parseFloat(item.lat), lon: parseFloat(item.lon) };
        })
        .filter((s, i, arr) => arr.findIndex(t => t.label.toLowerCase() == s.label.toLowerCase()) == i);
      refreshCityDatalist(suggestions, query);
    } catch(e) {
      refreshCityDatalist([], query);
    }
  }, 300);

  async function lookupTimezone(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m&timezone=auto`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("tz fetch failed");
    const data = await resp.json();
    if (!data.timezone) throw new Error("no timezone");
    return data.timezone;
  }

  function refreshCityDatalist(suggestions = [], queryValue = "") {
    cityList.innerHTML = "";
    const builtins = Object.keys(CITY_TZ).sort().map(city => ({ label: city, builtin: true }));
    const merged = [...builtins];

    for (const s of suggestions) {
      if (!builtins.find(b => b.label.toLowerCase() === s.label.toLowerCase())) {
        merged.push({ label: s.label, lat: s.lat, lon: s.lon, builtin: false });
      }
    }

    merged.forEach(entry => {
      const opt = document.createElement("option");
      opt.value = entry.label;
      if (entry.builtin) opt.label = CITY_TZ[entry.label];
      cityList.appendChild(opt);
    });

    if (queryValue && !merged.find(e => e.label.toLowerCase() === queryValue.toLowerCase())) {
      const direct = document.createElement("option");
      direct.value = queryValue;
      cityList.appendChild(direct);
    }

    smartCache = new Map();
    for (const s of suggestions) smartCache.set(s.label.toLowerCase(), s);
  }

  async function addCitySmart(name) {
    if (CITY_TZ[name]) { pushCity({ city: name, tz: CITY_TZ[name] }); return; }

    let sug = smartCache.get(name.toLowerCase());
    if (!sug) {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(name)}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data && data[0]) {
          sug = { label: name, lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        }
      } catch(e) {}
    }
    if (!sug) { alert("City not found. Try adding with a custom time zone."); return; }

    try {
      const tz = await lookupTimezone(sug.lat, sug.lon);
      pushCity({ city: name, tz });
    } catch(e) {
      alert("Found the city but couldn't determine time zone automatically. Add with custom time zone instead.");
    }
  }

  function pushCity(entry) {
    if (state.rows.some(r => r.city.toLowerCase() === entry.city.toLowerCase())) return;
    state.rows.push(entry);
    persist();
    render();
  }

  // Events
  addCityForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = cityInput.value.trim();
    if (!value) return;
    addCitySmart(value);
    cityInput.value = "";
  });

  cityInput.addEventListener("change", () => {
    const value = cityInput.value.trim();
    if (!value) return;
    addCitySmart(value);
    cityInput.value = "";
  });

  cityInput.addEventListener("input", () => {
    smartSearch(cityInput.value.trim());
  });

  cityInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = cityInput.value.trim();
      if (value) {
        addCitySmart(value);
        cityInput.value = "";
      }
    }
  });

  customTzBtn?.addEventListener("click", () => {
    const city = prompt("City display name (e.g., San Francisco, USA):");
    if (!city) return;
    const tz = prompt("Enter IANA time zone (e.g., America/Los_Angeles). Tip: check https://en.wikipedia.org/wiki/List_of_tz_database_time_zones");
    if (!tz) return;
    try { new Intl.DateTimeFormat(undefined, { timeZone: tz }).format(new Date()); }
    catch(e) { alert("That doesn't look like a valid IANA time zone."); return; }
    pushCity({ city, tz });
  });

  datePicker.addEventListener("change", () => {
    state.dateISO = datePicker.value || toISODate(new Date());
    persist();
    render();
  });

  todayBtn.addEventListener("click", () => {
    state.dateISO = toISODate(new Date());
    persist();
    render();
  });

  timeFormatSelect.addEventListener("change", () => {
    state.timeFormat = timeFormatSelect.value;
    persist();
    render();
  });

  themeSelect.addEventListener("change", () => {
    state.theme = parseInt(themeSelect.value, 10);
    applyTheme(state.theme);
    persist();
  });

  function init() {
    loadPersisted();
    refreshCityDatalist();
    applyTheme(state.theme);

    if (state.rows.length === 0) {
      state.rows = [
        { city: "Bucharest, Romania", tz: "Europe/Bucharest" },
        { city: "London, UK", tz: "Europe/London" },
        { city: "New York, USA", tz: "America/New_York" },
        { city: "Tokyo, Japan", tz: "Asia/Tokyo" }
      ];
    }

    render();

    window.addEventListener("resize", () => {
      updateFocusBar();
    });
  }

  init();
})();
