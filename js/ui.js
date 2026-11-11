/* MOKUJO 木序 P2 — UI helpers, router, chrome. No ES modules. */
var MokujoUI = {
  draft: {},
  query: {},
  timer: null,
  expireTimer: null
};

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function moneySim(fen) {
  return '<span class="price">' + esc(MokujoEngine.moneyLabel(fen)) + '</span><span class="tag-sim">模拟</span>';
}

function statusBadge(st) {
  return '<span class="status status-' + esc(st) + '">' + esc(st) + "</span>";
}

function toast(msg) {
  var wrap = document.getElementById("toast-wrap");
  if (!wrap) return;
  wrap.innerHTML = '<div class="toast">' + esc(msg) + "</div>";
  setTimeout(function () {
    if (wrap.firstChild) wrap.innerHTML = "";
  }, 2800);
}

function closeModal() {
  var m = document.getElementById("modal-root");
  if (m) m.innerHTML = "";
}

function showModal(opts) {
  var root = document.getElementById("modal-root");
  var body = opts.bodyHtml || "<p>" + esc(opts.text || "") + "</p>";
  root.innerHTML =
    '<div class="modal-mask" data-act="close-modal"><div class="modal" data-stop="1">' +
    (opts.title ? "<h3>" + esc(opts.title) + "</h3>" : "") +
    body +
    '<div class="btn-row">' +
    (opts.showCancel !== false ? '<button class="btn-ghost" type="button" data-act="close-modal">取消</button>' : "") +
    '<button class="btn" type="button" data-act="modal-ok">' + esc(opts.okText || "确定") + "</button>" +
    "</div></div></div>";
  return new Promise(function (resolve) {
    function done(val) {
      if (root._settled) return;
      root._settled = true;
      closeModal();
      resolve(val);
    }
    root.querySelector('[data-act="modal-ok"]').onclick = function (e) {
      e.stopPropagation();
      var val = true;
      var input = root.querySelector("[data-modal-input]");
      if (input) val = input.value;
      done(val);
    };
    root.querySelectorAll('[data-act="close-modal"]').forEach(function (el) {
      el.addEventListener("click", function (e) {
        if (el.classList.contains("modal-mask") && e.target !== el) return;
        e.stopPropagation();
        done(false);
      });
    });
  });
}

function confirmBox(title, text, okText) {
  return showModal({ title: title, text: text, okText: okText || "确定" });
}

function promptBox(title, text, def, okText) {
  return showModal({
    title: title,
    bodyHtml: "<p>" + esc(text) + '</p><textarea class="input" data-modal-input>' + esc(def || "") + "</textarea>",
    okText: okText || "确定"
  });
}

function go(path) {
  if (path.charAt(0) !== "#") path = "#/" + path.replace(/^\//, "");
  location.hash = path;
}

function currentRolePrefix(role) {
  if (role === "staff") return "s";
  if (role === "owner") return "o";
  return "c";
}

function parseRoute() {
  var h = (location.hash || "").replace(/^#\/?/, "");
  if (!h) h = "c/home";
  var parts = h.split("/").filter(Boolean);
  return { role: parts[0] || "c", name: parts[1] || "home", id: parts[2] || "", extra: parts.slice(3), parts: parts, hash: "#/" + parts.join("/") };
}

function navItems(role) {
  if (role === "staff") {
    return [
      { no: "01", label: "今日", path: "#/s/today" },
      { no: "02", label: "顾客", path: "#/s/customers" },
      { no: "03", label: "排班", path: "#/s/schedule" },
      { no: "04", label: "我的", path: "#/s/mine" }
    ];
  }
  if (role === "owner") {
    return [
      { no: "01", label: "看板", path: "#/o/dashboard" },
      { no: "02", label: "预约", path: "#/o/appointments" },
      { no: "03", label: "经营", path: "#/o/ops" },
      { no: "04", label: "设置", path: "#/o/settings" }
    ];
  }
  return [
    { no: "01", label: "首页", path: "#/c/home" },
    { no: "02", label: "预约", path: "#/c/appointments" },
    { no: "03", label: "会员", path: "#/c/member" },
    { no: "04", label: "我的", path: "#/c/mine" }
  ];
}

function tabbarHtml(role, route) {
  var items = navItems(role);
  return items.map(function (it) {
    var active = route.hash === it.path || (it.path.split("/")[2] && route.name === it.path.split("/")[2]);
    /* more precise: first two segments */
    var segs = it.path.replace("#/", "").split("/");
    var on = route.role === segs[0] && (
      route.name === segs[1] ||
      (segs[1] === "appointments" && route.name === "appointment") ||
      (segs[1] === "ops" && ["services","staff","schedule","chairs","customers","customer","members","cards","records","newold","referrals","service-edit","staff-edit"].indexOf(route.name) !== -1) ||
      (segs[1] === "settings" && ["rules","shop","roles","demo"].indexOf(route.name) !== -1) ||
      (segs[1] === "today" && (route.name === "appointment" || route.name === "settle")) ||
      (segs[1] === "customers" && route.name === "customer") ||
      (segs[1] === "member" && (route.name === "cards" || route.name === "buy")) ||
      (segs[1] === "mine" && (route.name === "records" || route.name === "share")) ||
      (segs[1] === "home" && ["intro","services","service","stylists","stylist","book","book-result"].indexOf(route.name) !== -1)
    );
    /* booking lives under home visually? Better: book from 预约 too. Keep 首页 for brand pages. */
    if (segs[1] === "home") {
      on = ["home","intro","services","service","stylists","stylist"].indexOf(route.name) !== -1 && route.role === "c";
    }
    if (segs[1] === "appointments" && route.role === "c") {
      on = ["appointments","appointment","book","book-result"].indexOf(route.name) !== -1;
    }
    return '<button type="button" class="' + (on ? "active" : "") + '" data-go="' + it.path + '"><span class="no">' + it.no + "</span>" + esc(it.label) + "</button>";
  }).join("");
}

function dateChips(selected, days, startOffset) {
  startOffset = startOffset == null ? 0 : startOffset;
  days = days || 8;
  var today = MokujoTime.dateStr(MokujoTime.now());
  var html = '<div class="date-row">';
  for (var i = startOffset; i < startOffset + days; i++) {
    var d = MokujoTime.addDays(today, i);
    var lab = i === 0 ? "今天" : i === 1 ? "明天" : "周" + MokujoTime.weekdayName(d);
    html += '<button type="button" class="date-pill' + (d === selected ? " on" : "") + '" data-act="pick-date" data-date="' + d + '"><span class="d">' + Number(d.slice(8)) + "</span>" + lab + "</button>";
  }
  html += "</div>";
  return html;
}

function itemListHtml(items) {
  return '<ol style="margin:6px 0 0;padding-left:18px;font-size:13px;line-height:1.8;">' +
    items.map(function (it) {
      return "<li>" + esc(it.name) + " · " + it.durationMin + " 分钟 · " + moneySim(it.priceFen) + "</li>";
    }).join("") + "</ol>";
}

function findName(list, id, key) {
  var x = MokujoEngine.byId(list, id);
  return x ? x[key || "name"] : "—";
}

function countdownHtml(apt, now) {
  if (!apt || apt.status !== "待确认" || !apt.timeoutAt) return "";
  var c = MokujoTime.countdown(now, MokujoTime.parseISO(apt.timeoutAt));
  if (c.expired) return '<div class="notice warn">确认时限已到，正在失效……</div>';
  return '<div class="notice">门店确认剩余时间 <span class="countdown" data-timeout="' + esc(apt.timeoutAt) + '">' + esc(c.textCN) + "</span>。超时未确认将自动失效，请稍后查看。</div>";
}

function pendingStaffHint(apt, now) {
  if (!apt || apt.status !== "待确认" || !apt.timeoutAt) return "";
  var c = MokujoTime.countdown(now, MokujoTime.parseISO(apt.timeoutAt));
  if (c.expired) return '<div class="notice warn">该预约已超过确认时限，已自动失效，时段已释放，不能再确认。如顾客仍要来，请顾客重新预约。</div>';
  return '<div class="notice">待门店确认，剩余 <span class="countdown" data-timeout="' + esc(apt.timeoutAt) + '">' + esc(c.textCN) + "</span>。超时将自动释放时段。</div>";
}

function timeoutCustomerCopy() {
  return "预约未在门店确认时限内完成确认，已自动失效，原定发型师和椅位已释放。如需服务，请重新预约。";
}

function timeoutStaffCopy() {
  return "该预约已超过确认时限，已自动失效，时段已释放，不能再确认。如顾客仍要来，请顾客重新预约。";
}

function aptBrief(state, apt) {
  var st = findName(state.staff, apt.staffId);
  var cus = findName(state.customers, apt.customerId);
  var start = MokujoTime.formatDateTimeCN(MokujoTime.parseISO(apt.start));
  var end = MokujoTime.hmOf(MokujoTime.parseISO(apt.end));
  return {
    staff: st,
    customer: cus,
    when: start + "–" + end,
    items: (apt.items || []).map(function (i) { return i.name; }).join("、")
  };
}

function ticketNo(apt) {
  var start = apt && apt.start ? MokujoTime.parseISO(apt.start) : MokujoTime.now();
  var p = MokujoTime.parts(start);
  var id = apt && apt.id ? apt.id : "";
  var n = 0;
  for (var i = 0; i < id.length; i++) n = (n * 33 + id.charCodeAt(i)) >>> 0;
  var code = String(n % 10000);
  while (code.length < 4) code = "0" + code;
  return "MK" + p.year.slice(2) + p.month + p.day + "-" + code;
}

MokujoUI.esc = esc;
MokujoUI.ticketNo = ticketNo;

MokujoUI.moneySim = moneySim;
MokujoUI.statusBadge = statusBadge;
MokujoUI.toast = toast;
MokujoUI.go = go;
MokujoUI.parseRoute = parseRoute;
MokujoUI.tabbarHtml = tabbarHtml;
MokujoUI.currentRolePrefix = currentRolePrefix;
MokujoUI.dateChips = dateChips;
MokujoUI.itemListHtml = itemListHtml;
MokujoUI.findName = findName;
MokujoUI.countdownHtml = countdownHtml;
MokujoUI.pendingStaffHint = pendingStaffHint;
MokujoUI.timeoutCustomerCopy = timeoutCustomerCopy;
MokujoUI.timeoutStaffCopy = timeoutStaffCopy;
MokujoUI.aptBrief = aptBrief;
MokujoUI.confirmBox = confirmBox;
MokujoUI.promptBox = promptBox;
MokujoUI.showModal = showModal;
MokujoUI.closeModal = closeModal;
