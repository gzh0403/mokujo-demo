/* MOKUJO 木序 P2 — Asia/Shanghai time helpers. No ES modules. */
var MokujoTime = (function () {
  var TZ = "Asia/Shanghai";

  function parts(ts) {
    var d = new Date(ts);
    var fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      weekday: "short"
    });
    var map = {};
    fmt.formatToParts(d).forEach(function (p) {
      map[p.type] = p.value;
    });
    var hour = map.hour === "24" ? "00" : map.hour;
    return {
      year: map.year,
      month: map.month,
      day: map.day,
      hour: hour,
      minute: map.minute,
      second: map.second,
      dateStr: map.year + "-" + map.month + "-" + map.day,
      hm: hour + ":" + map.minute,
      hms: hour + ":" + map.minute + ":" + map.second
    };
  }

  function now() {
    return Date.now();
  }

  function dateStr(ts) {
    return parts(ts == null ? now() : ts).dateStr;
  }

  function fromDateHM(date, hm) {
    var t = hm.length === 5 ? hm + ":00" : hm;
    return new Date(date + "T" + t + "+08:00").getTime();
  }

  function startOfDay(date) {
    return fromDateHM(date, "00:00:00");
  }

  function endOfDay(date) {
    return fromDateHM(date, "23:59:59") + 1000;
  }

  function addDays(date, n) {
    return dateStr(fromDateHM(date, "12:00:00") + n * 86400000);
  }

  function addMinutes(ts, m) {
    return ts + m * 60000;
  }

  function weekday(date) {
    return new Date(date + "T12:00:00+08:00").getUTCDay();
  }

  function weekdayName(date) {
    return "日一二三四五六".charAt(weekday(date));
  }

  function formatDateCN(date) {
    var p = date.split("-");
    return Number(p[0]) + "年" + Number(p[1]) + "月" + Number(p[2]) + "日 星期" + weekdayName(date);
  }

  function formatShortDate(date) {
    var p = date.split("-");
    return Number(p[1]) + "月" + Number(p[2]) + "日";
  }

  function formatDateTime(ts) {
    var p = parts(ts);
    return p.dateStr + " " + p.hm;
  }

  function formatDateTimeCN(ts) {
    var p = parts(ts);
    return formatShortDate(p.dateStr) + " " + p.hm;
  }

  function minutesBetween(a, b) {
    return Math.round((b - a) / 60000);
  }

  function iso(ts) {
    return new Date(ts).toISOString();
  }

  function parseISO(v) {
    if (typeof v === "number") return v;
    return new Date(v).getTime();
  }

  function hmOf(ts) {
    return parts(ts).hm;
  }

  function isSameDay(ts, date) {
    return dateStr(ts) === date;
  }

  function countdown(fromTs, toTs) {
    var ms = toTs - fromTs;
    if (ms <= 0) return { expired: true, text: "00:00", totalSec: 0, minutes: 0, seconds: 0 };
    var totalSec = Math.floor(ms / 1000);
    var minutes = Math.floor(totalSec / 60);
    var seconds = totalSec % 60;
    function pad(n) { return n < 10 ? "0" + n : String(n); }
    return {
      expired: false,
      text: pad(minutes) + ":" + pad(seconds),
      totalSec: totalSec,
      minutes: minutes,
      seconds: seconds,
      textCN: minutes + "分" + pad(seconds) + "秒"
    };
  }

  return {
    TZ: TZ,
    now: now,
    parts: parts,
    dateStr: dateStr,
    fromDateHM: fromDateHM,
    startOfDay: startOfDay,
    endOfDay: endOfDay,
    addDays: addDays,
    addMinutes: addMinutes,
    weekday: weekday,
    weekdayName: weekdayName,
    formatDateCN: formatDateCN,
    formatShortDate: formatShortDate,
    formatDateTime: formatDateTime,
    formatDateTimeCN: formatDateTimeCN,
    minutesBetween: minutesBetween,
    iso: iso,
    parseISO: parseISO,
    hmOf: hmOf,
    isSameDay: isSameDay,
    countdown: countdown
  };
})();
