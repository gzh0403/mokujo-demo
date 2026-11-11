/* Owner-end views */
var MokujoViews = MokujoViews || {};

MokujoViews["o/dashboard"] = function (ctx) {
  var range = (MokujoUI.query && MokujoUI.query.popularRange) || "today";
  var dash = MokujoEngine.computeDashboard(ctx.state, { now: ctx.now, popularRange: range });
  var html = '<div class="page owner"><div class="kicker">Daily Board</div><h1 class="page-title">今日经营看板</h1>';
  html += '<p class="lede">' + esc(MokujoTime.formatDateCN(dash.dateStr)) + ' · <span class="sim">全部数字均由演示数据现场计算，金额为模拟，非真实营业收入。</span></p>';
  html += '<div class="stat-grid">';
  html += '<div class="stat"><div class="n">' + dash.appointmentCountValid + '</div><div class="l">今日预约数量（有效）<br>另有取消 ' + dash.cancelledCount + " / 超时未确认 " + dash.timeoutCount + "</div></div>";
  html += '<div class="stat"><div class="n">' + esc(MokujoEngine.moneyLabel(dash.cashFen)) + '</div><div class="l">今日完成核销金额 <span class="sim">模拟</span><br>仅统计核销成功的收银，次卡项目计 0</div></div>';
  html += '<div class="stat"><div class="n">' + esc(MokujoEngine.moneyLabel(dash.cardOriginalFen)) + '</div><div class="l">今日次卡抵扣项目原价 <span class="sim">模拟</span><br>不混入收银金额</div></div>';
  html += '<div class="stat"><div class="n">' + dash.finishedVisitCount + '</div><div class="l">今日完成服务数量（按接待计）<br>另计项目件数 ' + dash.finishedItemCount + "</div></div>";
  html += '<div class="stat"><div class="n">' + dash.arrivedCustomerCount + '</div><div class="l">今日到店人数（按顾客去重）</div></div>';
  html += '<div class="stat"><div class="n">' + esc(dash.attendanceText) + '</div><div class="l">预约到店率<br>应到 ' + dash.dueCount + " · 已到店 " + dash.arrivedApptCount + "</div></div>";
  html += '<div class="stat"><div class="n">' + dash.newCustomers + '</div><div class="l">今日新客（按首次有效消费记录）</div></div>';
  html += '<div class="stat"><div class="n">' + dash.oldCustomers + '</div><div class="l">今日老客（今日核销且此前已有消费）</div></div>';
  html += "</div>";

  html += '<hr class="rule"><div class="kicker">Popular</div><h2 class="page-title" style="font-size:18px;">热门服务项目</h2>';
  html += '<div class="chip-row">';
  [["today","今日"],["7d","近7日"],["month","本月"]].forEach(function (x) {
    html += '<button class="chip' + (range === x[0] ? " on" : "") + '" data-act="pop-range" data-range="' + x[0] + '">' + x[1] + "</button>";
  });
  html += "</div>";
  if (!dash.popular.length) html += '<p class="meta">该统计期尚无核销项目。</p>';
  html += '<table class="table"><tr><th>项目</th><th>次数</th><th>原价合计（模拟）</th></tr>';
  dash.popular.forEach(function (p, i) {
    html += "<tr><td>" + (i + 1) + ". " + esc(p.name) + "</td><td>" + p.count + "</td><td>" + esc(MokujoEngine.moneyLabel(p.originalFen)) + "</td></tr>";
  });
  html += "</table>";

  html += '<hr class="rule"><div class="kicker">Team</div><h2 class="page-title" style="font-size:18px;">员工服务数量</h2>';
  html += '<table class="table"><tr><th>发型师</th><th>接待次数</th><th>项目件数</th></tr>';
  dash.staffStats.forEach(function (s) {
    html += "<tr><td>" + esc(s.name) + "</td><td>" + s.visitCount + "</td><td>" + s.itemCount + "</td></tr>";
  });
  html += "</table>";

  html += '<hr class="rule"><div class="kicker">Referrals</div><h2 class="page-title" style="font-size:18px;">推荐来源及有效转化</h2>';
  html += '<table class="table"><tr><th>来源</th><th>今日新增</th><th>今日转化</th><th>累计转化</th><th>转化率</th></tr>';
  dash.referralList.forEach(function (r) {
    html += "<tr><td>" + esc(r.type) + "</td><td>" + r.newInPeriod + "</td><td>" + r.convertedInPeriod + "</td><td>" + r.convertedCumulative + "</td><td>" + esc(r.rateText) + "</td></tr>";
  });
  html += "</table><p class=\"meta\">有效转化只计首次真实到店并生成消费记录。转化率分母为同期新增来源记录，分母为 0 时不显示百分比。</p>";

  html += '<hr class="rule"><div class="form-label">各状态数量（今日开始的预约）</div><div class="meta">';
  var stc = dash.statusCount;
  Object.keys(stc).forEach(function (k) { html += esc(k) + " " + stc[k] + "　"; });
  html += "</div>";

  html += '<div class="form-label">待结算清单</div>';
  if (!dash.pendingSettlement.length) html += '<p class="meta">没有待结算。</p>';
  dash.pendingSettlement.forEach(function (a) {
    html += '<button class="list-item" data-go="#/o/appointment/' + a.id + '">' + esc(findName(ctx.state.customers, a.customerId)) + " · " + esc(MokujoTime.formatDateTimeCN(MokujoTime.parseISO(a.start))) + "</button>";
  });
  html += '<div class="form-label">待确认</div>';
  if (!dash.pendingConfirm.length) html += '<p class="meta">没有待确认。</p>';
  dash.pendingConfirm.forEach(function (a) {
    html += '<button class="list-item" data-go="#/o/appointment/' + a.id + '">' + esc(findName(ctx.state.customers, a.customerId)) + " · " + esc(MokujoTime.formatDateTimeCN(MokujoTime.parseISO(a.start))) + " " + statusBadge("待确认") + "</button>";
  });
  html += '<p class="footer-note">演示样品 · 虚拟数据 · 非真实经营数据</p></div>';
  return html;
};

MokujoViews["o/appointments"] = function (ctx) {
  var date = staffDate(ctx);
  var stFilter = (MokujoUI.query && MokujoUI.query.status) || "";
  var staffFilter = (MokujoUI.query && MokujoUI.query.staff) || "";
  var list = appointmentsOn(ctx.state, date);
  if (stFilter) list = list.filter(function (a) { return a.status === stFilter; });
  if (staffFilter) list = list.filter(function (a) { return a.staffId === staffFilter; });
  var html = '<div class="page"><div class="kicker">Bookings</div><h1 class="page-title">预约管理</h1>';
  html += dateChips(date, 8, -1);
  html += '<div class="split-2"><select class="input" data-field="statusFilter"><option value="">全部状态</option>';
  ["待确认","已确认","已到店","服务中","待结算","已完成","超时未确认","已取消","逾期未到","到店后取消","结算作废"].forEach(function (s) {
    html += '<option' + (stFilter === s ? " selected" : "") + ">" + s + "</option>";
  });
  html += '</select><select class="input" data-field="staffFilter"><option value="">全部发型师</option>';
  ctx.state.staff.forEach(function (st) {
    html += '<option value="' + st.id + '"' + (staffFilter === st.id ? " selected" : "") + ">" + esc(st.name) + "</option>";
  });
  html += "</select></div>";
  if (!list.length) html += '<div class="empty">没有符合条件的预约。</div>';
  list.forEach(function (a) { html += aptRow(ctx.state, a, ctx.now, "o"); });
  return html + "</div>";
};

MokujoViews["o/ops"] = function (ctx) {
  var items = [
    ["#/o/services", "服务项目管理", "上下架、价格、时长与类别"],
    ["#/o/staff", "员工资料", "发型师、擅长项目与默认椅位"],
    ["#/o/schedule", "员工排班", "按星期或日期设排班与休息"],
    ["#/o/chairs", "椅位管理", "名称与启用状态"],
    ["#/o/customers", "顾客档案", "全店顾客与详情"],
    ["#/o/members", "会员管理", "会员标记与权益说明"],
    ["#/o/cards", "次卡管理", "发放演示次卡与流水"],
    ["#/o/records", "消费记录", "全店模拟核销清单"],
    ["#/o/newold", "新老顾客统计", "按有效消费记录口径"],
    ["#/o/referrals", "推荐来源统计", "新增、转化与一次更正"]
  ];
  var html = '<div class="page"><div class="kicker">Operations</div><h1 class="page-title">经营</h1>';
  items.forEach(function (it) {
    html += '<button class="menu-link" data-go="' + it[0] + '">' + esc(it[1]) + "<small>" + esc(it[2]) + "</small></button>";
  });
  return html + "</div>";
};

MokujoViews["o/settings"] = function (ctx) {
  var items = [
    ["#/o/rules", "营业时间与规则", "确认超时、展示间隔、步长、取消提前量"],
    ["#/o/shop", "门店资料", "品牌、介绍、地址与公告"],
    ["#/o/roles", "身份与权限", "添加或停用店员"],
    ["#/o/demo", "演示数据管理", "初始化与重置"]
  ];
  var html = '<div class="page"><div class="kicker">Settings</div><h1 class="page-title">设置</h1>';
  items.forEach(function (it) {
    html += '<button class="menu-link" data-go="' + it[0] + '">' + esc(it[1]) + "<small>" + esc(it[2]) + "</small></button>";
  });
  return html + '<p class="footer-note">演示工具仅出现在本样品中，正式产品不保留。</p></div>';
};

MokujoViews["o/services"] = function (ctx) {
  var html = '<div class="page"><button class="back" data-go="#/o/ops">← 经营</button><div class="kicker">Services</div><h1 class="page-title">服务项目</h1><button class="btn" data-act="new-service">新增项目</button>';
  ctx.state.services.forEach(function (s) {
    html += '<button class="list-item" data-go="#/o/service-edit/' + s.id + '"><div class="row"><strong>' + esc(s.name) + "</strong>" + moneySim(s.priceFen) + '</div><div class="meta">' + esc(s.category) + " · " + s.durationMin + " 分钟 · " + (s.on ? "上架" : "下架") + "</div></button>";
  });
  return html + "</div>";
};

MokujoViews["o/service-edit"] = function (ctx) {
  var s = ctx.route.id === "new" ? { id: "", name: "", category: "剪发", durationMin: 45, priceFen: 18800, on: true, desc: "" } : MokujoEngine.getService(ctx.state, ctx.route.id);
  if (!s) return '<div class="page">找不到项目。</div>';
  var html = '<div class="page"><button class="back" data-go="#/o/services">← 项目列表</button><h1 class="page-title">' + (s.id ? "编辑项目" : "新增项目") + "</h1>";
  html += '<label class="form-label">名称</label><input class="input" data-field="svc-name" value="' + esc(s.name) + '">';
  html += '<label class="form-label">类别</label><select class="input" data-field="svc-category">';
  (ctx.state.shop.categoryOrder || []).forEach(function (c) {
    html += '<option' + (s.category === c ? " selected" : "") + ">" + esc(c) + "</option>";
  });
  html += "</select>";
  html += '<label class="form-label">时长（分钟，可为非 30 倍数）</label><input class="input" type="number" data-field="svc-duration" value="' + s.durationMin + '">';
  html += '<label class="form-label">价格（元，演示）</label><input class="input" type="number" data-field="svc-price" value="' + (s.priceFen / 100) + '">';
  html += '<label class="form-label">说明</label><textarea class="input" data-field="svc-desc">' + esc(s.desc || "") + "</textarea>";
  html += '<label class="check-line"><input type="checkbox" data-field="svc-on"' + (s.on ? " checked" : "") + "> 上架</label>";
  html += '<button class="btn btn-block" data-act="save-service" data-id="' + esc(s.id || "new") + '">保存</button></div>';
  return html;
};

MokujoViews["o/staff"] = function (ctx) {
  var html = '<div class="page"><button class="back" data-go="#/o/ops">← 经营</button><div class="kicker">Team</div><h1 class="page-title">员工资料</h1><button class="btn" data-act="new-staff">新增发型师</button>';
  ctx.state.staff.forEach(function (st) {
    html += '<button class="list-item staff-row" data-go="#/o/staff-edit/' + st.id + '"><img class="avatar" src="' + esc(st.avatar) + '" alt=""><div><strong>' + esc(st.name) + "</strong><div class=\"meta\">" + esc(st.title) + " · " + (st.status === "active" ? "在职" : "停用") + "</div></div></button>";
  });
  return html + "</div>";
};

MokujoViews["o/staff-edit"] = function (ctx) {
  var st = ctx.route.id === "new" ? { id: "", name: "", title: "发型师", bio: "", serviceIds: [], defaultChairId: ctx.state.chairs[0].id, status: "active" } : MokujoEngine.getStaff(ctx.state, ctx.route.id);
  if (!st) return '<div class="page">找不到员工。</div>';
  var html = '<div class="page"><button class="back" data-go="#/o/staff">← 员工列表</button><h1 class="page-title">' + (st.id ? "编辑员工" : "新增员工") + "</h1>";
  html += '<label class="form-label">姓名</label><input class="input" data-field="st-name" value="' + esc(st.name) + '">';
  html += '<label class="form-label">头衔</label><input class="input" data-field="st-title" value="' + esc(st.title || "") + '">';
  html += '<label class="form-label">简介</label><textarea class="input" data-field="st-bio">' + esc(st.bio || "") + "</textarea>";
  html += '<label class="form-label">默认椅位</label><select class="input" data-field="st-chair">';
  ctx.state.chairs.forEach(function (c) {
    html += '<option value="' + c.id + '"' + (st.defaultChairId === c.id ? " selected" : "") + ">" + esc(c.name) + (c.enabled ? "" : "（停用）") + "</option>";
  });
  html += "</select><div class=\"form-label\">可接项目</div>";
  ctx.state.services.forEach(function (s) {
    html += '<label class="check-line"><input type="checkbox" data-st-svc="' + s.id + '"' + (st.serviceIds.indexOf(s.id) !== -1 ? " checked" : "") + "> " + esc(s.name) + "</label>";
  });
  if (st.id) html += '<label class="check-line"><input type="checkbox" data-field="st-active"' + (st.status === "active" ? " checked" : "") + "> 在职（取消勾选即停用，停用后不能再进入店员功能）</label>";
  html += '<button class="btn btn-block" data-act="save-staff" data-id="' + esc(st.id || "new") + '">保存</button></div>';
  return html;
};

MokujoViews["o/schedule"] = function (ctx) {
  var html = scheduleView(ctx, null, true);
  var extra = '<div class="page" style="padding-top:0;"><button class="back" data-go="#/o/ops">← 经营</button><hr class="rule"><h2 class="page-title" style="font-size:18px;">排班与休息设置</h2><p class="lede">按星期维护默认班次。也可为指定日期增加休息或临时占用。</p>';
  extra += '<div class="form-label">修改一条默认班次</div>';
  extra += '<select class="input" data-field="sch-staff">';
  ctx.state.staff.forEach(function (st) { extra += '<option value="' + st.id + '">' + esc(st.name) + "</option>"; });
  extra += '</select><select class="input" data-field="sch-week" style="margin-top:8px;">';
  "日一二三四五六".split("").forEach(function (n, i) { extra += '<option value="' + i + '">周' + n + "</option>"; });
  extra += '</select><div class="split-2" style="margin-top:8px;"><input class="input" data-field="sch-start" placeholder="开始 10:00" value="10:00"><input class="input" data-field="sch-end" placeholder="结束 20:00" value="20:00"></div>';
  extra += '<button class="btn" style="margin-top:8px;" data-act="save-schedule">保存该日班次</button>';
  extra += '<div class="form-label">增加休息段</div><div class="split-2"><input class="input" data-field="rest-start" placeholder="12:00"><input class="input" data-field="rest-end" placeholder="13:00"></div>';
  extra += '<button class="btn-gold" style="margin-top:8px;" data-act="save-rest">保存休息段</button>';
  extra += '<div class="form-label">临时占用（精确到日期时刻）</div>';
  extra += '<input class="input" data-field="blk-date" placeholder="日期 YYYY-MM-DD" value="' + esc(staffDate(ctx)) + '">';
  extra += '<div class="split-2" style="margin-top:8px;"><input class="input" data-field="blk-start" placeholder="14:00"><input class="input" data-field="blk-end" placeholder="15:00"></div>';
  extra += '<input class="input" data-field="blk-reason" placeholder="原因" style="margin-top:8px;">';
  extra += '<button class="btn-ghost" style="margin-top:8px;" data-act="add-block">标记临时占用</button></div>';
  return html + extra;
};

MokujoViews["o/chairs"] = function (ctx) {
  var html = '<div class="page"><button class="back" data-go="#/o/ops">← 经营</button><div class="kicker">Chairs</div><h1 class="page-title">椅位管理</h1><button class="btn" data-act="new-chair">新增椅位</button>';
  ctx.state.chairs.forEach(function (c) {
    html += '<div class="card"><div class="row"><strong>' + esc(c.name) + "</strong><span class=\"meta\">" + (c.enabled ? "启用" : "停用") + "</span></div>" +
      '<div class="btn-row"><button class="btn-ghost" data-act="rename-chair" data-id="' + c.id + '">改名</button><button class="btn-gold" data-act="toggle-chair" data-id="' + c.id + '">' + (c.enabled ? "停用" : "启用") + "</button></div></div>";
  });
  return html + "</div>";
};

MokujoViews["o/customers"] = function (ctx) {
  var html = '<div class="page"><button class="back" data-go="#/o/ops">← 经营</button><div class="kicker">Customers</div><h1 class="page-title">顾客档案</h1>';
  ctx.state.customers.forEach(function (c) {
    html += '<button class="list-item" data-go="#/o/customer/' + c.id + '"><div class="row"><strong>' + esc(c.name) + "</strong><span class=\"meta\">" + esc(c.phone) + "</span></div></button>";
  });
  return html + "</div>";
};

MokujoViews["o/members"] = function (ctx) {
  var html = '<div class="page"><button class="back" data-go="#/o/ops">← 经营</button><div class="kicker">Members</div><h1 class="page-title">会员管理</h1><p class="lede">权益说明可在门店资料中编辑。不提供无凭证地直接改次卡次数。</p>';
  ctx.state.customers.forEach(function (c) {
    html += '<div class="card"><div class="row"><strong>' + esc(c.name) + "</strong><span>" + (c.member ? "演示会员" : "非会员") + "</span></div>" +
      (c.memberSince ? '<div class="meta">加入：' + esc(MokujoTime.formatDateTimeCN(MokujoTime.parseISO(c.memberSince))) + "</div>" : "") +
      '<button class="btn-text" data-go="#/o/customer/' + c.id + '">查看档案</button></div>';
  });
  html += '<div class="form-label">权益说明</div><ul>' + (ctx.state.shop.memberBenefits || []).map(function (b) { return "<li class=\"lede\">" + esc(b) + "</li>"; }).join("") + "</ul>";
  return html + "</div>";
};

MokujoViews["o/cards"] = function (ctx) {
  var html = '<div class="page"><button class="back" data-go="#/o/ops">← 经营</button><div class="kicker">Cards</div><h1 class="page-title">次卡管理</h1><p class="lede">可发放演示次卡。购卡或发放金额不计入经营看板收银。</p>';
  html += '<div class="card"><h3>发放演示次卡</h3><select class="input" data-field="issue-cus">';
  ctx.state.customers.forEach(function (c) { html += '<option value="' + c.id + '">' + esc(c.name) + "</option>"; });
  html += '</select><select class="input" data-field="issue-prod" style="margin-top:8px;">';
  ctx.state.cardProducts.forEach(function (p) { html += '<option value="' + p.id + '">' + esc(p.name) + "</option>"; });
  html += '</select><button class="btn" style="margin-top:8px;" data-act="issue-card">发放</button></div>';
  ctx.state.punchCards.forEach(function (c) {
    html += '<div class="card"><div class="row"><strong>' + esc(c.name) + "</strong><span>余 " + c.remaining + " / " + c.totalCounts + "</span></div><div class=\"meta\">" + esc(findName(ctx.state.customers, c.customerId)) + " · " + esc(c.source) + "</div></div>";
  });
  html += '<div class="form-label">流水</div>';
  (ctx.state.punchLedgers || []).slice().reverse().forEach(function (l) {
    html += '<div class="row" style="font-size:12px;padding:6px 0;border-bottom:1px solid var(--line);"><span>' + esc(MokujoTime.formatDateTimeCN(MokujoTime.parseISO(l.createdAt))) + " · " + esc(findName(ctx.state.customers, l.customerId)) + "</span><strong>" + (l.change > 0 ? "+" : "") + l.change + "</strong></div>";
  });
  return html + "</div>";
};

MokujoViews["o/records"] = function (ctx) {
  var recs = (ctx.state.consumptionRecords || []).slice().reverse();
  var html = '<div class="page"><button class="back" data-go="#/o/ops">← 经营</button><div class="kicker">Ledger</div><h1 class="page-title">消费记录</h1><p class="sim">以下金额均为演示模拟数据。</p>';
  if (!recs.length) html += '<div class="empty">暂无记录</div>';
  recs.forEach(function (r) {
    html += '<div class="card"><div class="meta">' + esc(MokujoTime.formatDateTimeCN(MokujoTime.parseISO(r.redeemedAt))) + " · " + esc(findName(ctx.state.customers, r.customerId)) + " · " + esc(findName(ctx.state.staff, r.staffId)) + "</div>";
    r.items.forEach(function (it) {
      html += '<div class="row"><span>' + esc(it.name) + (it.method === "card" ? " · 次卡" : " · 模拟付款") + "</span>" + moneySim(it.cashFen) + "</div>";
    });
    html += '<div class="row"><span>收银（模拟）</span>' + moneySim(r.cashTotalFen) + "</div></div>";
  });
  return html + "</div>";
};

MokujoViews["o/newold"] = function (ctx) {
  var dash = MokujoEngine.computeDashboard(ctx.state, { now: ctx.now });
  var html = '<div class="page"><button class="back" data-go="#/o/ops">← 经营</button><div class="kicker">Cohorts</div><h1 class="page-title">新老顾客统计</h1><p class="lede">按有效消费记录定义，不按仅到店未核销定义。</p>';
  html += '<div class="stat-grid"><div class="stat"><div class="n">' + dash.newCustomers + '</div><div class="l">今日新客</div></div><div class="stat"><div class="n">' + dash.oldCustomers + '</div><div class="l">今日老客</div></div></div>';
  html += '<p class="meta">今日新客：今日产生该顾客人生第一笔有效消费记录。今日老客：今日产生有效消费记录，且今日之前已有过至少一笔。</p></div>';
  return html;
};

MokujoViews["o/referrals"] = function (ctx) {
  var dash = MokujoEngine.computeDashboard(ctx.state, { now: ctx.now });
  var html = '<div class="page"><button class="back" data-go="#/o/ops">← 经营</button><div class="kicker">Sources</div><h1 class="page-title">推荐来源统计</h1>';
  html += '<table class="table"><tr><th>来源</th><th>今日新增</th><th>今日转化</th><th>累计转化</th></tr>';
  dash.referralList.forEach(function (r) {
    html += "<tr><td>" + esc(r.type) + "</td><td>" + r.newInPeriod + "</td><td>" + r.convertedInPeriod + "</td><td>" + r.convertedCumulative + "</td></tr>";
  });
  html += "</table><hr class=\"rule\"><h2 class=\"page-title\" style=\"font-size:18px;\">顾客来源与一次更正</h2><p class=\"lede\">仅在尚未有效转化、且写入后 24 小时内，老板可更正一次，必须填写原因。</p>";
  ctx.state.customers.forEach(function (c) {
    var ref = MokujoEngine.getReferral(ctx.state, c.id);
    html += '<div class="card"><div class="row"><strong>' + esc(c.name) + "</strong><span class=\"meta\">" + (ref ? esc(ref.type) : "未填写") + "</span></div>";
    if (ref && ref.referrerId) html += '<div class="meta">推荐人：' + esc(findName(ctx.state.customers, ref.referrerId)) + "</div>";
    if (ref && ref.convertedAt) html += '<div class="meta">已有效转化，不能再改。</div>';
    else if (ref) html += '<button class="btn-gold" data-act="correct-ref" data-id="' + c.id + '">更正来源</button>';
    if (ref && ref.correction) html += '<div class="meta">更正记录：' + esc(ref.correction.reason) + " · " + esc(MokujoTime.formatDateTimeCN(MokujoTime.parseISO(ref.correction.at))) + "</div>";
    html += "</div>";
  });
  return html + "</div>";
};

MokujoViews["o/rules"] = function (ctx) {
  var s = ctx.state.shop;
  var html = '<div class="page"><button class="back" data-go="#/o/settings">← 设置</button><div class="kicker">Rules</div><h1 class="page-title">营业时间与规则</h1>';
  html += '<div class="notice">已提交的待确认预约，以提交当时写入的超时时长为准。新设置只对以后新提交的预约生效。</div>';
  html += '<label class="form-label">确认超时（5–120 整数分钟）</label><input class="input" type="number" data-field="rule-timeout" value="' + s.confirmTimeoutMinutes + '">';
  html += '<label class="form-label">展示间隔（仅影响日程怎么画）</label><select class="input" data-field="rule-interval">';
  [15, 30, 60].forEach(function (n) { html += '<option value="' + n + '"' + (s.displayInterval === n ? " selected" : "") + ">" + n + " 分钟</option>"; });
  html += "</select>";
  html += '<label class="form-label">可选开始时间步长</label><select class="input" data-field="rule-step">';
  [5, 10, 15, 30].forEach(function (n) { html += '<option value="' + n + '"' + (s.startStep === n ? " selected" : "") + ">" + n + " 分钟</option>"; });
  html += "</select>";
  html += '<label class="form-label">顾客自行取消提前量（小时）</label><input class="input" type="number" data-field="rule-lead" value="' + s.cancelLeadHours + '">';
  html += '<div class="form-label">周循环营业时间</div>';
  (s.hours || []).forEach(function (h) {
    html += '<div class="row" style="margin:6px 0;"><span>周' + "日一二三四五六".charAt(h.weekday) + '</span><span><input class="input" style="width:90px;display:inline-block;" data-hours-start="' + h.weekday + '" value="' + esc(h.start) + '"> – <input class="input" style="width:90px;display:inline-block;" data-hours-end="' + h.weekday + '" value="' + esc(h.end) + '"></span></div>';
  });
  html += '<button class="btn btn-block" data-act="save-rules">保存规则</button></div>';
  return html;
};

MokujoViews["o/shop"] = function (ctx) {
  var s = ctx.state.shop;
  var html = '<div class="page"><button class="back" data-go="#/o/settings">← 设置</button><div class="kicker">Profile</div><h1 class="page-title">门店资料</h1>';
  html += '<label class="form-label">品牌名称</label><input class="input" data-field="shop-brand" value="' + esc(s.brandName) + '">';
  html += '<label class="form-label">英文副标题</label><input class="input" data-field="shop-sub" value="' + esc(s.subtitle) + '">';
  html += '<label class="form-label">地址</label><input class="input" data-field="shop-addr" value="' + esc(s.address) + '">';
  html += '<label class="form-label">电话</label><input class="input" data-field="shop-phone" value="' + esc(s.phone) + '">';
  html += '<label class="form-label">公告</label><textarea class="input" data-field="shop-ann">' + esc(s.announcement) + "</textarea>";
  html += '<label class="form-label">介绍</label><textarea class="input" data-field="shop-intro">' + esc(s.intro) + "</textarea>";
  html += '<label class="form-label">会员权益（一行一条）</label><textarea class="input" data-field="shop-benefits">' + esc((s.memberBenefits || []).join("\n")) + "</textarea>";
  html += '<button class="btn btn-block" data-act="save-shop">保存资料</button></div>';
  return html;
};

MokujoViews["o/roles"] = function (ctx) {
  var html = '<div class="page"><button class="back" data-go="#/o/settings">← 设置</button><div class="kicker">Access</div><h1 class="page-title">身份与权限</h1><p class="lede">演示环境用角色切换进入预置账号。正式产品禁止空表自提管理员。此处可添加或停用店员。</p>';
  ctx.state.users.forEach(function (u) {
    html += '<div class="card"><div class="row"><strong>' + esc(u.name) + "</strong><span class=\"meta\">" + esc(u.role) + " · " + esc(u.status) + "</span></div>";
    if (u.role === "staff") html += '<button class="btn-gold" data-act="toggle-user" data-id="' + u.id + '">' + (u.status === "active" ? "停用店员" : "重新启用") + "</button>";
    html += "</div>";
  });
  html += '<hr class="rule"><p class="meta">新增发型师时会同步创建店员身份，请到「员工资料」办理。</p></div>';
  return html;
};

MokujoViews["o/demo"] = function (ctx) {
  return (
    '<div class="page"><button class="back" data-go="#/o/settings">← 设置</button><div class="kicker">Demo Data</div><h1 class="page-title">演示数据管理</h1>' +
    '<p class="lede">初始化与重置会按「今天」（亚洲/上海）重新生成虚拟门店、预约、次卡与消费记录，方便反复演示看板的动态计算。</p>' +
    '<div class="notice warn">重置会覆盖当前浏览器中已操作的演示进度，不可撤销。</div>' +
    '<div class="btn-row"><button class="btn" data-act="init-data">初始化演示数据</button><button class="btn-ghost" data-act="reset-data">一键重置</button></div>' +
    '<p class="footer-note">当前数据生成于 ' + esc(ctx.state.seededAt || "—") + " · 演示日 " + esc(ctx.state.seedToday || "—") + "</p></div>"
  );
};
