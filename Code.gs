/**
 * Бэкенд приложения торгового представителя.
 * Работает как веб-приложение Google Apps Script, привязанное к Google Таблице.
 * МойСклад: точки (контрагенты), остатки и цены, заказы покупателей.
 * Google Таблица: сотрудники, маршруты, визиты, координаты точек.
 *
 * Свойства скрипта (Настройки проекта → Свойства скрипта):
 *   MS_TOKEN            — токен МойСклад (обязательно)
 *   ORG_NAME            — название юрлица для заказов, по умолчанию «DEUS SAMARA»
 *   DEFAULT_PRICE_TYPE  — тип цены, если в карточке точки он не задан (если пусто — первый)
 *   POINT_TAG           — брать только контрагентов с этой группой (тегом); пусто — всех
 *   POINT_SKIP_TAGS     — не брать контрагентов из этих групп (через ;), по умолчанию «розница»
 *   CYCLE_START         — понедельник, с которого считается 1-я неделя 4-недельного графика, по умолчанию 2026-01-05
 *   RESERVE             — «нет», чтобы заказ не ставил товар в резерв (по умолчанию резерв ставится)
 *   SHOW_ZERO           — «да», чтобы показывать позиции с нулевым остатком
 *   DEBT_POSITIVE       — «да», если в вашем МойСклад долг покупателя — это положительный баланс
 *   TZ                  — часовой пояс, по умолчанию Europe/Samara
 *
 * Отчёт «Деус · Хулиган · Бланш · Нуар»:
 *   REPORT_CHANNEL      — канал продаж, по умолчанию «Деус»
 *   REPORT_FROM         — с какой даты брать заказы (гггг-мм-дд), по умолчанию 1 января текущего года
 *   REPORT_SKIP_AGENTS  — контрагенты, которых не брать в продажи: названия через ;
 *   REPORT_DEBT_FROM    — с какой даты брать отгрузки для долгов, по умолчанию 2026-08-01
 *   REPORT_DEBT_SKIP_TAG— группа контрагентов, которую не брать в долги, по умолчанию «хп»
 *   REPORT_ADDR_ATTR    — доп. поле заказа с адресом точки, по умолчанию «Адрес - Куда доставить»
 *   REPORT_FOR_REPS     — «нет», чтобы отчёт видел только руководитель
 */

var BASE = 'https://api.moysklad.ru/api/remap/1.2';
var SH = { users: 'Сотрудники', routes: 'Маршруты', days: 'План дня', visits: 'Визиты', geo: 'Координаты', rep: 'Отчёт (данные)' };
var RESULTS = ['Заказ', 'Отказ', 'Не застал', 'Закрыто', 'Другое'];
var HEAD = {};
HEAD[SH.users] = ['Ключ', 'Имя', 'Роль (торговый / руководитель)', 'Склады (названия через ;)', 'Активен (да / нет)'];
HEAD[SH.routes] = ['Ключ сотрудника', 'Неделя и день (w1d1 … w4d7)', 'Точки (id)', 'Точки (названия, для справки)'];
HEAD[SH.days] = ['Дата', 'Ключ сотрудника', 'Точки (id)'];
HEAD[SH.visits] = ['Время', 'Дата', 'Ключ сотрудника', 'Сотрудник', 'Точка (id)', 'Точка', 'Результат', 'Комментарий', 'Заказ №', 'Сумма', 'Фото', 'uid'];
HEAD[SH.geo] = ['Точка (id)', 'Широта', 'Долгота', 'Адрес'];
HEAD[SH.rep] = ['Служебные данные отчёта по брендам — не редактировать'];

/* ---------- установка ---------- */

/** Запустите один раз вручную: создаёт листы и пример сотрудников. */
function setup() {
  var ss = SpreadsheetApp.getActive();
  Object.keys(HEAD).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(HEAD[name]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, HEAD[name].length).setFontWeight('bold');
    }
    sh.getRange(1, 1, sh.getMaxRows(), HEAD[name].length).setNumberFormat('@');
    if (name === SH.routes) sh.getRange(1, 1, 1, HEAD[name].length).setValues([HEAD[name]]);
  });
  var u = ss.getSheetByName(SH.users);
  if (u.getLastRow() === 1) {
    u.appendRow([newKey_(), 'Руководитель', 'руководитель', '', 'да']);
    u.appendRow([newKey_(), 'Иванов Иван', 'торговый', 'Основной склад', 'да']);
  }
  installReportTrigger();
}

function newKey_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 16);
}

/** Проверка связи с МойСклад: запустите вручную и посмотрите журнал. */
function testMoySklad() {
  Logger.log('Склады: ' + getStores_().map(function (s) { return s.name; }).join(', '));
  Logger.log('Типы цен: ' + getPriceTypes_().map(function (s) { return s.name; }).join(', '));
  Logger.log('Юрлицо для заказов: ' + getOrg_().name);
  Logger.log('Точек: ' + getPoints_().length);
}

/* ---------- вход ---------- */

function doGet() {
  return json_({ ok: true, data: 'Сервис работает. Запросы принимаются методом POST.' });
}

function doPost(e) {
  var out;
  try {
    var req = JSON.parse(e.postData.contents);
    var user = auth_(req.key);
    var fn = ACTIONS[req.action];
    if (!fn) throw new Error('Неизвестное действие: ' + req.action);
    out = { ok: true, data: fn(req, user) };
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return json_(out);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- утилиты ---------- */

function prop_(k, d) {
  var v = PropertiesService.getScriptProperties().getProperty(k);
  return v == null || v === '' ? d : v;
}
function yes_(v) { return /^(да|yes|true|1)$/i.test(String(v || '').trim()); }
function tz_() { return prop_('TZ', 'Europe/Samara'); }
function today_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'); }
function dstr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  return String(v || '').trim();
}
function checkDate_(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d))) throw new Error('Неверная дата');
  return String(d);
}
function weekday_(date) {
  var n = new Date(date + 'T12:00:00Z').getUTCDay();
  return n === 0 ? 7 : n;
}
function sheet_(name) {
  var sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('Нет листа «' + name + '». Запустите функцию setup.');
  return sh;
}
function rows_(name) {
  var v = sheet_(name).getDataRange().getValues();
  v.shift();
  return v;
}
function ids_(cell) {
  try {
    var a = JSON.parse(String(cell || '[]'));
    return Array.isArray(a) ? a.map(String) : [];
  } catch (e) { return []; }
}
function lock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* Кэш с разбивкой на части: одно значение в CacheService не больше 100 КБ. */
var CHUNK = 30000;
function cachePut_(key, obj, sec) {
  try {
    var s = JSON.stringify(obj), n = Math.ceil(s.length / CHUNK) || 1, m = {};
    for (var i = 0; i < n; i++) m[key + '_' + i] = s.substr(i * CHUNK, CHUNK);
    m[key] = String(n);
    CacheService.getScriptCache().putAll(m, sec);
  } catch (e) { /* кэш не обязателен */ }
}
function cacheGet_(key) {
  try {
    var c = CacheService.getScriptCache(), n = Number(c.get(key));
    if (!n) return null;
    var keys = [];
    for (var i = 0; i < n; i++) keys.push(key + '_' + i);
    var all = c.getAll(keys), s = '';
    for (var j = 0; j < n; j++) {
      if (all[keys[j]] == null) return null;
      s += all[keys[j]];
    }
    return JSON.parse(s);
  } catch (e) { return null; }
}

/* ---------- МойСклад ---------- */

function ms_(path, opt) {
  var token = prop_('MS_TOKEN', '');
  if (!token) throw new Error('Не задан токен МойСклад (свойство MS_TOKEN)');
  var url = path.indexOf('http') === 0 ? path : BASE + path;
  var params = {
    method: (opt && opt.method) || 'get',
    headers: { Authorization: 'Bearer ' + token, 'Accept-Encoding': 'gzip' },
    muteHttpExceptions: true
  };
  if (opt && opt.headers) Object.keys(opt.headers).forEach(function (h) { params.headers[h] = opt.headers[h]; });
  if (opt && opt.body) {
    params.contentType = 'application/json';
    params.payload = JSON.stringify(opt.body);
  }
  for (var i = 0; i < 4; i++) {
    var r = UrlFetchApp.fetch(url, params), code = r.getResponseCode();
    if (code === 429 || code >= 500) { Utilities.sleep(1500 * (i + 1)); continue; }
    var txt = r.getContentText(), j = {};
    try { j = txt ? JSON.parse(txt) : {}; } catch (e) { j = {}; }
    if (code >= 400) {
      var msg = j.errors && j.errors[0] && j.errors[0].error;
      throw new Error('МойСклад: ' + (msg || ('ошибка ' + code)));
    }
    return j;
  }
  throw new Error('МойСклад не отвечает, попробуйте ещё раз');
}

function msAll_(path, headers, page) {
  page = page || 1000;
  var rows = [], offset = 0, sep = path.indexOf('?') >= 0 ? '&' : '?';
  for (;;) {
    var j = ms_(path + sep + 'limit=' + page + '&offset=' + offset, headers ? { headers: headers } : null);
    var part = j.rows || [];
    rows = rows.concat(part);
    if (part.length < page) break;
    offset += page;
  }
  return rows;
}

function meta_(type, id) {
  return { meta: { href: BASE + '/entity/' + type + '/' + id, type: type, mediaType: 'application/json' } };
}
function idOf_(o) {
  if (!o) return '';
  if (o.id) return o.id;
  var h = (o.meta && o.meta.href) || '';
  return h.split('?')[0].split('/').pop();
}

function getStores_() {
  var s = cacheGet_('stores');
  if (s) return s;
  s = msAll_('/entity/store').filter(function (r) { return !r.archived; })
    .map(function (r) { return { id: r.id, name: r.name }; });
  cachePut_('stores', s, 3600);
  return s;
}

function getPriceTypes_() {
  var s = cacheGet_('ptypes');
  if (s) return s;
  var j = ms_('/context/companysettings/pricetype');
  s = (Array.isArray(j) ? j : (j.rows || [])).map(function (r) { return { id: r.id, name: r.name }; });
  cachePut_('ptypes', s, 3600);
  return s;
}

function defPt_(pts) {
  var name = prop_('DEFAULT_PRICE_TYPE', '');
  for (var i = 0; i < pts.length; i++) if (pts[i].name === name) return i;
  return 0;
}

function squashName_(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

function getOrg_() {
  var s = cacheGet_('org');
  if (s) return s;
  var rows = msAll_('/entity/organization').filter(function (r) { return !r.archived; });
  var name = prop_('ORG_NAME', 'DEUS SAMARA');
  var o = rows.filter(function (r) { return squashName_(r.name) === squashName_(name); })[0];
  if (!o) throw new Error('В МойСклад не найдено юрлицо «' + name + '» (свойство ORG_NAME). Есть: ' + rows.map(function (r) { return r.name; }).join(', '));
  s = { id: o.id, name: o.name };
  cachePut_('org', s, 3600);
  return s;
}

/** Точки: контрагенты + долг. Долг = отрицательный баланс контрагента. */
function getPoints_() {
  var tag = String(prop_('POINT_TAG', '')).toLowerCase().trim();
  var skip = String(prop_('POINT_SKIP_TAGS', 'розница')).toLowerCase().split(';').map(function (x) { return x.trim(); }).filter(String);
  /* настройки отбора входят в имя кэша: поменяли группы — список пересобирается сразу, а не через 15 минут */
  var ckey = 'points2_' + Utilities.base64EncodeWebSafe(tag + '|' + skip.join(';')).slice(0, 60);
  var p = cacheGet_(ckey);
  if (p) return p;
  var debts = {}, sign = yes_(prop_('DEBT_POSITIVE', '')) ? -1 : 1;
  msAll_('/report/counterparty').forEach(function (r) {
    debts[idOf_(r.counterparty)] = Number(r.balance) || 0;
  });
  p = msAll_('/entity/counterparty').filter(function (r) {
    if (r.archived) return false;
    var tags = (r.tags || []).map(function (t) { return String(t).toLowerCase().trim(); });
    if (skip.some(function (x) { return tags.indexOf(x) >= 0; })) return false;
    return !tag || tags.indexOf(tag) >= 0;
  }).map(function (r) {
    var bal = (debts[r.id] || 0) * sign;
    return {
      id: r.id,
      n: r.name || '',
      a: r.actualAddress || r.legalAddress || '',
      ph: r.phone || '',
      pt: idOf_(r.priceType),
      d: bal < 0 ? Math.round(-bal) / 100 : 0
    };
  });
  p.sort(function (a, b) { return a.n.localeCompare(b.n, 'ru'); });
  cachePut_(ckey, p, 900);
  return p;
}

/**
 * Каталог: товары, модификации и комплекты с ценами по всем типам цен.
 * Берётся новым способом МойСклад (ассортимент без остатков) — старый отключат в 2027 году.
 */
function getCatalog_() {
  var c = cacheGet_('catalog');
  if (c) return c;
  var pts = getPriceTypes_();
  c = msAll_('/entity/assortment', { 'X-Lognex-Remap-Beta-Feature': 'assortmentWithoutStock' }).filter(function (r) {
    var t = r.meta && r.meta.type;
    return !r.archived && (t === 'product' || t === 'variant' || t === 'bundle');
  }).map(function (r) {
    var byPt = {};
    (r.salePrices || []).forEach(function (sp) { byPt[idOf_(sp.priceType)] = (Number(sp.value) || 0) / 100; });
    return {
      id: r.id,
      t: r.meta.type,
      n: r.name || '',
      g: r.pathName || '',
      c: r.code || r.article || '',
      p: pts.map(function (pt) { return byPt[pt.id] || 0; })
    };
  });
  c.sort(function (a, b) { return (a.g + a.n).localeCompare(b.g + b.n, 'ru'); });
  cachePut_('catalog', c, 1800);
  return c;
}

/** Краткий отчёт об остатках по одному складу: { id товара: количество }. */
function stockMap_(storeId, type) {
  var j = ms_('/report/stock/bystore/current?stockType=' + type + '&filter=' + encodeURIComponent('storeId=' + storeId));
  var m = {};
  (Array.isArray(j) ? j : []).forEach(function (r) {
    if (r.storeId === storeId) m[r.assortmentId] = Number(r[type]) || 0;
  });
  return m;
}

/**
 * Остатки и цены по складу. s — физический остаток, q — остаток за вычетом резерва
 * (то, что реально можно продать). Цены — массив в порядке типов цен.
 */
function getStock_(storeId) {
  var key = 'stock_' + storeId, s = cacheGet_(key);
  if (s) return s;
  var stock = stockMap_(storeId, 'stock'), free = stockMap_(storeId, 'freeStock');
  var zero = yes_(prop_('SHOW_ZERO', ''));
  s = getCatalog_().filter(function (c) { return zero || stock[c.id] > 0; }).map(function (c) {
    return { id: c.id, t: c.t, n: c.n, g: c.g, c: c.c, s: stock[c.id] || 0, q: Math.max(0, free[c.id] || 0), p: c.p };
  });
  cachePut_(key, s, 180);
  return s;
}

/* ---------- сотрудники ---------- */

function users_() {
  return rows_(SH.users).filter(function (r) { return String(r[0]).trim(); }).map(function (r) {
    return {
      key: String(r[0]).trim(),
      name: String(r[1]).trim(),
      manager: /руковод/i.test(String(r[2])),
      storeNames: String(r[3] || '').split(';').map(function (s) { return s.trim(); }).filter(String),
      active: !/^(нет|no|false|0)$/i.test(String(r[4]).trim())
    };
  });
}

function auth_(key) {
  key = String(key || '').trim();
  var u = key && users_().filter(function (x) { return x.key === key && x.active; })[0];
  if (!u) throw new Error('Ссылка недействительна. Попросите у руководителя новую.');
  return u;
}

function userStores_(u) {
  var all = getStores_();
  if (!u.storeNames.length) return u.manager ? all : [];
  var low = u.storeNames.map(function (s) { return s.toLowerCase(); });
  return all.filter(function (s) { return low.indexOf(s.name.toLowerCase()) >= 0; });
}

/** Чей маршрут смотрим: руководитель может указать сотрудника, торговый — только свой. */
function target_(req, u) {
  if (u.manager && req.emp) return String(req.emp);
  return u.key;
}

/* ---------- маршруты ---------- */

/* График маршрутов — цикл из 4 недель. Ячейка «Неделя и день»: w2d3 = 2-я неделя, среда.
   Просто число (3) — старый формат: среда каждой недели, если для недели нет своей строки. */
function cycleStart_() { return prop_('CYCLE_START', '2026-01-05'); }
function cycleWeek_(date) {
  var days = Math.round((Date.parse(date + 'T12:00:00Z') - Date.parse(cycleStart_() + 'T12:00:00Z')) / 86400000);
  return ((Math.floor(days / 7) % 4) + 4) % 4 + 1;
}
function slot_(cell) {
  var s = String(cell).trim().toLowerCase(), m = s.match(/^w([1-4])d([1-7])$/);
  if (m) return { week: Number(m[1]), day: Number(m[2]) };
  var n = Number(s);
  return n >= 1 && n <= 7 ? { week: 0, day: n } : null;
}
function templateIds_(key, week, day) {
  var exact = null, any = null;
  rows_(SH.routes).forEach(function (x) {
    if (String(x[0]) !== key) return;
    var sl = slot_(x[1]);
    if (!sl || sl.day !== day) return;
    if (sl.week === week) exact = ids_(x[2]);
    else if (sl.week === 0) any = ids_(x[2]);
  });
  return exact || any || [];
}

function dayIds_(key, date) {
  var r = rows_(SH.days).filter(function (x) { return dstr_(x[0]) === date && String(x[1]) === key; })[0];
  if (r) return { ids: ids_(r[2]), custom: true };
  return { ids: templateIds_(key, cycleWeek_(date), weekday_(date)), custom: false };
}

function visitsOf_(date, key) {
  return rows_(SH.visits).filter(function (r) {
    return dstr_(r[1]) === date && (!key || String(r[2]) === key);
  }).map(visitRow_);
}

function visitRow_(r) {
  var t = r[0] instanceof Date ? Utilities.formatDate(r[0], tz_(), 'HH:mm') : String(r[0]).slice(11, 16);
  return {
    time: t, date: dstr_(r[1]), key: String(r[2]), emp: String(r[3]), pid: String(r[4]), point: String(r[5]),
    res: String(r[6]), com: String(r[7]), order: String(r[8]), sum: Number(r[9]) || 0,
    photos: String(r[10] || '').split('\n').filter(String)
  };
}

/** Координаты точек: из листа; недостающие определяем по адресу (не больше 15 за запрос). */
function geoFor_(ids) {
  var out = {}, need = {};
  ids.forEach(function (id) { need[id] = true; });
  rows_(SH.geo).forEach(function (r) {
    if (need[r[0]] && r[1] !== '' && r[2] !== '') out[r[0]] = [Number(r[1]), Number(r[2])];
  });
  var missing = ids.filter(function (id) { return !out[id]; });
  if (!missing.length) return out;
  var pmap = {};
  getPoints_().forEach(function (p) { pmap[p.id] = p; });
  var add = [], n = 0;
  for (var i = 0; i < missing.length && n < 15; i++) {
    var p = pmap[missing[i]];
    if (!p || !p.a) continue;
    n++;
    try {
      var g = Maps.newGeocoder().setLanguage('ru').setRegion('ru').geocode(p.a);
      var loc = g.results && g.results[0] && g.results[0].geometry.location;
      if (loc) {
        out[p.id] = [loc.lat, loc.lng];
        add.push([p.id, String(loc.lat), String(loc.lng), p.a]);
      }
    } catch (e) { break; }
  }
  if (add.length) {
    lock_(function () {
      var sh = sheet_(SH.geo);
      sh.getRange(sh.getLastRow() + 1, 1, add.length, 4).setValues(add);
    });
  }
  return out;
}

function upsert_(name, match, row) {
  lock_(function () {
    var sh = sheet_(name), v = sh.getDataRange().getValues();
    for (var i = 1; i < v.length; i++) {
      if (match(v[i])) { sh.getRange(i + 1, 1, 1, row.length).setValues([row]); return; }
    }
    sh.appendRow(row);
  });
}

/* ---------- действия ---------- */

var ACTIONS = {

  init: function (req, u) {
    var pts = getPriceTypes_();
    return {
      user: { name: u.name, manager: u.manager },
      stores: userStores_(u),
      priceTypes: pts,
      defPt: defPt_(pts),
      results: RESULTS,
      today: today_(),
      cycleStart: cycleStart_(),
      brandReport: canSeeReport_(u)
    };
  },

  points: function () { return getPoints_(); },

  stock: function (req, u) {
    var ok = userStores_(u).some(function (s) { return s.id === req.storeId; });
    if (!ok) throw new Error('Этот склад вам не назначен');
    return getStock_(req.storeId);
  },

  route: function (req, u) {
    var date = checkDate_(req.date), key = target_(req, u);
    var d = dayIds_(key, date), geo = {};
    try { geo = geoFor_(d.ids); } catch (e) { geo = {}; }
    return { ids: d.ids, custom: d.custom, week: cycleWeek_(date), visits: visitsOf_(date, key), geo: geo };
  },

  saveDay: function (req, u) {
    var date = checkDate_(req.date), key = target_(req, u);
    var ids = (req.ids || []).map(String);
    upsert_(SH.days, function (r) { return dstr_(r[0]) === date && String(r[1]) === key; },
      [date, key, JSON.stringify(ids)]);
    return true;
  },

  pointInfo: function (req) {
    var all = rows_(SH.visits), out = [];
    for (var i = all.length - 1; i >= 0 && out.length < 5; i--) {
      if (String(all[i][4]) === String(req.pid)) out.push(visitRow_(all[i]));
    }
    return { visits: out };
  },

  order: function (req, u) {
    if (!req.uid) throw new Error('Нет номера запроса');
    var done = CacheService.getScriptCache().get('uid_' + req.uid);
    if (done) return JSON.parse(done);
    return lock_(function () {
      done = CacheService.getScriptCache().get('uid_' + req.uid);
      if (done) return JSON.parse(done);
      var store = userStores_(u).filter(function (s) { return s.id === req.storeId; })[0];
      if (!store) throw new Error('Этот склад вам не назначен');
      var point = getPoints_().filter(function (p) { return p.id === req.pid; })[0];
      if (!point) throw new Error('Точка не найдена в МойСклад. Обновите список точек.');
      var pts = getPriceTypes_(), def = defPt_(pts), idx = -1;
      pts.forEach(function (pt, i) { if (pt.id === point.pt) idx = i; });
      if (idx < 0) idx = def;
      var smap = {};
      getStock_(store.id).forEach(function (s) { smap[s.id] = s; });
      var reserve = !/^(нет|no|false|0)$/i.test(String(prop_('RESERVE', 'да')).trim());
      var items = (req.items || []).filter(function (it) { return Number(it.qty) > 0; });
      if (!items.length) throw new Error('В заказе нет товаров');
      var positions = items.map(function (it) {
        var s = smap[it.id];
        if (!s) throw new Error('Товара уже нет в остатках склада. Обновите остатки и проверьте корзину.');
        var qty = Number(it.qty), pos = {
          quantity: qty,
          price: Math.round((s.p[idx] || s.p[def] || 0) * 100),
          assortment: meta_(s.t, s.id)
        };
        if (reserve) pos.reserve = qty;
        return pos;
      });
      var note = 'Заказ из приложения, торговый: ' + u.name + (req.comment ? '. ' + String(req.comment).slice(0, 1000) : '');
      var j = ms_('/entity/customerorder', {
        method: 'post',
        body: {
          organization: meta_('organization', getOrg_().id),
          agent: meta_('counterparty', point.id),
          store: meta_('store', store.id),
          vatEnabled: false,
          description: note,
          positions: positions
        }
      });
      var res = { name: j.name, sum: (Number(j.sum) || 0) / 100 };
      CacheService.getScriptCache().put('uid_' + req.uid, JSON.stringify(res), 21600);
      return res;
    });
  },

  visit: function (req, u) {
    if (!req.uid) throw new Error('Нет номера запроса');
    var c = CacheService.getScriptCache();
    if (c.get('uid_' + req.uid)) return true;
    if (RESULTS.indexOf(req.result) < 0) throw new Error('Выберите результат визита');
    var links = (req.photos || []).slice(0, 4).map(function (data, i) {
      var b64 = String(data).split(',').pop();
      var name = today_() + ' ' + String(req.point || '').slice(0, 60) + ' ' + (i + 1) + '.jpg';
      var f = photoFolder_().createFile(Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', name));
      return f.getUrl();
    });
    lock_(function () {
      sheet_(SH.visits).appendRow([
        Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HH:mm'), today_(), u.key, u.name,
        String(req.pid), String(req.point || ''), req.result, String(req.comment || '').slice(0, 2000),
        String(req.order || ''), req.sum ? String(req.sum) : '', links.join('\n'), String(req.uid)
      ]);
    });
    c.put('uid_' + req.uid, '1', 21600);
    return true;
  },

  brandReport: function (req, u) {
    if (!canSeeReport_(u)) throw new Error('Отчёт доступен только руководителю');
    var pl = loadReport_();
    if (!pl) throw new Error('Отчёт ещё не собран. Руководитель может нажать «Обновить из МойСклад».');
    return pl;
  },

  brandSync: function (req, u) {
    mgr_(u);
    return syncReport();
  },

  /* --- только руководитель --- */

  employees: function (req, u) {
    mgr_(u);
    return users_().filter(function (x) { return x.active && !x.manager; })
      .map(function (x) { return { key: x.key, name: x.name }; });
  },

  /* Шаблон сотрудника: { 'неделя-день': [id точек] }, например '2-3' — 2-я неделя, среда. */
  getTemplate: function (req, u) {
    mgr_(u);
    var out = {}, legacy = {};
    rows_(SH.routes).forEach(function (r) {
      if (String(r[0]) !== String(req.emp)) return;
      var sl = slot_(r[1]);
      if (!sl) return;
      if (sl.week) out[sl.week + '-' + sl.day] = ids_(r[2]);
      else legacy[sl.day] = ids_(r[2]);
    });
    Object.keys(legacy).forEach(function (d) {
      for (var w = 1; w <= 4; w++) if (!out[w + '-' + d]) out[w + '-' + d] = legacy[d];
    });
    return out;
  },

  /* weeks — список недель (1–4), в которые записать этот день; по умолчанию одна req.week. */
  setTemplate: function (req, u) {
    mgr_(u);
    var day = Number(req.day), emp = String(req.emp), ids = (req.ids || []).map(String);
    var weeks = (req.weeks && req.weeks.length ? req.weeks : [req.week]).map(Number);
    if (!(day >= 1 && day <= 7)) throw new Error('Неверный день недели');
    if (!weeks.length || weeks.some(function (w) { return !(w >= 1 && w <= 4); })) throw new Error('Неверная неделя графика');
    var pmap = {};
    getPoints_().forEach(function (p) { pmap[p.id] = p.n; });
    var names = ids.map(function (id) { return pmap[id] || '?'; }).join('; ');
    weeks.forEach(function (w) {
      var code = 'w' + w + 'd' + day;
      upsert_(SH.routes, function (r) { return String(r[0]) === emp && String(r[1]).trim().toLowerCase() === code; },
        [emp, code, JSON.stringify(ids), names]);
    });
    return true;
  },

  report: function (req, u) {
    mgr_(u);
    var date = checkDate_(req.date), all = visitsOf_(date, '');
    return users_().filter(function (x) { return x.active && !x.manager; }).map(function (x) {
      return {
        key: x.key, name: x.name,
        plan: dayIds_(x.key, date).ids,
        visits: all.filter(function (v) { return v.key === x.key; })
      };
    });
  }
};

function mgr_(u) {
  if (!u.manager) throw new Error('Доступно только руководителю');
}

function photoFolder_() {
  var id = prop_('PHOTO_FOLDER_ID', '');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* создадим заново */ }
  }
  var f = DriveApp.createFolder('Фото визитов (торговые)');
  PropertiesService.getScriptProperties().setProperty('PHOTO_FOLDER_ID', f.getId());
  return f;
}


/* =====================================================================
 * Отчёт «Деус · Хулиган · Бланш · Нуар» — те же данные, что раньше
 * выгружались вручную двумя файлами:
 *   продажи — Заказы покупателей за период, канал продаж «Деус»
 *             (шаблон: товар, группа товара, цена, кол-во, сумма,
 *              контрагент, доп. поле «Адрес - Куда доставить», дата);
 *   долги   — Отгрузки с неоплаченным остатком, канал продаж «Деус»,
 *             без группы контрагентов «хп».
 * ===================================================================== */

var BRANDS_DEF = [
  { id: 'deus',    title: 'DEUS',          kw: ['deus'],                    gw: ['deus'],                    lastPad: false },
  { id: 'huligan', title: 'Хулиган',       kw: ['хулиган', 'huligan'],      gw: ['хулиган'],                 lastPad: true },
  { id: 'blansh',  title: 'Blansh и Nuar', kw: ['blansh', 'нуар', 'nuar'],  gw: ['blansh', 'нуар', 'nuar'],  lastPad: true }
];
/* Ароматы под мониторинг запуска: в названии товара должны быть все слова из must и одно из kw. */
var AROMAS_DEF = [
  { id: 'tokyo',   title: 'DEUS TOKYO SPRING',  must: ['deus'], kw: ['tokyo spring'],  color: '#d98fa8', dark: '#3a1a26' },
  { id: 'currant', title: 'DEUS BLACK CURRANT', must: ['deus'], kw: ['black currant'], color: '#6b4a9e', dark: '#251a3a' }
];

function canSeeReport_(u) {
  return u.manager || !/^(нет|no|false|0)$/i.test(String(prop_('REPORT_FOR_REPS', 'да')).trim());
}

/* Бренд: если у товара есть группа — смотрим только на неё, иначе на название (как в генераторе). */
function matchBrand_(item, group) {
  var i, j, low;
  if (group) {
    low = String(group).toLowerCase();
    for (i = 0; i < BRANDS_DEF.length; i++)
      for (j = 0; j < BRANDS_DEF[i].gw.length; j++)
        if (low.indexOf(BRANDS_DEF[i].gw[j]) >= 0) return BRANDS_DEF[i].id;
    return null;
  }
  low = String(item || '').toLowerCase();
  for (i = 0; i < BRANDS_DEF.length; i++)
    for (j = 0; j < BRANDS_DEF[i].kw.length; j++)
      if (low.indexOf(BRANDS_DEF[i].kw[j]) >= 0) return BRANDS_DEF[i].id;
  return null;
}
function matchAroma_(item, a) {
  var low = String(item || '').toLowerCase(), i;
  for (i = 0; i < a.must.length; i++) if (low.indexOf(a.must[i]) < 0) return false;
  for (i = 0; i < a.kw.length; i++) if (low.indexOf(a.kw[i]) >= 0) return true;
  return false;
}

function squash_(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

function channelHref_(name) {
  var want = squash_(name);
  var ch = msAll_('/entity/saleschannel').filter(function (r) { return squash_(r.name) === want; })[0];
  if (!ch) throw new Error('В МойСклад нет канала продаж «' + name + '» (свойство REPORT_CHANNEL)');
  return ch.meta.href.split('?')[0];
}

/* Название и группа (папка) товара по id — включая архивные, они есть в старых заказах. */
function itemNames_() {
  var m = {};
  msAll_('/entity/assortment?filter=' + encodeURIComponent('archived=true;archived=false'),
    { 'X-Lognex-Remap-Beta-Feature': 'assortmentWithoutStock' }).forEach(function (r) {
    m[r.id] = [r.name || '', String(r.pathName || '').split('/').pop()];
  });
  return m;
}
function lookupItem_(href) {
  try {
    var j = ms_(href.split('?')[0] + '?expand=productFolder,product.productFolder');
    var pf = j.productFolder || (j.product && j.product.productFolder);
    return [j.name || '', (pf && pf.name) || ''];
  } catch (e) { return ['', '']; }
}

function attrText_(doc, attrName) {
  var want = squash_(attrName), a = (doc.attributes || []).filter(function (x) { return squash_(x.name) === want; })[0];
  if (!a || a.value == null) return '';
  return String(typeof a.value === 'object' ? (a.value.name || '') : a.value).trim();
}

/** Собирает отчёт из МойСклад и сохраняет его. Запускается по расписанию и кнопкой «Обновить». */
function syncReport() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error('Отчёт уже обновляется, подождите минуту');
  try {
    var cfg = {
      channel: prop_('REPORT_CHANNEL', 'Деус'),
      from: prop_('REPORT_FROM', today_().slice(0, 4) + '-01-01'),
      debtFrom: prop_('REPORT_DEBT_FROM', '2026-08-01'),
      skipAgents: String(prop_('REPORT_SKIP_AGENTS', '')).split(';').map(squash_).filter(String),
      skipTag: squash_(prop_('REPORT_DEBT_SKIP_TAG', 'хп')),
      addrAttr: prop_('REPORT_ADDR_ATTR', 'Адрес - Куда доставить')
    };
    var ch = channelHref_(cfg.channel);
    var names = itemNames_(), lookups = 0;

    /* --- продажи: заказы покупателей с позициями --- */
    var orders = msAll_('/entity/customerorder?filter=' + encodeURIComponent('moment>=' + cfg.from + ' 00:00:00;salesChannel=' + ch) +
      '&expand=agent,positions&order=' + encodeURIComponent('moment,asc'), null, 100);
    var pts = {}, months = {}, firstDay = null, lastDay = null, nOrders = 0, noAddr = 0, nRows = 0, total = 0, noName = 0;
    orders.forEach(function (o) {
      var client = String((o.agent && o.agent.name) || '').trim();
      if (!client || cfg.skipAgents.indexOf(squash_(client)) >= 0) return;
      var day = String(o.moment || '').slice(0, 10), month = day.slice(0, 7);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
      var addr = attrText_(o, cfg.addrAttr);
      if (!addr) { addr = '(адрес не указан)'; noAddr++; }
      var pos = (o.positions && o.positions.rows) || [];
      if (o.positions && o.positions.meta && o.positions.meta.size > pos.length) pos = msAll_(o.positions.meta.href.split('?')[0]);
      if (!pos.length) return;
      nOrders++;
      var key = client + '\u0001' + addr;
      var p = pts[key] || (pts[key] = { c: client, a: addr, ld: null, b: {}, r: {} });
      pos.forEach(function (ps) {
        var href = (ps.assortment && ps.assortment.meta && ps.assortment.meta.href) || '';
        var id = href.split('?')[0].split('/').pop();
        var nm = names[id];
        if (!nm && href && lookups < 40) { lookups++; nm = names[id] = lookupItem_(href); }
        if (!nm) nm = ['', ''];
        if (!nm[0]) noName++;
        var qty = Number(ps.quantity) || 0;
        var amount = Math.round((Number(ps.price) || 0) * qty) / 100;
        months[month] = 1; nRows++; total += amount;
        if (!p.ld || day > p.ld) p.ld = day;
        if (!lastDay || day > lastDay) lastDay = day;
        if (!firstDay || day < firstDay) firstDay = day;
        AROMAS_DEF.forEach(function (a) {
          if (!matchAroma_(nm[0], a)) return;
          var ar = p.r[a.id] || (p.r[a.id] = { q: 0, s: 0, f: null, l: null, z: {} });
          ar.q += qty; ar.s += amount;
          if (!ar.f || day < ar.f) ar.f = day;
          if (!ar.l || day > ar.l) ar.l = day;
          var sm = String(nm[0]).match(/(\d+)\s*г/i), sz = sm ? (sm[1] + ' г') : '?';
          ar.z[sz] = (ar.z[sz] || 0) + qty;
        });
        var brand = matchBrand_(nm[0], nm[1]);
        if (brand) {
          var bb = p.b[brand] || (p.b[brand] = {});
          bb[month] = (bb[month] || 0) + amount;
        }
      });
    });

    /* --- долги: отгрузки, где оплачено меньше суммы --- */
    var debts = [];
    msAll_('/entity/demand?filter=' + encodeURIComponent('moment>=' + cfg.debtFrom + ' 00:00:00;salesChannel=' + ch) +
      '&expand=agent&order=' + encodeURIComponent('moment,desc'), null, 100).forEach(function (d) {
      var sum = Number(d.sum) || 0, paid = Number(d.payedSum) || 0;
      if (!(paid < sum)) return;
      var tags = ((d.agent && d.agent.tags) || []).map(squash_);
      if (cfg.skipTag && tags.indexOf(cfg.skipTag) >= 0) return;
      debts.push({
        num: String(d.name || ''), iso: String(d.moment || '').slice(0, 10),
        client: String((d.agent && d.agent.name) || '').trim(),
        amount: sum / 100, paid: paid / 100, balance: (sum - paid) / 100,
        addr: String(d.shipmentAddress || '').trim()
      });
    });

    var list = Object.keys(pts).map(function (k) { return pts[k]; });
    var pl = {
      v: 1,
      syncedAt: Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HH:mm'),
      channel: cfg.channel, from: cfg.from, debtFrom: cfg.debtFrom,
      orders: nOrders, rows: nRows, total: Math.round(total), noAddr: noAddr, noName: noName, firstDay: firstDay, lastDay: lastDay,
      months: Object.keys(months).sort(),
      brands: BRANDS_DEF, aromas: AROMAS_DEF,
      points: list, debts: debts
    };
    saveReport_(pl);
    return pl;
  } finally { lock.releaseLock(); }
}

/* Отчёт хранится на листе «Отчёт (данные)» частями по 40 000 символов (ограничение ячейки — 50 000). */
function saveReport_(pl) {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(SH.rep) || ss.insertSheet(SH.rep);
  var s = JSON.stringify(pl), rows = [HEAD[SH.rep]];
  for (var i = 0; i < s.length; i += 40000) rows.push(["'" + s.substr(i, 40000)]);
  sh.clearContents();
  sh.getRange(1, 1, rows.length, 1).setValues(rows);
  cachePut_('brep', pl, 3600);
}
function loadReport_() {
  var pl = cacheGet_('brep');
  if (pl) return pl;
  var sh = SpreadsheetApp.getActive().getSheetByName(SH.rep);
  if (!sh || sh.getLastRow() < 2) return null;
  var s = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]).replace(/^'/, ''); }).join('');
  try { pl = JSON.parse(s); } catch (e) { return null; }
  cachePut_('brep', pl, 3600);
  return pl;
}

/** Включает обновление отчёта каждый час. Вызывается из setup; можно запустить и отдельно. */
function installReportTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncReport') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncReport').timeBased().everyHours(1).create();
}


/**
 * Проверка отчёта: запустите вручную и откройте журнал выполнения.
 * Цифры сравните с последней выгрузкой «Продажи» (строк, сумма) и «Долги» (число, остаток).
 */
function checkReport() {
  var pl = syncReport(), last = pl.months[pl.months.length - 1];
  Logger.log('Канал продаж: ' + pl.channel + ' · заказы с ' + pl.firstDay + ' по ' + pl.lastDay);
  Logger.log('Заказов: ' + pl.orders + ' · строк (позиций): ' + pl.rows + ' · сумма всех строк: ' + pl.total + ' ₽');
  Logger.log('Точек (контрагент + адрес): ' + pl.points.length + ' · месяцев: ' + pl.months.length);
  Logger.log('Заказов без поля адреса: ' + pl.noAddr + ' · позиций без названия товара: ' + pl.noName);
  BRANDS_DEF.forEach(function (b) {
    var all = 0, m = 0;
    pl.points.forEach(function (p) {
      var bb = p.b[b.id] || {};
      Object.keys(bb).forEach(function (k) { all += bb[k]; if (k === last) m += bb[k]; });
    });
    Logger.log(b.title + ': за период ' + Math.round(all) + ' ₽, за ' + last + ' — ' + Math.round(m) + ' ₽');
  });
  var bal = 0;
  pl.debts.forEach(function (d) { bal += d.balance; });
  Logger.log('Долгов: ' + pl.debts.length + ' · общий остаток: ' + Math.round(bal) + ' ₽');
  if (pl.points[0]) Logger.log('Пример точки: ' + pl.points[0].c + ' | ' + pl.points[0].a);
}


/**
 * Какие группы контрагентов есть в МойСклад и сколько точек попадёт в приложение.
 * Запустите вручную и откройте журнал: название группы в POINT_SKIP_TAGS должно совпадать с тем, что здесь.
 */
function checkPoints() {
  var skip = String(prop_('POINT_SKIP_TAGS', 'розница')).toLowerCase().split(';').map(function (x) { return x.trim(); }).filter(String);
  var count = {}, all = 0, noTag = 0;
  msAll_('/entity/counterparty').forEach(function (r) {
    if (r.archived) return;
    all++;
    if (!(r.tags || []).length) noTag++;
    (r.tags || []).forEach(function (t) { count[t] = (count[t] || 0) + 1; });
  });
  Logger.log('Контрагентов не в архиве: ' + all + ' · без группы: ' + noTag);
  Object.keys(count).sort().forEach(function (t) {
    Logger.log('Группа «' + t + '»: ' + count[t] + (skip.indexOf(String(t).toLowerCase().trim()) >= 0 ? '  ← не загружается' : ''));
  });
  Logger.log('Не загружать группы (POINT_SKIP_TAGS): ' + skip.join('; '));
  Logger.log('В приложение попадёт точек: ' + getPoints_().length);
}
