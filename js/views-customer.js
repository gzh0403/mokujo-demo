/* Customer-end views */
var MokujoViews = MokujoViews || {};

MokujoViews["c/home"] = function (ctx) {
  var shop = ctx.state.shop;
  var on = ctx.state.services.filter(function (s) { return s.on; }).slice(0, 4);
  var staff = ctx.state.staff.filter(function (s) { return s.status === "active"; });
  return (
    '<div class="page">' +
    '<div class="hero-frame"><img src="assets/images/chair-detail.jpg" alt="木序椅位"><div class="hero-cap"><div class="kicker">No. 1986</div><div class="brand">' + esc(shop.brandName) + '</div><div>' + esc(shop.styleLine) + "</div></div></div>" +
    '<div class="kicker">HAIR PARLOUR</div>' +
    '<h1 class="page-title">把一次理发<br>写成一本杂志</h1>' +
    '<p class="lede">' + esc(shop.intro) + "</p>" +
    '<div class="notice">' + esc(shop.announcement) + "</div>" +
    '<div class="btn-row"><button class="btn" data-go="#/c/book">开始预约</button><button class="btn-ghost" data-go="#/c/intro">门店介绍</button></div>' +
    '<hr class="rule">' +
    '<div class="kicker">Selected</div><h2 class="page-title" style="font-size:20px;">推荐项目</h2>' +
    on.map(function (s) {
      return '<button class="list-item" data-go="#/c/service/' + s.id + '"><div class="row"><strong>' + esc(s.name) + "</strong>" + moneySim(s.priceFen) + '</div><div class="meta">' + s.durationMin + " 分钟 · " + esc(s.category) + "</div></button>";
    }).join("") +
    '<button class="btn-text" data-go="#/c/services">浏览全部项目 →</button>' +
    '<hr class="rule">' +
    '<div class="kicker">Stylists</div><h2 class="page-title" style="font-size:20px;">发型师</h2>' +
    staff.map(function (st) {
      return '<button class="list-item staff-row" data-go="#/c/stylist/' + st.id + '"><img class="avatar" src="' + esc(st.avatar) + '" alt=""><div><strong>' + esc(st.name) + '</strong><div class="meta">' + esc(st.title) + "</div></div></button>";
    }).join("") +
    '<p class="footer-note">演示样品 · 虚拟数据 · 非真实经营数据</p>' +
    "</div>"
  );
};

MokujoViews["c/intro"] = function (ctx) {
  var shop = ctx.state.shop;
  var hours = (shop.hours || []).map(function (h) {
    var name = "日一二三四五六".charAt(h.weekday);
    return "周" + name + " " + h.start + "–" + h.end;
  }).join("<br>");
  return (
    '<div class="page"><button class="back" data-go="#/c/home">← 返回首页</button>' +
    '<div class="kicker">The Parlour</div><h1 class="page-title">门店介绍</h1>' +
    '<div class="photo-inset"><img src="assets/images/hero-salon.jpg" alt="店内"></div>' +
    '<p class="lede">' + esc(shop.intro) + "</p>" +
    '<div class="card"><div class="meta">地址</div><strong>' + esc(shop.address) + "</strong><div class=\"meta\" style=\"margin-top:8px;\">电话</div><strong>" + esc(shop.phone) + "</strong></div>" +
    '<div class="card"><div class="meta">营业时间（演示）</div><div style="margin-top:6px;line-height:1.8;font-size:13px;">' + hours + "</div></div>" +
    '<div class="photo-inset"><img src="assets/images/still-tools.jpg" alt="工具"></div>' +
    '<button class="btn btn-block" data-go="#/c/book">开始预约</button></div>'
  );
};

MokujoViews["c/services"] = function (ctx) {
  var cats = ctx.state.shop.categoryOrder || [];
  var html = '<div class="page"><button class="back" data-go="#/c/home">← 返回</button><div class="kicker">Menu</div><h1 class="page-title">服务项目</h1><p class="lede">价格与时长均为演示数据，到店后在待结算中模拟核销，不发生真实支付。</p>';
  cats.forEach(function (cat) {
    var list = ctx.state.services.filter(function (s) { return s.category === cat && s.on; });
    if (!list.length) return;
    html += '<hr class="rule"><div class="vintage-no">' + esc(cat) + "</div>";
    list.forEach(function (s) {
      html += '<button class="list-item" data-go="#/c/service/' + s.id + '"><div class="row"><strong>' + esc(s.name) + "</strong>" + moneySim(s.priceFen) + '</div><div class="meta">' + s.durationMin + " 分钟</div></button>";
    });
  });
  html += '<div class="btn-row"><button class="btn btn-block" data-go="#/c/book">选择项目并预约</button></div></div>';
  return html;
};

MokujoViews["c/service"] = function (ctx) {
  var s = MokujoEngine.getService(ctx.state, ctx.route.id);
  if (!s) return '<div class="page">找不到该项目。<button class="btn-text" data-go="#/c/services">返回</button></div>';
  return (
    '<div class="page"><button class="back" data-go="#/c/services">← 全部项目</button>' +
    '<div class="kicker">' + esc(s.category) + '</div><h1 class="page-title">' + esc(s.name) + "</h1>" +
    "<p>" + moneySim(s.priceFen) + " · " + s.durationMin + " 分钟</p>" +
    '<p class="lede">' + esc(s.desc) + "</p>" +
    '<button class="btn btn-block" data-act="book-with-service" data-id="' + s.id + '">预约此项目</button></div>'
  );
};

MokujoViews["c/stylists"] = function (ctx) {
  var html = '<div class="page"><button class="back" data-go="#/c/home">← 返回</button><div class="kicker">Artisans</div><h1 class="page-title">发型师</h1>';
  ctx.state.staff.filter(function (s) { return s.status === "active"; }).forEach(function (st) {
    html += '<button class="list-item staff-row" data-go="#/c/stylist/' + st.id + '"><img class="avatar" src="' + esc(st.avatar) + '" alt=""><div><strong>' + esc(st.name) + '</strong><div class="meta">' + esc(st.title) + "</div></div></button>";
  });
  return html + "</div>";
};

MokujoViews["c/stylist"] = function (ctx) {
  var st = MokujoEngine.getStaff(ctx.state, ctx.route.id);
  if (!st) return '<div class="page">找不到该发型师。</div>';
  var svcs = ctx.state.services.filter(function (s) { return st.serviceIds.indexOf(s.id) !== -1 && s.on; });
  return (
    '<div class="page"><button class="back" data-go="#/c/stylists">← 全部发型师</button>' +
    '<div class="photo-inset"><img src="' + esc(st.avatar) + '" alt="" style="height:200px;object-fit:cover;width:100%;"></div>' +
    '<div class="kicker">' + esc(st.title) + '</div><h1 class="page-title">' + esc(st.name) + "</h1>" +
    '<p class="lede">' + esc(st.bio) + "</p>" +
    '<div class="meta">可接项目</div>' +
    svcs.map(function (s) { return '<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line);"><span>' + esc(s.name) + "</span><span class=\"meta\">" + s.durationMin + " 分钟</span></div>"; }).join("") +
    '<div class="btn-row"><button class="btn btn-block" data-act="book-with-staff" data-id="' + st.id + '">预约这位发型师</button></div></div>'
  );
};

function ensureDraft(state) {
  var d = MokujoUI.draft;
  if (!d.serviceIds) d.serviceIds = [];
  if (!d.dateStr) d.dateStr = MokujoTime.dateStr(MokujoTime.now());
  var user = MokujoEngine.actorOf(state, state.currentUserId);
  var cus = user && user.customerId ? MokujoEngine.getCustomer(state, user.customerId) : null;
  if (d.contactName == null && cus) d.contactName = cus.name;
  if (d.phone == null && cus) d.phone = cus.phone;
  return d;
}

MokujoViews["c/book"] = function (ctx) {
  var state = ctx.state;
  var d = ensureDraft(state);
  var user = MokujoEngine.actorOf(state, state.currentUserId);
  var customerId = user && user.customerId;
  var ref = customerId ? MokujoEngine.getReferral(state, customerId) : null;
  var onSvcs = state.services.filter(function (s) { return s.on; });
  var preview = MokujoEngine.previewBooking(state, d.serviceIds, d.staffId, d.dateStr);
  var html = '<div class="page"><button class="back" data-go="#/c/appointments">← 我的预约</button><div class="kicker">Reservation</div><h1 class="page-title">填写预约</h1><p class="lede">一次最多 5 个项目，须由同一位发型师连续完成。总时长按实际分钟计算，不是按 30 分钟格子凑。</p>';

  html += '<div class="form-label">01  选择项目（可多选）</div>';
  onSvcs.forEach(function (s) {
    var on = d.serviceIds.indexOf(s.id) !== -1;
    html += '<label class="check-line"><input type="checkbox" data-act="toggle-svc" data-id="' + s.id + '"' + (on ? " checked" : "") + "><span><strong>" + esc(s.name) + "</strong><div class=\"meta\">" + esc(s.category) + " · " + s.durationMin + " 分钟 · " + esc(MokujoEngine.moneyLabel(s.priceFen)) + ' <span class="tag-sim">模拟</span></div></span></label>';
  });

  if (preview.ok && preview.data.items.length) {
    html += '<div class="book-sum"><div class="meta">默认顺序（按门店类别：洗护、剪发、染烫造型、护理）</div>' +
      itemListHtml(preview.data.items) +
      '<div class="row" style="margin-top:8px;"><span>总时长</span><strong>' + preview.data.totalDurationMin + " 分钟</strong></div>" +
      '<div class="row"><span>总价（模拟）</span>' + moneySim(preview.data.totalPriceFen) + "</div></div>";
  }

  html += '<div class="form-label">02  选择发型师</div>';
  if (!d.serviceIds.length) {
    html += '<p class="meta">请先选择项目，再筛选会做全部项目且当日排班的发型师。</p>';
  } else {
    var staffList = preview.ok ? preview.data.staffList : [];
    if (!staffList.length) html += '<div class="notice warn">没有同时会做全部所选项目的在排班发型师，请减少项目或改期。</div>';
    staffList.forEach(function (st) {
      html += '<button type="button" class="list-item staff-row' + (d.staffId === st.id ? '" style="border-color:var(--walnut);"' : '"') + ' data-act="pick-staff" data-id="' + st.id + '"><img class="avatar" src="' + esc(st.avatar) + '" alt=""><div><strong>' + esc(st.name) + '</strong><div class="meta">' + esc(st.title) + "</div></div></button>";
    });
  }

  html += '<div class="form-label">03  选择日期与开始时间</div>';
  html += dateChips(d.dateStr, 8, 0);
  if (d.staffId && d.serviceIds.length && preview.ok) {
    var slots = preview.data.slots || [];
    if (!slots.length) html += '<div class="notice">该日没有足够的连续空档，请改选日期或发型师。</div>';
    else {
      html += '<div class="slots">';
      slots.forEach(function (sl) {
        var on = d.start && MokujoTime.parseISO(d.start) === sl.start;
        html += '<button type="button" class="slot' + (on ? " on" : "") + '" data-act="pick-slot" data-start="' + sl.start + '">' + esc(sl.hm) + "</button>";
      });
      html += "</div><p class=\"meta\">可选开始时间按 " + (state.shop.startStep || 15) + " 分钟步长，并允许紧接下一段占用的结束时刻。</p>";
    }
  } else {
    html += '<p class="meta">请先选定项目与发型师，再查看可约开始时间。</p>';
  }

  html += '<div class="form-label">04  姓名与联系方式</div>';
  html += '<input class="input" data-field="contactName" value="' + esc(d.contactName || "") + '" placeholder="姓名">';
  html += '<input class="input" data-field="phone" value="' + esc(d.phone || "") + '" placeholder="手机号" style="margin-top:8px;">';

  if (!ref) {
    html += '<div class="form-label">05  推荐来源（可选，仅可填写一次）</div>';
    html += '<select class="input" data-field="referralType"><option value="">暂不填写</option>';
    MokujoEngine.REF_TYPES.filter(function (t) { return t !== "未填写"; }).forEach(function (t) {
      html += '<option value="' + t + '"' + (d.referralType === t ? " selected" : "") + ">" + t + "</option>";
    });
    html += "</select>";
    if (d.referralType === "朋友推荐") {
      html += '<select class="input" data-field="referrerId" style="margin-top:8px;"><option value="">选择推荐人</option>';
      state.customers.forEach(function (c) {
        if (c.id === customerId) return;
        html += '<option value="' + c.id + '"' + (d.referrerId === c.id ? " selected" : "") + ">" + esc(c.name) + "</option>";
      });
      html += "</select><p class=\"meta\">不能推荐自己。</p>";
    }
  } else {
    html += '<div class="notice">首次推荐来源已记录为「' + esc(ref.type) + "」，不能再修改。</div>";
  }

  html += '<div class="btn-row"><button class="btn btn-block" data-act="submit-book">提交预约</button></div>';
  html += '<p class="footer-note">提交后进入待确认，并按门店时限占用时段。演示样品 · 非真实经营数据</p></div>';
  return html;
};

MokujoViews["c/book-result"] = function (ctx) {
  var apt = MokujoEngine.getAppointment(ctx.state, ctx.route.id);
  if (!apt) return '<div class="page">找不到该预约。</div>';
  var b = aptBrief(ctx.state, apt);
  var now = ctx.now;
  var html = '<div class="page"><div class="kicker">Ticket</div><h1 class="page-title">预约已提交</h1>';
  html += "<p>" + statusBadge(apt.status) + "</p>";
  html += '<div class="card"><div class="mono">No. ' + esc(ticketNo(apt)) + "</div><div style=\"margin-top:8px;\">" + esc(b.when) + "</div><div class=\"meta\">" + esc(b.staff) + " · " + esc(b.items) + "</div></div>";
  if (apt.status === "待确认") html += countdownHtml(apt, now);
  if (apt.status === "超时未确认") html += '<div class="notice warn">' + esc(timeoutCustomerCopy()) + "</div>";
  html += '<div class="btn-row"><button class="btn" data-go="#/c/appointment/' + apt.id + '">查看详情</button><button class="btn-ghost" data-go="#/c/appointments">我的预约</button></div></div>';
  return html;
};

MokujoViews["c/appointments"] = function (ctx) {
  var user = MokujoEngine.actorOf(ctx.state, ctx.state.currentUserId);
  var list = ctx.state.appointments.filter(function (a) { return user && a.customerId === user.customerId; });
  list.sort(function (a, b) { return MokujoTime.parseISO(b.start) - MokujoTime.parseISO(a.start); });
  var html = '<div class="page"><div class="kicker">My Bookings</div><h1 class="page-title">我的预约</h1><button class="btn btn-block" data-go="#/c/book">开始新的预约</button>';
  if (!list.length) html += '<div class="empty">还没有预约。选一个项目，约一位发型师。</div>';
  list.forEach(function (apt) {
    var b = aptBrief(ctx.state, apt);
    html += '<button class="list-item" data-go="#/c/appointment/' + apt.id + '"><div class="row"><strong>' + esc(b.when) + "</strong>" + statusBadge(apt.status) + '</div><div class="meta">' + esc(b.staff) + " · " + esc(b.items) + "</div>";
    if (apt.status === "待确认") html += countdownHtml(apt, ctx.now);
    html += "</button>";
  });
  return html + "</div>";
};

MokujoViews["c/appointment"] = function (ctx) {
  var apt = MokujoEngine.getAppointment(ctx.state, ctx.route.id);
  if (!apt) return '<div class="page">找不到该预约。</div>';
  var user = MokujoEngine.actorOf(ctx.state, ctx.state.currentUserId);
  if (!user || user.customerId !== apt.customerId) return '<div class="page">当前身份没有权限查看该预约。</div>';
  var b = aptBrief(ctx.state, apt);
  var can = MokujoEngine.canCustomerCancel(ctx.state, apt, ctx.now);
  var html = '<div class="page"><button class="back" data-go="#/c/appointments">← 我的预约</button><div class="kicker">Detail</div><h1 class="page-title">预约详情</h1>';
  html += "<p>" + statusBadge(apt.status) + "</p>";
  html += '<div class="card"><div class="mono">No. ' + esc(ticketNo(apt)) + "</div><div style=\"margin-top:8px;\">" + esc(b.when) + "</div><div class=\"meta\">发型师 " + esc(b.staff) + " · 椅位 " + esc(findName(ctx.state.chairs, apt.chairId)) + "</div></div>";
  html += '<div class="form-label">项目清单</div>' + itemListHtml(apt.items);
  html += '<div class="row"><span>总时长</span><strong>' + apt.totalDurationMin + " 分钟</strong></div>";
  html += '<div class="row"><span>总价（模拟）</span>' + moneySim(apt.totalPriceFen) + "</div>";
  if (apt.status === "待确认") html += countdownHtml(apt, ctx.now);
  if (apt.status === "超时未确认") {
    html += '<div class="notice warn">' + esc(timeoutCustomerCopy()) + "</div>";
    html += '<button class="btn btn-block" data-go="#/c/book">重新预约</button>';
  }
  if (can.ok) html += '<div class="btn-row"><button class="btn-ghost" data-act="customer-cancel" data-id="' + apt.id + '">取消预约</button></div>';
  else if (apt.status === "已确认" || apt.status === "已到店") html += '<p class="meta">' + esc(can.message || "到店之后不能自行取消，请联系门店。") + "</p>";
  return html + "</div>";
};

MokujoViews["c/member"] = function (ctx) {
  var shop = ctx.state.shop;
  var user = MokujoEngine.actorOf(ctx.state, ctx.state.currentUserId);
  var cus = user && user.customerId ? MokujoEngine.getCustomer(ctx.state, user.customerId) : null;
  var html = '<div class="page"><div class="kicker">Membership</div><h1 class="page-title">会员权益</h1>';
  html += '<div class="photo-inset"><img src="assets/images/still-tools.jpg" alt="" style="height:160px;object-fit:cover;width:100%;"></div>';
  html += '<p class="lede">以下为虚拟门店的权益说明，用于演示，不构成真实优惠承诺。</p>';
  html += "<p>会员状态：" + (cus && cus.member ? "已是演示会员" : "尚未标记为会员（首次核销或获卡后将自动标记）") + "</p>";
  html += "<ul>" + (shop.memberBenefits || []).map(function (b) { return "<li class=\"lede\">" + esc(b) + "</li>"; }).join("") + "</ul>";
  html += '<div class="btn-row"><button class="btn" data-go="#/c/cards">我的次卡</button><button class="btn-ghost" data-go="#/c/buy">演示购买次卡</button></div></div>';
  return html;
};

MokujoViews["c/buy"] = function (ctx) {
  var html = '<div class="page"><button class="back" data-go="#/c/member">← 会员</button><div class="kicker">Demo Card</div><h1 class="page-title">演示购买次卡</h1><p class="lede">这是完整的确认流程，但不接入真实支付，也不会把购卡金额计入经营看板的收银。</p>';
  ctx.state.cardProducts.forEach(function (p) {
    html += '<div class="card"><h3>' + esc(p.name) + "</h3><div class=\"meta\">" + esc(p.desc) + "</div><div class=\"row\" style=\"margin-top:8px;\"><span>演示售价</span>" + moneySim(p.demoPriceFen) + "</div><div class=\"meta\">共 " + p.totalCounts + " 次</div>" +
      '<button class="btn" style="margin-top:10px;" data-act="demo-buy" data-id="' + p.id + '">演示购买</button></div>';
  });
  return html + "</div>";
};

MokujoViews["c/cards"] = function (ctx) {
  var user = MokujoEngine.actorOf(ctx.state, ctx.state.currentUserId);
  var cards = user ? MokujoEngine.cardsForCustomer(ctx.state, user.customerId) : [];
  var leds = (ctx.state.punchLedgers || []).filter(function (l) { return user && l.customerId === user.customerId; }).slice().reverse();
  var html = '<div class="page"><button class="back" data-go="#/c/member">← 会员</button><div class="kicker">Punch Cards</div><h1 class="page-title">我的次卡</h1>';
  if (!cards.length) html += '<div class="empty">暂无次卡。<button class="btn-text" data-go="#/c/buy">去演示购买</button></div>';
  cards.forEach(function (c) {
    var names = c.serviceIds.map(function (id) { var s = MokujoEngine.getService(ctx.state, id); return s ? s.name : id; }).join("、");
    html += '<div class="card"><h3>' + esc(c.name) + "</h3><div class=\"row\"><span>剩余次数</span><strong>" + c.remaining + " / " + c.totalCounts + '</strong></div><div class="meta">适用：' + esc(names) + "</div></div>";
  });
  html += '<div class="form-label">扣次与发放流水</div>';
  if (!leds.length) html += '<p class="meta">暂无流水。</p>';
  leds.forEach(function (l) {
    html += '<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line);font-size:12px;"><span>' + esc(MokujoTime.formatDateTimeCN(MokujoTime.parseISO(l.createdAt))) + (l.note ? " · " + esc(l.note) : "") + "</span><strong>" + (l.change > 0 ? "+" : "") + l.change + "</strong></div>";
  });
  html += '<div class="btn-row"><button class="btn-ghost" data-go="#/c/buy">演示购买次卡</button></div></div>';
  return html;
};

MokujoViews["c/records"] = function (ctx) {
  var user = MokujoEngine.actorOf(ctx.state, ctx.state.currentUserId);
  var recs = (ctx.state.consumptionRecords || []).filter(function (r) { return user && r.customerId === user.customerId; }).slice().reverse();
  var html = '<div class="page"><button class="back" data-go="#/c/mine">← 我的</button><div class="kicker">Ledger</div><h1 class="page-title">消费记录</h1><p class="lede">金额均为演示模拟数据。</p>';
  if (!recs.length) html += '<div class="empty">暂无消费记录。</div>';
  recs.forEach(function (r) {
    html += '<div class="card"><div class="meta">' + esc(MokujoTime.formatDateTimeCN(MokujoTime.parseISO(r.redeemedAt))) + '</div>' +
      r.items.map(function (it) { return '<div class="row"><span>' + esc(it.name) + (it.method === "card" ? " · 次卡" : " · 模拟付款") + "</span>" + moneySim(it.method === "card" ? 0 : it.cashFen) + "</div>"; }).join("") +
      '<div class="row"><span>收银合计（模拟）</span>' + moneySim(r.cashTotalFen) + "</div>" +
      (r.cardOriginalTotalFen ? '<div class="meta">次卡抵扣项目原价 ' + esc(MokujoEngine.moneyLabel(r.cardOriginalTotalFen)) + "（模拟，不计入收银）</div>" : "") +
      '<button class="btn-text" data-go="#/c/book">再次预约</button></div>';
  });
  return html + "</div>";
};

MokujoViews["c/share"] = function (ctx) {
  var user = MokujoEngine.actorOf(ctx.state, ctx.state.currentUserId);
  var mark = user && user.customerId ? user.customerId : "demo";
  var link = "mokujo-demo://share?ref=" + encodeURIComponent(mark);
  return (
    '<div class="page"><button class="back" data-go="#/c/mine">← 我的</button><div class="kicker">Share</div><h1 class="page-title">门店分享</h1>' +
    '<p class="lede">第一版只记录推荐来源，不做返现、多级分销或自动奖励。下面是带推荐标记的模拟链接，不是真实网址。</p>' +
    '<div class="share-box">' + esc(link) + "</div>" +
    '<p class="meta">新顾客若通过此标记进入并首次填写来源为「朋友推荐」，将记录你为推荐人。自己打开自己的分享不能推荐自己。</p>' +
    '<button class="btn btn-block" data-act="copy-share" data-link="' + esc(link) + '">复制模拟链接</button>' +
    '<p class="footer-note">演示样品 · 虚拟数据 · 非真实经营数据</p></div>'
  );
};

MokujoViews["c/mine"] = function (ctx) {
  var user = MokujoEngine.actorOf(ctx.state, ctx.state.currentUserId);
  var cus = user && user.customerId ? MokujoEngine.getCustomer(ctx.state, user.customerId) : null;
  var ref = cus ? MokujoEngine.getReferral(ctx.state, cus.id) : null;
  return (
    '<div class="page"><div class="kicker">Account</div><h1 class="page-title">我的</h1>' +
    '<div class="card"><strong>' + esc(cus ? cus.name : "演示顾客") + '</strong><div class="meta">' + esc(cus ? cus.phone : "") + " · " + (cus && cus.member ? "演示会员" : "普通顾客") + '</div><div class="meta">当前为演示角色，不是正式登录。</div></div>' +
    (ref ? '<div class="notice">首次推荐来源：' + esc(ref.type) + (ref.referrerId ? "（" + esc(findName(ctx.state.customers, ref.referrerId)) + "）" : "") + (ref.convertedAt ? " · 已有效转化" : " · 尚未有效转化") + "</div>" : "") +
    '<button class="menu-link" data-go="#/c/appointments">我的预约<small>查看状态、倒计时与取消</small></button>' +
    '<button class="menu-link" data-go="#/c/cards">我的次卡<small>余次与流水</small></button>' +
    '<button class="menu-link" data-go="#/c/records">消费记录<small>模拟核销历史</small></button>' +
    '<button class="menu-link" data-go="#/c/share">分享门店<small>模拟推荐链接</small></button>' +
    '<p class="footer-note">演示样品 · 虚拟数据 · 非真实经营数据</p></div>'
  );
};
