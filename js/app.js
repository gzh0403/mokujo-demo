/* MOKUJO 木序 P2 — boot, toolbar, events, render. */
(function () {
  function stateNow() {
    return MokujoStore.load(MokujoTime.now());
  }

  function currentUser(state) {
    return MokujoEngine.actorOf(state, state.currentUserId) || state.users[0];
  }

  function syncRoleRoute(user) {
    var route = MokujoUI.parseRoute();
    var prefix = MokujoUI.currentRolePrefix(user.role);
    if (route.role !== prefix) {
      var home = prefix === "c" ? "home" : prefix === "s" ? "today" : "dashboard";
      location.replace("#/" + prefix + "/" + home);
      return true;
    }
    return false;
  }

  function render() {
    var now = MokujoTime.now();
    var state = MokujoStore.load(now);
    var user = currentUser(state);
    if (syncRoleRoute(user)) return;

    var route = MokujoUI.parseRoute();
    var key = route.role + "/" + route.name;
    var view = MokujoViews[key];
    var app = document.getElementById("app");
    var ctx = { state: state, now: now, route: route, user: user };
    if (!view) {
      app.innerHTML = '<div class="page"><h1 class="page-title">页面不存在</h1><p class="lede">' + MokujoUI.esc(key) + '</p><button class="btn" data-go="#/' + route.role + '/' + (route.role === "c" ? "home" : route.role === "s" ? "today" : "dashboard") + '">返回</button></div>';
    } else {
      try {
        app.innerHTML = view(ctx);
      } catch (e) {
        app.innerHTML = '<div class="page"><h1 class="page-title">页面渲染出错</h1><p class="lede">' + MokujoUI.esc(e.message) + "</p></div>";
        if (typeof console !== "undefined") console.error(e);
      }
    }
    document.getElementById("tabbar").innerHTML = MokujoUI.tabbarHtml(user.role, route);
    document.getElementById("phone-shell").className = "phone-shell role-" + user.role;
    updateToolbar(state, user);
    tickCountdowns(now);
  }

  function updateToolbar(state, user) {
    var sel = document.getElementById("role-switch");
    if (sel && sel.value !== user.id) sel.value = user.id;
    var brand = document.getElementById("head-brand");
    if (brand) brand.textContent = state.shop.brandName.toUpperCase().indexOf("MOKUJO") >= 0 ? "MOKUJO 木序" : state.shop.brandName;
    var sub = document.getElementById("head-sub");
    if (sub) {
      if (user.role === "customer") sub.textContent = state.shop.subtitle;
      else if (user.role === "staff") sub.textContent = "店员工作台 · " + user.name;
      else sub.textContent = "经营后台 · " + user.name;
    }
  }

  function tickCountdowns(now) {
    now = now || MokujoTime.now();
    var nodes = document.querySelectorAll("[data-timeout]");
    nodes.forEach(function (el) {
      var c = MokujoTime.countdown(now, MokujoTime.parseISO(el.getAttribute("data-timeout")));
      el.textContent = c.expired ? "00分00秒" : c.textCN;
    });
  }

  function act(name, fn) {
    var r = MokujoStore.transact(function (state, now) {
      var user = currentUser(state);
      return fn(state, user, now);
    });
    if (!r.ok) toast(r.message || "操作未完成");
    else if (r.message) toast(r.message);
    render();
    return r;
  }

  function val(sel) {
    var el = document.querySelector(sel);
    return el ? el.value : "";
  }

  function bindEvents() {
    document.body.addEventListener("click", function (e) {
      var t = e.target.closest("[data-go],[data-act],[data-stop]");
      if (!t) return;
      if (t.hasAttribute("data-stop")) e.stopPropagation();
      if (t.getAttribute("data-act") === "close-modal" && !t.closest(".modal")) {
        closeModal();
        return;
      }
      if (t.hasAttribute("data-go")) {
        e.preventDefault();
        go(t.getAttribute("data-go"));
        return;
      }
      var a = t.getAttribute("data-act");
      if (!a) return;
      e.preventDefault();
      handleAct(a, t);
    });

    document.body.addEventListener("change", function (e) {
      var el = e.target;
      var field = el.getAttribute("data-field");
      if (!field) return;
      if (field === "contactName" || field === "phone" || field === "referralType" || field === "referrerId") {
        MokujoUI.draft[field] = el.value;
        if (field === "referralType" || field === "referrerId") render();
        return;
      }
      if (field === "cusQuery") {
        MokujoUI.draft.cusQuery = el.value;
        render();
        return;
      }
      if (field === "statusFilter") {
        MokujoUI.query = MokujoUI.query || {};
        MokujoUI.query.status = el.value;
        render();
        return;
      }
      if (field === "staffFilter") {
        MokujoUI.query = MokujoUI.query || {};
        MokujoUI.query.staff = el.value;
        render();
      }
    });

    document.getElementById("role-switch").addEventListener("change", function () {
      MokujoStore.setCurrentUser(this.value);
      var state = stateNow();
      var user = currentUser(state);
      var prefix = MokujoUI.currentRolePrefix(user.role);
      var home = prefix === "c" ? "home" : prefix === "s" ? "today" : "dashboard";
      location.hash = "#/" + prefix + "/" + home;
      render();
    });

  }

  function handleAct(a, t) {
    var id = t.getAttribute("data-id");
    if (a === "pick-date") {
      MokujoUI.query = MokujoUI.query || {};
      MokujoUI.query.date = t.getAttribute("data-date");
      MokujoUI.draft.dateStr = t.getAttribute("data-date");
      MokujoUI.draft.start = null;
      render();
      return;
    }
    if (a === "toggle-svc") {
      var sid = t.getAttribute("data-id");
      var d = ensureDraft(stateNow());
      var i = d.serviceIds.indexOf(sid);
      if (t.checked && i === -1) {
        if (d.serviceIds.length >= 5) {
          t.checked = false;
          toast("一次预约最多选择 5 个项目。");
          return;
        }
        d.serviceIds.push(sid);
      } else if (!t.checked && i !== -1) d.serviceIds.splice(i, 1);
      MokujoUI.draft.staffId = d.staffId;
      render();
      return;
    }
    if (a === "pick-staff") {
      MokujoUI.draft.staffId = id;
      MokujoUI.draft.start = null;
      render();
      return;
    }
    if (a === "pick-slot") {
      MokujoUI.draft.start = Number(t.getAttribute("data-start"));
      render();
      return;
    }
    if (a === "book-with-service") {
      MokujoUI.draft = MokujoUI.draft || {};
      MokujoUI.draft.serviceIds = [id];
      go("#/c/book");
      return;
    }
    if (a === "book-with-staff") {
      MokujoUI.draft = MokujoUI.draft || {};
      MokujoUI.draft.staffId = id;
      go("#/c/book");
      return;
    }
    if (a === "submit-book") return submitBook();
    if (a === "customer-cancel") {
      act("cancel", function (state, user, now) {
        return MokujoEngine.cancelAppointment(state, user.id, id, "顾客取消", now);
      });
      return;
    }
    if (a === "demo-buy") {
      confirmBox("演示购买", "确认以演示流程购买该次卡？不会发生真实支付，购卡金额不计入经营看板收银。", "确认购买").then(function (ok) {
        if (ok) {
          var r = act("buy", function (state, user, now) {
            return MokujoEngine.demoBuyCard(state, user.id, { productId: id, customerId: user.customerId }, now);
          });
          if (r.ok) go("#/c/cards");
        }
      });
      return;
    }
    if (a === "copy-share") {
      var link = t.getAttribute("data-link");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(function () { toast("已复制模拟链接。"); }, function () { toast(link); });
      } else toast(link);
      return;
    }
    if (a === "confirm-apt") {
      act("confirm", function (state, user, now) { return MokujoEngine.confirmAppointment(state, user.id, id, now); });
      return;
    }
    if (a === "simulate-timeout") {
      confirmBox("模拟确认超时", "将按完整超时路径处理：状态变为超时未确认，并立即释放发型师和椅位。", "模拟超时").then(function (ok) {
        if (ok) act("sim-to", function (state, user, now) { return MokujoEngine.simulateTimeout(state, user.id, id, now); });
      });
      return;
    }
    if (a === "staff-cancel" || a === "cancel-arrived") {
      promptBox("取消预约", "请填写取消原因。", "", "确认取消").then(function (reason) {
        if (reason === true) return;
        if (!reason || !String(reason).trim()) { toast("请填写取消原因。"); return; }
        act("cancel", function (state, user, now) { return MokujoEngine.cancelAppointment(state, user.id, id, reason, now); });
      });
      return;
    }
    if (a === "noshow") {
      confirmBox("逾期未到", "将标记为逾期未到并释放时段。首版需手动标记。", "确认").then(function (ok) {
        if (ok) act("noshow", function (state, user, now) { return MokujoEngine.markNoShow(state, user.id, id, now); });
      });
      return;
    }
    if (a === "arrive") {
      act("arrive", function (state, user, now) { return MokujoEngine.arrive(state, user.id, id, now); });
      return;
    }
    if (a === "start-svc") {
      act("start", function (state, user, now) { return MokujoEngine.startService(state, user.id, id, now); });
      return;
    }
    if (a === "complete-svc") {
      act("complete", function (state, user, now) { return MokujoEngine.completeService(state, user.id, id, now); });
      return;
    }
    if (a === "open-settle") {
      var box = document.getElementById("settle-box");
      if (box) box.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (a === "void-settle") {
      promptBox("作废待结算", "必须填写原因。作废后不生成消费记录、不扣次。", "", "确认作废").then(function (reason) {
        if (!reason || reason === true || !String(reason).trim()) { if (reason) toast("必须填写原因。"); return; }
        act("void", function (state, user, now) { return MokujoEngine.voidSettlement(state, user.id, id, reason, now); });
      });
      return;
    }
    if (a === "do-settle") return doSettle(id);
    if (a === "reorder") return doReorder(id);
    if (a === "pop-range") {
      MokujoUI.query = MokujoUI.query || {};
      MokujoUI.query.popularRange = t.getAttribute("data-range");
      render();
      return;
    }
    if (a === "new-service") { go("#/o/service-edit/new"); return; }
    if (a === "save-service") return saveService(id);
    if (a === "new-staff") { go("#/o/staff-edit/new"); return; }
    if (a === "save-staff") return saveStaff(id);
    if (a === "save-schedule") return saveSchedule(false);
    if (a === "save-rest") return saveSchedule(true);
    if (a === "add-block") return addBlock();
    if (a === "new-chair") {
      promptBox("新增椅位", "请输入椅位名称。", "四号椅", "新增").then(function (name) {
        if (!name || name === true) return;
        act("chair", function (state, user, now) { return MokujoEngine.upsertChair(state, user.id, { name: name, enabled: true }, now); });
      });
      return;
    }
    if (a === "rename-chair") {
      promptBox("椅位改名", "请输入新的名称。", "", "保存").then(function (name) {
        if (!name || name === true) return;
        act("chair", function (state, user, now) { return MokujoEngine.upsertChair(state, user.id, { id: id, name: name }, now); });
      });
      return;
    }
    if (a === "toggle-chair") {
      act("chair", function (state, user, now) {
        var c = MokujoEngine.getChair(state, id);
        return MokujoEngine.upsertChair(state, user.id, { id: id, enabled: !c.enabled }, now);
      });
      return;
    }
    if (a === "issue-card") {
      var cus = val('[data-field="issue-cus"]');
      var prod = val('[data-field="issue-prod"]');
      act("issue", function (state, user, now) { return MokujoEngine.issueCard(state, user.id, { customerId: cus, productId: prod }, now); });
      return;
    }
    if (a === "correct-ref") return correctRef(id);
    if (a === "save-rules") return saveRules();
    if (a === "save-shop") return saveShop();
    if (a === "toggle-user") {
      act("user", function (state, user, now) {
        var u = MokujoEngine.byId(state.users, id);
        if (!u || u.role !== "staff") return MokujoEngine.fail("AUTH", "只能停用或启用店员。");
        if (u.staffId) {
          return MokujoEngine.upsertStaff(state, user.id, { id: u.staffId, status: u.status === "active" ? "disabled" : "active" }, now);
        }
        u.status = u.status === "active" ? "disabled" : "active";
        return MokujoEngine.ok(u, "已更新。");
      });
      return;
    }
    if (a === "init-data" || a === "reset-data") {
      confirmBox(a === "reset-data" ? "重置演示数据" : "初始化演示数据", "将按今天重新生成全部虚拟数据，当前演示进度会被覆盖。", "确认").then(function (ok) {
        if (ok) {
          MokujoStore.reset(MokujoTime.now());
          toast("演示数据已重新生成。看板上的数字已按新的种子数据重新计算。");
          render();
        }
      });
    }
  }

  function submitBook() {
    var d = MokujoUI.draft || {};
    var nameEl = document.querySelector('[data-field="contactName"]');
    var phoneEl = document.querySelector('[data-field="phone"]');
    if (nameEl) d.contactName = nameEl.value;
    if (phoneEl) d.phone = phoneEl.value;
    var typeEl = document.querySelector('[data-field="referralType"]');
    var refEl = document.querySelector('[data-field="referrerId"]');
    if (typeEl) d.referralType = typeEl.value;
    if (refEl) d.referrerId = refEl.value;
    var r = act("book", function (state, user, now) {
      return MokujoEngine.createAppointment(state, user.id, {
        customerId: user.customerId,
        serviceIds: d.serviceIds || [],
        staffId: d.staffId,
        start: d.start,
        contactName: d.contactName,
        phone: d.phone,
        referralType: d.referralType,
        referrerId: d.referrerId
      }, now);
    });
    if (r.ok && r.data) {
      MokujoUI.draft = {};
      go("#/c/book-result/" + r.data.id);
    }
  }

  function doSettle(appointmentId) {
    var radios = document.querySelectorAll("[data-settle-item]");
    var map = {};
    radios.forEach(function (r) {
      if (!r.checked) return;
      var itemId = r.getAttribute("data-settle-item");
      var v = r.value;
      if (v === "cash") map[itemId] = { itemId: itemId, method: "cash" };
      else if (v.indexOf("card:") === 0) map[itemId] = { itemId: itemId, method: "card", cardId: v.slice(5) };
    });
    var methods = Object.keys(map).map(function (k) { return map[k]; });
    act("settle", function (state, user, now) {
      return MokujoEngine.settle(state, user.id, appointmentId, methods, now);
    });
  }

  function doReorder(appointmentId) {
    var raw = val('[data-field="newOrder"]');
    var r = act("reorder", function (state, user, now) {
      var apt = MokujoEngine.getAppointment(state, appointmentId);
      var parts = String(raw).split(/[,，\s]+/).map(function (x) { return parseInt(x, 10); }).filter(function (n) { return n > 0; });
      var ids = parts.map(function (n) { return apt.items[n - 1] && apt.items[n - 1].id; });
      return MokujoEngine.reorderItems(state, user.id, appointmentId, ids, now);
    });
  }

  function saveService(id) {
    var priceYuan = Number(val('[data-field="svc-price"]'));
    act("svc", function (state, user, now) {
      return MokujoEngine.upsertService(state, user.id, {
        id: id === "new" ? null : id,
        name: val('[data-field="svc-name"]'),
        category: val('[data-field="svc-category"]'),
        durationMin: Number(val('[data-field="svc-duration"]')),
        priceFen: Math.round(priceYuan * 100),
        desc: val('[data-field="svc-desc"]'),
        on: !!(document.querySelector('[data-field="svc-on"]') && document.querySelector('[data-field="svc-on"]').checked)
      }, now);
    });
    if (id === "new") go("#/o/services");
  }

  function saveStaff(id) {
    var svc = [];
    document.querySelectorAll("[data-st-svc]").forEach(function (el) { if (el.checked) svc.push(el.getAttribute("data-st-svc")); });
    var activeEl = document.querySelector('[data-field="st-active"]');
    act("st", function (state, user, now) {
      return MokujoEngine.upsertStaff(state, user.id, {
        id: id === "new" ? null : id,
        name: val('[data-field="st-name"]'),
        title: val('[data-field="st-title"]'),
        bio: val('[data-field="st-bio"]'),
        defaultChairId: val('[data-field="st-chair"]'),
        serviceIds: svc,
        status: !activeEl || activeEl.checked ? "active" : "disabled"
      }, now);
    });
    if (id === "new") go("#/o/staff");
  }

  function saveSchedule(isRest) {
    act("sch", function (state, user, now) {
      return MokujoEngine.upsertSchedule(state, user.id, {
        staffId: val('[data-field="sch-staff"]'),
        weekday: Number(val('[data-field="sch-week"]')),
        start: isRest ? val('[data-field="rest-start"]') : val('[data-field="sch-start"]'),
        end: isRest ? val('[data-field="rest-end"]') : val('[data-field="sch-end"]'),
        kind: isRest ? "rest" : null
      }, now);
    });
  }

  function addBlock() {
    var date = val('[data-field="blk-date"]');
    var a = val('[data-field="blk-start"]');
    var b = val('[data-field="blk-end"]');
    act("blk", function (state, user, now) {
      return MokujoEngine.addTempBlock(state, user.id, {
        staffId: val('[data-field="sch-staff"]'),
        start: MokujoTime.iso(MokujoTime.fromDateHM(date, a)),
        end: MokujoTime.iso(MokujoTime.fromDateHM(date, b)),
        reason: val('[data-field="blk-reason"]')
      }, now);
    });
  }

  function correctRef(customerId) {
    var body = '<p>仅在未有效转化且写入 24 小时内可更正一次，必须填写原因。</p>' +
      '<label class="form-label">新的来源类型</label><select class="input" data-modal-type>' +
      MokujoEngine.REF_TYPES.map(function (t) { return '<option>' + t + "</option>"; }).join("") + "</select>" +
      '<label class="form-label">推荐人（朋友推荐时必填）</label><select class="input" data-modal-ref><option value="">无</option>' +
      stateNow().customers.filter(function (c) { return c.id !== customerId; }).map(function (c) { return '<option value="' + c.id + '">' + MokujoUI.esc(c.name) + "</option>"; }).join("") + "</select>" +
      '<label class="form-label">原因</label><textarea class="input" data-modal-input></textarea>';
    showModal({ title: "更正推荐来源", bodyHtml: body, okText: "提交更正" }).then(function (reason) {
      var rootGone = true;
      /* input already read as reason from data-modal-input. Need type/referrer from modal — too late if closed.
         Fix: read them before close by hooking — showModal already closed. Redesign: read in ok handler by wrapping. */
    });
    /* custom because we need extra fields */
    var root = document.getElementById("modal-root");
    var okBtn = root.querySelector('[data-act="modal-ok"]');
    okBtn.onclick = function (e) {
      e.stopPropagation();
      var type = root.querySelector("[data-modal-type]").value;
      var referrerId = root.querySelector("[data-modal-ref]").value;
      var reason = root.querySelector("[data-modal-input]").value;
      closeModal();
      act("ref", function (state, user, now) {
        return MokujoEngine.ownerCorrectReferral(state, user.id, { customerId: customerId, type: type, referrerId: referrerId, reason: reason }, now);
      });
    };
  }

  function saveRules() {
    var hours = [];
    document.querySelectorAll("[data-hours-start]").forEach(function (el) {
      var w = Number(el.getAttribute("data-hours-start"));
      var endEl = document.querySelector('[data-hours-end="' + w + '"]');
      hours.push({ weekday: w, start: el.value, end: endEl ? endEl.value : "20:00" });
    });
    act("rules", function (state, user, now) {
      return MokujoEngine.updateShopRules(state, user.id, {
        confirmTimeoutMinutes: Number(val('[data-field="rule-timeout"]')),
        displayInterval: Number(val('[data-field="rule-interval"]')),
        startStep: Number(val('[data-field="rule-step"]')),
        cancelLeadHours: Number(val('[data-field="rule-lead"]')),
        hours: hours
      }, now);
    });
  }

  function saveShop() {
    var benefits = val('[data-field="shop-benefits"]').split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    act("shop", function (state, user, now) {
      return MokujoEngine.updateShopRules(state, user.id, {
        brandName: val('[data-field="shop-brand"]'),
        subtitle: val('[data-field="shop-sub"]'),
        address: val('[data-field="shop-addr"]'),
        phone: val('[data-field="shop-phone"]'),
        announcement: val('[data-field="shop-ann"]'),
        intro: val('[data-field="shop-intro"]'),
        memberBenefits: benefits
      }, now);
    });
  }

  function startTimers() {
    if (MokujoUI.timer) clearInterval(MokujoUI.timer);
    if (MokujoUI.expireTimer) clearInterval(MokujoUI.expireTimer);
    MokujoUI.timer = setInterval(function () { tickCountdowns(MokujoTime.now()); }, 1000);
    MokujoUI.expireTimer = setInterval(function () {
      var changed = [];
      MokujoStore.transact(function (state, now) {
        changed = MokujoEngine.expireDue(state, now);
        return { ok: true };
      });
      if (changed && changed.length) render();
    }, 5000);
  }

  function boot() {
    MokujoStore.init && MokujoStore.load(MokujoTime.now());
    try {
      var params = new URLSearchParams(location.search || "");
      var as = params.get("as");
      if (as) {
        var map = { customer: "user-aqing", staff: "user-xiaolin", owner: "user-owner", aqing: "user-aqing", xiaolin: "user-xiaolin", mokujo: "user-owner" };
        MokujoStore.setCurrentUser(map[as] || as);
      }
    } catch (e) {}
    var sel = document.getElementById("role-switch");
    var state = stateNow();
    sel.innerHTML = state.users.filter(function (u) { return u.status === "active"; }).map(function (u) {
      return '<option value="' + u.id + '">' + MokujoUI.esc(u.name) + "</option>";
    }).join("");
    sel.value = state.currentUserId;
    document.getElementById("btn-init").onclick = function () {
      confirmBox("初始化演示数据", "将按今天重新生成虚拟演示数据。当前进度会被覆盖。", "确认初始化").then(function (ok) {
        if (ok) { MokujoStore.reset(MokujoTime.now()); toast("演示数据已初始化。"); render(); }
      });
    };
    document.getElementById("btn-reset").onclick = function () {
      confirmBox("重置演示数据", "将恢复到初始演示数据，便于反复演示。当前进度会被覆盖。", "确认重置").then(function (ok) {
        if (ok) { MokujoStore.reset(MokujoTime.now()); toast("已重置为初始演示数据。"); render(); }
      });
    };
    bindEvents();
    window.addEventListener("hashchange", render);
    window.addEventListener("storage", function (e) {
      if (e.key === MokujoStore.KEY || e.key === MokujoStore.SESSION_KEY) render();
    });
    startTimers();
    if (!location.hash) location.hash = "#/c/home";
    else render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
