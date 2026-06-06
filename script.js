const MAX_NUMBER = 45;
const MAIN_NUMBER_COUNT = 6;
const HISTORY_LIMIT = 8;
const MAX_CANVAS_DPR = 2;

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
    clearBtn
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
  return [...new Set(raw)].filter((num) => num >= 1 && num <= MAX_NUMBER).slice(0, MAIN_NUMBER_COUNT);
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
  const main = [...fixed, ...randomUniqueNumbers(MAIN_NUMBER_COUNT - fixed.length, fixed)]
    .sort((a, b) => a - b);
  const bonus = includeBonusInput?.checked ? randomUniqueNumbers(1, main)[0] : null;
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
          ${entry.lines.join("<br>")}
        </li>
      `
    )
    .join("");
}

function generateTickets() {
  const count = Number(setCountInput.value);
  tickets = Array.from({ length: count }, createTicket);
  drawCount += count;
  drawCountEl.textContent = drawCount;
  statusText.textContent = `${count}게임 생성됨`;
  renderTickets();

  history.unshift({
    time: new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date()),
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
  resultGrid.innerHTML = "";
  historyList.innerHTML = "";
  drawCountEl.textContent = "0";
  statusText.textContent = "초기화됨";
}

if (hasGenerator) {
  generateBtn.addEventListener("click", generateTickets);
  copyBtn.addEventListener("click", copyTickets);
  clearBtn.addEventListener("click", clearTickets);
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
