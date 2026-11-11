/* MOKUJO 木序 P2 — virtual seed data, rebuilt relative to "today" in Asia/Shanghai. */
var MokujoData = (function () {
  var CATEGORY_ORDER = ["洗护", "剪发", "染烫造型", "护理"];

  var WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

  function weeklyHours(start, end) {
    return WEEKDAYS.map(function (w) {
      return { weekday: w, start: start, end: w === 0 ? "19:00" : end };
    });
  }

  function weeklySchedule(staffId, start, end, restStart, restEnd) {
    var rows = [];
    WEEKDAYS.forEach(function (w) {
      var close = w === 0 ? "19:00" : end;
      rows.push({
        id: "sch-" + staffId + "-w" + w,
        staffId: staffId,
        weekday: w,
        start: start,
        end: close
      });
      if (restStart && restEnd) {
        rows.push({
          id: "rest-" + staffId + "-w" + w,
          kind: "rest",
          staffId: staffId,
          weekday: w,
          start: restStart,
          end: restEnd
        });
      }
    });
    return rows;
  }

  function build(now) {
    now = now || MokujoTime.now();
    var today = MokujoTime.dateStr(now);
    var yesterday = MokujoTime.addDays(today, -1);
    var tomorrow = MokujoTime.addDays(today, 1);
    var lastMonth = MokujoTime.addDays(today, -32);
    var lastWeek = MokujoTime.addDays(today, -7);
    var twoMonthsAgo = MokujoTime.addDays(today, -60);

    function ts(date, hm) {
      return MokujoTime.fromDateHM(date, hm);
    }
    function iso(date, hm) {
      return MokujoTime.iso(ts(date, hm));
    }

    var shop = {
      id: "shop-mokujo",
      brandName: "MOKUJO 木序",
      subtitle: "HAIR PARLOUR · EST. 1986",
      styleLine: "昭和复古 × 精品理发沙龙",
      intro: "木序是一间虚拟演示门店。我们用胡桃木、旧纸与细金线，把一次理发写成一本小型杂志。这里的项目、价格、员工与预约全部是演示数据，不是真实经营记录。",
      address: "演示市昭和通 1986 号 二楼",
      phone: "010-19861986",
      announcement: "今日演示开放预约。确认时限默认 15 分钟，超时将自动释放时段。",
      hours: weeklyHours("10:00", "20:00"),
      closedDates: [],
      displayInterval: 30,
      startStep: 15,
      confirmTimeoutMinutes: 15,
      cancelLeadHours: 2,
      categoryOrder: CATEGORY_ORDER.slice(),
      memberBenefits: [
        "生日当月可预约一次演示护理礼遇（需提前告知门店）。",
        "持有次卡的顾客可在待结算时按适用项目扣次。",
        "会员可查看完整消费记录，并再次预约同一位发型师。"
      ]
    };

    var services = [
      { id: "svc-wash", name: "经典洗发", category: "洗护", durationMin: 20, priceFen: 4800, on: true, desc: "温水冲洗、轻柔按摩与基础吹理，作为剪染前的开始。" },
      { id: "svc-cut45", name: "精修剪发", category: "剪发", durationMin: 45, priceFen: 18800, on: true, desc: "按头型与发量进行精修，时长 45 分钟，不是 30 分钟的整数倍。" },
      { id: "svc-cut60", name: "昭和造型剪", category: "剪发", durationMin: 60, priceFen: 26800, on: true, desc: "更完整的沟通、修剪与造型，约 60 分钟。" },
      { id: "svc-color", name: "时尚染发", category: "染烫造型", durationMin: 90, priceFen: 42800, on: true, desc: "单次染发演示项目，含上色与基础护理，约 90 分钟。" },
      { id: "svc-perm", name: "经典烫发", category: "染烫造型", durationMin: 120, priceFen: 48800, on: true, desc: "经典烫发演示项目，约 120 分钟。" },
      { id: "svc-scalp", name: "头皮护理", category: "护理", durationMin: 30, priceFen: 16800, on: true, desc: "头皮清洁与放松护理，30 分钟。" },
      { id: "svc-oil", name: "护发精油护理", category: "护理", durationMin: 45, priceFen: 22800, on: true, desc: "精油护理与吹整，45 分钟。" }
    ];

    var chairs = [
      { id: "chair-1", name: "一号椅", enabled: true },
      { id: "chair-2", name: "二号椅", enabled: true },
      { id: "chair-3", name: "三号椅", enabled: true }
    ];

    var allSvc = services.map(function (s) { return s.id; });

    var staff = [
      {
        id: "stf-xiaolin",
        name: "小林",
        title: "店长发型师",
        bio: "演示员工。擅长精修与护理，默认一号椅。也可作为店员账号处理预约。",
        avatar: "assets/images/avatar-xiaolin.jpg",
        serviceIds: allSvc.slice(),
        defaultChairId: "chair-1",
        status: "active"
      },
      {
        id: "stf-ayuan",
        name: "阿远",
        title: "资深剪裁",
        bio: "演示员工。擅长精修与造型剪，默认二号椅。",
        avatar: "assets/images/avatar-ayuan.jpg",
        serviceIds: ["svc-wash", "svc-cut45", "svc-cut60", "svc-scalp", "svc-oil"],
        defaultChairId: "chair-2",
        status: "active"
      },
      {
        id: "stf-xiaoxia",
        name: "小夏",
        title: "染烫造型",
        bio: "演示员工。擅长染烫与护理，默认三号椅。",
        avatar: "assets/images/avatar-xiaoxia.jpg",
        serviceIds: allSvc.slice(),
        defaultChairId: "chair-3",
        status: "active"
      }
    ];

    var schedules = []
      .concat(weeklySchedule("stf-xiaolin", "10:00", "20:00", "12:00", "13:00"))
      .concat(weeklySchedule("stf-ayuan", "10:00", "20:00", "12:30", "13:30"))
      .concat(weeklySchedule("stf-xiaoxia", "10:00", "20:00", "12:30", "13:30"));

    var tempBlocks = [];

    var customers = [
      { id: "cus-aqing", name: "阿青", phone: "13800001001", member: true, memberSince: iso(lastMonth, "11:00"), createdAt: iso(twoMonthsAgo, "10:00") },
      { id: "cus-anan", name: "阿南", phone: "13800001002", member: true, memberSince: iso(twoMonthsAgo, "15:00"), createdAt: iso(twoMonthsAgo, "14:00") },
      { id: "cus-xiaoman", name: "小满", phone: "13800001003", member: false, memberSince: null, createdAt: iso(yesterday, "18:20") },
      { id: "cus-achuan", name: "阿川", phone: "13800001004", member: false, memberSince: null, createdAt: iso(lastWeek, "09:10") },
      { id: "cus-linxia", name: "林夏", phone: "13800001005", member: false, memberSince: null, createdAt: iso(lastWeek, "16:40") },
      { id: "cus-abei", name: "阿北", phone: "13800001006", member: false, memberSince: null, createdAt: iso(today, "09:05") },
      { id: "cus-adong", name: "阿东", phone: "13800001007", member: false, memberSince: null, createdAt: iso(today, "08:40") }
    ];

    var users = [
      { id: "user-aqing", role: "customer", name: "顾客阿青", customerId: "cus-aqing", staffId: null, status: "active" },
      { id: "user-xiaolin", role: "staff", name: "店员小林", customerId: null, staffId: "stf-xiaolin", status: "active" },
      { id: "user-owner", role: "owner", name: "老板木序", customerId: null, staffId: null, status: "active" }
    ];

    var cardProducts = [
      {
        id: "prod-cut10",
        name: "精修剪发十次卡",
        totalCounts: 10,
        serviceIds: ["svc-cut45"],
        demoPriceFen: 158000,
        desc: "适用于「精修剪发」。演示购买或老板发放，不计入今日收银金额。"
      },
      {
        id: "prod-care5",
        name: "护理五次卡",
        totalCounts: 5,
        serviceIds: ["svc-scalp", "svc-oil"],
        demoPriceFen: 68800,
        desc: "适用于「头皮护理」「护发精油护理」。演示购买或老板发放，不计入今日收银金额。"
      }
    ];

    var punchCards = [
      {
        id: "card-aqing-cut",
        customerId: "cus-aqing",
        productId: "prod-cut10",
        name: "精修剪发十次卡",
        serviceIds: ["svc-cut45"],
        totalCounts: 10,
        remaining: 7,
        status: "active",
        issuedAt: iso(lastMonth, "11:30"),
        issuedBy: "user-owner",
        source: "owner-issue"
      }
    ];

    function item(id, svcId, sort) {
      var s = services.filter(function (x) { return x.id === svcId; })[0];
      return {
        id: id,
        serviceId: s.id,
        name: s.name,
        category: s.category,
        durationMin: s.durationMin,
        priceFen: s.priceFen,
        sort: sort
      };
    }

    function apt(cfg) {
      return {
        id: cfg.id,
        shopId: "shop-mokujo",
        customerId: cfg.customerId,
        staffId: cfg.staffId,
        chairId: cfg.chairId,
        items: cfg.items,
        totalDurationMin: cfg.totalDurationMin,
        totalPriceFen: cfg.totalPriceFen,
        start: iso(cfg.date, cfg.startHM),
        end: MokujoTime.iso(ts(cfg.date, cfg.startHM) + cfg.totalDurationMin * 60000),
        status: cfg.status,
        submittedAt: cfg.submittedAt,
        timeoutMinutesSnapshot: cfg.timeoutMinutesSnapshot || 15,
        timeoutAt: cfg.timeoutAt || null,
        confirmedAt: cfg.confirmedAt || null,
        confirmedBy: cfg.confirmedBy || null,
        arrivedAt: cfg.arrivedAt || null,
        arrivedBy: cfg.arrivedBy || null,
        serviceStartedAt: cfg.serviceStartedAt || null,
        serviceCompletedAt: cfg.serviceCompletedAt || null,
        cancelledAt: cfg.cancelledAt || null,
        cancelReason: cfg.cancelReason || null,
        cancelledBy: cfg.cancelledBy || null,
        settledAt: cfg.settledAt || null,
        settlementId: cfg.settlementId || null,
        contactName: cfg.contactName,
        phone: cfg.phone,
        notes: cfg.notes || "",
        lateFinishWarnedAt: null,
        noShowAt: cfg.noShowAt || null,
        voidReason: cfg.voidReason || null,
        voidedAt: cfg.voidedAt || null
      };
    }

    function lock(id, kind, resourceId, appointmentId, date, startHM, minutes, status, releasedAt) {
      var startMs = ts(date, startHM);
      return {
        id: id,
        kind: kind,
        resourceId: resourceId,
        appointmentId: appointmentId,
        start: iso(date, startHM),
        end: MokujoTime.iso(startMs + minutes * 60000),
        status: status,
        releasedAt: releasedAt || null
      };
    }

    /* Today's narrative (times are on the Shanghai calendar day, independent of the current clock):
       10:00 阿青+小林 洗+精修 已完成，混合结算（洗付款、剪扣次）
       10:00 阿南+阿远 精修 已完成，模拟付款
       11:00 小满+小夏 时尚染发 已完成，小满首次核销（新客+推荐转化）
       13:30 林夏+小林 护发精油 待结算（可演示结算）
       18:00 阿川+阿远 昭和造型剪 已确认（可到店 / 若已过点可标记逾期）
       近期提交：阿北+小夏 明日 11:00 护发精油 待确认（可确认或模拟超时）
       早些时候：阿东+阿远 16:00 精修 已超时未确认
       明日：阿青+小林 14:00 精修 已确认（顾客可取消）
       历史：阿青、阿南过往消费，使两人成为老客
    */

    var appointments = [];
    var locks = [];
    var consumptionRecords = [];
    var punchLedgers = [];
    var referrals = [];

    /* --- historical: 阿南 first visit two months ago --- */
    appointments.push(apt({
      id: "apt-hist-anan-1",
      customerId: "cus-anan",
      staffId: "stf-ayuan",
      chairId: "chair-2",
      items: [item("it-hist-anan-1", "svc-cut45", 1)],
      totalDurationMin: 45,
      totalPriceFen: 18800,
      date: twoMonthsAgo,
      startHM: "15:00",
      status: "已完成",
      submittedAt: iso(twoMonthsAgo, "11:00"),
      confirmedAt: iso(twoMonthsAgo, "11:05"),
      confirmedBy: "user-xiaolin",
      arrivedAt: iso(twoMonthsAgo, "14:55"),
      arrivedBy: "user-xiaolin",
      serviceStartedAt: iso(twoMonthsAgo, "15:00"),
      serviceCompletedAt: iso(twoMonthsAgo, "15:40"),
      settledAt: iso(twoMonthsAgo, "15:45"),
      settlementId: "con-hist-anan-1",
      contactName: "阿南",
      phone: "13800001002"
    }));
    locks.push(lock("lk-h-anan-s", "staff", "stf-ayuan", "apt-hist-anan-1", twoMonthsAgo, "15:00", 45, "released", iso(twoMonthsAgo, "15:40")));
    locks.push(lock("lk-h-anan-c", "chair", "chair-2", "apt-hist-anan-1", twoMonthsAgo, "15:00", 45, "released", iso(twoMonthsAgo, "15:40")));
    consumptionRecords.push({
      id: "con-hist-anan-1",
      appointmentId: "apt-hist-anan-1",
      customerId: "cus-anan",
      staffId: "stf-ayuan",
      redeemedAt: iso(twoMonthsAgo, "15:45"),
      redeemedBy: "user-xiaolin",
      items: [{ serviceId: "svc-cut45", name: "精修剪发", priceFen: 18800, method: "cash", cardId: null, cashFen: 18800, originalFen: 18800 }],
      cashTotalFen: 18800,
      cardOriginalTotalFen: 0,
      originalTotalFen: 18800
    });

    /* --- historical: 阿青 last month, first consumption --- */
    appointments.push(apt({
      id: "apt-hist-aqing-1",
      customerId: "cus-aqing",
      staffId: "stf-xiaolin",
      chairId: "chair-1",
      items: [item("it-hist-aqing-1a", "svc-wash", 1), item("it-hist-aqing-1b", "svc-cut45", 2)],
      totalDurationMin: 65,
      totalPriceFen: 23600,
      date: lastMonth,
      startHM: "14:00",
      status: "已完成",
      submittedAt: iso(lastMonth, "10:00"),
      confirmedAt: iso(lastMonth, "10:08"),
      confirmedBy: "user-xiaolin",
      arrivedAt: iso(lastMonth, "13:55"),
      arrivedBy: "user-xiaolin",
      serviceStartedAt: iso(lastMonth, "14:00"),
      serviceCompletedAt: iso(lastMonth, "15:00"),
      settledAt: iso(lastMonth, "15:08"),
      settlementId: "con-hist-aqing-1",
      contactName: "阿青",
      phone: "13800001001"
    }));
    locks.push(lock("lk-h-aqing-s", "staff", "stf-xiaolin", "apt-hist-aqing-1", lastMonth, "14:00", 65, "released", iso(lastMonth, "15:00")));
    locks.push(lock("lk-h-aqing-c", "chair", "chair-1", "apt-hist-aqing-1", lastMonth, "14:00", 65, "released", iso(lastMonth, "15:00")));
    consumptionRecords.push({
      id: "con-hist-aqing-1",
      appointmentId: "apt-hist-aqing-1",
      customerId: "cus-aqing",
      staffId: "stf-xiaolin",
      redeemedAt: iso(lastMonth, "15:08"),
      redeemedBy: "user-xiaolin",
      items: [
        { serviceId: "svc-wash", name: "经典洗发", priceFen: 4800, method: "cash", cardId: null, cashFen: 4800, originalFen: 4800 },
        { serviceId: "svc-cut45", name: "精修剪发", priceFen: 18800, method: "card", cardId: "card-aqing-cut", cashFen: 0, originalFen: 18800 }
      ],
      cashTotalFen: 4800,
      cardOriginalTotalFen: 18800,
      originalTotalFen: 23600
    });
    punchLedgers.push({
      id: "led-hist-aqing-1",
      cardId: "card-aqing-cut",
      appointmentId: "apt-hist-aqing-1",
      consumptionId: "con-hist-aqing-1",
      customerId: "cus-aqing",
      change: -1,
      remainingAfter: 9,
      createdAt: iso(lastMonth, "15:08"),
      by: "user-xiaolin"
    });

    /* --- historical: 阿南 last week --- */
    appointments.push(apt({
      id: "apt-hist-anan-2",
      customerId: "cus-anan",
      staffId: "stf-xiaolin",
      chairId: "chair-1",
      items: [item("it-hist-anan-2", "svc-cut60", 1)],
      totalDurationMin: 60,
      totalPriceFen: 26800,
      date: lastWeek,
      startHM: "16:00",
      status: "已完成",
      submittedAt: iso(lastWeek, "09:00"),
      confirmedAt: iso(lastWeek, "09:10"),
      confirmedBy: "user-xiaolin",
      arrivedAt: iso(lastWeek, "15:55"),
      arrivedBy: "user-xiaolin",
      serviceStartedAt: iso(lastWeek, "16:00"),
      serviceCompletedAt: iso(lastWeek, "16:55"),
      settledAt: iso(lastWeek, "17:00"),
      settlementId: "con-hist-anan-2",
      contactName: "阿南",
      phone: "13800001002"
    }));
    locks.push(lock("lk-h-anan2-s", "staff", "stf-xiaolin", "apt-hist-anan-2", lastWeek, "16:00", 60, "released", iso(lastWeek, "16:55")));
    locks.push(lock("lk-h-anan2-c", "chair", "chair-1", "apt-hist-anan-2", lastWeek, "16:00", 60, "released", iso(lastWeek, "16:55")));
    consumptionRecords.push({
      id: "con-hist-anan-2",
      appointmentId: "apt-hist-anan-2",
      customerId: "cus-anan",
      staffId: "stf-xiaolin",
      redeemedAt: iso(lastWeek, "17:00"),
      redeemedBy: "user-xiaolin",
      items: [{ serviceId: "svc-cut60", name: "昭和造型剪", priceFen: 26800, method: "cash", cardId: null, cashFen: 26800, originalFen: 26800 }],
      cashTotalFen: 26800,
      cardOriginalTotalFen: 0,
      originalTotalFen: 26800
    });

    /* --- today 10:00 阿青 + 小林 洗+精修 已完成 混合 --- */
    appointments.push(apt({
      id: "apt-today-aqing",
      customerId: "cus-aqing",
      staffId: "stf-xiaolin",
      chairId: "chair-1",
      items: [item("it-today-aqing-a", "svc-wash", 1), item("it-today-aqing-b", "svc-cut45", 2)],
      totalDurationMin: 65,
      totalPriceFen: 23600,
      date: today,
      startHM: "10:00",
      status: "已完成",
      submittedAt: iso(yesterday, "18:00"),
      confirmedAt: iso(yesterday, "18:06"),
      confirmedBy: "user-xiaolin",
      arrivedAt: iso(today, "09:52"),
      arrivedBy: "user-xiaolin",
      serviceStartedAt: iso(today, "10:00"),
      serviceCompletedAt: iso(today, "11:02"),
      settledAt: iso(today, "11:08"),
      settlementId: "con-today-aqing",
      contactName: "阿青",
      phone: "13800001001"
    }));
    locks.push(lock("lk-td-aqing-s", "staff", "stf-xiaolin", "apt-today-aqing", today, "10:00", 65, "released", iso(today, "11:02")));
    locks.push(lock("lk-td-aqing-c", "chair", "chair-1", "apt-today-aqing", today, "10:00", 65, "released", iso(today, "11:02")));
    consumptionRecords.push({
      id: "con-today-aqing",
      appointmentId: "apt-today-aqing",
      customerId: "cus-aqing",
      staffId: "stf-xiaolin",
      redeemedAt: iso(today, "11:08"),
      redeemedBy: "user-xiaolin",
      items: [
        { serviceId: "svc-wash", name: "经典洗发", priceFen: 4800, method: "cash", cardId: null, cashFen: 4800, originalFen: 4800 },
        { serviceId: "svc-cut45", name: "精修剪发", priceFen: 18800, method: "card", cardId: "card-aqing-cut", cashFen: 0, originalFen: 18800 }
      ],
      cashTotalFen: 4800,
      cardOriginalTotalFen: 18800,
      originalTotalFen: 23600
    });
    punchLedgers.push({
      id: "led-today-aqing",
      cardId: "card-aqing-cut",
      appointmentId: "apt-today-aqing",
      consumptionId: "con-today-aqing",
      customerId: "cus-aqing",
      change: -1,
      remainingAfter: 8,
      createdAt: iso(today, "11:08"),
      by: "user-xiaolin"
    });
    /* card remaining already set to 7 because there is another historical + today? hist left 9, today should leave 8.
       Wait I set remaining: 7 in punchCards. Let me recount:
       issued 10, hist -1 → 9, today -1 → 8. Fix remaining to 8.
       I will fix below after building punchCards... I'll set it to 8 in the object above? I already wrote 7. I'll patch after. */

    /* --- today 10:00 阿南 + 阿远 精修 已完成 --- */
    appointments.push(apt({
      id: "apt-today-anan",
      customerId: "cus-anan",
      staffId: "stf-ayuan",
      chairId: "chair-2",
      items: [item("it-today-anan", "svc-cut45", 1)],
      totalDurationMin: 45,
      totalPriceFen: 18800,
      date: today,
      startHM: "10:00",
      status: "已完成",
      submittedAt: iso(yesterday, "19:10"),
      confirmedAt: iso(yesterday, "19:12"),
      confirmedBy: "user-xiaolin",
      arrivedAt: iso(today, "09:50"),
      arrivedBy: "user-xiaolin",
      serviceStartedAt: iso(today, "10:00"),
      serviceCompletedAt: iso(today, "10:42"),
      settledAt: iso(today, "10:48"),
      settlementId: "con-today-anan",
      contactName: "阿南",
      phone: "13800001002"
    }));
    locks.push(lock("lk-td-anan-s", "staff", "stf-ayuan", "apt-today-anan", today, "10:00", 45, "released", iso(today, "10:42")));
    locks.push(lock("lk-td-anan-c", "chair", "chair-2", "apt-today-anan", today, "10:00", 45, "released", iso(today, "10:42")));
    consumptionRecords.push({
      id: "con-today-anan",
      appointmentId: "apt-today-anan",
      customerId: "cus-anan",
      staffId: "stf-ayuan",
      redeemedAt: iso(today, "10:48"),
      redeemedBy: "user-xiaolin",
      items: [{ serviceId: "svc-cut45", name: "精修剪发", priceFen: 18800, method: "cash", cardId: null, cashFen: 18800, originalFen: 18800 }],
      cashTotalFen: 18800,
      cardOriginalTotalFen: 0,
      originalTotalFen: 18800
    });

    /* --- today 11:00 小满 + 小夏 染发 已完成 首次核销 --- */
    appointments.push(apt({
      id: "apt-today-xiaoman",
      customerId: "cus-xiaoman",
      staffId: "stf-xiaoxia",
      chairId: "chair-3",
      items: [item("it-today-xiaoman", "svc-color", 1)],
      totalDurationMin: 90,
      totalPriceFen: 42800,
      date: today,
      startHM: "11:00",
      status: "已完成",
      submittedAt: iso(yesterday, "20:00"),
      confirmedAt: iso(yesterday, "20:04"),
      confirmedBy: "user-xiaolin",
      arrivedAt: iso(today, "10:50"),
      arrivedBy: "user-xiaolin",
      serviceStartedAt: iso(today, "11:00"),
      serviceCompletedAt: iso(today, "12:25"),
      settledAt: iso(today, "12:32"),
      settlementId: "con-today-xiaoman",
      contactName: "小满",
      phone: "13800001003"
    }));
    locks.push(lock("lk-td-xm-s", "staff", "stf-xiaoxia", "apt-today-xiaoman", today, "11:00", 90, "released", iso(today, "12:25")));
    locks.push(lock("lk-td-xm-c", "chair", "chair-3", "apt-today-xiaoman", today, "11:00", 90, "released", iso(today, "12:25")));
    consumptionRecords.push({
      id: "con-today-xiaoman",
      appointmentId: "apt-today-xiaoman",
      customerId: "cus-xiaoman",
      staffId: "stf-xiaoxia",
      redeemedAt: iso(today, "12:32"),
      redeemedBy: "user-xiaolin",
      items: [{ serviceId: "svc-color", name: "时尚染发", priceFen: 42800, method: "cash", cardId: null, cashFen: 42800, originalFen: 42800 }],
      cashTotalFen: 42800,
      cardOriginalTotalFen: 0,
      originalTotalFen: 42800
    });

    /* --- today 13:30 林夏 + 小林 护发精油 待结算 --- */
    appointments.push(apt({
      id: "apt-today-linxia",
      customerId: "cus-linxia",
      staffId: "stf-xiaolin",
      chairId: "chair-1",
      items: [item("it-today-linxia", "svc-oil", 1)],
      totalDurationMin: 45,
      totalPriceFen: 22800,
      date: today,
      startHM: "13:30",
      status: "待结算",
      submittedAt: iso(today, "09:10"),
      confirmedAt: iso(today, "09:12"),
      confirmedBy: "user-xiaolin",
      arrivedAt: iso(today, "13:25"),
      arrivedBy: "user-xiaolin",
      serviceStartedAt: iso(today, "13:32"),
      serviceCompletedAt: iso(today, "14:10"),
      contactName: "林夏",
      phone: "13800001005",
      notes: "提前结束，剩余时段已释放。"
    }));
    locks.push(lock("lk-td-lx-s", "staff", "stf-xiaolin", "apt-today-linxia", today, "13:30", 45, "released", iso(today, "14:10")));
    locks.push(lock("lk-td-lx-c", "chair", "chair-1", "apt-today-linxia", today, "13:30", 45, "released", iso(today, "14:10")));

    /* --- today 18:00 阿川 + 阿远 昭和造型剪 已确认 --- */
    appointments.push(apt({
      id: "apt-today-achuan",
      customerId: "cus-achuan",
      staffId: "stf-ayuan",
      chairId: "chair-2",
      items: [item("it-today-achuan", "svc-cut60", 1)],
      totalDurationMin: 60,
      totalPriceFen: 26800,
      date: today,
      startHM: "18:00",
      status: "已确认",
      submittedAt: iso(today, "08:30"),
      confirmedAt: iso(today, "08:36"),
      confirmedBy: "user-xiaolin",
      contactName: "阿川",
      phone: "13800001004"
    }));
    locks.push(lock("lk-td-ac-s", "staff", "stf-ayuan", "apt-today-achuan", today, "18:00", 60, "active", null));
    locks.push(lock("lk-td-ac-c", "chair", "chair-2", "apt-today-achuan", today, "18:00", 60, "active", null));

    /* --- 阿东 today 16:00 超时未确认（提交于 15:40，超时 15 分钟，开始时刻到了仍未确认也会超时） --- */
    appointments.push(apt({
      id: "apt-today-adong",
      customerId: "cus-adong",
      staffId: "stf-ayuan",
      chairId: "chair-2",
      items: [item("it-today-adong", "svc-cut45", 1)],
      totalDurationMin: 45,
      totalPriceFen: 18800,
      date: today,
      startHM: "16:00",
      status: "超时未确认",
      submittedAt: iso(today, "15:40"),
      timeoutMinutesSnapshot: 15,
      timeoutAt: iso(today, "15:55"),
      contactName: "阿东",
      phone: "13800001007"
    }));
    locks.push(lock("lk-td-ad-s", "staff", "stf-ayuan", "apt-today-adong", today, "16:00", 45, "released", iso(today, "15:55")));
    locks.push(lock("lk-td-ad-c", "chair", "chair-2", "apt-today-adong", today, "16:00", 45, "released", iso(today, "15:55")));

    /* --- 阿北 明日 11:00 待确认：timeoutAt = now+12min so demo can confirm or wait; if now is used at seed time --- */
    var pendingSubmitted = now - 3 * 60000;
    var pendingTimeout = now + 12 * 60000;
    appointments.push(apt({
      id: "apt-tmr-abei",
      customerId: "cus-abei",
      staffId: "stf-xiaoxia",
      chairId: "chair-3",
      items: [item("it-tmr-abei", "svc-oil", 1)],
      totalDurationMin: 45,
      totalPriceFen: 22800,
      date: tomorrow,
      startHM: "11:00",
      status: "待确认",
      submittedAt: MokujoTime.iso(pendingSubmitted),
      timeoutMinutesSnapshot: 15,
      timeoutAt: MokujoTime.iso(pendingTimeout),
      contactName: "阿北",
      phone: "13800001006"
    }));
    locks.push(lock("lk-tmr-ab-s", "staff", "stf-xiaoxia", "apt-tmr-abei", tomorrow, "11:00", 45, "active", null));
    locks.push(lock("lk-tmr-ab-c", "chair", "chair-3", "apt-tmr-abei", tomorrow, "11:00", 45, "active", null));

    /* --- 明日 阿青 + 小林 14:00 已确认 --- */
    appointments.push(apt({
      id: "apt-tmr-aqing",
      customerId: "cus-aqing",
      staffId: "stf-xiaolin",
      chairId: "chair-1",
      items: [item("it-tmr-aqing", "svc-cut45", 1)],
      totalDurationMin: 45,
      totalPriceFen: 18800,
      date: tomorrow,
      startHM: "14:00",
      status: "已确认",
      submittedAt: iso(today, "09:40"),
      confirmedAt: iso(today, "09:44"),
      confirmedBy: "user-xiaolin",
      contactName: "阿青",
      phone: "13800001001"
    }));
    locks.push(lock("lk-tmr-aq-s", "staff", "stf-xiaolin", "apt-tmr-aqing", tomorrow, "14:00", 45, "active", null));
    locks.push(lock("lk-tmr-aq-c", "chair", "chair-1", "apt-tmr-aqing", tomorrow, "14:00", 45, "active", null));

    /* remaining of 阿青 card: issued 10, hist -1, today -1 → 8 */
    punchCards[0].remaining = 8;

    referrals = [
      {
        customerId: "cus-aqing",
        type: "朋友推荐",
        referrerId: "cus-anan",
        writtenAt: iso(lastMonth, "10:00"),
        writtenBy: "user-aqing",
        convertedAt: iso(lastMonth, "15:08"),
        conversionRecordId: "con-hist-aqing-1",
        correctionUsed: false,
        correction: null
      },
      {
        customerId: "cus-anan",
        type: "路过",
        referrerId: null,
        writtenAt: iso(twoMonthsAgo, "14:00"),
        writtenBy: "user-owner",
        convertedAt: iso(twoMonthsAgo, "15:45"),
        conversionRecordId: "con-hist-anan-1",
        correctionUsed: false,
        correction: null
      },
      {
        customerId: "cus-xiaoman",
        type: "朋友推荐",
        referrerId: "cus-aqing",
        writtenAt: iso(yesterday, "18:20"),
        writtenBy: "cus-xiaoman",
        convertedAt: iso(today, "12:32"),
        conversionRecordId: "con-today-xiaoman",
        correctionUsed: false,
        correction: null
      },
      {
        customerId: "cus-achuan",
        type: "网络看到",
        referrerId: null,
        writtenAt: iso(lastWeek, "09:10"),
        writtenBy: "cus-achuan",
        convertedAt: null,
        conversionRecordId: null,
        correctionUsed: false,
        correction: null
      },
      {
        customerId: "cus-linxia",
        type: "未填写",
        referrerId: null,
        writtenAt: iso(lastWeek, "16:40"),
        writtenBy: "system",
        convertedAt: null,
        conversionRecordId: null,
        correctionUsed: false,
        correction: null
      },
      {
        customerId: "cus-abei",
        type: "路过",
        referrerId: null,
        writtenAt: iso(today, "09:05"),
        writtenBy: "cus-abei",
        convertedAt: null,
        conversionRecordId: null,
        correctionUsed: false,
        correction: null
      },
      {
        customerId: "cus-adong",
        type: "其他",
        referrerId: null,
        writtenAt: iso(today, "08:40"),
        writtenBy: "cus-adong",
        convertedAt: null,
        conversionRecordId: null,
        correctionUsed: false,
        correction: null
      }
    ];

    return {
      schemaVersion: 1,
      seededAt: MokujoTime.iso(now),
      seedToday: today,
      shop: shop,
      services: services,
      chairs: chairs,
      staff: staff,
      schedules: schedules,
      tempBlocks: tempBlocks,
      customers: customers,
      users: users,
      cardProducts: cardProducts,
      punchCards: punchCards,
      punchLedgers: punchLedgers,
      appointments: appointments,
      locks: locks,
      consumptionRecords: consumptionRecords,
      referrals: referrals,
      audit: [],
      currentUserId: "user-aqing"
    };
  }

  return { CATEGORY_ORDER: CATEGORY_ORDER, build: build };
})();
