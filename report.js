/* Отчёт «Деус · Хулиган · Бланш · Нуар».
   Вёрстка и расчёты перенесены из «Генератор отчета v3.html» без изменений;
   данные приходят с сервера (МойСклад), а не из файлов выгрузки. */
var BrandReport = (function () {
'use strict';
var STATE = { debts: { fileName: '', rows: [] } };
var AROMAS_DEF = [];
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function two(n){ return (n<10?'0':'')+n; }
function todayIso(){ var d=new Date(); return d.getFullYear()+'-'+two(d.getMonth()+1)+'-'+two(d.getDate()); }
function plural(n, one, few, many){ var a=Math.abs(n)%100, b=a%10; if(a>10&&a<20) return many; if(b===1) return one; if(b>=2&&b<=4) return few; return many; }
function monthRu(key){ if(!key) return ''; var M=['','январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь']; var p=String(key).split('-'); var y=+p[0], m=+p[1]; if(!y||!m||m<1||m>12) return ''; return M[m]+' '+y; }
function monthIn(key){ if(!key) return ''; var M=['','январе','феврале','марте','апреле','мае','июне','июле','августе','сентябре','октябре','ноябре','декабре']; var p=String(key).split('-'); var y=+p[0], m=+p[1]; if(!y||!m||m<1||m>12) return ''; return M[m]+' '+y; }
var REPORT_CSS = "\n:root {\n  --bg:#f6f4ef; --card:#fffdf8; --ink:#26221a; --muted:#7d7466; --line:#e8e1d3;\n  --ok:#2f7d4f; --warn:#b07d2e; --accent:#8a5a2b; --bad:#b03a2e;\n}\n* { box-sizing:border-box }\nbody { margin:0; background:var(--bg); color:var(--ink); font:15px/1.55 -apple-system,'Segoe UI',Roboto,Arial,sans-serif }\n.wrap { max-width:1180px; margin:0 auto; padding:28px 20px 60px }\n.hero h1 { font-size:30px; margin:0 0 6px; letter-spacing:-.4px }\n.hero .sub { color:var(--muted) }\n.hero .when { color:var(--muted); font-size:13px; margin-top:2px }\n.card { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:20px; margin:18px 0; box-shadow:0 1px 3px rgba(60,50,20,.06) }\nh2 { font-size:19px; margin:0 0 12px; padding-left:2px }\n.bdot { display:inline-block; width:12px; height:12px; border-radius:4px; margin-right:8px }\n.grid3 { display:grid; gap:14px; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)) }\n.bcard { background:linear-gradient(160deg, var(--bd) -40%, var(--card) 60%); border:1px solid var(--line); border-radius:16px; padding:18px 20px; position:relative; overflow:hidden }\n.bcard::before { content:''; position:absolute; left:0; top:0; bottom:0; width:5px; background:var(--bc) }\n.bhead { display:flex; align-items:baseline; gap:10px; margin-bottom:6px }\n.bhead h3 { margin:0; font-size:18px }\n.share { margin-left:auto; font-size:12px; color:var(--muted) }\n.bars .brow { display:flex; align-items:center; gap:10px; font-size:13.5px; margin:5px 0 }\n.bars .brow span { color:var(--muted) }\n.bars .brow b { margin-left:auto }\n.mini { flex:1 0 auto; width:90px; height:6px; border-radius:3px; background:#eee6d6; margin-left:8px; overflow:hidden }\n.mini i { display:block; height:100%; background:var(--ok) }\n.mini.warn i { background:var(--warn) }\n.chartwrap { overflow-x:auto }\nsvg text { fill:#7d7466; font-size:11px }\n.grid line { stroke:#eee6d6 }\n.legend { display:flex; gap:18px; font-size:13px; color:var(--muted); padding:8px 4px 0 }\n.legend i { display:inline-block; width:11px; height:11px; border-radius:3px; margin-right:6px; vertical-align:-1px }\n.cols2 { display:grid; gap:16px; grid-template-columns:1fr 1fr }\n@media (max-width:900px) { .cols2 { grid-template-columns:1fr } }\n.panel { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:14px 16px; margin:14px 0 }\n.brandsec h2 { border-bottom:2px solid; padding-bottom:8px; display:flex; align-items:center; gap:2px }\n.ptitle { font-weight:600; margin:4px 0 8px; font-size:14.5px }\n.ptitle.ok { color:var(--ok) } .ptitle.warn { color:var(--warn) }\n.hint { color:var(--muted); font-size:13px; margin-bottom:10px }\n.totline { display:flex; align-items:baseline; gap:10px; margin-top:12px; padding:10px 14px; border:1px solid var(--line); border-radius:10px; background:var(--card); font-size:14.5px }\n.totline b { font-size:16px; font-variant-numeric:tabular-nums }\n.tblwrap { overflow:auto; border:1px solid var(--line); border-radius:10px }\n.tblwrap.tall { max-height:460px }\ntable.tbl { width:100%; border-collapse:collapse; font-size:13.5px }\n.tbl th { position:sticky; top:0; background:#f4efe4; text-align:left; padding:8px 10px; font-size:12.5px; text-transform:uppercase; letter-spacing:.4px; color:#6b6355; border-bottom:1px solid var(--line); z-index:2 }\n.tbl td { padding:7px 10px; border-bottom:1px solid #f0e9db; vertical-align:top }\n.tbl tr:hover td { background:#faf6ec }\ntd.num, th.num { text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums }\ntd.addr { color:#5d5648; font-size:12.5px; max-width:280px }\ntd.last { white-space:nowrap; color:#5d5648 }\n.debtdate { color:var(--muted); font-size:11.5px; white-space:nowrap }\n.tbl th.sortable { cursor:pointer; user-select:none }\n.tbl th.sortable:hover { background:#ece4d2 }\n.tbl th[data-dir=\"asc\"]::after { content:' \u25b2'; font-size:9px; color:var(--accent) }\n.tbl th[data-dir=\"desc\"]::after { content:' \u25bc'; font-size:9px; color:var(--accent) }\n.pills { white-space:nowrap }\n.pill { display:inline-block; min-width:30px; text-align:center; padding:2px 7px; border-radius:20px; font-size:11px; font-weight:600; margin-right:4px }\n.pill.ok { background:#dcefe3; color:#2f7d4f; border:1px solid #b7dcc5 }\n.pill.mid { background:#f3ead7; color:#8a5a2b; border:1px solid #e4d3ae }\n.pill.no { background:#eee9df; color:#9a9284; border:1px solid #ddd3c2 }\n.search { width:100%; padding:9px 12px; border:1px solid var(--line); border-radius:10px; font:inherit; font-size:14px; margin:4px 0 12px; background:#fffdf8 }\n.search:focus { outline:2px solid #d8c9a8; border-color:#cbb98f }\nfooter.rep { color:var(--muted); font-size:12.5px; margin-top:28px; border-top:1px solid var(--line); padding-top:14px }\n\n@media (max-width:600px){\n  body { font:15px/1.5 -apple-system,'Segoe UI',Roboto,Arial,sans-serif; -webkit-text-size-adjust:100% }\n  .wrap { padding:16px 12px 40px }\n  .hero h1 { font-size:21px; line-height:1.25 }\n  .hero .sub, .hero .when { font-size:12.5px; word-break:break-word }\n  .card { padding:14px; margin:14px 0; border-radius:14px }\n  h2 { font-size:16.5px; margin:0 0 10px }\n  .grid3 { grid-template-columns:1fr; gap:10px }\n  .bcard { padding:14px; border-radius:14px }\n  .bhead h3 { font-size:16px }\n  .bhead { flex-wrap:wrap }\n  .bars .brow { font-size:13px; gap:8px }\n  .mini { width:56px; margin-left:6px }\n  .totline { flex-wrap:wrap; gap:4px 10px; padding:10px 12px; font-size:13.5px }\n  .totline b { font-size:15px }\n  .cols2 { grid-template-columns:1fr }\n  .panel { padding:12px; margin:12px 0 }\n  .legend { flex-wrap:wrap; gap:8px 14px; font-size:12px }\n  .tblwrap.tall { max-height:70vh }\n  table.tbl { font-size:13px }\n  .tbl th { padding:6px 8px; font-size:11px }\n  .tbl td { padding:6px 8px }\n  td.addr { max-width:200px; font-size:11.5px }\n  td.num { font-size:12.5px }\n  .pill { min-width:26px; padding:2px 6px; font-size:10px }\n  #tblAll td.pills { white-space:normal; padding:4px 2px; width:44px }\n  #tblAll td.pills .pill { display:block; margin:0 0 3px 0; width:36px }\n  #tblAll, #tblAll td, #tblAll th { font-size:11.5px }\n  #tblAll td.addr { font-size:11px }\n  #tblAll td.num { font-size:11.5px }\n  .search { font-size:16px; padding:10px 12px }\n  table.tbl { table-layout:fixed }\n  .tbl th, .tbl td { overflow-wrap:break-word; word-wrap:break-word }\n  footer.rep { font-size:11.5px }\n}\n@media (hover:none){ .tbl tr:hover td { background:transparent } }\n";
/* --- рендер отчёта --- */
var BRAND_META={
  deus:  {label:'DEUS',           color:'#e2b13c', dark:'#3a2f10', pill:'DEU'},
  huligan:{label:'Хулиган',       color:'#c0554d', dark:'#3a1412', pill:'ХУЛ'},
  blansh:{label:'Blansh и Nuar',  color:'#7c6bb0', dark:'#221a38', pill:'B/N'}
};
function fmt(v){
  var s=Math.round(v).toString(), out='';
  while(s.length>3){ out='\u00a0'+s.slice(-3)+out; s=s.slice(0,-3); }
  return s+out;
}
function addrShort(a){
  a=String(a);
  a=a.replace(/^[0-9]{6},\s*/,'');
  a=a.replace(/Россия,\s*/i,'');
  a=a.replace(/Самарская обл[а-я]*,\s*/i,'');
  a=a.replace(/г Самара,\s*/i,'');
  return a;
}

function reportBody(model, fileName, debts){
  var brands=model.brands, sep=model.sepMonth;
  var pts=model.allPoints.slice().sort(function(a,b){
    return a.client.localeCompare(b.client,'ru')||a.canon.localeCompare(b.canon,'ru');
  });
  var totalAll=brands.reduce(function(a,b){ return a+pts.reduce(function(x,p){ return x+p.byBrand[b.id].sum; },0); },0);
  var h='';
  h+='<header class="hero">';
  h+='<h1>Отчет Деус · Хулиган · Бланш · Нуар</h1>';
  h+='<div class="sub">Самара · '+esc(fileName);
  if(model.firstDay&&model.lastDay) h+=' · заказы с '+fmtDay(model.firstDay)+' по '+fmtDay(model.lastDay);
  else if(model.months.length) h+=' · '+ruDate(model.months[0])+' — '+ruDate(model.months[model.months.length-1]);
  h+='</div>';
  h+='<div class="when">отчёт сформирован: '+fmtNow()+'</div>';
  h+='</header>';

  var sepLabel=monthRu(sep||'');
  var sepIn=monthIn(sep||'');
  var sepCap=sepLabel?sepLabel.charAt(0).toUpperCase()+sepLabel.slice(1):'';
  h+='<div class="card"><h2>Сводка</h2><div class="grid3">';
  brands.forEach(function(b){
    var meta=BRAND_META[b.id]||{label:b.title,color:'#999',dark:'#333',pill:'?'};
    var rubAll=pts.reduce(function(a,p){ return a+p.byBrand[b.id].sum; },0);
    var boughtSep=pts.filter(function(p){ return p.byBrand[b.id].sep>0; }).length;
    var notSep=pts.length-boughtSep;
    var share=totalAll? (rubAll/totalAll*100):0;
    h+='<div class="bcard" style="--bc:'+meta.color+';--bd:'+meta.dark+'">';
    h+='<div class="bhead"><span class="bdot"></span><h3>'+esc(b.title)+'</h3><span class="share">'+Math.round(share)+'% выручки</span></div>';
    h+='<div class="bars">';
    h+='<div class="brow"><span>Точек всего</span><b>'+pts.length+'</b></div>';
    h+='<div class="brow"><span>Покупали в '+sepIn+'</span><b>'+boughtSep+' из '+pts.length+'</b><div class="mini"><i style="width:'+(pts.length?Math.round(boughtSep/pts.length*100):0)+'%"></i></div></div>';
    h+='<div class="brow"><span>Не покупали в '+sepIn+'</span><b>'+notSep+' из '+pts.length+'</b><div class="mini warn"><i style="width:'+(pts.length?Math.round(notSep/pts.length*100):0)+'%"></i></div></div>';
    var rubSep=pts.reduce(function(a,p){ return a+p.byBrand[b.id].sep; },0);
    h+='<div class="brow"><span>Продажи за '+sepLabel+'</span><b>'+fmt(rubSep)+' ₽</b></div>';
    h+='</div></div>';
  });
  h+='</div>';
  var rubSepAll=brands.reduce(function(a,b){ return a+pts.reduce(function(x,p){ return x+p.byBrand[b.id].sep; },0); },0);
  h+='<div class="totline"><span>Общая сумма продаж</span><b>'+fmt(rubSepAll)+' ₽ за '+sepLabel+'</b></div>';
  h+='<p class="hint" style="margin:10px 2px 0">Точка = уникальная пара «Контрагент + Адрес доставки» из заказов.</p>';
  h+='</div>';

  h+=aromaMonitor(model, pts);

  h+='<div class="card"><h2>Продажи по месяцам</h2>'+monthsChart(model, pts)+'</div>';

  brands.forEach(function(b){
    var meta=BRAND_META[b.id];
    var bought=pts.filter(function(p){ return p.byBrand[b.id].sep>0; });
    /* сверху — точки, которые недавно что-то заказывали: с ними и работать в первую очередь */
    var notb=pts.filter(function(p){ return p.byBrand[b.id].sep<=0; }).sort(function(x,y){
      return (y.lastDay||'').localeCompare(x.lastDay||'')||x.client.localeCompare(y.client,'ru');
    });
    h+='<section class="brandsec">';
    h+='<h2 style="border-color:'+meta.color+'"><span class="bdot" style="background:'+meta.color+'"></span>'+esc(b.title)+'</h2>';
    h+='<div class="hint">'+bought.length+' '+plural(bought.length,'точка','точки','точек')+' покупали в '+sepIn+' · '+notb.length+' не покупали'+(model.lastDay?' · в «Не покупали» сверху точки со свежим заказом любого товара (дни — до '+fmtDay(model.lastDay)+'), под датой — когда последний раз брали бренд':'')+'</div>';
    h+='<div class="cols2">';
    h+='<div class="panel" style="margin:0"><div class="ptitle ok">✓ Покупали в '+sepIn+'</div><div class="tblwrap tall"><table class="tbl">';
    h+='<thead><tr><th>Контрагент</th><th>Адрес доставки</th><th class="num">'+sepCap+', ₽</th><th class="num">Период, ₽</th></tr></thead><tbody>';
    bought.forEach(function(p){
      var bb=p.byBrand[b.id];
      h+='<tr><td>'+esc(p.client)+'</td><td class="addr">'+esc(addrShort(p.canon))+'</td><td class="num">'+fmt(bb.sep)+'</td><td class="num">'+fmt(bb.sum)+'</td></tr>';
    });
    h+='</tbody></table></div></div>';
    h+='<div class="panel" style="margin:0"><div class="ptitle warn">— Не покупали в '+sepIn+'</div><div class="tblwrap tall"><table class="tbl">';
    h+='<thead><tr><th>Контрагент</th><th>Адрес доставки</th><th>Последний заказ</th></tr></thead><tbody>';
    notb.forEach(function(p){
      var bb=p.byBrand[b.id];
      var last=bb.last? (b.lastPad? bb.last.split('-')[1]+'.'+bb.last.split('-')[0] : parseInt(bb.last.split('-')[1],10)+'.'+bb.last.split('-')[0]) : null;
      var dd=daysBetween(p.lastDay, model.lastDay);
      var sub=(dd!=null?dd+' дн. · ':'')+(last?'бренд: '+last:'бренд не брали');
      h+='<tr><td>'+esc(p.client)+'</td><td class="addr">'+esc(addrShort(p.canon))+'</td><td class="last">'+fmtDay(p.lastDay)+'<div class="debtdate" style="white-space:normal">'+sub+'</div></td></tr>';
    });
    h+='</tbody></table></div></div>';
    h+='</div></section>';
  });

  h+='<section class="panel" id="allc"><h2>Все контрагенты</h2>';
  h+='<div class="hint">'+pts.length+' точек «контрагент + адрес доставки» · метки брендов: яркая = покупал в '+sepIn+', приглушённая = покупал раньше, серая = не покупал</div>';
  h+='<input type="search" id="qall" class="search" placeholder="Поиск по контрагенту или адресу…">';
  h+='<div class="tblwrap tall"><table class="tbl" id="tblAll">';
  h+='<thead><tr><th>Контрагент</th><th>Адрес доставки</th><th>Бренды</th><th class="num">Период, ₽</th><th class="num">'+sepCap+', ₽</th></tr></thead><tbody>';
  pts.forEach(function(p){
    h+='<tr><td>'+esc(p.client)+'</td><td class="addr">'+esc(addrShort(p.canon))+'</td><td class="pills">';
    brands.forEach(function(b){
      var meta=BRAND_META[b.id];
      var bb=p.byBrand[b.id];
      var cls=bb.sep>0?'ok':(bb.sum>0?'mid':'no');
      var tip=meta.label+(bb.sep>0?' · покупал в '+sepIn:(bb.sum>0?' · покупал раньше':' · не покупал'));
      /* ИСПРАВЛЕНО: tip прогоняется через esc() */
      h+='<span class="pill '+cls+'" title="'+esc(tip)+'">'+meta.pill+'</span>';
    });
    h+='</td><td class="num">'+fmt(p.sumAll)+'</td><td class="num">'+fmt(p.sumSep)+'</td></tr>';
  });
  h+='</tbody></table></div></section>';
  if(debts && debts.length){
    var dTot=0;
    debts.forEach(function(d){ dTot+=d.balance; });
    h+='<section class="panel" id="debts"><h2>Долги контрагентов</h2>';
    var today=todayIso();
    h+='<div class="hint">'+esc(STATE.debts.fileName)+' · долгов — '+debts.length+' · общий остаток — '+fmt(dTot)+' ₽ · «Дней» — сколько прошло с даты долга на '+fmtDay(today)+' · по заголовку колонки можно сортировать</div>';
    h+='<div class="tblwrap"><table class="tbl" id="tblDebts">';
    h+='<thead><tr><th>Контрагент</th><th>Адрес</th><th>Дата долга</th><th class="num">Дней</th><th class="num">Сумма, ₽</th><th class="num">Оплачено, ₽</th><th class="num">Остаток, ₽</th></tr></thead><tbody>';
    debts.forEach(function(d){
      var age=d.iso?daysBetween(d.iso, today):null;
      /* в МойСклад у контрагента бывает несколько адресов через перенос строки — выводим каждый с новой строки */
      var addrHtml=String(d.addr||'').split(/\n+/).map(function(x){ return x.trim(); }).filter(Boolean).map(function(x){ return esc(addrShort(x)); }).join('<br>');
      h+='<tr><td>'+esc(d.client)+'</td><td class="addr">'+addrHtml+'</td><td class="debtdate" data-s="'+esc(d.date)+'">'+esc(d.dateShort)+'</td><td class="num">'+(age==null?'':age)+'</td><td class="num">'+fmt(d.amount)+'</td><td class="num">'+fmt(d.paid)+'</td><td class="num">'+fmt(d.balance)+'</td></tr>';
    });
    h+='</tbody></table></div></section>';
  }
  h+='<footer class="rep">Данные: '+esc(fileName)+(STATE.debts.rows.length?' · долги: '+esc(STATE.debts.fileName):'')+'</footer>';
  return h;
}


/* --- Мониторинг запуска ароматов: кто получил, кто нет --- */
function fmtDay(d){ if(!d) return '—'; var p=d.split('-'); return p[2]+'.'+p[1]+'.'+p[0]; }
function daysBetween(a,b){
  if(!a||!b) return null;
  var x=a.split('-'), y=b.split('-');
  return Math.round((Date.UTC(+y[0],+y[1]-1,+y[2])-Date.UTC(+x[0],+x[1]-1,+x[2]))/86400000);
}
function aromaMonitor(model, pts){
  if(!AROMAS_DEF.length) return '';
  var ref=model.lastDay;
  var h='<div class="card" id="aromamon"><h2>Мониторинг запуска ароматов</h2>';
  h+='<div class="hint">Точка = «Контрагент + Адрес доставки». «Не отгружали» — активные точки (был заказ любого товара за выбранный срок до '+fmtDay(ref)+'), которым аромат ещё не отгружали.</div>';
  h+='<div class="aroctl"><label>Считать активными точки с заказом за последние <select class="aroact">'
    +'<option value="30">30 дней</option><option value="60">60 дней</option><option value="90" selected>90 дней</option><option value="180">180 дней</option><option value="99999">весь период</option></select></label></div>';
  AROMAS_DEF.forEach(function(a){
    var shipped=pts.filter(function(p){ return p.aro[a.id].qty>0||p.aro[a.id].sum>0; });
    var notS=pts.filter(function(p){ return !(p.aro[a.id].qty>0||p.aro[a.id].sum>0); });
    shipped.sort(function(x,y){ return (y.aro[a.id].last||'').localeCompare(x.aro[a.id].last||'')||x.client.localeCompare(y.client,'ru'); });
    notS.sort(function(x,y){ return (y.lastDay||'').localeCompare(x.lastDay||'')||x.client.localeCompare(y.client,'ru'); });
    var totQty=0,totSum=0; shipped.forEach(function(p){ totQty+=p.aro[a.id].qty; totSum+=p.aro[a.id].sum; });
    h+='<section class="brandsec aromasec" data-shipped="'+shipped.length+'" style="margin-top:18px">';
    h+='<h2 style="border-color:'+a.color+'"><span class="bdot" style="background:'+a.color+'"></span>'+esc(a.title)+'</h2>';
    h+='<div class="aronums">'
      +'<div><b>'+shipped.length+'</b><span>точек отгружено</span></div>'
      +'<div><b class="ar-notcnt">0</b><span>активных не отгружено</span></div>'
      +'<div><b class="ar-pct">0%</b><span>охват активных точек</span></div>'
      +'<div><b>'+fmt(totQty)+'</b><span>шт всего</span></div>'
      +'<div><b>'+fmt(totSum)+' ₽</b><span>сумма</span></div></div>';
    h+='<div class="mini aroprog"><i class="ar-bar" style="width:0%;background:'+a.color+'"></i></div>';
    h+='<div class="cols2">';
    h+='<div class="panel" style="margin:0"><div class="ptitle ok">✓ Отгружено ('+shipped.length+')</div><div class="tblwrap tall"><table class="tbl">';
    h+='<thead><tr><th>Контрагент</th><th>Адрес доставки</th><th>Дата</th><th>Фасовки</th><th class="num">Сумма, ₽</th></tr></thead><tbody>';
    shipped.forEach(function(p){
      var ar=p.aro[a.id];
      var sz=Object.keys(ar.sizes).sort(function(x,y){ return parseInt(x,10)-parseInt(y,10); }).map(function(k){ return k+' × '+fmt(ar.sizes[k]); }).join(', ');
      var dt=(ar.first&&ar.first!==ar.last)?(fmtDay(ar.first)+' – '+fmtDay(ar.last)):fmtDay(ar.last);
      h+='<tr><td>'+esc(p.client)+'</td><td class="addr">'+esc(addrShort(p.canon))+'</td><td class="last">'+dt+'</td><td>'+esc(sz)+'</td><td class="num">'+fmt(ar.sum)+'</td></tr>';
    });
    h+='</tbody></table></div></div>';
    h+='<div class="panel" style="margin:0"><div class="ptitle warn">— Не отгружали (<span class="ar-notshow">0</span> активных из '+notS.length+')</div><div class="tblwrap tall"><table class="tbl">';
    h+='<thead><tr><th>Контрагент</th><th>Адрес доставки</th><th>Последний заказ</th></tr></thead><tbody>';
    notS.forEach(function(p){
      var dd=daysBetween(p.lastDay,ref);
      h+='<tr class="ar-nrow" data-days="'+(dd==null?99999:dd)+'"><td>'+esc(p.client)+'</td><td class="addr">'+esc(addrShort(p.canon))+'</td><td class="last">'+fmtDay(p.lastDay)+(dd!=null?' <span class="debtdate">('+dd+' дн.)</span>':'')+'</td></tr>';
    });
    h+='</tbody></table></div></div>';
    h+='</div></section>';
  });
  h+='</div>';
  return h;
}
/* Фильтр «активные точки» и пересчёт счётчиков (работает и в скачанном отчёте) */
function aromaInit(){
  var card=document.getElementById('aromamon'); if(!card) return;
  var sel=card.querySelector('.aroact'); if(!sel) return;
  function apply(){
    var lim=parseInt(sel.value,10);
    card.querySelectorAll('.aromasec').forEach(function(sec){
      var shipped=parseInt(sec.getAttribute('data-shipped'),10)||0, act=0;
      sec.querySelectorAll('.ar-nrow').forEach(function(tr){
        var on=(parseInt(tr.getAttribute('data-days'),10)<=lim);
        tr.classList.toggle('hid',!on); if(on) act++;
      });
      var tot=shipped+act, pct=tot?Math.round(shipped/tot*100):0;
      sec.querySelector('.ar-notcnt').textContent=act;
      sec.querySelector('.ar-notshow').textContent=act;
      sec.querySelector('.ar-pct').textContent=pct+'%';
      sec.querySelector('.ar-bar').style.width=pct+'%';
    });
  }
  sel.onchange=apply; apply();
}

function ruDate(key){ return monthRu(key); }
function fmtNow(){
  var d=new Date();
  var D=['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
  var Mn=['','января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  var hh=(d.getHours()<10?'0':'')+d.getHours(), mm=(d.getMinutes()<10?'0':'')+d.getMinutes();
  return D[d.getDay()]+', '+d.getDate()+' '+Mn[d.getMonth()+1]+' '+d.getFullYear()+', '+hh+':'+mm;
}

function monthsChart(model, pts){
  var brands=model.brands;
  var W=1060,H=300,PADL=46,PADR=12,PADT=18,PADB=34;
  var plotW=W-PADL-PADR, plotH=H-PADT-PADB;
  var n=model.months.length||1;
  var groupW=plotW/n;
  var barW=Math.min(26, groupW/3.6);
  var maxRub=1;
  model.months.forEach(function(mm){
    brands.forEach(function(b){
      var s=pts.reduce(function(a,p){ var v=p.byBrand[b.id].months.get(mm); return a+(v||0); },0);
      if(s>maxRub) maxRub=s;
    });
  });
  function yv(v){ return PADT+plotH*(1-v/maxRub); }
  var grid='';
  for(var i=0;i<5;i++){
    var v=maxRub*i/4, y=yv(v);
    grid+='<line x1="'+PADL+'" y1="'+y.toFixed(1)+'" x2="'+(W-PADR)+'" y2="'+y.toFixed(1)+'"/>';
    grid+='<text x="'+(PADL-8)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end">'+Math.round(v/1000)+'к</text>';
  }
  var bars='';
  model.months.forEach(function(mm,gi){
    var gx=PADL+groupW*gi+groupW/2;
    brands.forEach(function(b,bi){
      var s=Math.round(pts.reduce(function(a,p){ var v=p.byBrand[b.id].months.get(mm); return a+(v||0); },0));
      if(!s) return;
      var x=gx-barW*1.5+bi*barW+bi*2;
      var hh=plotH*(s/maxRub);
      bars+='<rect x="'+x.toFixed(1)+'" y="'+yv(s).toFixed(1)+'" width="'+barW.toFixed(1)+'" height="'+hh.toFixed(1)+'" rx="3" fill="'+BRAND_META[b.id].color+'" class="bar"><title>'+monthRu(mm)+' · '+BRAND_META[b.id].label+': '+fmt(s)+' ₽</title></rect>';
    });
    bars+='<text x="'+gx.toFixed(1)+'" y="'+(H-10)+'" text-anchor="middle" class="mlabel">'+monthRu(mm).split(' ')[0]+'</text>';
  });
  var legend='<div class="legend">'+brands.map(function(b){ return '<span><i style="background:'+BRAND_META[b.id].color+'"></i>'+BRAND_META[b.id].label+'</span>'; }).join('')+'</div>';
  return '<div class="chartwrap"><svg viewBox="0 0 '+W+' '+H+'" width="100%" role="img" aria-label="Продажи по месяцам"><g class="grid">'+grid+'</g><g class="bars">'+bars+'</g></svg>'+legend+'</div>';
}

/* --- поиск (для отображения и для скачанного отчёта) --- */
/* ИСПРАВЛЕНО: _initSearch теперь не создаёт дубликаты счётчика и поисковых полей,
   которые уже были вшиты в HTML отчёта на этапе attachSearch(). */
REPORT_CSS += "\n.aroctl { margin:0 0 6px; font-size:13.5px; color:var(--muted) }\n.aroctl select { padding:5px 8px; border:1px solid var(--line); border-radius:8px; font:inherit; background:#fffdf8; margin-left:4px }\n.aronums { display:flex; flex-wrap:wrap; gap:10px 26px; margin:4px 0 8px }\n.aronums div { display:flex; flex-direction:column }\n.aronums b { font-size:22px; font-variant-numeric:tabular-nums; line-height:1.2 }\n.aronums span { font-size:12px; color:var(--muted) }\n.aroprog { width:100%; margin:0 0 12px; height:8px }\n.aroprog i { transition:width .2s }\ntr.hid { display:none !important }\n.bcard .bdot { background:var(--bc) }\n";
var SEARCH_JS = "function _initSearch(){var qall=document.getElementById('qall');var tbl=document.getElementById('tblAll');if(!qall||!tbl||!tbl.parentNode)return;var wrap=tbl.parentNode;var trs=tbl.querySelectorAll('tbody tr');var st=null;for(var _i=0;_i<wrap.children.length;_i++){var _c=wrap.children[_i];if(_c.getAttribute&&_c.getAttribute('data-search-count')){st=_c;break;}}if(!st){st=document.createElement('div');st.className='hint';st.setAttribute('data-search-count','1');wrap.insertBefore(st,tbl);}function upd(){var n=0;trs.forEach(function(tr){if(tr.style.display!=='none')n++;});st.textContent='Показано точек: '+n+' из '+trs.length;}upd();if(!qall._searchInit){qall._searchInit=true;qall.addEventListener('input',function(){var v=this.value.trim().toLowerCase();trs.forEach(function(tr){tr.style.display=(!v||tr.textContent.toLowerCase().indexOf(v)>=0)?'':'none';});upd();});}document.querySelectorAll('.brandsec .panel').forEach(function(p){var inp=p.querySelector('input.search');if(!inp){inp=document.createElement('input');inp.type='search';inp.className='search';inp.placeholder='Поиск по таблице…';p.insertBefore(inp,p.querySelector('.tblwrap'));}if(!inp._searchInit){inp._searchInit=true;inp.addEventListener('input',function(){var v=this.value.trim().toLowerCase();p.querySelectorAll('tbody tr').forEach(function(tr){tr.style.display=(!v||tr.textContent.toLowerCase().indexOf(v)>=0)?'':'none';});});}});}if(document.readyState!=='loading')_initSearch();else document.addEventListener('DOMContentLoaded',_initSearch);function _initDebtSort(){var tbl=document.getElementById('tblDebts');if(!tbl||!tbl.parentNode)return;var ths=Array.prototype.slice.call(tbl.querySelectorAll('thead th'));var trs=Array.prototype.slice.call(tbl.querySelectorAll('tbody tr'));ths.forEach(function(th,idx){th.classList.add('sortable');th.addEventListener('click',function(){var dir=th.getAttribute('data-dir')==='asc'?'desc':'asc';ths.forEach(function(o){o.removeAttribute('data-dir');});th.setAttribute('data-dir',dir);var isDate=idx===2;trs.sort(function(a,b){var ka,kb;if(isDate){ka=a.cells[idx];kb=b.cells[idx];ka=ka.getAttribute('data-s')||ka.textContent||'';kb=kb.getAttribute('data-s')||kb.textContent||'';ka=ka.split('.').reverse().join('');kb=kb.split('.').reverse().join('');}else{ka=a.cells[idx].textContent;kb=b.cells[idx].textContent;if(th.classList.contains('num')||a.cells[idx].classList.contains('num')){ka=parseFloat(ka.replace(/[^0-9.,\-]/g,'').replace(',','.'))||0;kb=parseFloat(kb.replace(/[^0-9.,\-]/g,'').replace(',','.'))||0;}}if(ka<kb)return dir==='asc'?-1:1;if(ka>kb)return dir==='asc'?1:-1;return 0;});trs.forEach(function(tr){tbl.tBodies[0].appendChild(tr);});});});}if(document.readyState!=='loading')_initDebtSort();else document.addEventListener('DOMContentLoaded',_initDebtSort);";


/* ---- сборка модели из ответа сервера (то же, что делал buildModel после чтения файла) ---- */
function buildModel(pl, sepWanted){
  var brands=pl.brands;
  AROMAS_DEF=pl.aromas;
  var months=pl.months.slice().sort();
  var sep=(sepWanted && months.indexOf(sepWanted)>=0) ? sepWanted : (months.length?months[months.length-1]:null);
  var names={};
  var pts=pl.points.map(function(q){
    names[q.c]=1;
    var p={client:q.c, canon:q.a, lastDay:q.ld||null, byBrand:{}, aro:{}};
    brands.forEach(function(b){
      var src=(q.b||{})[b.id]||{}, mm=new Map(), sum=0, last=null;
      Object.keys(src).sort().forEach(function(k){ mm.set(k,src[k]); sum+=src[k]; if(!last||k>last) last=k; });
      p.byBrand[b.id]={sum:sum, months:mm, sep:mm.get(sep)||0, last:last};
    });
    pl.aromas.forEach(function(a){
      var r=(q.r||{})[a.id];
      p.aro[a.id]=r?{qty:r.q,sum:r.s,first:r.f,last:r.l,sizes:r.z||{}}:{qty:0,sum:0,first:null,last:null,sizes:{}};
    });
    p.sumAll=brands.reduce(function(a,b){return a+p.byBrand[b.id].sum;},0);
    p.sumSep=brands.reduce(function(a,b){return a+p.byBrand[b.id].sep;},0);
    return p;
  });
  return {allPoints:pts, months:months, sepMonth:sep, brands:brands, lastDay:pl.lastDay||null, firstDay:pl.firstDay||null, clients:{size:Object.keys(names).length}};
}
function debtRows(pl){
  return (pl.debts||[]).map(function(d){
    var p=String(d.iso||'').split('-');
    var full=p.length===3?(p[2]+'.'+p[1]+'.'+p[0]):'';
    return {num:d.num, iso:d.iso, date:full, dateShort:full?full.slice(0,5):'', client:d.client, amount:d.amount, paid:d.paid, balance:d.balance, addr:d.addr||''};
  });
}
function sourceLabel(pl){
  return 'заказы покупателей из МойСклад, канал продаж «'+pl.channel+'»';
}
/* Предупреждения о свежести данных — как в генераторе, без сравнения двух файлов */
function warnings(model, sepWanted){
  var out=[], last=model.lastDay, today=todayIso();
  if(!last) return out;
  var lastM=model.months.length?model.months[model.months.length-1]:null;
  var age=daysBetween(last, today);
  if(age!=null && age>7) out.push('Последний заказ — '+fmtDay(last)+', это '+age+' '+plural(age,'день','дня','дней')+' назад.');
  else if(!sepWanted && lastM && lastM<today.slice(0,7)) out.push('Заказов за '+monthRu(today.slice(0,7))+' ещё нет, поэтому отчётный месяц — '+monthRu(lastM)+'.');
  return out;
}
/* Готовая страница отчёта: body — то же, что показывал генератор; page — то же, что он скачивал */
function render(pl, sepWanted){
  var model=buildModel(pl, sepWanted);
  var debts=debtRows(pl);
  STATE.debts.rows=debts;
  STATE.debts.fileName='Отгрузки из МойСклад с '+fmtDay(pl.debtFrom)+', канал продаж «'+pl.channel+'»';
  var body=reportBody(model, sourceLabel(pl), debts);
  var page='<!DOCTYPE html>\n<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Отчет Деус Хулиган Бланш Нуар</title><style>'+REPORT_CSS+'</style></head><body><div class="wrap">'+body+'</div><script>(function(){'+SEARCH_JS+'})()<\/script><script>('+aromaInit.toString()+')()<\/script></body></html>';
  return {page:page, body:body, model:model, months:model.months, sepMonth:model.sepMonth, warnings:warnings(model, sepWanted), monthRu:monthRu};
}
return { render:render, buildModel:buildModel, monthRu:monthRu, fmtDay:fmtDay };
})();
if (typeof module !== 'undefined') module.exports = BrandReport;
