/* 自駕行程的純資料計算，同時提供瀏覽器與測試使用。 */
(() => {
  'use strict';
  const minutes = value => /^\d{2}:\d{2}$/.test(value || '') && +value.slice(0, 2) < 24 && +value.slice(3) < 60 ? +value.slice(0, 2) * 60 + +value.slice(3) : null;
  const clock = value => {
    value = Math.round(value);
    const day = Math.floor(value / 1440), time = ((value % 1440) + 1440) % 1440;
    return `${day === 1 ? '翌日 ' : day === -1 ? '前日 ' : day ? `${Math.abs(day)} 天${day > 0 ? '後' : '前'} ` : ''}${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;
  };
  const arrivalMinutes = item => {
    const base = minutes(item.arrivalTime || item.time);
    return base === null ? null : base + (Number(item.arrivalDayOffset) || 0) * 1440;
  };
  const arrivalLabel = item => arrivalMinutes(item) === null ? (item.arrivalTime || item.time || '時間未定') : clock(arrivalMinutes(item));
  const safeUrl = value => { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch (_) { return ''; } };
  const navigation = item => safeUrl(item.googleMaps || item.mapUrl) || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.address || item.map || item.name || '')}&travelmode=driving`;
  const status = item => ['current', 'done', 'skipped'].includes(item.status) ? item.status : 'pending';
  function localTime(timeZone, now = new Date()) {
    let formatter;
    try { formatter = new Intl.DateTimeFormat('en-CA', {timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}); }
    catch (_) { formatter = new Intl.DateTimeFormat('en-CA', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}); }
    const p=Object.fromEntries(formatter.formatToParts(now).map(x=>[x.type,x.value]));
    return {date:`${p.year}-${p.month}-${p.day}`,minutes:+p.hour*60 + +p.minute};
  }
  const nextIndex = items => { const current = items.findIndex(it => status(it) === 'current'); return items.findIndex((it, i) => i > current && status(it) === 'pending'); };
  function delay(items, now) {
    const current = items.find(it => status(it) === 'current');
    if (!current || current.stayMinutes === undefined) return 0;
    const arrival = arrivalMinutes(current);
    return arrival === null ? 0 : Math.max(0, Math.ceil(now - arrival - Number(current.stayMinutes)));
  }
  function shiftPending(items, by) {
    const current = items.findIndex(it => status(it) === 'current');
    if (current < 0 || !Number.isFinite(by) || by <= 0) return;
    items.forEach((it, i) => {
      const n = arrivalMinutes(it);
      if (i <= current || status(it) !== 'pending' || n === null) return;
      const shifted = n + Math.ceil(by);
      it[it.arrivalTime ? 'arrivalTime' : 'time'] = clock(shifted % 1440);
      it.arrivalDayOffset = Math.floor(shifted / 1440);
    });
    items[current].stayMinutes = Number(items[current].stayMinutes || 0) + Math.ceil(by);
  }
  function publicTrip(trip) {
    return JSON.parse(JSON.stringify(trip, (key, value) => ['reservationNo', 'editKey', 'syncKey'].includes(key) ? undefined : value));
  }
  const validTrip = t => t && typeof t === 'object' && Array.isArray(t.days) && t.days.every(d => d && typeof d === 'object' && (!d.items || (Array.isArray(d.items) && d.items.every(it => it && typeof it === 'object'))));
  const api = { minutes, clock, arrivalMinutes, arrivalLabel, shiftPending, safeUrl, navigation, status, nextIndex, delay, publicTrip, validTrip, localTime };
  if (typeof module !== 'undefined') module.exports = api;
  else window.TripCore = api;
})();
