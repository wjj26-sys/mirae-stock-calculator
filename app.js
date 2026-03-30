const MAX_CARDS = 4;
const STORAGE_KEY = "mirae-mstock-calc-final-v4";

const $ = (id) => document.getElementById(id);

const defaultCard = () => ({
  name: "종목명",
  qty: "1",
  entryPrice: "1000",
  sellPrice: "1000",
  nowPrice: "1000",
  nowColor: "black",
});

const defaultState = () => ({
  deposit: "5000000",
  accountNo: "123-4567-8910-2",
  accountOwner: "홍길동",
  cards: [defaultCard()],
});

const state = defaultState();
let hasShownDepositAlert = false;

/* ---------------- utils ---------------- */
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return;

    state.deposit = data.deposit || defaultState().deposit;
    state.accountNo = data.accountNo || defaultState().accountNo;
    state.accountOwner = data.accountOwner || defaultState().accountOwner;
    state.cards = Array.isArray(data.cards) && data.cards.length
      ? data.cards.slice(0, MAX_CARDS)
      : [defaultCard()];
  } catch (e) {
    console.error("저장 데이터 로드 실패", e);
  }
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeDigits(value) {
  return String(value ?? "").replace(/[^0-9]/g, "");
}

function parseNumber(value) {
  const cleaned = sanitizeDigits(value);
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatInt(value) {
  return Math.round(value).toLocaleString("ko-KR");
}

function formatRate(value) {
  return Number(value).toFixed(2);
}

function formatAccountNo(value) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 12);
  const a = digits.slice(0, 3);
  const b = digits.slice(3, 7);
  const c = digits.slice(7, 11);
  const d = digits.slice(11, 12);

  let result = "";
  if (a) result += a;
  if (b) result += `-${b}`;
  if (c) result += `-${c}`;
  if (d) result += `-${d}`;
  return result;
}

function getSignColor(value) {
  const n = Number(value);
  if (n > 0) return "red";
  if (n < 0) return "blue";
  return "black";
}

function getDigitSrc(color, ch) {
  const base = `./assets/digits/${color}`;
  if (/[0-9]/.test(ch)) return `${base}/${ch}.png`;
  if (ch === ",") return `${base}/comma.png`;
  if (ch === ".") return `${base}/dot.png`;
  if (ch === "-" && color === "blue") return `${base}/minus.png`;
  return null;
}

function getCardSizeClass(text) {
  const str = String(text ?? "");

  // 마이너스 제거
  const clean = str.replace("-", "");
  const parts = clean.split(".");
  const integerPart = parts[0].replace(/,/g, "");
  const hasDot = parts.length > 1;

  // 1) 금액: 천만원(10,000,000) 이상이면 작게
  const intValue = Number(integerPart || "0");
  if (!hasDot && intValue >= 10000000) {
    return "size-xxxs";
  }

  // 2) 소수점: 앞자리 5개 초과면 작게
  // 예: 12345.67 까진 기본, 123456.78 부터 작게
  if (hasDot && integerPart.length > 5) {
    return "size-xxxs";
  }

  // 3) 보조 기준
  if (str.length >= 10) return "size-xxs";
  if (str.length >= 8) return "size-xs";
  if (str.length >= 7) return "size-sm";

  return "size-normal";
}

/* ---------------- calc ---------------- */
function calcCard(card) {
  const qty = parseNumber(card.qty);
  const entryPrice = parseNumber(card.entryPrice);
  const sellPrice = parseNumber(card.sellPrice);
  const nowPrice = parseNumber(card.nowPrice);

  const buyAmt = qty * entryPrice;   // 매입금액
  const evalAmt = qty * sellPrice;   // 평가금액
  const profit = evalAmt - buyAmt;   // 평가손익

  // 현재가는 계산에 안 넣음
  const rate = entryPrice !== 0
    ? ((sellPrice - entryPrice) / entryPrice) * 100
    : 0;

  return {
    name: card.name || "종목명",
    qtyLeft: String(qty),      // 주문가능
    qtyRight: String(qty),     // 보유수량
    buyAmt,
    evalAmt,
    profit,
    rate,
    sellPrice,                 // 아랫줄 매도가
    nowPrice,                  // 윗줄 현재가 (표시만)
    avgPrice: entryPrice,      // 평균단가 위치 = 진입가
  };
}

function calcSummary() {
  const cards = state.cards.map(calcCard);

  const buy = cards.reduce((sum, card) => sum + card.buyAmt, 0);
  const evalAmt = cards.reduce((sum, card) => sum + card.evalAmt, 0);
  const profit = evalAmt - buy;
  const rate = buy !== 0 ? (profit / buy) * 100 : 0;

  return { buy, evalAmt, profit, rate, cards };
}

/* ---------------- render digits ---------------- */
function createDigitImg(src, ch) {
  const img = document.createElement("img");
  img.src = src;
  img.alt = ch;
  img.draggable = false;
  img.dataset.char = ch;
  return img;
}

function renderDigitString(target, value, color) {
  if (!target) return;

  target.innerHTML = "";
  const text = String(value ?? "");
  if (!text) return;

  for (const ch of text) {
    const src = getDigitSrc(color, ch);
    if (!src) continue;
    target.appendChild(createDigitImg(src, ch));
  }
}

function renderCardDigitString(target, value, color) {
  if (!target) return;

  target.innerHTML = "";
  const text = String(value ?? "");
  if (!text) return;

  target.classList.remove("size-normal", "size-sm", "size-xs", "size-xxs", "size-xxxs");
  target.classList.add(getCardSizeClass(text));

  for (const ch of text) {
    const src = getDigitSrc(color, ch);
    if (!src) {
      console.log("없는 숫자:", ch, color);
      continue;
    }
    target.appendChild(createDigitImg(src, ch));
  }
}

/* ---------------- render screen ---------------- */
function renderSummary() {
  $("accountNoText").textContent = state.accountNo || "";
  $("accountNameText").textContent = state.accountOwner || "";

  const summary = calcSummary();

  renderDigitString($("sumBuy"), formatInt(summary.buy), "black");
  renderDigitString($("sumEval"), formatInt(summary.evalAmt), "black");

  const profitColor = getSignColor(summary.profit);
  const profitText = summary.profit < 0
    ? `-${formatInt(Math.abs(summary.profit))}`
    : formatInt(summary.profit);
  renderDigitString($("sumProfit"), profitText, profitColor);

  const rateColor = getSignColor(summary.rate);
  const rateText = summary.rate < 0
    ? `-${formatRate(Math.abs(summary.rate))}`
    : formatRate(summary.rate);
  renderDigitString($("sumRate"), rateText, rateColor);
}

function renderCards() {
  const layer = $("cardLayer");
  layer.innerHTML = "";

  const cards = calcSummary().cards;

  cards.forEach((card, index) => {
    const original = state.cards[index];

    const el = document.createElement("div");
    el.className = "stock-card";

    el.innerHTML = `
      <div class="card-name text-noise-md">${escapeHtml(card.name)}</div>

      <div class="qty-box qty-left" id="qty-left-${index}"></div>
      <div class="qty-box qty-right" id="qty-right-${index}"></div>

      <div class="card-num card-profit" id="profit-${index}"></div>
      <div class="card-num card-eval" id="eval-${index}"></div>
      <div class="card-num card-now" id="now-${index}"></div>

      <div class="card-num card-rate" id="rate-${index}"></div>
      <div class="card-num card-sell" id="sell-${index}"></div>
      <div class="card-num card-avg" id="avg-${index}"></div>
    `;

    layer.appendChild(el);

    renderDigitString(document.getElementById(`qty-left-${index}`), card.qtyLeft, "black");
    renderDigitString(document.getElementById(`qty-right-${index}`), card.qtyRight, "black");

    const profitColor = getSignColor(card.profit);
    const profitText = card.profit < 0
      ? `-${formatInt(Math.abs(card.profit))}`
      : formatInt(card.profit);
    renderDigitString(document.getElementById(`profit-${index}`), profitText, profitColor);

    const rateColor = getSignColor(card.rate);
    const rateText = card.rate < 0
      ? `-${formatRate(Math.abs(card.rate))}`
      : formatRate(card.rate);
    renderDigitString(document.getElementById(`rate-${index}`), rateText, rateColor);

    renderDigitString(document.getElementById(`eval-${index}`), formatInt(card.evalAmt), "black");
    renderDigitString(
      document.getElementById(`now-${index}`),
      formatInt(card.nowPrice),
      original.nowColor || "black"
    );
    renderDigitString(document.getElementById(`sell-${index}`), formatInt(card.sellPrice), "black");
    renderDigitString(document.getElementById(`avg-${index}`), formatInt(card.avgPrice), "black");
  });
}

function updateDepositStatus() {
  const box = $("depositStatus");
  const deposit = parseNumber(state.deposit);
  const need = state.cards.reduce((sum, card) => {
    return sum + (parseNumber(card.qty) * parseNumber(card.entryPrice));
  }, 0);

  if (need > deposit) {
    box.className = "deposit-status warn";
    box.textContent = `예수금 부족: 필요 ${formatInt(need)}원 / 보유 ${formatInt(deposit)}원`;
  } else {
    box.className = "deposit-status ok";
    box.textContent = `예수금 가능: 사용 ${formatInt(need)}원 / 잔여 ${formatInt(deposit - need)}원`;
  }
}

function maybeAlertDeposit() {
  const deposit = parseNumber(state.deposit);
  const need = state.cards.reduce((sum, card) => {
    return sum + (parseNumber(card.qty) * parseNumber(card.entryPrice));
  }, 0);

  const short = need > deposit;

  if (short && !hasShownDepositAlert) {
    hasShownDepositAlert = true;
    alert(`예수금이 부족합니다.\n필요금액: ${formatInt(need)}원\n보유예수금: ${formatInt(deposit)}원`);
  }

  if (!short) hasShownDepositAlert = false;
}

function syncViewOnly() {
  renderSummary();
  renderCards();
  updateDepositStatus();
}

/* ---------------- render editors ---------------- */
function renderEditors() {
  const box = $("editorList");
  box.innerHTML = "";

  state.cards.forEach((card, index) => {
    const wrap = document.createElement("div");
    wrap.className = "editor-card";
    wrap.innerHTML = `
      <div class="editor-head">
        <strong>카드 ${index + 1}</strong>
        <button class="small-btn delete" type="button" data-delete="${index}">삭제</button>
      </div>

      <div class="editor-grid">
        <div class="field full">
          <label>종목명</label>
          <input type="text" value="${escapeHtml(card.name || "")}" data-key="name" data-index="${index}" />
        </div>

        <div class="field">
          <label>보유수량</label>
          <input type="text" inputmode="numeric" value="${escapeHtml(card.qty || "")}" data-key="qty" data-index="${index}" />
        </div>

        <div class="field">
          <label>진입가</label>
          <input type="text" inputmode="numeric" value="${escapeHtml(card.entryPrice || "")}" data-key="entryPrice" data-index="${index}" />
        </div>

        <div class="field">
          <label>매도가</label>
          <input type="text" inputmode="numeric" value="${escapeHtml(card.sellPrice || "")}" data-key="sellPrice" data-index="${index}" />
        </div>

        <div class="field">
          <label>현재가</label>
          <input type="text" inputmode="numeric" value="${escapeHtml(card.nowPrice || "")}" data-key="nowPrice" data-index="${index}" />
        </div>

        <div class="field">
          <label>현재가 색상</label>
          <select data-key="nowColor" data-index="${index}">
            <option value="black" ${card.nowColor === "black" ? "selected" : ""}>black</option>
            <option value="red" ${card.nowColor === "red" ? "selected" : ""}>red</option>
            <option value="blue" ${card.nowColor === "blue" ? "selected" : ""}>blue</option>
          </select>
        </div>
      </div>

      <div class="help">평균단가 위치에는 진입가가 자동 표시됨</div>
    `;
    box.appendChild(wrap);
  });

  box.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.delete);
      if (state.cards.length === 1) {
        alert("카드는 최소 1개는 있어야 합니다.");
        return;
      }
      state.cards.splice(index, 1);
      renderEditors();
      syncViewOnly();
      saveState();
    });
  });

  box.querySelectorAll("input[data-key], select[data-key]").forEach((el) => {
    el.addEventListener("input", handleEditorInput);
    el.addEventListener("change", handleEditorInput);
  });
}

function handleEditorInput(e) {
  const index = Number(e.target.dataset.index);
  const key = e.target.dataset.key;
  if (!state.cards[index]) return;

  if (["qty", "entryPrice", "sellPrice", "nowPrice"].includes(key)) {
    e.target.value = sanitizeDigits(e.target.value);
  }

  state.cards[index][key] = e.target.value;

  syncViewOnly();
  maybeAlertDeposit();
  saveState();
}

/* ---------------- top controls ---------------- */
function bindTopControls() {
  $("depositInput").addEventListener("input", (e) => {
    e.target.value = sanitizeDigits(e.target.value);
    state.deposit = e.target.value;
    syncViewOnly();
    maybeAlertDeposit();
    saveState();
  });

  $("accountNoInput").addEventListener("input", (e) => {
    const formatted = formatAccountNo(e.target.value);
    e.target.value = formatted;
    state.accountNo = formatted;
    renderSummary();
    saveState();
  });

  $("accountNameInput").addEventListener("input", (e) => {
    state.accountOwner = e.target.value;
    renderSummary();
    saveState();
  });

  $("addCardBtn").addEventListener("click", () => {
    if (state.cards.length >= MAX_CARDS) {
      alert("카드는 최대 4개까지 가능합니다.");
      return;
    }
    state.cards.push(defaultCard());
    renderEditors();
    syncViewOnly();
    saveState();
  });

 $("downloadBtn").addEventListener("click", async () => {
   try {
     const screen = $("screen");

     // 👉 캡처 모드 ON
     screen.classList.add("capture-mode");

     const canvas = await html2canvas(screen, {
       backgroundColor: null,
       useCORS: true,
       scale: 4,
       width: 588,
       height: 1148,
       windowWidth: 588,
       windowHeight: 1148,
     });

     // 👉 캡처 모드 OFF
     screen.classList.remove("capture-mode");

     const link = document.createElement("a");
     link.download = `mirae-calc-${Date.now()}.png`;
     link.href = canvas.toDataURL("image/png");
     document.body.appendChild(link);
     link.click();
     link.remove();

   } catch (err) {
     console.error(err);
     $("screen").classList.remove("capture-mode");
     alert("이미지 저장에 실패했습니다.");
   }
 });

  $("resetBtn").addEventListener("click", () => {
    if (!confirm("정말 초기화할까요?")) return;

    localStorage.removeItem(STORAGE_KEY);
    const next = defaultState();

    state.deposit = next.deposit;
    state.accountNo = next.accountNo;
    state.accountOwner = next.accountOwner;
    state.cards = next.cards;
    hasShownDepositAlert = false;

    $("depositInput").value = state.deposit;
    $("accountNoInput").value = state.accountNo;
    $("accountNameInput").value = state.accountOwner;

    renderEditors();
    syncViewOnly();
  });
}

/* ---------------- init ---------------- */
function init() {
  loadState();

  state.accountNo = formatAccountNo(state.accountNo);

  $("depositInput").value = state.deposit;
  $("accountNoInput").value = state.accountNo;
  $("accountNameInput").value = state.accountOwner;

  bindTopControls();
  renderEditors();
  syncViewOnly();
}

init();