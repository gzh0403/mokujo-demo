/* MOKUJO 木序 P2 — shared business engine. All writes go through here. */
var MokujoEngine = (function () {
  var STATUS = {
    PENDING: "待确认",
    CONFIRMED: "已确认",
    ARRIVED: "已到店",
    IN_SERVICE: "服务中",
    SETTLE: "待结算",
    DONE: "已完成",
    TIMEOUT: "超时未确认",
    CANCELLED: "已取消",
    NOSHOW: "逾期未到",
    CANCEL_AFTER: "到店后取消",
    VOID: "结算作废"
  };

  var LOCKING = [STATUS.PENDING, STATUS.CONFIRMED, STATUS.ARRIVED, STATUS.IN_SERVICE];
  var TERMINAL = [STATUS.TIMEOUT, STATUS.CANCELLED, STATUS.NOSHOW, STATUS.CANCEL_AFTER, STATUS.VOID, STATUS.DONE];
  var ARRIVED_PLUS = [STATUS.ARRIVED, STATUS.IN_SERVICE, STATUS.SETTLE, STATUS.DONE];
  var COMPLETED_SERVICE = [STATUS.SETTLE, STATUS.DONE];
  var REF_TYPES = ["朋友推荐", "路过", "网络看到", "其他", "未填写"];

  function ok(data, message) {
    return { ok: true, data: data || null, message: message || "" };
  }
  function fail(code, message, extra) {
    var r = { ok: false, code: code, message: message };
    if (extra) {
      for (var k in extra) r[k] = extra[k];
    }
    return r;
  }
  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function uid(prefix, now) {
    now = now || MokujoTime.now();
    return prefix + "-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }
  function parseTs(v) {
    return MokujoTime.parseISO(v);
  }
  function fenYuan(fen) {
    var n = Number(fen) || 0;
    return (n / 100).toFixed(2);
  }
  function moneyLabel(fen) {
    return "¥" + fenYuan(fen);
  }
  function overlaps(a0, a1, b0, b1) {
    return a0 < b1 && b0 < a1;
  }
  function actorOf(state, actorId) {
    var id = actorId || state.currentUserId;
    var user = byId(state.users, id);
    return user || null;
  }
  function requireUser(state, actorId) {
    var u = actorOf(state, actorId);
    if (!u || u.status !== "active") return fail("AUTH", "当前身份没有权限做这个操作。");
    return null;
  }
  function requireRole(state, actorId, roles) {
    var err = requireUser(state, actorId);
    if (err) return err;
    var u = actorOf(state, actorId);
    if (roles.indexOf(u.role) === -1) return fail("AUTH", "当前身份没有权限做这个操作。");
    return null;
  }
  function isStaffish(user) {
    return user && (user.role === "staff" || user.role === "owner");
  }

  function getShop(state) { return state.shop; }
  function getService(state, id) { return byId(state.services, id); }
  function getStaff(state, id) { return byId(state.staff, id); }
  function getChair(state, id) { return byId(state.chairs, id); }
  function getCustomer(state, id) { return byId(state.customers, id); }
  function getAppointment(state, id) { return byId(state.appointments, id); }
  function getCard(state, id) { return byId(state.punchCards, id); }

  function shopHoursFor(state, dateStr) {
    if (state.shop.closedDates && state.shop.closedDates.indexOf(dateStr) !== -1) return null;
    var w = MokujoTime.weekday(dateStr);
    var row = null;
    (state.shop.hours || []).forEach(function (h) {
      if (h.weekday === w) row = h;
    });
    return row;
  }

  function staffWindows(state, staffId, dateStr) {
    var hours = shopHoursFor(state, dateStr);
    if (!hours) return [];
    var w = MokujoTime.weekday(dateStr);
    var sch = null;
    var rests = [];
    (state.schedules || []).forEach(function (s) {
      if (s.staffId !== staffId) return;
      if (s.date && s.date !== dateStr) return;
      if (!s.date && s.weekday !== w) return;
      if (s.kind === "rest") rests.push(s);
      else sch = s;
    });
    if (!sch) return [];
    var start = Math.max(MokujoTime.fromDateHM(dateStr, hours.start), MokujoTime.fromDateHM(dateStr, sch.start));
    var end = Math.min(MokujoTime.fromDateHM(dateStr, hours.end), MokujoTime.fromDateHM(dateStr, sch.end));
    if (!(start < end)) return [];
    var blocks = [];
    rests.forEach(function (r) {
      blocks.push([MokujoTime.fromDateHM(dateStr, r.start), MokujoTime.fromDateHM(dateStr, r.end)]);
    });
    (state.tempBlocks || []).forEach(function (b) {
      if (b.staffId !== staffId) return;
      var bs = parseTs(b.start);
      var be = parseTs(b.end);
      if (overlaps(start, end, bs, be)) blocks.push([bs, be]);
    });
    blocks.sort(function (a, b) { return a[0] - b[0]; });
    var windows = [];
    var cursor = start;
    blocks.forEach(function (b) {
      var bs = Math.max(b[0], start);
      var be = Math.min(b[1], end);
      if (bs >= be) return;
      if (cursor < bs) windows.push([cursor, bs]);
      if (be > cursor) cursor = be;
    });
    if (cursor < end) windows.push([cursor, end]);
    return windows;
  }

  function chairForStaff(state, staffId, dateStr) {
    var st = getStaff(state, staffId);
    if (!st) return null;
    var w = MokujoTime.weekday(dateStr);
    var found = null;
    (state.schedules || []).forEach(function (s) {
      if (s.staffId !== staffId) return;
      if (s.kind === "rest") return;
      if (s.date && s.date === dateStr && s.chairId) found = s.chairId;
      if (!found && !s.date && s.weekday === w && s.chairId) found = s.chairId;
    });
    return found || st.defaultChairId;
  }

  function activeLocks(state, kind, resourceId, excludeAppointmentId) {
    return (state.locks || []).filter(function (l) {
      if (l.status !== "active") return false;
      if (l.kind !== kind) return false;
      if (l.resourceId !== resourceId) return false;
      if (excludeAppointmentId && l.appointmentId === excludeAppointmentId) return false;
      return true;
    });
  }

  function occupiedIntervals(state, staffId, chairId, excludeAppointmentId) {
    var out = [];
    activeLocks(state, "staff", staffId, excludeAppointmentId).forEach(function (l) {
      out.push({ start: parseTs(l.start), end: parseTs(l.end), source: "staff", lockId: l.id, appointmentId: l.appointmentId });
    });
    if (chairId) {
      activeLocks(state, "chair", chairId, excludeAppointmentId).forEach(function (l) {
        out.push({ start: parseTs(l.start), end: parseTs(l.end), source: "chair", lockId: l.id, appointmentId: l.appointmentId });
      });
    }
    return out;
  }

  function intervalInsideWindows(start, end, windows) {
    for (var i = 0; i < windows.length; i++) {
      if (start >= windows[i][0] && end <= windows[i][1]) return true;
    }
    return false;
  }

  function conflictAgainst(start, end, occupied) {
    for (var i = 0; i < occupied.length; i++) {
      if (overlaps(start, end, occupied[i].start, occupied[i].end)) return occupied[i];
    }
    return null;
  }

  function checkInterval(state, staffId, dateStr, startTs, durationMin, excludeAppointmentId) {
    var st = getStaff(state, staffId);
    if (!st || st.status !== "active") return fail("STAFF", "找不到可用的发型师。");
    var chairId = chairForStaff(state, staffId, dateStr);
    var chair = getChair(state, chairId);
    if (!chair || !chair.enabled) return fail("CHAIR", "该椅位这一段时间已被占用，请改选时段。");
    var endTs = startTs + durationMin * 60000;
    var windows = staffWindows(state, staffId, dateStr);
    if (!windows.length) return fail("SCHEDULE", "发型师该段时间休息，请改选其他时间。");
    if (!intervalInsideWindows(startTs, endTs, windows)) {
      var hours = shopHoursFor(state, dateStr);
      if (!hours) return fail("CLOSED", "该日门店不营业，请改选其他日期。");
      /* distinguish rest vs not enough time vs outside hours */
      var occHint = conflictAgainst(startTs, endTs, occupiedIntervals(state, staffId, chairId, excludeAppointmentId));
      if (occHint) {
        if (occHint.source === "chair") return fail("CHAIR", "该椅位这一段时间已被占用，请改选时段。");
        return fail("STAFF", "该发型师这一段时间已被预约，请改选其他时段。");
      }
      return fail("DURATION", "该时段不够完成本次服务，请改选其他开始时间。");
    }
    var hit = conflictAgainst(startTs, endTs, occupiedIntervals(state, staffId, chairId, excludeAppointmentId));
    if (hit) {
      if (hit.source === "chair") return fail("CHAIR", "该椅位这一段时间已被占用，请改选时段。");
      return fail("STAFF", "该发型师这一段时间已被预约，请改选其他时段。");
    }
    return ok({ start: startTs, end: endTs, chairId: chairId, staffId: staffId, durationMin: durationMin });
  }

  function uniqueSorted(arr) {
    var m = {};
    arr.forEach(function (x) { m[x] = true; });
    return Object.keys(m).map(Number).sort(function (a, b) { return a - b; });
  }

  function getAvailableStarts(state, opts) {
    var dateStr = opts.dateStr;
    var staffId = opts.staffId;
    var durationMin = opts.durationMin;
    var excludeAppointmentId = opts.excludeAppointmentId || null;
    var step = (getShop(state).startStep || 15);
    var windows = staffWindows(state, staffId, dateStr);
    var chairId = chairForStaff(state, staffId, dateStr);
    var occupied = occupiedIntervals(state, staffId, chairId, excludeAppointmentId);
    var candidates = [];
    windows.forEach(function (w) {
      var t = w[0];
      /* align first step to clock, but always include window start (may be after a rest) */
      candidates.push(t);
      var day0 = MokujoTime.startOfDay(dateStr);
      var firstStep = t;
      var mod = ((t - day0) / 60000) % step;
      if (mod !== 0) firstStep = t + (step - mod) * 60000;
      for (var s = firstStep; s + durationMin * 60000 <= w[1]; s += step * 60000) {
        candidates.push(s);
      }
    });
    /* exact end of previous occupancies (and rest ends already = window starts) */
    occupied.forEach(function (o) {
      candidates.push(o.end);
    });
    var uniq = uniqueSorted(candidates);
    var out = [];
    uniq.forEach(function (s) {
      var chk = checkInterval(state, staffId, dateStr, s, durationMin, excludeAppointmentId);
      if (chk.ok) out.push({ start: s, end: chk.data.end, hm: MokujoTime.hmOf(s), endHm: MokujoTime.hmOf(chk.data.end), chairId: chk.data.chairId });
    });
    return out;
  }

  function sortServiceIds(state, serviceIds) {
    var order = (state.shop.categoryOrder || MokujoData.CATEGORY_ORDER).slice();
    var selectedIndex = {};
    serviceIds.forEach(function (id, i) { if (selectedIndex[id] == null) selectedIndex[id] = i; });
    var svcs = serviceIds.map(function (id) { return getService(state, id); });
    var indexed = svcs.map(function (s, i) {
      return { s: s, i: i, cat: order.indexOf(s ? s.category : "") };
    });
    indexed.sort(function (a, b) {
      if (a.cat === b.cat) return a.i - b.i;
      if (a.cat < 0) return 1;
      if (b.cat < 0) return -1;
      return a.cat - b.cat;
    });
    return indexed.map(function (x) { return serviceIds[x.i]; });
  }

  function buildItems(state, serviceIds, now) {
    var ordered = sortServiceIds(state, serviceIds);
    var items = [];
    var totalDur = 0;
    var totalFen = 0;
    ordered.forEach(function (id, idx) {
      var s = getService(state, id);
      items.push({
        id: uid("it", now) + "-" + idx,
        serviceId: s.id,
        name: s.name,
        category: s.category,
        durationMin: s.durationMin,
        priceFen: s.priceFen,
        sort: idx + 1
      });
      totalDur += s.durationMin;
      totalFen += s.priceFen;
    });
    return { items: items, totalDurationMin: totalDur, totalPriceFen: totalFen };
  }

  function eligibleStaff(state, serviceIds, dateStr) {
    return state.staff.filter(function (st) {
      if (st.status !== "active") return false;
      var okAll = serviceIds.every(function (sid) { return st.serviceIds.indexOf(sid) !== -1; });
      if (!okAll) return false;
      if (dateStr && !staffWindows(state, st.id, dateStr).length) return false;
      return true;
    });
  }

  function previewBooking(state, serviceIds, staffId, dateStr) {
    if (!serviceIds || !serviceIds.length) return fail("ITEMS", "请至少选择 1 个服务项目。");
    if (serviceIds.length > 5) return fail("ITEMS", "一次预约最多选择 5 个项目。");
    for (var i = 0; i < serviceIds.length; i++) {
      var s = getService(state, serviceIds[i]);
      if (!s || !s.on) return fail("ITEMS", "只能选择当前上架的服务项目。");
    }
    var built = buildItems(state, serviceIds, MokujoTime.now());
    var staffList = eligibleStaff(state, serviceIds, dateStr);
    var slots = [];
    var chairId = null;
    if (staffId) {
      var st = getStaff(state, staffId);
      if (!st) return fail("STAFF", "请选择一位发型师。");
      if (!staffList.some(function (x) { return x.id === staffId; })) {
        return fail("STAFF", "第一版须由同一位会做全部所选项目、且当日排班的发型师完成。");
      }
      chairId = chairForStaff(state, staffId, dateStr);
      if (dateStr) slots = getAvailableStarts(state, { dateStr: dateStr, staffId: staffId, durationMin: built.totalDurationMin });
    }
    return ok({
      items: built.items,
      totalDurationMin: built.totalDurationMin,
      totalPriceFen: built.totalPriceFen,
      staffList: staffList,
      slots: slots,
      chairId: chairId
    });
  }

  function releaseLocks(state, appointmentId, atIso) {
    (state.locks || []).forEach(function (l) {
      if (l.appointmentId === appointmentId && l.status === "active") {
        l.status = "released";
        l.releasedAt = atIso;
      }
    });
  }

  function addLocks(state, appointment, now) {
    var dateStr = MokujoTime.dateStr(parseTs(appointment.start));
    state.locks.push({
      id: uid("lk-s", now),
      kind: "staff",
      resourceId: appointment.staffId,
      appointmentId: appointment.id,
      start: appointment.start,
      end: appointment.end,
      status: "active",
      releasedAt: null
    });
    state.locks.push({
      id: uid("lk-c", now),
      kind: "chair",
      resourceId: appointment.chairId,
      appointmentId: appointment.id,
      start: appointment.start,
      end: appointment.end,
      status: "active",
      releasedAt: null
    });
  }

  function pendingShouldExpire(apt, now) {
    if (!apt || apt.status !== STATUS.PENDING) return false;
    var timeoutAt = apt.timeoutAt ? parseTs(apt.timeoutAt) : null;
    var start = parseTs(apt.start);
    if (timeoutAt != null && now >= timeoutAt) return true;
    if (now >= start) return true;
    return false;
  }

  function expireOne(state, apt, now, reason) {
    if (apt.status !== STATUS.PENDING) return false;
    apt.status = STATUS.TIMEOUT;
    apt.expiredAt = MokujoTime.iso(now);
    apt.expireReason = reason || "timeout";
    releaseLocks(state, apt.id, apt.expiredAt);
    return true;
  }

  function expireDue(state, now) {
    now = now || MokujoTime.now();
    var changed = [];
    (state.appointments || []).forEach(function (apt) {
      if (pendingShouldExpire(apt, now)) {
        if (expireOne(state, apt, now, now >= parseTs(apt.start) && (!apt.timeoutAt || now < parseTs(apt.timeoutAt)) ? "start-reached" : "timeout")) {
          changed.push(apt.id);
        }
      }
    });
    return changed;
  }

  function audit(state, now, actorId, action, target, detail) {
    state.audit = state.audit || [];
    state.audit.push({
      id: uid("au", now),
      at: MokujoTime.iso(now),
      by: actorId,
      action: action,
      target: target,
      detail: detail || ""
    });
  }

  /* ---------- referral ---------- */
  function getReferral(state, customerId) {
    for (var i = 0; i < (state.referrals || []).length; i++) {
      if (state.referrals[i].customerId === customerId) return state.referrals[i];
    }
    return null;
  }

  function samePerson(state, customerId, referrerId) {
    if (!customerId || !referrerId) return false;
    if (customerId === referrerId) return true;
    var a = getCustomer(state, customerId);
    var b = getCustomer(state, referrerId);
    if (a && b && a.phone && b.phone && a.phone === b.phone) return true;
    return false;
  }

  function isFullyLockedReferral(ref) {
    return !!(ref && ref.convertedAt);
  }

  function canCustomerWriteReferral(state, customerId) {
    var ref = getReferral(state, customerId);
    return !ref;
  }

  function writeReferral(state, now, actorId, customerId, type, referrerId, allowEmpty) {
    if (getReferral(state, customerId)) {
      return fail("REF_EXISTS", "每位顾客只能有一个首次推荐来源，已记录的来源不能覆盖。");
    }
    if (REF_TYPES.indexOf(type) === -1) return fail("REF_TYPE", "请选择有效的推荐来源。");
    if (type === "朋友推荐") {
      if (!referrerId) return fail("REF_FRIEND", "选择朋友推荐时，必须选择一位系统内已有顾客作为推荐人。");
      if (samePerson(state, customerId, referrerId)) return fail("REF_SELF", "不能把自己设为自己的推荐人。");
      if (!getCustomer(state, referrerId)) return fail("REF_FRIEND", "推荐人必须是系统内已有顾客。");
    } else {
      referrerId = null;
    }
    var rec = {
      customerId: customerId,
      type: type,
      referrerId: referrerId,
      writtenAt: MokujoTime.iso(now),
      writtenBy: actorId,
      convertedAt: null,
      conversionRecordId: null,
      correctionUsed: false,
      correction: null
    };
    state.referrals.push(rec);
    return ok(rec);
  }

  function maybeConvertReferral(state, now, customerId, consumptionId) {
    var ref = getReferral(state, customerId);
    /* first consumption record for this customer? */
    var previous = (state.consumptionRecords || []).filter(function (c) {
      return c.customerId === customerId && c.id !== consumptionId;
    });
    if (previous.length) return;
    if (!ref) {
      ref = {
        customerId: customerId,
        type: "未填写",
        referrerId: null,
        writtenAt: MokujoTime.iso(now),
        writtenBy: "system",
        convertedAt: null,
        conversionRecordId: null,
        correctionUsed: false,
        correction: null
      };
      state.referrals.push(ref);
    }
    if (!ref.convertedAt) {
      ref.convertedAt = MokujoTime.iso(now);
      ref.conversionRecordId = consumptionId;
    }
  }

  function setReferral(state, actorId, payload, now) {
    now = now || MokujoTime.now();
    var err = requireUser(state, actorId);
    if (err) return err;
    var user = actorOf(state, actorId);
    var customerId = payload.customerId;
    if (user.role === "customer") {
      if (user.customerId !== customerId) return fail("AUTH", "当前身份没有权限做这个操作。");
    } else if (!isStaffish(user)) {
      return fail("AUTH", "当前身份没有权限做这个操作。");
    }
    /* staff cannot modify existing; they also shouldn't write over. Only if empty. */
    return writeReferral(state, now, actorId, customerId, payload.type, payload.referrerId);
  }

  function ownerCorrectReferral(state, actorId, payload, now) {
    now = now || MokujoTime.now();
    var err = requireRole(state, actorId, ["owner"]);
    if (err) return err;
    var ref = getReferral(state, payload.customerId);
    if (!ref) return fail("REF_NONE", "该顾客还没有推荐来源，请先写入，而不是更正。");
    if (isFullyLockedReferral(ref)) return fail("REF_LOCKED", "有效转化完成后，推荐来源不能再修改。");
    if (ref.correctionUsed) return fail("REF_ONCE", "推荐来源仅允许老板更正一次。");
    var written = parseTs(ref.writtenAt);
    if (now - written > 24 * 3600 * 1000) return fail("REF_WINDOW", "已超过写入后 24 小时的更正窗口，不能再改。");
    if (!payload.reason || !String(payload.reason).trim()) return fail("REF_REASON", "更正推荐来源必须填写原因。");
    var type = payload.type;
    var referrerId = payload.referrerId || null;
    if (REF_TYPES.indexOf(type) === -1) return fail("REF_TYPE", "请选择有效的推荐来源。");
    if (type === "朋友推荐") {
      if (!referrerId) return fail("REF_FRIEND", "选择朋友推荐时，必须选择一位系统内已有顾客作为推荐人。");
      if (samePerson(state, payload.customerId, referrerId)) return fail("REF_SELF", "不能把自己设为自己的推荐人。");
    } else referrerId = null;
    var from = { type: ref.type, referrerId: ref.referrerId };
    ref.type = type;
    ref.referrerId = referrerId;
    ref.correctionUsed = true;
    ref.correction = {
      at: MokujoTime.iso(now),
      by: actorId,
      reason: String(payload.reason).trim(),
      from: from,
      to: { type: type, referrerId: referrerId }
    };
    audit(state, now, actorId, "correct-referral", payload.customerId, payload.reason);
    return ok(ref, "已更正推荐来源，并留下操作记录。");
  }

  /* ---------- booking ---------- */
  function createAppointment(state, actorId, payload, now) {
    now = now || MokujoTime.now();
    var err = requireRole(state, actorId, ["customer"]);
    if (err) return err;
    var user = actorOf(state, actorId);
    var customerId = payload.customerId || user.customerId;
    if (user.customerId !== customerId) return fail("AUTH", "当前身份没有权限做这个操作。");
    var customer = getCustomer(state, customerId);
    if (!customer) return fail("CUSTOMER", "找不到顾客档案。");
    var serviceIds = payload.serviceIds || [];
    if (serviceIds.length < 1) return fail("ITEMS", "请至少选择 1 个服务项目。");
    if (serviceIds.length > 5) return fail("ITEMS", "一次预约最多选择 5 个项目。");
    for (var i = 0; i < serviceIds.length; i++) {
      var s = getService(state, serviceIds[i]);
      if (!s || !s.on) return fail("ITEMS", "只能选择当前上架的服务项目。");
    }
    var staffId = payload.staffId;
    if (!staffId) return fail("STAFF", "请选择一位发型师。第一版不做随机分配。");
    var st = getStaff(state, staffId);
    if (!st || st.status !== "active") return fail("STAFF", "请选择一位在职发型师。");
    if (!serviceIds.every(function (sid) { return st.serviceIds.indexOf(sid) !== -1; })) {
      return fail("STAFF", "第一版须由同一位会做全部所选项目的发型师完成。");
    }
    if (!payload.start) return fail("TIME", "请选择预约开始时间。");
    var startTs = parseTs(payload.start);
    var dateStr = MokujoTime.dateStr(startTs);
    var built = buildItems(state, serviceIds, now);
    var chk = checkInterval(state, staffId, dateStr, startTs, built.totalDurationMin, null);
    if (!chk.ok) return chk;
    var contactName = (payload.contactName || customer.name || "").trim();
    var phone = (payload.phone || customer.phone || "").trim();
    if (!contactName || !phone) return fail("CONTACT", "请填写姓名与联系方式。");
    var timeoutMin = Number(state.shop.confirmTimeoutMinutes) || 15;
    if (timeoutMin < 5) timeoutMin = 5;
    if (timeoutMin > 120) timeoutMin = 120;
    timeoutMin = Math.round(timeoutMin);
    var timeoutAt = now + timeoutMin * 60000;
    var apt = {
      id: uid("apt", now),
      shopId: state.shop.id,
      customerId: customerId,
      staffId: staffId,
      chairId: chk.data.chairId,
      items: built.items,
      totalDurationMin: built.totalDurationMin,
      totalPriceFen: built.totalPriceFen,
      start: MokujoTime.iso(startTs),
      end: MokujoTime.iso(chk.data.end),
      status: STATUS.PENDING,
      submittedAt: MokujoTime.iso(now),
      timeoutMinutesSnapshot: timeoutMin,
      timeoutAt: MokujoTime.iso(timeoutAt),
      confirmedAt: null,
      confirmedBy: null,
      arrivedAt: null,
      arrivedBy: null,
      serviceStartedAt: null,
      serviceCompletedAt: null,
      cancelledAt: null,
      cancelReason: null,
      cancelledBy: null,
      settledAt: null,
      settlementId: null,
      contactName: contactName,
      phone: phone,
      notes: payload.notes || "",
      lateFinishWarnedAt: null,
      noShowAt: null,
      voidReason: null,
      voidedAt: null
    };
    if (pendingShouldExpire(apt, now)) {
      return fail("TIME", "该开始时间已到或确认窗口无效，请改选其他时段。");
    }
    /* optional referral if empty */
    if (payload.referralType) {
      if (canCustomerWriteReferral(state, customerId)) {
        var rr = writeReferral(state, now, actorId, customerId, payload.referralType, payload.referrerId);
        if (!rr.ok && payload.referralType === "朋友推荐") return rr;
      }
    }
    state.appointments.push(apt);
    addLocks(state, apt, now);
    audit(state, now, actorId, "create-appointment", apt.id, "");
    return ok(apt, "预约已提交，等待门店确认。");
  }

  function confirmAppointment(state, actorId, appointmentId, now) {
    now = now || MokujoTime.now();
    var err = requireRole(state, actorId, ["staff", "owner"]);
    if (err) return err;
    expireDue(state, now);
    var apt = getAppointment(state, appointmentId);
    if (!apt) return fail("NOT_FOUND", "找不到该预约。");
    if (apt.status === STATUS.TIMEOUT) {
      return fail("TIMEOUT", "该预约已超过确认时限，时段已释放，请重新预约。");
    }
    if (apt.status !== STATUS.PENDING) return fail("STATE", "当前状态不能做这个操作。");
    if (pendingShouldExpire(apt, now)) {
      expireOne(state, apt, now, "timeout");
      return fail("TIMEOUT", "该预约已超过确认时限，时段已释放，请重新预约。");
    }
    apt.status = STATUS.CONFIRMED;
    apt.confirmedAt = MokujoTime.iso(now);
    apt.confirmedBy = actorId;
    audit(state, now, actorId, "confirm", apt.id, "");
    return ok(apt, "预约已确认。");
  }

  function simulateTimeout(state, actorId, appointmentId, now) {
    now = now || MokujoTime.now();
    /* demo tool: staff/owner, or any via demo toolbar (pass actor as-is; allow all demo users) */
    var err = requireUser(state, actorId);
    if (err) return err;
    var apt = getAppointment(state, appointmentId);
    if (!apt) return fail("NOT_FOUND", "找不到该预约。");
    if (apt.status !== STATUS.PENDING) return fail("STATE", "只有待确认的预约可以模拟确认超时。");
    expireOne(state, apt, now, "simulated");
    audit(state, now, actorId, "simulate-timeout", apt.id, "");
    return ok(apt, "已按确认超时处理：预约失效，时段已释放。");
  }

  function canCustomerCancel(state, apt, now) {
    if (apt.status === STATUS.PENDING) return { ok: true };
    if (apt.status === STATUS.CONFIRMED) {
      var lead = (state.shop.cancelLeadHours || 2) * 3600000;
      if (parseTs(apt.start) - now >= lead) return { ok: true };
      return { ok: false, message: "已超过可取消时间，请联系门店。" };
    }
    return { ok: false, message: "当前状态不允许取消。" };
  }

  function cancelAppointment(state, actorId, appointmentId, reason, now) {
    now = now || MokujoTime.now();
    var err = requireUser(state, actorId);
    if (err) return err;
    var user = actorOf(state, actorId);
    var apt = getAppointment(state, appointmentId);
    if (!apt) return fail("NOT_FOUND", "找不到该预约。");
    expireDue(state, now);
    apt = getAppointment(state, appointmentId);

    if (user.role === "customer") {
      if (user.customerId !== apt.customerId) return fail("AUTH", "当前身份没有权限做这个操作。");
      var cc = canCustomerCancel(state, apt, now);
      if (!cc.ok) return fail("CANCEL", cc.message);
      apt.status = STATUS.CANCELLED;
    } else if (isStaffish(user)) {
      if (apt.status === STATUS.ARRIVED) {
        apt.status = STATUS.CANCEL_AFTER;
      } else if (apt.status === STATUS.PENDING || apt.status === STATUS.CONFIRMED) {
        apt.status = STATUS.CANCELLED;
      } else {
        return fail("STATE", "当前状态不能做这个操作。");
      }
      if (!reason || !String(reason).trim()) return fail("REASON", "请填写取消原因。");
    } else {
      return fail("AUTH", "当前身份没有权限做这个操作。");
    }
    apt.cancelledAt = MokujoTime.iso(now);
    apt.cancelledBy = actorId;
    apt.cancelReason = reason ? String(reason).trim() : (user.role === "customer" ? "顾客取消" : "");
    releaseLocks(state, apt.id, apt.cancelledAt);
    audit(state, now, actorId, "cancel", apt.id, apt.cancelReason);
    return ok(apt, apt.status === STATUS.CANCEL_AFTER ? "已到店后取消，时段已释放，不生成消费记录。" : "预约已取消，时段已释放。");
  }

  function markNoShow(state, actorId, appointmentId, now) {
    now = now || MokujoTime.now();
    var err = requireRole(state, actorId, ["staff", "owner"]);
    if (err) return err;
    var apt = getAppointment(state, appointmentId);
    if (!apt) return fail("NOT_FOUND", "找不到该预约。");
    if (apt.status !== STATUS.CONFIRMED) return fail("STATE", "当前状态不能做这个操作。");
    if (now < parseTs(apt.start)) return fail("STATE", "预约开始时间尚未到达，不能标记逾期未到。");
    apt.status = STATUS.NOSHOW;
    apt.noShowAt = MokujoTime.iso(now);
    releaseLocks(state, apt.id, apt.noShowAt);
    audit(state, now, actorId, "noshow", apt.id, "");
    return ok(apt, "已标记逾期未到，时段已释放。");
  }

  function arrive(state, actorId, appointmentId, now) {
    now = now || MokujoTime.now();
    var err = requireRole(state, actorId, ["staff", "owner"]);
    if (err) return err;
    var apt = getAppointment(state, appointmentId);
    if (!apt) return fail("NOT_FOUND", "找不到该预约。");
    if (apt.status !== STATUS.CONFIRMED) return fail("STATE", "当前状态不能做这个操作。");
    apt.status = STATUS.ARRIVED;
    apt.arrivedAt = MokujoTime.iso(now);
    apt.arrivedBy = actorId;
    audit(state, now, actorId, "arrive", apt.id, "");
    return ok(apt, "已登记到店。");
  }

  function startService(state, actorId, appointmentId, now) {
    now = now || MokujoTime.now();
    var err = requireRole(state, actorId, ["staff", "owner"]);
    if (err) return err;
    var apt = getAppointment(state, appointmentId);
    if (!apt) return fail("NOT_FOUND", "找不到该预约。");
    if (apt.status !== STATUS.ARRIVED) return fail("STATE", "当前状态不能做这个操作。");
    apt.status = STATUS.IN_SERVICE;
    apt.serviceStartedAt = MokujoTime.iso(now);
    audit(state, now, actorId, "start-service", apt.id, "");
    return ok(apt, "已开始服务。");
  }

  function lateFinishWarning(state, apt, now) {
    if (!apt || apt.status !== STATUS.IN_SERVICE) return null;
    if (now >= parseTs(apt.end)) {
      return "原定结束时间已到，下一位预约即将开始，请先结束当前服务，不要占用下一位的时段。";
    }
    return null;
  }

  function completeService(state, actorId, appointmentId, now) {
    now = now || MokujoTime.now();
    var err = requireRole(state, actorId, ["staff", "owner"]);
    if (err) return err;
    var apt = getAppointment(state, appointmentId);
    if (!apt) return fail("NOT_FOUND", "找不到该预约。");
    if (apt.status !== STATUS.IN_SERVICE) return fail("STATE", "当前状态不能做这个操作。");
    var warn = lateFinishWarning(state, apt, now);
    if (warn) apt.lateFinishWarnedAt = apt.lateFinishWarnedAt || MokujoTime.iso(now);
    apt.status = STATUS.SETTLE;
    apt.serviceCompletedAt = MokujoTime.iso(now);
    releaseLocks(state, apt.id, apt.serviceCompletedAt);
    /* never extend into the next lock: we only release, we do not write a longer lock */
    audit(state, now, actorId, "complete-service", apt.id, warn || "");
    return ok({ appointment: apt, lateWarning: warn }, "服务已完成，进入待结算，时段已释放。");
  }

  function cardsForCustomer(state, customerId) {
    return (state.punchCards || []).filter(function (c) {
      return c.customerId === customerId && c.status === "active";
    });
  }

  function cardApplies(card, serviceId) {
    return card && card.status === "active" && card.serviceIds.indexOf(serviceId) !== -1 && card.remaining > 0;
  }

  function settle(state, actorId, appointmentId, itemMethods, now) {
    now = now || MokujoTime.now();
    var err = requireRole(state, actorId, ["staff", "owner"]);
    if (err) return err;
    var apt = getAppointment(state, appointmentId);
    if (!apt) return fail("NOT_FOUND", "找不到该预约。");
    if (apt.status === STATUS.DONE || (state.consumptionRecords || []).some(function (c) { return c.appointmentId === apt.id; })) {
      return fail("DUP", "这笔消费已经核销过了，不能重复操作。");
    }
    if (apt.status !== STATUS.SETTLE) return fail("STATE", "只能从待结算发起核销。");
    if (!itemMethods || itemMethods.length !== apt.items.length) {
      return fail("SETTLE", "请为每一个项目选择结算方式。");
    }
    var methodsByItem = {};
    itemMethods.forEach(function (m) { methodsByItem[m.itemId] = m; });
    var cardUse = {}; /* cardId -> count */
    var lines = [];
    for (var i = 0; i < apt.items.length; i++) {
      var it = apt.items[i];
      var m = methodsByItem[it.id];
      if (!m || (m.method !== "cash" && m.method !== "card")) {
        return fail("SETTLE", "请为每一个项目选择模拟到店付款或次卡扣次。");
      }
      if (m.method === "card") {
        var card = getCard(state, m.cardId);
        if (!card || card.customerId !== apt.customerId) return fail("CARD", "请选择该顾客名下的适用次卡。");
        if (!cardApplies(card, it.serviceId)) {
          if (card.remaining <= 0) return fail("CARD", "次卡余次不足，请改用其他结算方式。");
          return fail("CARD", "该次卡不适用于此项目，请改用其他结算方式。");
        }
        cardUse[card.id] = (cardUse[card.id] || 0) + 1;
        lines.push({
          serviceId: it.serviceId,
          name: it.name,
          priceFen: it.priceFen,
          method: "card",
          cardId: card.id,
          cashFen: 0,
          originalFen: it.priceFen
        });
      } else {
        lines.push({
          serviceId: it.serviceId,
          name: it.name,
          priceFen: it.priceFen,
          method: "cash",
          cardId: null,
          cashFen: it.priceFen,
          originalFen: it.priceFen
        });
      }
    }
    for (var cid in cardUse) {
      var c = getCard(state, cid);
      if (c.remaining < cardUse[cid]) return fail("CARD", "次卡余次不足，请改用其他结算方式。");
    }
    /* all-or-nothing: apply after all checks */
    var conId = uid("con", now);
    var cashTotal = 0, cardOrig = 0, orig = 0;
    lines.forEach(function (ln) {
      cashTotal += ln.cashFen;
      orig += ln.originalFen;
      if (ln.method === "card") cardOrig += ln.originalFen;
    });
    var rec = {
      id: conId,
      appointmentId: apt.id,
      customerId: apt.customerId,
      staffId: apt.staffId,
      redeemedAt: MokujoTime.iso(now),
      redeemedBy: actorId,
      items: lines,
      cashTotalFen: cashTotal,
      cardOriginalTotalFen: cardOrig,
      originalTotalFen: orig
    };
    for (var cid2 in cardUse) {
      var card2 = getCard(state, cid2);
      card2.remaining -= cardUse[cid2];
      if (card2.remaining < 0) return fail("CARD", "次卡余次不足，请改用其他结算方式。");
      state.punchLedgers.push({
        id: uid("led", now),
        cardId: card2.id,
        appointmentId: apt.id,
        consumptionId: conId,
        customerId: apt.customerId,
        change: -cardUse[cid2],
        remainingAfter: card2.remaining,
        createdAt: MokujoTime.iso(now),
        by: actorId
      });
    }
    state.consumptionRecords.push(rec);
    apt.status = STATUS.DONE;
    apt.settledAt = rec.redeemedAt;
    apt.settlementId = conId;
    maybeConvertReferral(state, now, apt.customerId, conId);
    var cus = getCustomer(state, apt.customerId);
    if (cus && !cus.member) {
      cus.member = true;
      cus.memberSince = rec.redeemedAt;
    }
    audit(state, now, actorId, "settle", apt.id, conId);
    return ok({ appointment: apt, record: rec }, "核销成功，已生成消费记录。");
  }

  function voidSettlement(state, actorId, appointmentId, reason, now) {
    now = now || MokujoTime.now();
    var err = requireRole(state, actorId, ["staff", "owner"]);
    if (err) return err;
    var apt = getAppointment(state, appointmentId);
    if (!apt) return fail("NOT_FOUND", "找不到该预约。");
    if (apt.status !== STATUS.SETTLE) return fail("STATE", "当前状态不能做这个操作。");
    if (!reason || !String(reason).trim()) return fail("REASON", "作废待结算必须填写原因。");
    apt.status = STATUS.VOID;
    apt.voidedAt = MokujoTime.iso(now);
    apt.voidReason = String(reason).trim();
    audit(state, now, actorId, "void-settlement", apt.id, apt.voidReason);
    return ok(apt, "待结算已作废，不生成消费记录，不扣次。");
  }

  function reorderItems(state, actorId, appointmentId, itemIds, now) {
    now = now || MokujoTime.now();
    var err = requireRole(state, actorId, ["staff", "owner"]);
    if (err) return err;
    var apt = getAppointment(state, appointmentId);
    if (!apt) return fail("NOT_FOUND", "找不到该预约。");
    if (!(apt.status === STATUS.PENDING || apt.status === STATUS.CONFIRMED || apt.status === STATUS.ARRIVED)) {
      return fail("STATE", "当前状态不能调整项目顺序。");
    }
    if (apt.status !== STATUS.PENDING) {
      /* duration must stay the same; we only allow reorder, not add/remove */
    }
    if (!itemIds || itemIds.length !== apt.items.length) return fail("ORDER", "项目清单不完整。");
    var map = {};
    apt.items.forEach(function (it) { map[it.id] = it; });
    var next = [];
    for (var i = 0; i < itemIds.length; i++) {
      if (!map[itemIds[i]]) return fail("ORDER", "项目清单不正确。");
      next.push(map[itemIds[i]]);
      delete map[itemIds[i]];
    }
    next.forEach(function (it, idx) { it.sort = idx + 1; });
    apt.items = next;
    audit(state, now, actorId, "reorder-items", apt.id, "");
    return ok(apt, "已调整项目顺序，总时长和总价不变。");
  }

  /* ---------- cards ---------- */
  function issueOrBuyCard(state, actorId, payload, source, now) {
    now = now || MokujoTime.now();
    var product = byId(state.cardProducts, payload.productId);
    if (!product) return fail("PRODUCT", "找不到该次卡产品。");
    var customerId = payload.customerId;
    var customer = getCustomer(state, customerId);
    if (!customer) return fail("CUSTOMER", "找不到顾客档案。");
    var card = {
      id: uid("card", now),
      customerId: customerId,
      productId: product.id,
      name: product.name,
      serviceIds: product.serviceIds.slice(),
      totalCounts: product.totalCounts,
      remaining: product.totalCounts,
      status: "active",
      issuedAt: MokujoTime.iso(now),
      issuedBy: actorId,
      source: source
    };
    state.punchCards.push(card);
    if (!customer.member) {
      customer.member = true;
      customer.memberSince = card.issuedAt;
    }
    state.punchLedgers.push({
      id: uid("led", now),
      cardId: card.id,
      appointmentId: null,
      consumptionId: null,
      customerId: customerId,
      change: product.totalCounts,
      remainingAfter: product.totalCounts,
      createdAt: card.issuedAt,
      by: actorId,
      note: source === "demo-buy" ? "演示购买" : "老板发放"
    });
    audit(state, now, actorId, source, card.id, product.id);
    return ok(card, source === "demo-buy" ? "演示购买成功。这是虚拟次卡，未发生真实支付。" : "已发放演示次卡。");
  }

  function demoBuyCard(state, actorId, payload, now) {
    now = now || MokujoTime.now();
    var err = requireRole(state, actorId, ["customer"]);
    if (err) return err;
    var user = actorOf(state, actorId);
    var customerId = payload.customerId || user.customerId;
    if (user.customerId !== customerId) return fail("AUTH", "当前身份没有权限做这个操作。");
    return issueOrBuyCard(state, actorId, { productId: payload.productId, customerId: customerId }, "demo-buy", now);
  }

  function issueCard(state, actorId, payload, now) {
    now = now || MokujoTime.now();
    var err = requireRole(state, actorId, ["owner"]);
    if (err) return err;
    return issueOrBuyCard(state, actorId, payload, "owner-issue", now);
  }

  /* ---------- owner config (selected) ---------- */
  function updateShopRules(state, actorId, patch, now) {
    now = now || MokujoTime.now();
    var err = requireRole(state, actorId, ["owner"]);
    if (err) return err;
    var shop = state.shop;
    if (patch.confirmTimeoutMinutes != null) {
      var n = Number(patch.confirmTimeoutMinutes);
      if (!Number.isFinite(n) || n < 5 || n > 120 || Math.round(n) !== n) {
        return fail("RULE", "确认超时须为 5 到 120 分钟的整数。");
      }
      shop.confirmTimeoutMinutes = n;
    }
    if (patch.displayInterval != null) {
      if ([15, 30, 60].indexOf(Number(patch.displayInterval)) === -1) return fail("RULE", "展示间隔只能是 15、30 或 60 分钟。");
      shop.displayInterval = Number(patch.displayInterval);
    }
    if (patch.startStep != null) {
      var st = Number(patch.startStep);
      if (!(st === 5 || st === 10 || st === 15 || st === 30)) return fail("RULE", "可选开始时间步长不支持该取值。");
      shop.startStep = st;
    }
    if (patch.cancelLeadHours != null) {
      var h = Number(patch.cancelLeadHours);
      if (!Number.isFinite(h) || h < 0 || h > 48) return fail("RULE", "取消提前量不在允许范围内。");
      shop.cancelLeadHours = h;
    }
    if (patch.categoryOrder) {
      shop.categoryOrder = patch.categoryOrder.slice();
    }
    if (patch.announcement != null) shop.announcement = String(patch.announcement);
    if (patch.intro != null) shop.intro = String(patch.intro);
    if (patch.address != null) shop.address = String(patch.address);
    if (patch.phone != null) shop.phone = String(patch.phone);
    if (patch.brandName != null) shop.brandName = String(patch.brandName);
    if (patch.subtitle != null) shop.subtitle = String(patch.subtitle);
    if (patch.hours) shop.hours = patch.hours;
    if (patch.closedDates) shop.closedDates = patch.closedDates;
    if (patch.memberBenefits) shop.memberBenefits = patch.memberBenefits;
    audit(state, now, actorId, "update-shop-rules", shop.id, "");
    return ok(shop, "门店规则已更新。新设置只对之后新提交的预约生效。");
  }

  function upsertService(state, actorId, payload, now) {
    now = now || MokujoTime.now();
    var err = requireRole(state, actorId, ["owner"]);
    if (err) return err;
    var s;
    if (payload.id) {
      s = getService(state, payload.id);
      if (!s) return fail("NOT_FOUND", "找不到该服务项目。");
    } else {
      s = { id: uid("svc", now), on: true };
      state.services.push(s);
    }
    if (payload.name) s.name = payload.name;
    if (payload.category) s.category = payload.category;
    if (payload.desc != null) s.desc = payload.desc;
    if (payload.durationMin != null) {
      var d = Number(payload.durationMin);
      if (!Number.isFinite(d) || d <= 0 || d > 600) return fail("SVC", "请填写有效的服务时长（分钟）。");
      s.durationMin = Math.round(d);
    }
    if (payload.priceFen != null) {
      var p = Number(payload.priceFen);
      if (!Number.isFinite(p) || p < 0) return fail("SVC", "请填写有效价格。");
      s.priceFen = Math.round(p);
    }
    if (payload.on != null) s.on = !!payload.on;
    audit(state, now, actorId, "upsert-service", s.id, "");
    return ok(s, "服务项目已保存。");
  }

  function upsertStaff(state, actorId, payload, now) {
    now = now || MokujoTime.now();
    var err = requireRole(state, actorId, ["owner"]);
    if (err) return err;
    var st;
    if (payload.id) {
      st = getStaff(state, payload.id);
      if (!st) return fail("NOT_FOUND", "找不到该员工。");
    } else {
      st = { id: uid("stf", now), status: "active", avatar: "assets/images/avatar-ayuan.jpg", serviceIds: [] };
      state.staff.push(st);
      /* also create a staff user so they can be selected later */
      state.users.push({
        id: uid("user", now),
        role: "staff",
        name: "店员" + (payload.name || ""),
        customerId: null,
        staffId: st.id,
        status: "active"
      });
    }
    if (payload.name) st.name = payload.name;
    if (payload.title != null) st.title = payload.title;
    if (payload.bio != null) st.bio = payload.bio;
    if (payload.serviceIds) st.serviceIds = payload.serviceIds.slice();
    if (payload.defaultChairId) st.defaultChairId = payload.defaultChairId;
    if (payload.status) {
      if (payload.status === "disabled") st.status = "disabled";
      else st.status = "active";
      state.users.forEach(function (u) {
        if (u.staffId === st.id && u.role === "staff") u.status = st.status === "active" ? "active" : "disabled";
      });
    }
    audit(state, now, actorId, "upsert-staff", st.id, "");
    return ok(st, "员工资料已保存。");
  }

  function upsertChair(state, actorId, payload, now) {
    now = now || MokujoTime.now();
    var err = requireRole(state, actorId, ["owner"]);
    if (err) return err;
    var c;
    if (payload.id) {
      c = getChair(state, payload.id);
      if (!c) return fail("NOT_FOUND", "找不到该椅位。");
    } else {
      c = { id: uid("chair", now), enabled: true };
      state.chairs.push(c);
    }
    if (payload.name) c.name = payload.name;
    if (payload.enabled != null) c.enabled = !!payload.enabled;
    audit(state, now, actorId, "upsert-chair", c.id, "");
    return ok(c, "椅位已保存。");
  }

  function upsertSchedule(state, actorId, payload, now) {
    now = now || MokujoTime.now();
    var err = requireRole(state, actorId, ["owner"]);
    if (err) return err;
    var row;
    if (payload.id) {
      row = byId(state.schedules, payload.id);
      if (!row) return fail("NOT_FOUND", "找不到该排班。");
    } else {
      row = { id: uid("sch", now) };
      state.schedules.push(row);
    }
    row.staffId = payload.staffId;
    row.weekday = payload.weekday;
    if (payload.date) row.date = payload.date; else delete row.date;
    row.start = payload.start;
    row.end = payload.end;
    row.kind = payload.kind || null;
    if (payload.chairId) row.chairId = payload.chairId;
    audit(state, now, actorId, "upsert-schedule", row.id, "");
    return ok(row, "排班已保存。");
  }

  function addTempBlock(state, actorId, payload, now) {
    now = now || MokujoTime.now();
    var err = requireRole(state, actorId, ["owner"]);
    if (err) return err;
    var b = {
      id: uid("blk", now),
      staffId: payload.staffId,
      start: payload.start,
      end: payload.end,
      reason: payload.reason || "临时占用"
    };
    state.tempBlocks = state.tempBlocks || [];
    state.tempBlocks.push(b);
    audit(state, now, actorId, "temp-block", b.id, b.reason);
    return ok(b, "已标记临时占用。");
  }

  /* ---------- dashboard ---------- */
  function recordsInRange(state, startTs, endTs) {
    return (state.consumptionRecords || []).filter(function (c) {
      var t = parseTs(c.redeemedAt);
      return t >= startTs && t < endTs;
    });
  }

  function firstConsumptionTime(state, customerId) {
    var min = null;
    (state.consumptionRecords || []).forEach(function (c) {
      if (c.customerId !== customerId) return;
      var t = parseTs(c.redeemedAt);
      if (min == null || t < min) min = t;
    });
    return min;
  }

  function computeDashboard(state, opts) {
    opts = opts || {};
    var now = opts.now || MokujoTime.now();
    var dateStr = opts.dateStr || MokujoTime.dateStr(now);
    var dayStart = MokujoTime.startOfDay(dateStr);
    var dayEnd = MokujoTime.endOfDay(dateStr);
    var popularRange = opts.popularRange || "today";
    var popStart = dayStart;
    var popEnd = dayEnd;
    if (popularRange === "7d") {
      popStart = MokujoTime.startOfDay(MokujoTime.addDays(dateStr, -6));
    } else if (popularRange === "month") {
      var parts = dateStr.split("-");
      popStart = MokujoTime.startOfDay(parts[0] + "-" + parts[1] + "-01");
    }

    var aptsToday = (state.appointments || []).filter(function (a) {
      return MokujoTime.dateStr(parseTs(a.start)) === dateStr;
    });
    var statusCount = {};
    aptsToday.forEach(function (a) {
      statusCount[a.status] = (statusCount[a.status] || 0) + 1;
    });
    var cancelledN = statusCount[STATUS.CANCELLED] || 0;
    var timeoutN = statusCount[STATUS.TIMEOUT] || 0;
    var validAppts = aptsToday.filter(function (a) {
      return a.status !== STATUS.CANCELLED && a.status !== STATUS.TIMEOUT;
    });

    var recsToday = recordsInRange(state, dayStart, dayEnd);
    var cashFen = 0, cardOrigFen = 0;
    recsToday.forEach(function (r) {
      cashFen += r.cashTotalFen || 0;
      cardOrigFen += r.cardOriginalTotalFen || 0;
    });

    var finishedToday = (state.appointments || []).filter(function (a) {
      if (COMPLETED_SERVICE.indexOf(a.status) === -1) return false;
      if (!a.serviceCompletedAt) return false;
      var t = parseTs(a.serviceCompletedAt);
      return t >= dayStart && t < dayEnd;
    });
    var finishedItemCount = 0;
    finishedToday.forEach(function (a) { finishedItemCount += (a.items || []).length; });

    var arrivedCustomers = {};
    aptsToday.forEach(function (a) {
      if (ARRIVED_PLUS.indexOf(a.status) !== -1) arrivedCustomers[a.customerId] = true;
    });
    var arrivedCount = Object.keys(arrivedCustomers).length;

    /* popular services from redeemed line items */
    var recsPop = recordsInRange(state, popStart, popEnd);
    var popMap = {};
    recsPop.forEach(function (r) {
      (r.items || []).forEach(function (it) {
        if (!popMap[it.serviceId]) popMap[it.serviceId] = { serviceId: it.serviceId, name: it.name, count: 0, originalFen: 0 };
        popMap[it.serviceId].count += 1;
        popMap[it.serviceId].originalFen += it.originalFen || 0;
      });
    });
    var popular = Object.keys(popMap).map(function (k) { return popMap[k]; });
    popular.sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return b.originalFen - a.originalFen;
    });
    popular = popular.slice(0, 5);

    var staffMap = {};
    state.staff.forEach(function (st) {
      staffMap[st.id] = { staffId: st.id, name: st.name, visitCount: 0, itemCount: 0 };
    });
    finishedToday.forEach(function (a) {
      if (!staffMap[a.staffId]) staffMap[a.staffId] = { staffId: a.staffId, name: (getStaff(state, a.staffId) || {}).name || a.staffId, visitCount: 0, itemCount: 0 };
      staffMap[a.staffId].visitCount += 1;
      staffMap[a.staffId].itemCount += (a.items || []).length;
    });
    var staffStats = Object.keys(staffMap).map(function (k) { return staffMap[k]; });
    staffStats.sort(function (a, b) { return b.visitCount - a.visitCount; });

    var due = aptsToday.filter(function (a) {
      if (a.status === STATUS.CANCELLED || a.status === STATUS.TIMEOUT) return false;
      if (ARRIVED_PLUS.indexOf(a.status) !== -1) return true;
      if (parseTs(a.start) <= now) return true;
      return false;
    });
    var arrivedAppts = due.filter(function (a) { return ARRIVED_PLUS.indexOf(a.status) !== -1; });
    var attendance = null;
    var attendanceText = "暂无应到预约";
    if (due.length) {
      attendance = Math.round((arrivedAppts.length / due.length) * 1000) / 10;
      attendanceText = attendance.toFixed(1) + "%";
    }

    var newCustomers = 0, oldCustomers = 0;
    var seen = {};
    recsToday.forEach(function (r) {
      if (seen[r.customerId]) return;
      seen[r.customerId] = true;
      var first = firstConsumptionTime(state, r.customerId);
      if (first != null && first >= dayStart && first < dayEnd) newCustomers += 1;
      else oldCustomers += 1;
    });

    /* referral stats for today + cumulative */
    var referralGroups = {};
    REF_TYPES.forEach(function (t) {
      referralGroups[t] = { type: t, newInPeriod: 0, convertedInPeriod: 0, convertedCumulative: 0, total: 0 };
    });
    (state.referrals || []).forEach(function (ref) {
      var g = referralGroups[ref.type] || (referralGroups[ref.type] = { type: ref.type, newInPeriod: 0, convertedInPeriod: 0, convertedCumulative: 0, total: 0 });
      g.total += 1;
      var w = parseTs(ref.writtenAt);
      if (w >= dayStart && w < dayEnd) g.newInPeriod += 1;
      if (ref.convertedAt) {
        g.convertedCumulative += 1;
        var ct = parseTs(ref.convertedAt);
        if (ct >= dayStart && ct < dayEnd) g.convertedInPeriod += 1;
      }
    });
    var referralList = REF_TYPES.map(function (t) {
      var g = referralGroups[t];
      var rate = g.newInPeriod === 0 ? null : Math.round((g.convertedInPeriod / g.newInPeriod) * 1000) / 10;
      return {
        type: t,
        newInPeriod: g.newInPeriod,
        convertedInPeriod: g.convertedInPeriod,
        convertedCumulative: g.convertedCumulative,
        total: g.total,
        rate: rate,
        rateText: rate == null ? "—" : rate.toFixed(1) + "%"
      };
    });

    return {
      dateStr: dateStr,
      generatedAt: MokujoTime.iso(now),
      demoLabel: "演示样品 · 虚拟数据 · 非真实经营数据",
      appointmentCountValid: validAppts.length,
      appointmentCountAll: aptsToday.length,
      statusCount: statusCount,
      cancelledCount: cancelledN,
      timeoutCount: timeoutN,
      cashFen: cashFen,
      cardOriginalFen: cardOrigFen,
      finishedVisitCount: finishedToday.length,
      finishedItemCount: finishedItemCount,
      arrivedCustomerCount: arrivedCount,
      popular: popular,
      popularRange: popularRange,
      staffStats: staffStats,
      dueCount: due.length,
      arrivedApptCount: arrivedAppts.length,
      attendance: attendance,
      attendanceText: attendanceText,
      newCustomers: newCustomers,
      oldCustomers: oldCustomers,
      referralList: referralList,
      pendingSettlement: (state.appointments || []).filter(function (a) { return a.status === STATUS.SETTLE; }),
      pendingConfirm: (state.appointments || []).filter(function (a) { return a.status === STATUS.PENDING; })
    };
  }

  return {
    STATUS: STATUS,
    LOCKING: LOCKING,
    TERMINAL: TERMINAL,
    ARRIVED_PLUS: ARRIVED_PLUS,
    COMPLETED_SERVICE: COMPLETED_SERVICE,
    REF_TYPES: REF_TYPES,
    ok: ok,
    fail: fail,
    byId: byId,
    uid: uid,
    fenYuan: fenYuan,
    moneyLabel: moneyLabel,
    overlaps: overlaps,
    actorOf: actorOf,
    getShop: getShop,
    getService: getService,
    getStaff: getStaff,
    getChair: getChair,
    getCustomer: getCustomer,
    getAppointment: getAppointment,
    getCard: getCard,
    shopHoursFor: shopHoursFor,
    staffWindows: staffWindows,
    chairForStaff: chairForStaff,
    checkInterval: checkInterval,
    getAvailableStarts: getAvailableStarts,
    sortServiceIds: sortServiceIds,
    buildItems: buildItems,
    eligibleStaff: eligibleStaff,
    previewBooking: previewBooking,
    releaseLocks: releaseLocks,
    expireDue: expireDue,
    pendingShouldExpire: pendingShouldExpire,
    createAppointment: createAppointment,
    confirmAppointment: confirmAppointment,
    simulateTimeout: simulateTimeout,
    canCustomerCancel: canCustomerCancel,
    cancelAppointment: cancelAppointment,
    markNoShow: markNoShow,
    arrive: arrive,
    startService: startService,
    lateFinishWarning: lateFinishWarning,
    completeService: completeService,
    cardsForCustomer: cardsForCustomer,
    cardApplies: cardApplies,
    settle: settle,
    voidSettlement: voidSettlement,
    reorderItems: reorderItems,
    demoBuyCard: demoBuyCard,
    issueCard: issueCard,
    updateShopRules: updateShopRules,
    upsertService: upsertService,
    upsertStaff: upsertStaff,
    upsertChair: upsertChair,
    upsertSchedule: upsertSchedule,
    addTempBlock: addTempBlock,
    getReferral: getReferral,
    setReferral: setReferral,
    ownerCorrectReferral: ownerCorrectReferral,
    writeReferral: writeReferral,
    computeDashboard: computeDashboard,
    firstConsumptionTime: firstConsumptionTime
  };
})();
