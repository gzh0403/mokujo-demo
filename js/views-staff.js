/* Staff-end views (also reused by owner for appointment handling) */
var MokujoViews = MokujoViews || {};

function staffDate(ctx) {
  return (MokujoUI.query && MokujoUI.query.date) || MokujoTime.dateStr(ctx.now);
}

function appointmentsOn(state, dateStr) {
  return state.appointments.filter(function (a) {
    return MokujoTime.dateStr(MokujoTime.parseISO(a.start)) === dateStr;
  }).sort(function (a, b) { return MokujoTime.parseISO(a.start) - MokujoTime.parseISO(b.start); });
}

function aptRow(state, apt, now, prefix) {
  prefix = prefix || "s";
  var b = aptBrief(state, apt);
  var extra = "";
  if (apt.status === "待确认") extra = pendingStaffHint(apt, now);
  if (apt.status === "待结算") extra = '<div class="notice warn">待结算 · 服务已完成，时段已释放，等待核销。</div>';
  return '<button class="list-item" data-go="#/' + prefix + '/appointment/' + apt.id + '"><div class="row"><strong>' + esc(MokujoTime.hmOf(MokujoTime.parseISO(apt.start))) + "–" + esc(MokujoTime.hmOf(MokujoTime.parseISO(apt.end))) + "</strong>" + statusBadge(apt.status) + '</div><div class="meta">' + esc(b.customer) + " · " + esc(b.staff) + " · " + esc(b.items) + "</div>" + extra + "</button>";
}

MokujoViews["s/today"] = function (ctx) {
  var date = staffDate(ctx);
  var list = appointmentsOn(ctx.state, date);
  var pending = list.filter(function (a) { return a.status === "待确认"; });
  var settle = ctx.state.appointments.filter(function (a) { return a.status === "待结算"; });
  var html = '<div class="page staff-dense"><div class="kicker">Today</div><h1 class="page-title">今日预约</h1>';
  html += dateChips(date, 8, -1);
  html += '<div class="btn-row"><button class="btn-gold" data-go="#/s/settle">待结算清单（' + settle.length + "）</button></div>";
  if (pending.length) html += '<div class="notice">有 ' + pending.length + " 笔待确认，请在时限内处理。</div>";
  if (!list.length) html += '<div class="empty">这一天没有预约。</div>';
  list.forEach(function (a) { html += aptRow(ctx.state, a, ctx.now, "s"); });
  return html + "</div>";
};

MokujoViews["s/settle"] = function (ctx) {
  var list = ctx.state.appointments.filter(function (a) { return a.status === "待结算"; });
  var html = '<div class="page"><button class="back" data-go="#/s/today">← 今日</button><div class="kicker">Settlement</div><h1 class="page-title">待结算清单</h1><p class="lede">服务已完成，时段已释放。核销为模拟结算，不发生真实收款。</p>';
  if (!list.length) html += '<div class="empty">没有待结算的预约。</div>';
  list.forEach(function (a) { html += aptRow(ctx.state, a, ctx.now, "s"); });
  return html + "</div>";
};

function appointmentHandleView(ctx, prefix) {
  var apt = MokujoEngine.getAppointment(ctx.state, ctx.route.id);
  if (!apt) return '<div class="page">找不到该预约。</div>';
  var b = aptBrief(ctx.state, apt);
  var warn = MokujoEngine.lateFinishWarning(ctx.state, apt, ctx.now);
  var html = '<div class="page"><button class="back" data-go="#/' + prefix + (prefix === "o" ? "/appointments" : "/today") + '">← 返回</button><div class="kicker">Ticket</div><h1 class="page-title">预约处理</h1>';
  html += "<p>" + statusBadge(apt.status) + "</p>";
  html += '<div class="card"><div class="mono">No. ' + esc(ticketNo(apt)) + "</div><div>" + esc(b.when) + "</div><div class=\"meta\">顾客 " + esc(b.customer) + " · " + esc(apt.phone) + "<br>发型师 " + esc(b.staff) + " · 椅位 " + esc(findName(ctx.state.chairs, apt.chairId)) + "</div></div>";
  if (apt.status === "待确认") html += pendingStaffHint(apt, ctx.now);
  if (apt.status === "超时未确认") html += '<div class="notice warn">' + esc(timeoutStaffCopy()) + "</div>";
  if (warn) html += '<div class="notice warn">' + esc(warn) + "</div>";
  html += '<div class="form-label">项目顺序</div>' + itemListHtml(apt.items);
  html += '<div class="row"><span>总时长 / 总价（模拟）</span><strong>' + apt.totalDurationMin + " 分钟</strong></div>" + '<div class="row"><span></span>' + moneySim(apt.totalPriceFen) + "</div>";

  if (apt.status === "待确认" || apt.status === "已确认" || apt.status === "已到店") {
    html += '<div class="form-label">调整顺序（不改变总时长和总价）</div><p class="meta">输入项目从上到下的编号顺序，用逗号分隔。</p>';
    html += '<input class="input" data-field="newOrder" placeholder="例如 2,1" value="' + apt.items.map(function (it, i) { return i + 1; }).join(",") + '">';
    html += '<button class="btn-gold" style="margin-top:8px;" data-act="reorder" data-id="' + apt.id + '">保存顺序</button>';
  }

  html += '<div class="btn-row" style="margin-top:16px;">';
  if (apt.status === "待确认") {
    html += '<button class="btn" data-act="confirm-apt" data-id="' + apt.id + '">确认预约</button>';
    html += '<button class="btn-ghost" data-act="staff-cancel" data-id="' + apt.id + '">取消并填原因</button>';
    html += '<button class="btn-gold" data-act="simulate-timeout" data-id="' + apt.id + '">模拟确认超时</button>';
  }
  if (apt.status === "已确认") {
    html += '<button class="btn" data-act="arrive" data-id="' + apt.id + '">到店登记</button>';
    html += '<button class="btn-ghost" data-act="staff-cancel" data-id="' + apt.id + '">取消并填原因</button>';
    if (ctx.now >= MokujoTime.parseISO(apt.start)) {
      html += '<button class="btn-gold" data-act="noshow" data-id="' + apt.id + '">标记逾期未到</button>';
    }
  }
  if (apt.status === "已到店") {
    html += '<button class="btn" data-act="start-svc" data-id="' + apt.id + '">开始服务</button>';
    html += '<button class="btn-ghost" data-act="cancel-arrived" data-id="' + apt.id + '">到店后取消</button>';
  }
  if (apt.status === "服务中") {
    html += '<button class="btn" data-act="complete-svc" data-id="' + apt.id + '">服务完成</button>';
  }
  if (apt.status === "待结算") {
    html += '<button class="btn" data-act="open-settle" data-id="' + apt.id + '">去结算核销</button>';
    html += '<button class="btn-ghost" data-act="void-settle" data-id="' + apt.id + '">作废待结算</button>';
  }
  html += "</div>";

  if (apt.status === "待结算") html += settleForm(ctx, apt);
  if (apt.status === "已完成" && apt.settlementId) {
    var rec = MokujoEngine.byId(ctx.state.consumptionRecords, apt.settlementId);
    if (rec) {
      html += '<div class="form-label">消费记录（模拟）</div><div class="card">收银 ' + moneySim(rec.cashTotalFen) + (rec.cardOriginalTotalFen ? '<div class="meta">次卡抵扣项目原价 ' + esc(MokujoEngine.moneyLabel(rec.cardOriginalTotalFen)) + "（模拟）</div>" : "") + "</div>";
    }
  }
  html += '<div class="btn-row"><button class="btn-text" data-go="#/' + prefix + "/customer/" + apt.customerId + '">查看顾客档案 →</button></div>';
  return html + "</div>";
}

function settleForm(ctx, apt) {
  var cards = MokujoEngine.cardsForCustomer(ctx.state, apt.customerId);
  var html = '<div class="card" id="settle-box"><h3>模拟结算与核销</h3><p class="meta">可为不同项目分别选择模拟到店付款或次卡扣次。必须一次完成，不能分两次核销。金额为演示数据。</p>';
  apt.items.forEach(function (it) {
    html += '<div style="padding:8px 0;border-bottom:1px solid var(--line);"><strong>' + esc(it.name) + "</strong> " + moneySim(it.priceFen);
    html += '<div class="chip-row"><label class="chip"><input type="radio" name="m-' + it.id + '" value="cash" checked data-settle-item="' + it.id + '"> 模拟付款</label>';
    cards.forEach(function (c) {
      var okc = c.serviceIds.indexOf(it.serviceId) !== -1 && c.remaining > 0;
      html += '<label class="chip' + (okc ? "" : " dead") + '"><input type="radio" name="m-' + it.id + '" value="card:' + c.id + '" data-settle-item="' + it.id + '"' + (okc ? "" : " disabled") + "> 次卡·" + esc(c.name) + "（余" + c.remaining + "）</label>";
    });
    html += "</div></div>";
  });
  if (!cards.length) html += '<p class="meta">该顾客暂无可用次卡，可全部使用模拟付款。</p>';
  html += '<button class="btn btn-block" data-act="do-settle" data-id="' + apt.id + '">确认核销并生成消费记录</button></div>';
  return html;
}

MokujoViews["s/appointment"] = function (ctx) { return appointmentHandleView(ctx, "s"); };
MokujoViews["o/appointment"] = function (ctx) { return appointmentHandleView(ctx, "o"); };

MokujoViews["s/customers"] = function (ctx) {
  var q = (MokujoUI.draft.cusQuery || "").trim();
  var list = ctx.state.customers.filter(function (c) {
    if (!q) return true;
    return (c.name && c.name.indexOf(q) !== -1) || (c.phone && c.phone.indexOf(q) !== -1);
  });
  var html = '<div class="page"><div class="kicker">Clients</div><h1 class="page-title">查询顾客</h1><input class="input" data-field="cusQuery" placeholder="姓名或手机号" value="' + esc(q) + '">';
  list.forEach(function (c) {
    html += '<button class="list-item" data-go="#/s/customer/' + c.id + '"><div class="row"><strong>' + esc(c.name) + "</strong><span class=\"meta\">" + esc(c.phone) + "</span></div><div class=\"meta\">" + (c.member ? "演示会员" : "尚未标记会员") + "</div></button>";
  });
  return html + "</div>";
};

function customerFileView(ctx, prefix) {
  var c = MokujoEngine.getCustomer(ctx.state, ctx.route.id);
  if (!c) return '<div class="page">找不到该顾客。</div>';
  var ref = MokujoEngine.getReferral(ctx.state, c.id);
  var cards = MokujoEngine.cardsForCustomer(ctx.state, c.id);
  var recs = (ctx.state.consumptionRecords || []).filter(function (r) { return r.customerId === c.id; });
  var apts = ctx.state.appointments.filter(function (a) { return a.customerId === c.id; }).sort(function (a, b) { return MokujoTime.parseISO(b.start) - MokujoTime.parseISO(a.start); });
  var html = '<div class="page"><button class="back" data-go="#/' + prefix + (prefix === "o" ? "/customers" : "/customers") + '">← 返回</button><div class="kicker">Profile</div><h1 class="page-title">' + esc(c.name) + "</h1>";
  html += '<div class="meta">' + esc(c.phone) + " · " + (c.member ? "演示会员" : "尚未标记会员") + "</div>";
  html += '<div class="card"><div class="meta">推荐来源</div><strong>' + (ref ? esc(ref.type) : "未填写") + "</strong>";
  if (ref && ref.referrerId) html += '<div class="meta">推荐人：' + esc(findName(ctx.state.customers, ref.referrerId)) + "</div>";
  if (ref && ref.convertedAt) html += '<div class="meta">已于 ' + esc(MokujoTime.formatDateTimeCN(MokujoTime.parseISO(ref.convertedAt))) + " 有效转化</div>";
  else html += '<div class="meta">尚未有效转化（须首次核销并生成消费记录）</div>';
  html += "</div>";
  html += '<div class="form-label">次卡</div>';
  if (!cards.length) html += '<p class="meta">暂无次卡</p>';
  cards.forEach(function (card) {
    html += '<div class="row"><span>' + esc(card.name) + "</span><strong>余 " + card.remaining + " / " + card.totalCounts + "</strong></div>";
  });
  html += '<div class="form-label">消费记录（模拟）</div>';
  if (!recs.length) html += '<p class="meta">暂无消费记录</p>';
  recs.slice().reverse().forEach(function (r) {
    html += '<div class="row" style="font-size:12px;padding:6px 0;border-bottom:1px solid var(--line);"><span>' + esc(MokujoTime.formatDateTimeCN(MokujoTime.parseISO(r.redeemedAt))) + "</span>" + moneySim(r.cashTotalFen) + "</div>";
  });
  html += '<div class="form-label">预约历史</div>';
  apts.forEach(function (a) {
    html += aptRow(ctx.state, a, ctx.now, prefix);
  });
  return html + "</div>";
}

MokujoViews["s/customer"] = function (ctx) { return customerFileView(ctx, "s"); };
MokujoViews["o/customer"] = function (ctx) { return customerFileView(ctx, "o"); };

MokujoViews["s/schedule"] = function (ctx) {
  var user = MokujoEngine.actorOf(ctx.state, ctx.state.currentUserId);
  var staffId = (user && user.staffId) || ctx.state.staff[0].id;
  return scheduleView(ctx, staffId, false);
};

function scheduleView(ctx, staffId, allStaff) {
  var date = staffDate(ctx);
  var html = '<div class="page"><div class="kicker">Board</div><h1 class="page-title">' + (allStaff ? "员工排班" : "我的工作安排") + "</h1>";
  html += dateChips(date, 8, -1);
  var people = allStaff ? ctx.state.staff.filter(function (s) { return s.status === "active"; }) : [MokujoEngine.getStaff(ctx.state, staffId)].filter(Boolean);
  var interval = ctx.state.shop.displayInterval || 30;
  people.forEach(function (st) {
    var hours = MokujoEngine.shopHoursFor(ctx.state, date);
    html += '<div class="card"><h3>' + esc(st.name) + " · " + esc(findName(ctx.state.chairs, MokujoEngine.chairForStaff(ctx.state, st.id, date))) + "</h3>";
    if (!hours) { html += '<p class="meta">门店本日不营业</p></div>'; return; }
    var open = MokujoTime.fromDateHM(date, hours.start);
    var close = MokujoTime.fromDateHM(date, hours.end);
    var span = close - open;
    html += '<div class="meta">' + hours.start + "–" + hours.end + " · 展示间隔 " + interval + " 分钟（仅用于画格子，冲突按连续区间判断）</div>";
    html += '<div class="occ-bar">';
    MokujoEngine.staffWindows(ctx.state, st.id, date); /* windows already exclude rest */
    /* rest blocks */
    (ctx.state.schedules || []).forEach(function (s) {
      if (s.staffId !== st.id || s.kind !== "rest") return;
      if (s.date && s.date !== date) return;
      if (!s.date && s.weekday !== MokujoTime.weekday(date)) return;
      var a = MokujoTime.fromDateHM(date, s.start), b = MokujoTime.fromDateHM(date, s.end);
      var left = ((a - open) / span) * 100, w = ((b - a) / span) * 100;
      html += '<div class="blk rest" style="left:' + left + "%;width:" + w + '%;">休息</div>';
    });
    ctx.state.locks.filter(function (l) { return l.kind === "staff" && l.resourceId === st.id && l.status === "active"; }).forEach(function (l) {
      var a = MokujoTime.parseISO(l.start), b = MokujoTime.parseISO(l.end);
      if (!MokujoEngine.overlaps(open, close, a, b)) return;
      var left = ((Math.max(a, open) - open) / span) * 100;
      var w = ((Math.min(b, close) - Math.max(a, open)) / span) * 100;
      var apt = MokujoEngine.getAppointment(ctx.state, l.appointmentId);
      var label = apt ? MokujoTime.hmOf(a) + " " + findName(ctx.state.customers, apt.customerId) : MokujoTime.hmOf(a);
      html += '<div class="blk" style="left:' + left + "%;width:" + Math.max(w, 2) + '%;">' + esc(label) + "</div>";
    });
    html += "</div>";
    /* list intervals */
    appointmentsOn(ctx.state, date).filter(function (a) { return a.staffId === st.id && MokujoEngine.LOCKING.indexOf(a.status) !== -1; }).forEach(function (a) {
      html += '<div class="meta">' + esc(MokujoTime.hmOf(MokujoTime.parseISO(a.start))) + "–" + esc(MokujoTime.hmOf(MokujoTime.parseISO(a.end))) + " " + esc(findName(ctx.state.customers, a.customerId)) + " " + esc(a.status) + "</div>";
    });
    html += "</div>";
  });
  return html + "</div>";
}

MokujoViews["s/mine"] = function (ctx) {
  var user = MokujoEngine.actorOf(ctx.state, ctx.state.currentUserId);
  var st = user && user.staffId ? MokujoEngine.getStaff(ctx.state, user.staffId) : null;
  return (
    '<div class="page"><div class="kicker">Staff</div><h1 class="page-title">店员中心</h1>' +
    '<div class="card"><strong>' + esc(user ? user.name : "") + '</strong><div class="meta">' + (st ? esc(st.title) + " · " + esc(st.name) : "店员演示账号") + '</div><div class="meta">这是演示角色切换，不是正式管理开通。</div></div>' +
    '<button class="menu-link" data-go="#/s/today">今日预约</button>' +
    '<button class="menu-link" data-go="#/s/settle">待结算清单</button>' +
    '<button class="menu-link" data-go="#/s/schedule">我的工作安排</button>' +
    '<button class="menu-link" data-go="#/s/customers">查询顾客</button>' +
    '<p class="footer-note">演示样品 · 虚拟数据 · 非真实经营数据</p></div>'
  );
};
