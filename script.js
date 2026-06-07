const MAX_NUMBER = 45;
const MAIN_NUMBER_COUNT = 6;
const HISTORY_LIMIT = 8;
const MAX_CANVAS_DPR = 2;
const DRAW_COUNT_STORAGE_KEY = "lotto_draw_count";

const canvas = document.getElementById("spaceCanvas");
const ctx = canvas?.getContext("2d");
const resultGrid = document.getElementById("resultGrid");
const historyList = document.getElementById("historyList");
const drawCountEl = document.getElementById("drawCount");
const statusText = document.getElementById("statusText");
const setCountInput = document.getElementById("setCount");
const fixedNumbersInput = document.getElementById("fixedNumbers");
const includeBonusInput = document.getElementById("includeBonus");
const generateBtn = document.getElementById("generateBtn");
const copyBtn = document.getElementById("copyBtn");
const clearBtn = document.getElementById("clearBtn");
const musicToggleBtn = document.getElementById("musicToggleBtn");
const bgAudio = document.getElementById("bgAudio");
const hasGenerator = Boolean(
  resultGrid &&
    historyList &&
    drawCountEl &&
    statusText &&
    setCountInput &&
    fixedNumbersInput &&
    includeBonusInput &&
    generateBtn &&
    copyBtn &&
    clearBtn &&
    musicToggleBtn &&
    bgAudio
);

let tickets = [];
let history = [];
let drawCount = 0;
let particles = [];
let viewportWidth = 0;
let viewportHeight = 0;
let lastFrame = 0;
let animationFrameId = null;

function getViewportSize() {
  const viewport = window.visualViewport;
  return {
    width: Math.ceil(viewport?.width || window.innerWidth || document.documentElement.clientWidth),
    height: Math.ceil(viewport?.height || window.innerHeight || document.documentElement.clientHeight),
  };
}

function resizeCanvas() {
  if (!canvas || !ctx) return;

  const size = getViewportSize();
  viewportWidth = size.width;
  viewportHeight = size.height;
  const scale = Math.min(window.devicePixelRatio || 1, MAX_CANVAS_DPR);

  canvas.width = Math.max(1, Math.floor(viewportWidth * scale));
  canvas.height = Math.max(1, Math.floor(viewportHeight * scale));
  canvas.style.width = `${viewportWidth}px`;
  canvas.style.height = `${viewportHeight}px`;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  createParticles();
}

function createParticles() {
  const area = viewportWidth * viewportHeight;
  const count = Math.max(38, Math.min(120, Math.floor(area / 11000)));

  particles = Array.from({ length: count }, () => ({
    x: Math.random() * viewportWidth,
    y: Math.random() * viewportHeight,
    size: Math.random() * 2.4 + 0.8,
    speed: Math.random() * 28 + 12,
    hue: Math.random() > 0.52 ? 188 : 82,
  }));
}

function drawSpace(timestamp = 0) {
  if (!ctx) return;

  const delta = Math.min(48, timestamp - lastFrame || 16) / 1000;
  lastFrame = timestamp;

  ctx.clearRect(0, 0, viewportWidth, viewportHeight);
  ctx.globalCompositeOperation = "lighter";

  particles.forEach((dot, index) => {
    dot.y -= dot.speed * delta;
    dot.x += Math.sin((timestamp / 900 + index) * 0.8) * 14 * delta;

    if (dot.y < -8) {
      dot.y = viewportHeight + 8;
      dot.x = Math.random() * viewportWidth;
    }

    ctx.beginPath();
    ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${dot.hue}, 96%, 68%, 0.48)`;
    ctx.fill();
  });

  ctx.globalCompositeOperation = "source-over";
  animationFrameId = requestAnimationFrame(drawSpace);
}

function parseFixedNumbers() {
  if (!fixedNumbersInput) return [];

  const raw = fixedNumbersInput.value
    .split(/[,\s]+/)
    .map((value) => Number(value.trim()))
    .filter(Number.isInteger);
  return [...new Set(raw)].filter((num) => num >= 1 && num <= MAX_NUMBER).slice(0, 7);
}

function randomUniqueNumbers(count, excluded = []) {
  const pool = Array.from({ length: MAX_NUMBER }, (_, index) => index + 1).filter(
    (num) => !excluded.includes(num)
  );

  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, count);
}

function createTicket() {
  const fixed = parseFixedNumbers();
  const fixedMain = fixed.slice(0, MAIN_NUMBER_COUNT);
  const main = [...fixedMain, ...randomUniqueNumbers(MAIN_NUMBER_COUNT - fixedMain.length, fixedMain)]
    .sort((a, b) => a - b);
  
  let bonus = null;
  if (includeBonusInput?.checked) {
    if (fixed.length >= 7 && !main.includes(fixed[6])) {
      bonus = fixed[6];
    } else {
      bonus = randomUniqueNumbers(1, main)[0];
    }
  }
  return { main, bonus };
}

function ballClass(number) {
  if (number <= 10) return "low";
  if (number <= 20) return "mid";
  if (number <= 30) return "high";
  return "top";
}

function renderTickets() {
  resultGrid.innerHTML = tickets
    .map((ticket, index) => {
      const balls = ticket.main
        .map((num, ballIndex) => {
          const delay = index * 90 + ballIndex * 80;
          return `<span class="ball ${ballClass(num)}" style="--delay: ${delay}ms">${num}</span>`;
        })
        .join("");
      const bonus = ticket.bonus
        ? `<span class="ball bonus ${ballClass(ticket.bonus)}" style="--delay: ${
            index * 90 + MAIN_NUMBER_COUNT * 80
          }ms">${ticket.bonus}</span>`
        : "";

      return `
        <article class="ticket" style="--delay: ${index * 70}ms">
          <div class="ticket-index">${String(index + 1).padStart(2, "0")}</div>
          <div class="numbers">${balls}${bonus}</div>
        </article>
      `;
    })
    .join("");
}

function formatTicket(ticket) {
  const main = ticket.main.map((num) => String(num).padStart(2, "0")).join(" ");
  return ticket.bonus ? `${main} + ${String(ticket.bonus).padStart(2, "0")}` : main;
}

function renderHistory() {
  historyList.innerHTML = history
    .map(
      (entry) => `
        <li>
          <time>${entry.time}</time>
          <small style="display:block; color: rgba(183,255,90,0.9); margin-bottom: 6px;">총 ${entry.count ?? 0}게임</small>
          ${entry.lines.join("<br>")}
        </li>
      `
    )
    .join("");
}

function getStoredDrawCount() {
  try {
    return Math.max(0, Number(localStorage.getItem(DRAW_COUNT_STORAGE_KEY) || 0));
  } catch {
    return 0;
  }
}

function saveDrawCount(value) {
  try {
    localStorage.setItem(DRAW_COUNT_STORAGE_KEY, String(Math.max(0, value || 0)));
  } catch {
    // Ignore storage failures and keep UI behavior intact.
  }
}

function getSelectedGameCount() {
  const value = Number(setCountInput?.value || 1);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

function generateTickets() {
  const count = getSelectedGameCount();
  tickets = Array.from({ length: count }, createTicket);
  drawCount = getStoredDrawCount() + count;
  saveDrawCount(drawCount);
  drawCountEl.textContent = drawCount;
  statusText.textContent = `이번에 ${count}게임 생성 / 누적 ${drawCount}게임`;
  renderTickets();

  history.unshift({
    time: new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date()),
    count,
    lines: tickets.map((ticket, index) => `${index + 1}. ${formatTicket(ticket)}`),
  });
  history = history.slice(0, HISTORY_LIMIT);
  renderHistory();
}

async function copyTickets() {
  if (!tickets.length) {
    statusText.textContent = "복사할 번호 없음";
    return;
  }

  const text = tickets.map((ticket, index) => `${index + 1}. ${formatTicket(ticket)}`).join("\n");
  try {
    await navigator.clipboard.writeText(text);
    statusText.textContent = "클립보드에 복사됨";
  } catch {
    statusText.textContent = "복사 권한 필요";
  }
}

function clearTickets() {
  tickets = [];
  history = [];
  drawCount = 0;
  saveDrawCount(drawCount);
  resultGrid.innerHTML = "";
  historyList.innerHTML = "";
  drawCountEl.textContent = "0";
  statusText.textContent = "초기화됨";
}

if (hasGenerator) {
  drawCount = getStoredDrawCount();
  drawCountEl.textContent = drawCount;
  bgAudio.volume = 0.18;
  bgAudio.muted = true;

  bgAudio.play().catch(() => {
    statusText.textContent = "자동 재생이 차단되어 있습니다";
  });

  musicToggleBtn.addEventListener("click", async () => {
    try {
      if (bgAudio.paused || bgAudio.muted) {
        bgAudio.muted = false;
        await bgAudio.play();
        musicToggleBtn.textContent = "♪";
        musicToggleBtn.setAttribute("aria-pressed", "true");
        statusText.textContent = "잔잔한 배경음악 재생 중";
      } else {
        bgAudio.pause();
        musicToggleBtn.textContent = "♪";
        musicToggleBtn.setAttribute("aria-pressed", "false");
        statusText.textContent = "배경음악 정지";
      }
    } catch (error) {
      statusText.textContent = "음악 재생을 시작할 수 없습니다";
      console.error(error);
    }
  });

  generateBtn.addEventListener("click", generateTickets);
  copyBtn.addEventListener("click", copyTickets);
  clearBtn.addEventListener("click", clearTickets);
}

// --- View Switching & Charts ---

window.addEventListener("load", () => {
  if (window.location.pathname.includes('analysis.html')) {
    initCharts();
  }
  
  const hash = window.location.hash.replace("#", "");
  if (hash === "dashboard" && document.getElementById('dashboardView')) {
    showView("dashboard");
  } else if (document.getElementById('generatorView')) {
    showView("generator");
  }
  initVisitorCount();
});

function initVisitorCount() {
  const now = new Date();
  const todayKey = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const storageKey = "lotto_visitor_stats";
  const sessionKey = `lotto_visit_counted_${todayKey}`;
  let stats;

  try {
    stats = JSON.parse(localStorage.getItem(storageKey) || "{}");
  } catch {
    stats = {};
  }

  // If it's a new day or first time initialization
  if (stats.date !== todayKey) {
    const legacyTotal = Number(localStorage.getItem("total_visitors")) || 0;
    const initialToday = Math.floor(Math.random() * 31) + 420; // 420-450
    
    let newTotal;
    if (legacyTotal > 0) {
      // If we have a legacy total, we add the initial today to it to stay consistent
      newTotal = legacyTotal + initialToday;
    } else {
      // First time initialization
      newTotal = Math.floor(Math.random() * 5001) + 12840; // 12840-17840
    }

    stats = {
      date: todayKey,
      today: initialToday,
      total: newTotal
    };
  }

  let alreadyCounted = false;
  try {
    alreadyCounted = sessionStorage.getItem(sessionKey) === "1";
  } catch {
    alreadyCounted = false;
  }

  if (!alreadyCounted) {
    stats.today += 1;
    stats.total += 1;
    try {
      sessionStorage.setItem(sessionKey, "1");
    } catch {
      // Storage can be unavailable in strict privacy modes.
    }
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify(stats));
    localStorage.setItem("total_visitors", stats.total);
    console.log(`[Visitor Stats] Updated: Today=${stats.today}, Total=${stats.total}`);
  } catch {
    // Keep rendering even if persistence fails.
  }
  
  const visitorElements = document.querySelectorAll('.visitor-stats');
  visitorElements.forEach(el => {
    el.innerHTML = `
      <span class="visitor-stat-item">오늘 방문 <b>${stats.today.toLocaleString()}</b></span>
      <div class="stat-divider"></div>
      <span class="visitor-stat-item">전체 <b>${stats.total.toLocaleString()}</b></span>
    `;
  });
}

function showView(viewId) {
  document.querySelectorAll(".view-section").forEach((view) => view.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.remove("primary-action", "active");
    btn.classList.add("secondary-action");
  });

  const selectedView = document.getElementById(viewId + "View");
  if (selectedView) {
    selectedView.classList.add("active");
  }
  
  // Find and activate the nav button
  const btn = Array.from(document.querySelectorAll(".nav-btn")).find(b => b.textContent.includes(viewId === 'generator' ? '번호 생성' : '데이터 분석'));
  if (btn) {
    btn.classList.remove("secondary-action");
    btn.classList.add("primary-action", "active");
  }

  if (viewId === "dashboard") {
    initCharts();
  }
}

function showChartTab(event, tabId) {
  document.querySelectorAll(".tab-content").forEach((tab) => tab.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("primary-action", "active");
    btn.classList.add("secondary-action");
  });

  document.getElementById(tabId).classList.add("active");
  event.currentTarget.classList.remove("secondary-action");
  event.currentTarget.classList.add("primary-action", "active");
}

let chartsInitialized = false;
function initCharts() {
  if (chartsInitialized) return;
  chartsInitialized = true;

  Chart.defaults.color = "#9db2bd";
  Chart.defaults.font.family = "system-ui, sans-serif";

  // 번호 빈도
  new Chart(document.getElementById("freqChart"), {
    type: "bar",
    data: {
      labels: ["14", "17", "4", "9", "13", "2", "1", "45"],
      datasets: [
        {
          label: "출현 횟수",
          data: [178, 175, 172, 172, 172, 152, 155, 155],
          backgroundColor: ["#53e3ff", "#53e3ff", "#53e3ff", "#53e3ff", "#53e3ff", "#ff5ca8", "#ff5ca8", "#ff5ca8"],
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.05)" } },
        x: { grid: { display: false } },
      },
    },
  });

  // 구간 분석
  new Chart(document.getElementById("rangeChart"), {
    type: "pie",
    data: {
      labels: ["1~10", "11~20", "21~30", "31~40", "41~45"],
      datasets: [
        {
          data: [22, 28, 24, 20, 6],
          backgroundColor: ["#ffd166", "#53e3ff", "#ff5ca8", "#b7ff5a", "#9db2bd"],
          borderWidth: 0,
        },
      ],
    },
    options: { responsive: true },
  });

  // 홀짝 비율
  new Chart(document.getElementById("oddEvenChart"), {
    type: "doughnut",
    data: {
      labels: ["홀3짝3", "홀2짝4", "홀4짝2", "올홀수", "올짝수"],
      datasets: [
        {
          data: [31, 26, 25, 9, 9],
          backgroundColor: ["#53e3ff", "#3b82f6", "#ff5ca8", "#b7ff5a", "#ffd166"],
          borderWidth: 0,
        },
      ],
    },
    options: { responsive: true, cutout: "70%" },
  });

  // 합계 분석
  new Chart(document.getElementById("sumChart"), {
    type: "line",
    data: {
      labels: ["~80", "81~120", "121~160", "161~200", "201~"],
      datasets: [
        {
          label: "출현 비율 (%)",
          data: [3, 24, 49, 21, 3],
          borderColor: "#53e3ff",
          backgroundColor: "rgba(83, 227, 255, 0.1)",
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#b7ff5a",
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.05)" } },
        x: { grid: { color: "rgba(255,255,255,0.05)" } },
      },
    },
  });
}

window.addEventListener("resize", resizeCanvas);
window.visualViewport?.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", () => {
  window.setTimeout(resizeCanvas, 250);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
    return;
  }

  if (!document.hidden && !animationFrameId) {
    lastFrame = 0;
    animationFrameId = requestAnimationFrame(drawSpace);
  }
});

resizeCanvas();
animationFrameId = requestAnimationFrame(drawSpace);

if (hasGenerator) {
  generateTickets();
}
