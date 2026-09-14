const euroFmt = new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'});
const DEFAULT_STATE = {
  page: 'dashboard',
  balance: 0,
  startingCapital: 0,
  startingCapitalMonth: '',
  forecastMonth: '2026-09',
  dashboardMonth: '2026-09',
  movementMonth: 'all',
  movementFilter: 'all',
  transactions: [],
  futureEvents: [],
  goals: [],
  goalTab: 'active',
  forecastHistory: {},
  cushionMinimum: 0,
  cushionIdeal: 0
};

function loadState(){
  try{
    const raw=localStorage.getItem('matteos-finance-v1');
    if(!raw) return structuredClone(DEFAULT_STATE);
    const saved=JSON.parse(raw);
    if(!saved || typeof saved!=='object') return structuredClone(DEFAULT_STATE);
    return {
      ...structuredClone(DEFAULT_STATE),
      ...saved,
      transactions:Array.isArray(saved.transactions)?saved.transactions.map(t=>t&&t.category==='Benzina'?{...t,category:'Auto'}:t):structuredClone(DEFAULT_STATE.transactions),
      futureEvents:Array.isArray(saved.futureEvents)?saved.futureEvents.map(e=>e&&e.category==='Benzina'?{...e,category:'Auto'}:e):structuredClone(DEFAULT_STATE.futureEvents),
      goals:Array.isArray(saved.goals)?saved.goals:structuredClone(DEFAULT_STATE.goals),
      goalTab:saved.goalTab==='completed'?'completed':'active',
      forecastHistory:saved.forecastHistory&&typeof saved.forecastHistory==='object'?saved.forecastHistory:{},
      cushionMinimum:Math.max(0,Number(saved.cushionMinimum)||0),
      cushionIdeal:Math.max(0,Number(saved.cushionIdeal)||0)
    };
  }catch(err){
    console.warn('Dati locali non validi: ripristino la versione sicura.',err);
    return structuredClone(DEFAULT_STATE);
  }
}
const state = loadState();
const categories=['Stipendio','Spesa','Casa','Affitto','Contrattempo','Tempo libero','Altro','Auto','Redditi','Lavoro','Salute'];
const incomeCategories=['Stipendio','Extra','Mance','Altro'];
const expenseCategories=['Obiettivi','Spesa','Auto','Casa','Affitto','Contrattempo','Tempo libero','Altro'];
const futureIncomeCategories=['Altro'];
const futureExpenseCategories=['Spesa','Auto','Casa','Tempo libero','Contrattempo','Affitto','Altro'];
function futureCategoriesForType(type){return type==='income'?futureIncomeCategories:futureExpenseCategories}
function futureCategoryOptions(type){return futureCategoriesForType(type).map(c=>`<option>${c}</option>`).join('')}
function categoriesForType(type){return type==='expense'?expenseCategories:incomeCategories}
function categoryOptions(type){return categoriesForType(type).map(c=>`<option>${c}</option>`).join('')}
// Cache tecniche temporanee: non modificano dati, formule o risultati; evitano soltanto di ripetere gli stessi filtri.
let dataIndexCache=null;
let goalPlanCache=null;
let performanceDataSignature='';
function invalidatePerformanceCache(){dataIndexCache=null;goalPlanCache=null}
function getPerformanceDataSignature(){return JSON.stringify({transactions:state.transactions,futureEvents:state.futureEvents,goals:state.goals,cushionMinimum:state.cushionMinimum,cushionIdeal:state.cushionIdeal,startingCapital:state.startingCapital,startingCapitalMonth:state.startingCapitalMonth,balance:state.balance})}
function save(){const signature=getPerformanceDataSignature();if(signature!==performanceDataSignature){invalidatePerformanceCache();performanceDataSignature=signature}localStorage.setItem('matteos-finance-v1',JSON.stringify(state))}
function uid(){return Math.random().toString(36).slice(2,10)}
function sum(items){return items.reduce((a,b)=>a+b,0)}
function monthOf(d){return d.slice(0,7)}
function currentMonth(){const d=new Date();return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`}
function monthName(ym){return new Date(ym+'-01T12:00:00').toLocaleDateString('it-IT',{month:'long',year:'numeric'})}
function getDataIndex(){
  if(dataIndexCache)return dataIndexCache;
  const byMonth=new Map(),byDate=new Map(),monthlyTotals=new Map();
  state.transactions.forEach(t=>{
    const month=monthOf(t.date);
    if(!byMonth.has(month))byMonth.set(month,[]);
    byMonth.get(month).push(t);
    if(!byDate.has(t.date))byDate.set(t.date,[]);
    byDate.get(t.date).push(t);
    const totals=monthlyTotals.get(month)||{income:0,expense:0};
    const amount=Number(t.amount)||0;
    if(t.type==='income')totals.income+=amount;else if(t.type==='expense')totals.expense+=amount;
    monthlyTotals.set(month,totals);
  });
  dataIndexCache={byMonth,byDate,monthlyTotals,balanceByMonth:new Map()};
  return dataIndexCache;
}
function monthTx(ym){return getDataIndex().byMonth.get(ym)||[]}
function income(ym=currentMonth()){return getDataIndex().monthlyTotals.get(ym)?.income||0}
function expenses(ym=currentMonth()){return getDataIndex().monthlyTotals.get(ym)?.expense||0}
function savings(ym=currentMonth()){return income(ym)-expenses(ym)}
function prevMonth(ym){let [y,m]=ym.split('-').map(Number);m--;if(m===0){m=12;y--}return `${y}-${String(m).padStart(2,'0')}`}
function nextMonth(ym){let [y,m]=ym.split('-').map(Number);m++;if(m===13){m=1;y++}return `${y}-${String(m).padStart(2,'0')}`}
function monthRange(from,to){if(!from||!to)return [];const out=[];let m=from;while(m<=to&&out.length<240){out.push(m);m=nextMonth(m)}return out}
function knownMonths(){const values=[state.startingCapitalMonth,currentMonth(),state.forecastMonth,state.dashboardMonth,state.movementMonth!=='all'?state.movementMonth:''].filter(Boolean);state.transactions.forEach(t=>values.push(monthOf(t.date)));state.futureEvents.forEach(e=>values.push(monthOf(e.date)));const clean=values.filter(Boolean).sort();if(!clean.length)return [currentMonth()];return monthRange(clean[0],clean[clean.length-1])}
function availableDataMonths(){return knownMonths()}
function balanceAtEndOfMonth(ym){
  const index=getDataIndex();
  if(index.balanceByMonth.has(ym))return index.balanceByMonth.get(ym);
  const from=state.startingCapitalMonth||'';
  let balance=Number(state.startingCapital)||0;
  index.monthlyTotals.forEach((totals,month)=>{if(month<=ym&&(!from||month>=from))balance+=totals.income-totals.expense});
  index.balanceByMonth.set(ym,balance);
  return balance;
}
function monthlyCapacity(){const allMonths=[...new Set(state.transactions.map(t=>monthOf(t.date)))];const values=allMonths.map(m=>Math.max(0,savings(m))).filter(Number.isFinite);return values.length?sum(values)/values.length:245.6}
function changePage(page){
  state.page=page;
  // Ogni pagina viene sempre aperta dall'inizio.
  if(page==='dashboard') dashboardWeekOffset=currentDashboardWeekOffset();
  save();
  render();
  requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'auto'}));
}

// Navigazione della settimana della Dashboard: non modifica i dati salvati.
let dashboardWeekOffset = 0;
let dashboardWeekDirection = 0;
let dashboardWeekTransition = null;
let dashboardWeekTransitionTimer = null;
const WEEK_BASE = new Date('2026-09-03T12:00:00');
const WEEK_LABELS = ['DOM','LUN','MAR','MER','GIO','VEN','SAB'];
const MONTH_LABELS = ['GEN','FEB','MAR','APR','MAG','GIU','LUG','AGO','SET','OTT','NOV','DIC'];
function pad2(n){return String(n).padStart(2,'0')}
function displayDate(date){return new Date(date+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'long'})}
function isoDate(d){return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`}
dashboardWeekOffset=currentDashboardWeekOffset();
function dashboardMonthPageCount(ym=state.dashboardMonth||currentMonth()){
  const [year,month]=ym.split('-').map(Number);
  const total=new Date(year,month,0).getDate();
  return Math.max(1,Math.ceil(total/7));
}
function currentDashboardWeekOffset(){
  const ym=state.dashboardMonth||currentMonth();
  if(ym!==currentMonth()) return 0;
  const now=new Date();
  return Math.floor((now.getDate()-1)/7);
}
function dashboardWeekDays(offset=dashboardWeekOffset){
  const ym=state.dashboardMonth||currentMonth();
  const [year,month]=ym.split('-').map(Number);
  const total=new Date(year,month,0).getDate();
  const startDay=offset*7+1;
  if(startDay>total)return [];
  return Array.from({length:Math.min(7,total-startDay+1)},(_,i)=>{
    const date=new Date(year,month-1,startDay+i,12,0,0);
    const key=isoDate(date);
    const tx=getDataIndex().byDate.get(key)||[];
    const inc=sum(tx.filter(t=>t.type==='income').map(t=>Number(t.amount)||0));
    const out=sum(tx.filter(t=>t.type==='expense').map(t=>Number(t.amount)||0));
    return {date,key,name:WEEK_LABELS[date.getDay()],day:date.getDate(),month:MONTH_LABELS[date.getMonth()],inc,out};
  });
}
function shiftDashboardWeek(delta){
  if(dashboardWeekTransition) return;
  const from=dashboardWeekOffset;
  const maxOffset=dashboardMonthPageCount()-1;
  const to=Math.max(0,Math.min(maxOffset,from+delta));
  if(to===from)return;
  dashboardWeekDirection=delta>0?1:-1;
  dashboardWeekTransition={from,to,direction:delta>0?'next':'prev'};
  dashboardWeekOffset=to;
  render();
  clearTimeout(dashboardWeekTransitionTimer);
  dashboardWeekTransitionTimer=setTimeout(()=>{
    dashboardWeekTransition=null;
    render();
  },1080);
}
function weekAmount(v){return Number.isInteger(v)?String(v):v.toLocaleString('it-IT',{maximumFractionDigits:2})}

function completedInsightMonths(){
  return [...new Set(state.transactions.map(t=>monthOf(t.date)))].filter(m=>m<currentMonth()).sort();
}
function insightAvailabilityDays(){
  const dataMonths=[...new Set(state.transactions.map(t=>monthOf(t.date)))].sort();
  const firstMonth=dataMonths[0]||currentMonth();
  const [year,month]=firstMonth.split('-').map(Number);
  // Due mesi diventano confrontabili all'inizio del mese successivo al secondo mese.
  const availableFrom=new Date(year,month+1,1,0,0,0,0);
  const now=new Date();
  now.setHours(0,0,0,0);
  return Math.max(0,Math.ceil((availableFrom-now)/(24*60*60*1000)));
}
function monthInsightButtons(){
  const months=completedInsightMonths();
  if(months.length<2){
    const days=insightAvailabilityDays();
    return `<button class="big-btn insight-locked" disabled><span class="insight-label">Disponibile tra</span><small class="insight-size-spacer">In attesa di dati</small></button><button class="big-btn insight-locked" disabled><span class="insight-label">${days} giorni</span><small class="insight-size-spacer">In attesa di dati</small></button>`;
  }
  const ranked=months.map(m=>({m,net:income(m)-expenses(m)}));
  const best=[...ranked].sort((a,b)=>b.net-a.net)[0];
  const worst=[...ranked].sort((a,b)=>a.net-b.net)[0];
  return `<button class="big-btn income insight-ready" onclick="openMonthAnalysis('${best.m}')"><span class="insight-label">Mese migliore</span><small class="insight-size-spacer">${monthName(best.m)} · ${best.net>=0?'+':''}${euroFmt.format(best.net)}</small></button><button class="big-btn expense insight-ready" onclick="openMonthAnalysis('${worst.m}')"><span class="insight-label">Mese peggiore</span><small class="insight-size-spacer">${monthName(worst.m)} · ${worst.net>=0?'+':''}${euroFmt.format(worst.net)}</small></button>`;
}
function completedGoalsInMonth(ym){
  return completedGoals().filter(goal=>{
    if(goal.completionTransactionId){const t=state.transactions.find(x=>x.id===goal.completionTransactionId);if(t)return monthOf(t.date)===ym;}
    return monthOf(goal.completedAt||'')===ym;
  });
}
function monthCategoryTotals(ym,type){
  const out={};
  monthTx(ym).filter(t=>t.type===type).forEach(t=>{const c=canonicalCategory(t.category)||'Senza categoria';out[c]=(out[c]||0)+(Number(t.amount)||0)});
  return Object.entries(out).sort((a,b)=>b[1]-a[1]);
}
function openMonthAnalysis(ym){
  const inc=income(ym), out=expenses(ym), net=inc-out;
  const incomeCats=monthCategoryTotals(ym,'income'), expenseCats=monthCategoryTotals(ym,'expense');
  const previous=completedInsightMonths().filter(m=>m<ym);
  const avg=(values)=>values.length?sum(values)/values.length:null;
  const avgInc=previous.length?avg(previous.map(m=>income(m))):null;
  const avgOut=previous.length?avg(previous.map(m=>expenses(m))):null;
  const avgNet=previous.length?avg(previous.map(m=>income(m)-expenses(m))):null;
  const categoryAverage=(type,category)=>previous.length?avg(previous.map(m=>monthCategoryTotals(m,type).find(([c])=>c===category)?.[1]||0)):null;
  const anomalous=(rows,type)=>rows.map(([category,value])=>{
    const baseline=categoryAverage(type,category);
    return {category,value,baseline,excess:baseline===null?0:value-baseline};
  }).filter(x=>x.baseline!==null&&x.value>Math.max(x.baseline*1.5,x.baseline+50)).sort((a,b)=>b.excess-a.excess)[0]||null;
  const unusualExpense=anomalous(expenseCats,'expense');
  const unusualIncome=anomalous(incomeCats,'income');
  const pct=(value,base)=>base&&base!==0?Math.round((value-base)/Math.abs(base)*100):null;
  const netVsAvg=pct(net,avgNet), incVsAvg=pct(inc,avgInc), outVsAvg=pct(out,avgOut);
  const completedInMonth=completedGoalsInMonth(ym);
  const lines=[];
  if(net>=0){
    lines.push(`Mese chiuso in attivo di <b>${euroFmt.format(net)}</b>: una base positiva su cui costruire.`);
    if(avgNet!==null) lines.push(netVsAvg>=0?`Il saldo è <b>${Math.abs(netVsAvg)}% sopra</b> la media dei mesi precedenti.`:`Il saldo è <b>${Math.abs(netVsAvg)}% sotto</b> la media recente, ma resta comunque positivo.`);
    if(unusualIncome) lines.push(`Il risultato è stato sostenuto soprattutto da <b>${escapeHtml(unusualIncome.category)}</b>, un'entrata nettamente superiore al suo andamento abituale.`);
    else if(avgInc!==null&&avgOut!==null&&inc>=avgInc&&out<=avgOut) lines.push('Il risultato sembra legato a una combinazione virtuosa: entrate solide e uscite rimaste sotto controllo.');
    else if(unusualExpense) lines.push(`Nonostante un aumento anomalo di <b>${escapeHtml(unusualExpense.category)}</b>, hai comunque chiuso il mese in positivo.`);
    else if(avgInc!==null&&incVsAvg>0) lines.push('Le entrate hanno contribuito più del solito al buon risultato del mese.');
    lines.push('Consiglio: prova a distinguere ciò che è replicabile da ciò che è stato eccezionale e conserva il surplus come margine di sicurezza.');
  }else{
    lines.push(`Mese chiuso con un passivo di <b>${euroFmt.format(Math.abs(net))}</b>, ma il dato va letto insieme alle sue cause.`);
    if(unusualExpense) lines.push(`<b>${escapeHtml(unusualExpense.category)}</b> è cresciuta in modo anomalo rispetto alla sua media: potrebbe trattarsi di una spesa straordinaria più che di una cattiva abitudine.`);
    else if(avgInc!==null&&inc<avgInc) lines.push(`Le entrate sono state più basse del normale${incVsAvg!==null?` (${Math.abs(incVsAvg)}% sotto la media)`:''}, contribuendo al risultato negativo.`);
    if(!unusualExpense&&avgOut!==null&&out>avgOut) lines.push(`Le uscite sono aumentate rispetto alla media recente${outVsAvg!==null?` (${Math.abs(outVsAvg)}% in più)`:''}: qui vale la pena individuare le voci ricorrenti da alleggerire.`);
    else if(unusualExpense) lines.push('Se questa spesa non si ripeterà, il mese successivo potrebbe migliorare già senza tagli drastici.');
    if(previous.length===0) lines.push('Lo storico è ancora limitato: questa prima analisi fotografa il mese, e diventerà più precisa man mano che accumuli dati.');
    lines.push('Consiglio: separa le spese inevitabili da quelle rinviabili e intervieni prima sulle categorie che puoi ridurre senza peggiorare la tua qualità di vita.');
  }
  if(completedInMonth.length){
    const names=completedInMonth.map(g=>escapeHtml(g.name));
    lines.push(`${completedInMonth.length===1?`Hai anche portato a termine l'obiettivo <b>${names[0]}</b>.`: `Hai portato a termine <b>${completedInMonth.length} obiettivi</b>: ${names.join(', ')}.`} Questo è un risultato importante da leggere insieme al semplice saldo del mese.`);
    if(net<0)lines.push('Parte del risultato mensile va quindi interpretata come denaro trasformato in un obiettivo pianificato, non soltanto come una normale uscita.');
  }
  const catList=(arr,sign)=>arr.map(([c,v])=>`<div class="forecast-row"><span>${escapeHtml(c)}</span><b>${sign}${euroFmt.format(v)}</b></div>`).join('')||'<div class="forecast-row"><span>Nessuna voce</span><b>—</b></div>';
  openModal(`<div class="modal-head"><h2>Analisi di ${monthName(ym)}</h2><button class="close-btn" onclick="closeModal()">×</button></div><div class="analysis-box ${net>=0?'good':'watch'}" style="margin-top:16px"><p style="margin:0">${lines.join('<br><br>')}</p></div><div class="panel" style="margin-top:14px;padding:14px"><h3 style="margin-top:0">Riepilogo del mese</h3><div class="forecast-row"><span>Entrate</span><b class="positive">${euroFmt.format(inc)}</b></div><div class="forecast-row"><span>Uscite</span><b class="negative">${euroFmt.format(out)}</b></div><div class="forecast-row"><span>Saldo</span><b class="${net>=0?'positive':'negative'}">${euroFmt.format(net)}</b></div><h4 class="analysis-income-title">Entrate per categoria</h4>${catList(incomeCats,'+')}<h4 class="analysis-expense-title">Uscite per categoria</h4>${catList(expenseCats,'−')}</div><div class="modal-actions"><button class="primary-btn" onclick="closeModal()">Chiudi</button></div>`);
}

function dayCardMarkup(day,today=false){return `<div class="day-card ${today?'today':''}"><div class="day-name">${day.name}</div><div class="day-num">${day.day}</div><div class="day-month">${day.month}</div><div class="day-in positive">+€ ${weekAmount(day.inc)}</div><div class="day-out negative">-€ ${weekAmount(day.out)}</div><button class="day-plus" onclick="openTransaction('income','${day.key}')">＋</button></div>`}
function dashboard(){const months=availableDataMonths();if(!months.includes(state.dashboardMonth))state.dashboardMonth=months[months.length-1]||currentMonth();const ym=state.dashboardMonth, inc=income(ym), out=expenses(ym), sav=inc-out;const cats={};monthTx(ym).filter(t=>t.type==='expense').forEach(t=>{const c=canonicalCategory(t.category)||'Senza categoria';cats[c]=(cats[c]||0)+t.amount});const totalOut=out||1;const colors=['#7a21ff','#ff1675','#ff6247','#29e88b','#ffd34f','#ffe08a','#a93de7'];const entries=Object.entries(cats);const days=dashboardWeekDays();
return `<section class="page dashboard-page ${state.page==='dashboard'?'active':''}${dashboardWeekTransition?' week-changing':''}">
  <div class="hero">
    <img class="duck-art" src="assets/dashboard-mascot.png" alt="Mascotte di Matteo's Finance" />
    <img class="dashboard-logo" src="assets/dashboard-logo-red-2-transparent.png" alt="Matteo's Finance" />
    <div class="hero-actions"><button class="icon-btn" onclick="openSettings()" title="Impostazioni">⚙</button></div>
    <button type="button" class="month-select finance-choice-trigger" aria-label="Mese dashboard" onclick="openDashboardMonthPicker()">${monthNameShort(ym)} <span>▾</span></button>
    <div class="balance-card"><div class="balance-label-row"><div class="balance-label">TOTALE DISPONIBILE</div></div><div class="balance-value-row"><div class="balance-value">${euroFmt.format(balanceAtEndOfMonth(ym))}</div></div><div class="balance-delta"><span class="${sav>=0?'positive':'negative'}">${sav>=0?'↗':'↘'} ${euroFmt.format(sav)}</span> &nbsp; saldo del mese</div><div class="balance-buttons">${monthInsightButtons()}</div></div>
  </div>
  <div class="section"><div class="section-title week-title"><span>▣ SETTIMANA IN CORSO</span><span class="week-nav"><button type="button" onclick="shiftDashboardWeek(-1)" aria-label="Giorni precedenti">‹</button><button type="button" onclick="shiftDashboardWeek(1)" aria-label="Giorni successivi">›</button></span></div><div class="panel week-panel"><div class="week-viewport dashboard-week-swipe">${dashboardWeekTransition?`<div class="week-track week-transition-${dashboardWeekTransition.direction}">${(dashboardWeekTransition.direction==='next'?[dashboardWeekDays(dashboardWeekTransition.from),days]:[days,dashboardWeekDays(dashboardWeekTransition.from)]).map(week=>`<div class="week-pane"><div class="week-grid">${week.map(day=>dayCardMarkup(day,ym===currentMonth()&&day.key===todayIso())).join('')}</div></div>`).join('')}</div>`:`<div class="week-grid">${days.map(day=>dayCardMarkup(day,ym===currentMonth()&&day.key===todayIso())).join('')}</div>`}</div></div></div>
  <div class="stats-grid"><div class="stat-card green"><b><span class="stat-icon">↗</span> ENTRATE</b><strong>${euroFmt.format(inc)}</strong></div><div class="stat-card pink"><b><span class="stat-icon">↘</span> USCITE</b><strong>${euroFmt.format(out)}</strong></div><div class="stat-card blue"><b><span class="stat-icon coin-icon">€</span> RISPARMIO</b><strong>${euroFmt.format(sav)}</strong></div></div>
  <div class="panel chart-panel"><div><div class="section-title" style="margin:0 0 8px">RIPARTIZIONE USCITE</div><ul class="legend">${entries.map(([c,v],i)=>`<li><i class="dot" style="background:${colors[i%colors.length]}"></i><span>${c}</span><span>${Math.round(v/totalOut*100)}%</span><span>${euroFmt.format(v)}</span></li>`).join('')||'<li>Nessuna uscita</li>'}</ul></div><div style="position:relative;display:grid;place-items:center"><div class="donut" style="background:${donutGradient(entries,colors,totalOut)}"></div><div class="donut-center"><b>${euroFmt.format(out)}</b><small>Totale uscite</small></div></div></div>
</section>`}
function donutGradient(entries,colors,total){if(!entries.length)return '#172435';let acc=0;const s=entries.map(([_,v],i)=>{const a=acc;acc+=v/total*100;return `${colors[i%colors.length]} ${a}% ${acc}%`}).join(',');return `conic-gradient(${s})`}
function forecastExpenseCategories(ym){
  // La ripartizione deve usare esattamente la stessa logica del totale previsto:
  // tutti i mesi storici disponibili, escluso il mese in corso, più gli eventi futuri.
  const avg=averageCategoryTotals(ym,'expense').byCategory;
  const projected={};
  Object.entries(avg).forEach(([c,v])=>projected[c]=(projected[c]||0)+Number(v||0));
  futureEventsForMonth(ym).filter(e=>e.type==='expense'&&!(eventAlreadyRecorded(e))).filter(e=>ym!==currentMonth()||e.date>=todayIso()).forEach(e=>{const c=canonicalCategory(e.category)||'Senza categoria';projected[c]=(projected[c]||0)+(Number(e.amount)||0)});
  return Object.entries(projected).filter(([,v])=>v>0.005).sort((a,b)=>b[1]-a[1]);
}
function forecastChartData(){
  const start=currentMonth(); let m=start, out=[];
  for(let i=0;i<6;i++){out.push({m,value:forecast(m).endBalance});m=nextMonth(m)}
  return out;
}
function forecastChartMarkup(){
  const data=forecastChartData(), values=data.map(x=>x.value), cushion=Math.max(0,Number(state.cushionMinimum)||0);
  const rawMin=Math.min(...values,cushion),rawMax=Math.max(...values,cushion,1),padding=Math.max(50,(rawMax-rawMin)*.12);
  const min=Math.max(0,rawMin-padding),max=rawMax+padding,range=Math.max(1,max-min);
  const W=600,H=230,padLeft=76,padRight=20,padTop=18,padBottom=36;
  const y=v=>H-padBottom-((v-min)/range)*(H-padTop-padBottom);
  const x=i=>padLeft+(i*(W-padLeft-padRight)/Math.max(1,data.length-1));
  const points=data.map((d,i)=>`${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const cushionY=y(cushion).toFixed(1);
  const ticks=[max,max-(max-min)/2,min];
  const grid=ticks.map(v=>`<g><line x1="${padLeft}" x2="${W-padRight}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="forecast-grid-line"/><text x="${padLeft-10}" y="${y(v).toFixed(1)}" class="forecast-axis-label" text-anchor="end" dominant-baseline="middle">${euroFmt.format(v)}</text></g>`).join('');
  const labels=data.map((d,i)=>`<div class="forecast-chart-label" style="left:${(x(i)/W*100).toFixed(2)}%">${monthName(d.m).slice(0,3)}</div>`).join('');
  const endpointLabels=[0,data.length-1].filter((v,i,a)=>a.indexOf(v)===i).map(i=>`<text x="${x(i).toFixed(1)}" y="${Math.max(14,y(data[i].value)-12).toFixed(1)}" class="forecast-value-label" text-anchor="middle">${euroFmt.format(data[i].value)}</text>`).join('');
  return `<div class="forecast-chart-wrap"><div class="forecast-chart-summary"><span>Minimo <b>${euroFmt.format(Math.min(...values))}</b></span><span>Finale <b>${euroFmt.format(values.at(-1))}</b></span><span>🛡 Cuscinetto <b>${euroFmt.format(cushion)}</b></span></div><div class="forecast-chart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Andamento del saldo previsto">${grid}<line x1="${padLeft}" x2="${W-padRight}" y1="${cushionY}" y2="${cushionY}" class="cushion-line"/><text x="${W-padRight}" y="${Math.max(14,Number(cushionY)-7).toFixed(1)}" class="cushion-label" text-anchor="end">Cuscinetto</text><polyline points="${points}" class="forecast-line"/>${data.map((d,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(d.value).toFixed(1)}" r="5" class="forecast-point"><title>${monthName(d.m)}: ${euroFmt.format(d.value)}</title></circle>`).join('')}${endpointLabels}</svg><div class="forecast-chart-labels">${labels}</div></div></div>`;
}

function missingMonthsBefore(targetMonth){
  const start=state.startingCapitalMonth;
  if(!start||!targetMonth||targetMonth<=start)return [];
  const months=monthRange(start,targetMonth);
  if(months.length<=1)return [];
  return months.slice(1,-1).filter(m=>monthTx(m).length===0);
}
function latestRecordedMonth(){
  const months=state.transactions.map(t=>monthOf(t.date)).filter(Boolean).sort();
  return months.at(-1)||'';
}
function hasIncompleteHistory(){
  const latest=latestRecordedMonth();
  return !!latest&&missingMonthsBefore(latest).length>0;
}
function dataQualityWarningMarkup(){
  return hasIncompleteHistory()?'<div class="data-quality-warning">i dati visualizzati non sono affidabili</div>':'';
}
let pendingTransactionContinuation=null;
function cancelPendingTransaction(){pendingTransactionContinuation=null;closeModal()}
function continuePendingTransaction(){const fn=pendingTransactionContinuation;pendingTransactionContinuation=null;closeModal();if(fn)fn()}
function missingMonthRegistrationWarning(data,continueFn){
  const missing=missingMonthsBefore(monthOf(data.date));
  if(!missing.length){continueFn();return}
  const names=missing.map(monthName).join(', ');
  pendingTransactionContinuation=continueFn;
  openModal(`<div class="confirm-card data-quality-modal"><div class="confirm-icon">⚠</div><h2>Mensilità non compilate</h2><p>Stai registrando un movimento in <b>${escapeHtml(monthName(monthOf(data.date)))}</b>, ma risultano non compilate queste mensilità precedenti: <b>${escapeHtml(names)}</b>.</p><p>Ci risultano mensilità non compilate. Il calcolo delle previsioni e degli obiettivi non potrà essere esatto.</p><div class="modal-actions confirm-actions"><button type="button" class="secondary-btn" onclick="cancelPendingTransaction()">Annulla</button><button type="button" class="primary-btn" onclick="continuePendingTransaction()">Ignora e prosegui</button></div></div>`);
}
function forecasts(){
  const f=forecast(state.forecastMonth), cats=forecastExpenseCategories(state.forecastMonth);
  const catRows=cats.map(([c,v])=>`<div class="forecast-row"><span>${escapeHtml(c)}</span><b class="negative">${euroFmt.format(v)}</b></div>`).join('')||'<div class="empty">Non ci sono uscite previste per questo mese.</div>';
  return `<section class="page ${state.page==='forecasts'?'active':''}">${forecastHistoryCard()}<div class="page-head"><div><h1>Previsioni</h1></div><button class="icon-btn" onclick="openSettings()">⚙</button></div><div class="month-control"><button onclick="shiftForecast(-1)">‹</button><button type="button" class="month-choice-button" onclick="openForecastMonthPicker()">${monthNameShort(state.forecastMonth)} <span>▾</span></button><button onclick="shiftForecast(1)">›</button></div><div class="panel forecast-card"><h3 style="margin-top:0">Situazione prevista</h3>${dataQualityWarningMarkup()}<div class="forecast-row"><span>🟢 Entrate previste</span><b>${euroFmt.format(f.income)}</b></div><div class="forecast-row"><span>🔴 Uscite previste</span><b>${euroFmt.format(f.expenses)}</b></div><div class="forecast-row"><span>📉 Saldo mese</span><b class="${f.net>=0?'positive':'negative'}">${euroFmt.format(f.net)}</b></div><div class="forecast-row"><span>🏦 Totale stimato fine mese</span><b class="${f.endBalance>=0?'positive':'negative'}">${euroFmt.format(f.endBalance)}</b></div><div class="forecast-note">La previsione usa la <b>media dei mesi precedenti disponibili</b>, categoria per categoria, senza considerare i movimenti reali del mese in corso. Gli <b>eventi futuri</b> vengono aggiunti con il loro importo reale.</div></div><div class="panel forecast-category-panel"><h3>Ripartizione delle uscite previste</h3>${catRows}</div><div class="section-title">Eventi futuri <button class="primary-btn" onclick="openFutureEvent()">＋ Aggiungi evento</button></div><div class="events-list">${futureEventsForMonth(state.forecastMonth).map(eventRow).join('')||'<div class="empty">Nessun evento previsto per questo mese.</div>'}</div><div class="panel forecast-chart-panel"><h3>Andamento del saldo previsto</h3>${forecastChartMarkup()}</div></section>`
}
function monthOptions(){const known=availableDataMonths();return known.length?known:[currentMonth()]}
function setDashboardMonth(m){state.dashboardMonth=m;dashboardWeekOffset=currentDashboardWeekOffset();dashboardWeekTransition=null;save();render();requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'auto'}))}
function shiftForecast(n){state.forecastMonth=n>0?nextMonth(state.forecastMonth):prevMonth(state.forecastMonth);save();render();requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'auto'}))}
function futureEventsForMonth(ym){return state.futureEvents.filter(e=>monthOf(e.date)===ym)}

// --- Motore previsioni ---
// La previsione separa sempre tre cose: dati reali, media storica ed eventi già conosciuti.
function historicalMonthsBefore(ym){
  // Per non falsare la media con un mese ancora in corso, vengono usati i mesi
  // realmente conclusi e antecedenti al mese che stiamo stimando.
  const cutoff=ym===currentMonth()?ym:currentMonth();
  return [...new Set(state.transactions.map(t=>monthOf(t.date)))].filter(m=>m<cutoff&&m<ym).sort();
}
function canonicalCategory(value=''){
  const key=String(value).trim().toLocaleLowerCase('it-IT');
  // Compatibilità con i dati salvati prima della correzione del nome categoria.
  if(key==='spese')return 'Spesa';
  if(key==='benzina')return 'Auto';
  return String(value).trim();
}
function averageCategoryTotals(ym,type){
  const months=historicalMonthsBefore(ym);
  if(!months.length)return {total:0,byCategory:{},months:0};
  const byCategory={};
  months.forEach(m=>{
    monthTx(m).filter(t=>t.type===type).forEach(t=>{
      const category=canonicalCategory(t.category);
      byCategory[category]=(byCategory[category]||0)+(Number(t.amount)||0);
    });
  });
  Object.keys(byCategory).forEach(c=>byCategory[c]/=months.length);
  return {total:sum(Object.values(byCategory)),byCategory,months:months.length};
}
function todayIso(){const d=new Date();return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`}
function daysInMonth(ym){const [y,m]=ym.split('-').map(Number);return new Date(y,m,0).getDate()}
function remainingMonthFraction(ym){
  if(ym!==currentMonth())return 1;
  const today=todayIso();
  if(monthOf(today)!==ym)return 1;
  const day=Number(today.slice(-2));
  return Math.max(0,(daysInMonth(ym)-day+1)/daysInMonth(ym));
}
function normalizedDescription(value=''){return String(value).trim().toLocaleLowerCase('it-IT').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')}
function descriptionTokens(value=''){
  const stopWords=new Set(['di','del','della','delle','dei','il','lo','la','i','gli','le','un','una','per','da','a','al','alla','alle','ed','e','con','nel','nello','nella','sul','sulla']);
  const aliases={
    auto:'veicolo',automobile:'veicolo',macchina:'veicolo',meccanico:'veicolo',officina:'veicolo',revisione:'veicolo',tagliando:'veicolo',
    assicurazione:'assicurazione',polizza:'assicurazione',
    affitto:'affitto',locazione:'affitto',
    stipendio:'stipendio',salario:'stipendio',paga:'stipendio'
  };
  return normalizedDescription(value).split(' ').filter(Boolean).filter(token=>!stopWords.has(token)).map(token=>aliases[token]||token);
}
function descriptionsSimilarity(a='',b=''){
  const x=normalizedDescription(a),y=normalizedDescription(b);
  if(!x||!y)return 0;
  if(x===y)return 1;
  if(x.includes(y)||y.includes(x))return 0.9;
  const aTokens=[...new Set(descriptionTokens(a))],bTokens=[...new Set(descriptionTokens(b))];
  if(!aTokens.length||!bTokens.length)return 0;
  const shared=aTokens.filter(token=>bTokens.includes(token)).length;
  return shared?shared/Math.min(aTokens.length,bTokens.length):0;
}
function eventAlreadyRecorded(e){
  const description=normalizedDescription(e.description);
  if(!description)return false;
  return state.transactions.some(t=>monthOf(t.date)===monthOf(e.date)&&t.type===e.type&&normalizedDescription(t.description)===description);
}
function findMatchingFutureEvent(transaction){
  const candidates=state.futureEvents.filter(e=>e.type===transaction.type&&monthOf(e.date)===monthOf(transaction.date));
  let best=null;
  candidates.forEach(event=>{
    const similarity=descriptionsSimilarity(transaction.description||transaction.category,event.description||event.category);
    const sameCategory=canonicalCategory(transaction.category).toLocaleLowerCase('it-IT')===canonicalCategory(event.category).toLocaleLowerCase('it-IT');
    const score=Math.max(similarity,sameCategory&&similarity>0?Math.min(1,similarity+0.1):0);
    if(score>=0.5&&(!best||score>best.score))best={event,score};
  });
  return best;
}
function futureEventTotals(ym){
  const today=todayIso();
  const events=futureEventsForMonth(ym).filter(e=>{
    if(eventAlreadyRecorded(e))return false;
    return ym!==currentMonth()||e.date>=today;
  });
  return {
    income:sum(events.filter(e=>e.type==='income').map(e=>Number(e.amount)||0)),
    expenses:sum(events.filter(e=>e.type==='expense').map(e=>Number(e.amount)||0))
  };
}
function realMonthTotals(ym){
  const tx=monthTx(ym);
  return {
    income:sum(tx.filter(t=>t.type==='income').map(t=>Number(t.amount)||0)),
    expenses:sum(tx.filter(t=>t.type==='expense').map(t=>Number(t.amount)||0))
  };
}
function balanceAtStartOfMonth(ym){
  const from=state.startingCapitalMonth||'';
  const relevant=state.transactions.filter(t=>{const m=monthOf(t.date);return m<ym&&(!from||m>=from)});
  return (Number(state.startingCapital)||0)+sum(relevant.map(t=>t.type==='income'?(Number(t.amount)||0):-(Number(t.amount)||0)));
}
function normalForecastForMonth(ym){
  // La previsione è indipendente dai movimenti reali del mese in corso.
  // Per il mese corrente stimiamo l'intero mese sulla base dei mesi precedenti disponibili.
  const factor=1;
  const forecastType=type=>{
    const avg=averageCategoryTotals(ym,type);
    let total=0;
    Object.values(avg.byCategory).forEach(value=>{total+=value*factor});
    return {total,months:avg.months};
  };
  const inc=forecastType('income'),out=forecastType('expense');
  return {income:inc.total,expenses:out.total,historicalMonths:Math.max(inc.months,out.months)};
}
function forecastComponents(ym){
  const normal=normalForecastForMonth(ym);
  const events=futureEventTotals(ym);
  const income=normal.income+events.income;
  const expenses=normal.expenses+events.expenses;
  return {income,expenses,net:income-expenses,normal,events,actual:{income:0,expenses:0}};
}
function forecastSnapshotForMonth(ym){
  const previous=prevMonth(ym);
  const income=normalForecastForMonth(ym).income+futureEventTotals(ym).income;
  const expenses=normalForecastForMonth(ym).expenses+futureEventTotals(ym).expenses;
  return {income,expenses,net:income-expenses,sourceMonth:previous};
}
function ensureForecastHistory(){
  const current=currentMonth(), previous=prevMonth(current);
  if(!state.forecastHistory||typeof state.forecastHistory!=='object')state.forecastHistory={};
  if(!state.forecastHistory[previous]){
    const snapshot=forecastSnapshotForMonth(previous);
    // Per il primo mese senza uno snapshot storico, usiamo la previsione ricostruibile
    // con i mesi precedenti disponibili. Da qui in avanti il valore resta congelato.
    state.forecastHistory[previous]={income:snapshot.income,expenses:snapshot.expenses,net:snapshot.net,createdAt:new Date().toISOString()};
    save();
  }
}
function forecastHistoryCard(){
  const day=Number(todayIso().slice(-2));
  if(day>7)return '';
  const previous=prevMonth(currentMonth());
  const h=state.forecastHistory?.[previous];
  if(!h)return '';
  const actual=realMonthTotals(previous),diff=actual.income-actual.expenses-(Number(h.net)||0);
  const tone=diff>=0?'good':'watch';
  const sign=diff>=0?'+':'';
  return `<div class="analysis-box ${tone} forecast-history-card"><h3 style="margin-top:0">📊 Come è andato ${monthNameShort(previous)}</h3><div class="forecast-row"><span>Risparmio previsto</span><b>${euroFmt.format(h.net)}</b></div><div class="forecast-row"><span>Risparmio reale</span><b>${euroFmt.format(actual.income-actual.expenses)}</b></div><div class="forecast-row"><span>Differenza</span><b class="${diff>=0?'positive':'negative'}">${sign}${euroFmt.format(diff)}</b></div><p>${diff>=0?'Hai risparmiato più del previsto.':'Hai risparmiato meno del previsto.'}</p></div>`;
}
ensureForecastHistory();
function forecast(ym){
  const base=currentMonth();
  // Per i mesi già conclusi mostriamo il dato reale, senza inventare previsioni.
  if(ym<base){
    const actual=realMonthTotals(ym);
    return {income:actual.income,expenses:actual.expenses,net:actual.income-actual.expenses,endBalance:balanceAtEndOfMonth(ym),normal:{income:0,expenses:0},events:{income:0,expenses:0},actual};
  }
  let running=balanceAtStartOfMonth(base);
  let m=base;
  let result=null;
  while(m<=ym){
    const parts=forecastComponents(m);
    running+=parts.net;
    if(m===ym)result={...parts,endBalance:running};
    m=nextMonth(m);
  }
  return result||{income:0,expenses:0,net:0,endBalance:running};
}
const ICON_BASE_PATH='assets/icons/';
const ICONS={
  travel:'1_viaggi.webp', flight:'2_aereo.webp', beach:'3_mare.webp', mountain:'4_montagna.webp', hotel:'5_hotel.webp', camping:'6_campeggio.webp', concert:'7_concerto.webp', bar:'61_bar.webp', theatre:'9_teatro.webp', gym:'10_palestra.webp', car:'11_automobile.webp', repair:'12_meccanico.webp', carIssue:'13_guasto_auto.webp', fuel:'14_benzina.webp', driving:'15_viaggio_in_auto.webp', train:'16_treno.webp', cruise:'17_nave.webp', house:'18_casa.webp', appliances:'19_elettrodomestici.webp', gas:'20_gas.webp', light:'21_luce.webp', internet:'22_internet.webp', bills:'23_bollette.webp', charity:'24_donazione.webp', moving:'25_trasloco.webp', tools:'26_riparazione.webp', gift:'27_regalo.webp', love:'28_amore.webp', health:'29_salute.webp', doctor:'30_medico.webp', dentist:'31_dentista.webp', family:'32_mamma.webp', healthHeart:'33_elettrocardiogramma.webp', mushrooms:'34_funghi_allucinogeni.webp', pet:'35_gatto.webp', vet:'36_veterinario.webp', pharmacy:'37_farmacia.webp', sunglasses:'38_occhiali_da_sole.webp', shopping:'39_acquisti_importanti.webp', electronics:'40_tecnologia.webp', house2:'41_casa.webp', target:'42_obiettivo.webp', wallet:'43_rimborso.webp', party:'44_party.webp', holiday:'45_ferie.webp', christmas:'46_natale.webp', newYear:'47_capodanno.webp', easter:'48_pasqua.webp', ferragosto:'49_ferragosto.webp', dinner:'50_ristorante.webp', aperitivo:'51_aperitivo.webp', restaurant:'50_ristorante.webp', wedding:'53_matrimonio.webp', mourning:'54_lutto.webp', taxes:'55_tasse.webp',
  messico:'101_Messico.webp', usa:'102_Stati_Uniti.webp', lituania:'103_Lituania.webp', lettonia:'104_Lettonia.webp', estonia:'105_Estonia.webp', slovacchia:'106_Slovacchia.webp', albania:'107_Albania.webp', islanda:'108_Islanda.webp', finlandia:'109_Finlandia.webp', giappone:'110_Giappone.webp', norvegia:'111_Norvegia.webp', svezia:'112_Svezia.webp', danimarca:'113_Danimarca.webp', polonia:'114_Polonia.webp', belgio:'121_Belgio.webp', svizzera:'122_Svizzera.webp', romania:'123_Romania.webp', bulgaria:'124_Bulgaria.webp', slovenia:'125_Slovenia.webp', malta:'126_Malta.webp', ungheria:'127_Ungheria.webp', repubblicaCeca:'128_Repubblica_Ceca.webp', croazia:'129_Croazia.webp', portogallo:'130_Portogallo.webp', austria:'131_austria.webp', grecia:'132_grecia.webp', turchia:'133_turchia.webp', italia:'134_italia.webp', spagna:'135_spagna.webp', francia:'136_francia.webp', germania:'137_germania.webp',
  stadio:'138_stadio.webp', sport:'139_sport.webp', museo:'140_museo.webp', pallavolo:'141_pallavolo.webp', calcio:'142_calcio.webp', basket:'143_basket.webp', surf:'144_surf.webp', bilancia:'100_bilancia.webp', rugby:'146_rugby.webp', libri:'147_libri.webp', musica:'148_musica.webp', aperitivoNamed:'149_aperitivo.webp', pizza:'150_pizza.webp', cucinaCinese:'151_cucina_cinese.webp', hamburger:'152_hamburger.webp', irlanda:'153_irlanda.webp', uk:'67_inghilterra.webp', albania:'107_Albania.webp', thailandia:'68_thailandia.webp', cina:'69_cina.webp', malaysia:'70_malesia.webp', canada:'71_canada.webp', hongKong:'72_hong_kong.webp', australia:'73_australia.webp', vietnam:'74_vietnam.webp', india:'76_india.webp', singapore:'77_singapore.webp', marocco:'78_marocco.webp', egitto:'79_egitto.webp', sudafrica:'80_sudafrica.webp', repubblicaDominicana:'81_repubblica_dominicana.webp', brasile:'82_brasile.webp', portoRico:'83_porto_rico.webp', cile:'84_cile.webp', argentina:'85_argentina.webp', colombia:'86_colombia.webp', peru:'87_peru.webp', costaRica:'88_costa_rica.webp', cuba:'89_cuba.webp', russia:'90_russia.webp', giamaica:'91_giamaica.webp', bahamas:'92_bahamas.webp', filippine:'93_filippine.webp', cambogia:'94_cambogia.webp', nuovaZelanda:'95_nuova_zelanda.webp', fiji:'96_fiji.webp', piante:'97_piante.webp', multa:'56_multa.webp', creditCard:'57_carta_di_credito.webp', carTax:'58_bollo_auto.webp', carInsurance:'59_assicurazione_auto.webp',
};
function iconImg(file,extraClass=''){
  return `<img class="finance-icon-img ${extraClass}" src="${ICON_BASE_PATH}${file}" alt="" aria-hidden="true" loading="lazy" decoding="async">`;
}
function normalizeIconText(value=''){
  return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}
function semanticIconFile(description='',category='',type=''){
  const raw=String(description||'').trim();
  if(!raw)return '';

  const normalize=(value='')=>String(value||'').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[’']/g,"'").replace(/[^\p{L}\p{N}\s]/gu,' ')
    .replace(/\s+/g,' ').trim();
  const text=normalize(raw);
  const hasWord=(word)=>new RegExp(`(^|\\s)${normalize(word).replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}(?=\\s|$)`,'u').test(text);
  const hasAny=(words)=>words.some(hasWord);
  const hasPhrase=(phrases)=>phrases.some(p=>text.includes(normalize(p)));

  // Gerarchia intenzionale:
  // 1) nomi/entità specifiche; 2) luoghi; 3) soggetto/concetto; 4) freccia ↑/↓.
  // Una corrispondenza più generica non può scavalcare una più specifica.

  // 1. Nomi / entità specifiche. Sono controllati prima di luoghi e concetti.
  // Qui entrano solo entità per le quali la libreria possiede davvero un'icona.
  const namedEntities=[
    // Esempi futuri: ['nome entita',['varianti'],ICONS.nome]
  ];
  for(const [,variants,file] of namedEntities){
    if(file&&hasPhrase(variants))return file;
  }

  // 2. Paesi e località. Se il nome del luogo è presente, vince sui concetti generici.
  const places=[
    ['irlanda',['dublino','irlanda'],ICONS.irlanda],
    ['uk',['londra','inghilterra','regno unito','uk','united kingdom'],ICONS.uk],
    ['germania',['berlino','germania'],ICONS.germania],
    ['italia',['roma','italia','sardegna','valledoria'],ICONS.italia],
    ['spagna',['madrid','spagna'],ICONS.spagna],
    ['francia',['parigi','francia'],ICONS.francia],
    ['portogallo',['lisbona','portogallo'],ICONS.portogallo],
    ['austria',['vienna','austria'],ICONS.austria],
    ['grecia',['atene','grecia'],ICONS.grecia],
    ['turchia',['istanbul','turchia'],ICONS.turchia],
    ['croazia',['zagabria','croazia'],ICONS.croazia],
    ['repubblicaCeca',['praga','repubblica ceca'],ICONS.repubblicaCeca],
    ['ungheria',['budapest','ungheria'],ICONS.ungheria],
    ['polonia',['varsavia','polonia'],ICONS.polonia],
    ['slovacchia',['bratislava','slovacchia'],ICONS.slovacchia],
    ['slovenia',['lubiana','slovenia'],ICONS.slovenia],
    ['islanda',['reykjavik','islanda'],ICONS.islanda],
    ['norvegia',['oslo','norvegia'],ICONS.norvegia],
    ['svezia',['stoccolma','svezia'],ICONS.svezia],
    ['danimarca',['copenaghen','danimarca'],ICONS.danimarca],
    ['finlandia',['helsinki','finlandia'],ICONS.finlandia],
    ['lituania',['vilnius','lituania'],ICONS.lituania],
    ['lettonia',['riga','lettonia'],ICONS.lettonia],
    ['estonia',['tallinn','estonia'],ICONS.estonia],
    ['belgio',['bruxelles','belgio'],ICONS.belgio],
    ['romania',['bucarest','bucharest','romania'],ICONS.romania],
    ['bulgaria',['sofia','bulgaria'],ICONS.bulgaria],
    ['malta',['malta'],ICONS.malta],
    ['messico',['messico'],ICONS.messico],
    ['usa',['stati uniti','usa','new york','america'],ICONS.usa],
    ['giappone',['giappone','tokyo','kyoto'],ICONS.giappone],
    ['cina',['cina','pechino','shanghai'],ICONS.cina],
    ['canada',['canada','toronto','vancouver'],ICONS.canada],
    ['thailandia',['thailandia','bangkok'],ICONS.thailandia],
    ['vietnam',['vietnam'],ICONS.vietnam],
    ['indonesia',['indonesia','bali'],ICONS.indonesia],
    ['india',['india'],ICONS.india],
    ['singapore',['singapore'],ICONS.singapore],
    ['marocco',['marocco'],ICONS.marocco],
    ['egitto',['egitto'],ICONS.egitto],
    ['sudafrica',['sudafrica','sud africa'],ICONS.sudafrica],
    ['brasile',['brasile'],ICONS.brasile],
    ['cile',['cile'],ICONS.cile],
    ['argentina',['argentina'],ICONS.argentina],
    ['colombia',['colombia'],ICONS.colombia],
    ['peru',['peru'],ICONS.peru],
    ['costaRica',['costa rica'],ICONS.costaRica],
    ['cuba',['cuba'],ICONS.cuba],
    ['giamaica',['giamaica'],ICONS.giamaica],
    ['bahamas',['bahamas'],ICONS.bahamas],
    ['filippine',['filippine'],ICONS.filippine],
    ['cambogia',['cambogia'],ICONS.cambogia],
    ['nuovaZelanda',['nuova zelanda'],ICONS.nuovaZelanda],
    ['fiji',['fiji'],ICONS.fiji],
    ['portoRico',['porto rico'],ICONS.portoRico],
    ['hongKong',['hong kong'],ICONS.hongKong],
    ['malaysia',['malaysia'],ICONS.malaysia],
    ['australia',['australia'],ICONS.australia]
  ];
  for(const [,words,file] of places){
    if(file&&hasAny(words))return file;
  }

  // 3. Soggetto / concetto. L'ordine è volutamente specifico -> generico.
  const concepts=[
    [['lampadina','lampade','lampada','luce','luci'],ICONS.light],
    [['bilanciare','bilancia','pareggiare','pareggia','equilibrare','equilibrio','bilancio'],ICONS.bilancia],
    [['benzina','carburante','rifornimento','rifornire','diesel'],ICONS.fuel],
    [['aereo','aeroporto','volo','volare','voli'],ICONS.flight],
    [['treno','treni','ferrovia','ferroviario'],ICONS.train],
    [['crociera','crociere'],ICONS.cruise],
    [['hotel','albergo','alloggio','b&b','bed','pensione'],ICONS.hotel],
    [['campeggio','campeggiare','tenda'],ICONS.camping],
    [['palestra','allenamento','fitness','gym'],ICONS.gym],
    [['medico','dottore','visita medica','specialista'],ICONS.doctor],
    [['dentista','dentale'],ICONS.dentist],
    [['farmacia','farmaci','farmaco','medicinale','medicinali'],ICONS.pharmacy],
    [['veterinario','veterinaria'],ICONS.vet],
    [['multa','multe','sanzione','sanzioni'],ICONS.multa],
    [['carta di credito','carta credito','credit card'],ICONS.creditCard],
    [['bollo auto','bollo macchina'],ICONS.carTax],
    [['assicurazione auto','assicurazione macchina'],ICONS.carInsurance],
    [['meccanico','riparazione auto','gommista','officina'],ICONS.repair],
    [['elettrodomestico','elettrodomestici','frigorifero','lavatrice','forno'],ICONS.appliances],
    [['gas','metano'],ICONS.gas],
    [['internet','wifi','wi fi','fibra','adsl'],ICONS.internet],
    [['bolletta','bollette','utenze','utenza'],ICONS.bills],
    [['trasloco','traslocare'],ICONS.moving],
    [['attrezzi','utensili','ferramenta'],ICONS.tools],
    [['donazione','donazioni','beneficenza'],ICONS.charity],
    [['regalo','regali','omaggio'],ICONS.gift],
    [['matrimonio','matrimoni','nozze'],ICONS.wedding],
    [['natale','christmas'],ICONS.christmas],
    [['capodanno','anno nuovo'],ICONS.newYear],
    [['pasqua'],ICONS.easter],
    [['ferragosto'],ICONS.ferragosto],
    [['compleanno','compleanni','festa','feste','party'],ICONS.party],
    [['pizza','pizze'],ICONS.pizza],
    [['hamburger','burger'],ICONS.hamburger],
    [['aperitivo','aperitivi','cocktail'],ICONS.aperitivo],
    [['ristorante','ristorazione'],ICONS.restaurant],
    [['cena','cenare','pranzo','pranzare'],ICONS.dinner],
    [['concerto','concerti','live','spettacolo musicale'],ICONS.concert],
    [['musica','musicale','heavy metal','metal'],ICONS.musica],
    [['stadio'],ICONS.stadio],
    [['pallavolo','volley'],ICONS.pallavolo],
    [['calcio'],ICONS.calcio],
    [['basket','pallacanestro'],ICONS.basket],
    [['surf','surfing'],ICONS.surf],
    [['rugby'],ICONS.rugby],
    [['sport'],ICONS.sport],
    [['museo','musei'],ICONS.museo],
    [['libro','libri'],ICONS.libri],
    [['cucina cinese'],ICONS.cucinaCinese],
    [['bar','pub'],ICONS.bar],
    [['teatro'],ICONS.theatre],
    [['spiaggia','mare','balneare','bagno'],ICONS.beach],
    [['montagna','montagne','trekking','escursione','escursioni'],ICONS.mountain],
    [['viaggio','viaggi','vacanza','vacanze','ferie','weekend','tour'],ICONS.travel],
    [['casa','abitazione','appartamento'],ICONS.house],
    [['amore','fidanzata','fidanzato','coppia','anniversario'],ICONS.love],
    [['salute','benessere'],ICONS.health],
    [['famiglia','figlio','figlia','genitori'],ICONS.family],
    [['funghi','fungo'],ICONS.mushrooms],
    [['animale','animali','gatto','gatti','cane','cani'],ICONS.pet],
    [['veterinario'],ICONS.vet],
    [['occhiali da sole','occhiali'],ICONS.sunglasses],
    [['shopping','acquisti','acquisto','negozio'],ICONS.shopping],
    [['elettronica','computer','pc','telefono','smartphone','tablet'],ICONS.electronics],
    [['obiettivo','obiettivi','traguardo'],ICONS.target],
    [['portafoglio','soldi','denaro','contanti'],ICONS.wallet],
    [['tasse','imposte','f24','tributi'],ICONS.taxes],
    [['guidare','guida','automobile','macchina','auto'],ICONS.driving]
  ];
  for(const [words,file] of concepts){
    if(file&&hasAny(words))return file;
  }

  return '';
}

function movementDirectionIcon(type=''){
  return type==='income'
    ? '<span class="movement-direction-icon movement-direction-income" aria-hidden="true">↑</span>'
    : '<span class="movement-direction-icon movement-direction-expense" aria-hidden="true">↓</span>';
}
function eventIcon(description='',category='',type=''){
  // Movimenti: la descrizione è l'unica fonte per l'icona semantica.
  // Se la descrizione è vuota OPPURE non viene riconosciuto alcun termine,
  // il fallback è sempre la freccia coerente con entrata/uscita.
  const raw=String(description||'').trim();
  if(!raw)return movementDirectionIcon(type);
  const file=semanticIconFile(raw);
  return file ? iconImg(file) : movementDirectionIcon(type);
}

function eventRow(e){const tone=e.type==='income'?'income':'expense';return `<div class="event-swipe-wrap" data-event-id="${e.id}"><div class="event-swipe-action" onclick="requestDeleteFutureEvent('${e.id}')"><span>⌫</span><small>Elimina</small></div><div class="event-row event-${tone} swipeable-event"><div class="event-icon">${eventIcon(e.description,e.category,e.type)}</div><div class="event-meta"><b class="editable-title" onclick="openFutureEvent('${e.id}')">${escapeHtml(e.description)}</b><small>${displayDate(e.date)} · ${e.category}</small></div><div class="event-actions"><strong class="${e.type==='income'?'positive':'negative'}">${e.type==='income'?'+':'-'}${euroFmt.format(e.amount)}</strong></div></div></div>`}
function goals(){const active=activeGoals(),completed=completedGoals(),archived=archivedGoals(),showCompleted=state.goalTab==='completed',showArchived=state.goalTab==='archived';const archivedRows=archived.map(g=>`<button type="button" class="archived-goal-row" onclick="openArchivedGoal('${g.id}')"><span>${escapeHtml(g.name)}</span><span>›</span></button>`).join('');return `<section class="page ${state.page==='goals'?'active':''}"><div class="page-head"><div><h1>Obiettivi</h1></div><button class="icon-btn" onclick="openSettings()">⚙</button></div><button class="primary-btn" style="width:100%;font-size:18px" onclick="openGoal()">＋ Nuovo obiettivo</button>${dataQualityWarningMarkup()}<div class="goal-tabs"><button class="${!showCompleted&&!showArchived?'active':''}" onclick="setGoalTab('active')">In corso (${active.length})</button><button id="completedGoalsTab" class="${showCompleted?'active':''}" onclick="setGoalTab('completed')">Completati (${completed.length})</button><button class="${showArchived?'active':''}" onclick="setGoalTab('archived')">Archiviati (${archived.length})</button></div><div class="goals-list">${showArchived?(archivedRows||'<div class="empty">Nessun obiettivo archiviato.</div>'):showCompleted?(completed.map(completedGoalCard).join('')||'<div class="empty">Nessun obiettivo completato.</div>'):(active.map(goalCard).join('')||'<div class="empty">Non hai ancora obiettivi in corso.</div>')}</div></section>`}
function goalVisual(name){
  // Per le card Obiettivo l'icona continua a dipendere esclusivamente dalla descrizione.
  return iconImg(semanticIconFile(name,'','expense'),'goal-visual-img');
}
function goalPriorityWeight(priority='media'){return priority==='alta'?4:priority==='media'?2:1}
function goalDeadlineMonth(g){const d=new Date(g.deadline+'T12:00:00');return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`}
function isGoalCompleted(g){return !!g.completed}
function isGoalArchived(g){return !!g.archived}
function activeGoals(){return state.goals.filter(g=>!isGoalCompleted(g)&&!isGoalArchived(g))}
function completedGoals(){return state.goals.filter(g=>isGoalCompleted(g)&&!isGoalArchived(g))}
function archivedGoals(){return state.goals.filter(g=>isGoalCompleted(g)&&isGoalArchived(g))}
function daysBetweenDates(a,b){const x=new Date(a+'T12:00:00'),y=new Date(b+'T12:00:00');return Math.round(Math.abs(x-y)/(24*60*60*1000))}
function goalMovementChecks(transaction,goal){
  const date=daysBetweenDates(transaction.date,goal.deadline)<=30;
  const goalCost=Math.max(0.01,Number(goal.cost)||0.01),amount=Number(transaction.amount)||0;
  const cost=amount>=goalCost*.75&&amount<=goalCost*1.25;
  const similarity=descriptionsSimilarity(transaction.description,goal.name);
  const description=similarity>=.5;
  return {date,cost,description,similarity,count:[date,cost,description].filter(Boolean).length};
}
function findMatchingGoal(transaction){
  if(transaction.type!=='expense'||canonicalCategory(transaction.category)!=='Obiettivi'||!transaction.description)return null;
  let best=null;
  activeGoals().forEach(goal=>{
    const checks=goalMovementChecks(transaction,goal);
    if(checks.count<2)return;
    const score=checks.count*10+checks.similarity+(checks.date?1:0)+(checks.cost?1:0);
    if(!best||score>best.score)best={goal,checks,score};
  });
  return best;
}
function hasObjectiveMovementForGoal(goal){
  return state.transactions.some(t=>t.type==='expense'&&canonicalCategory(t.category)==='Obiettivi'&&goalMovementChecks(t,goal).count>=2);
}
function markGoalForVictory(goalId,source,transactionId=''){
  const goal=state.goals.find(g=>g.id===goalId);if(!goal||goal.completed||goal.completionPending)return false;
  goal.completionPending=true;goal.completionSource=source;if(transactionId)goal.completionTransactionId=transactionId;
  save();return true;
}
function goalMovementIcon(transaction){return iconImg(ICONS.target,'goal-movement-img')}
function restoreGoalsLinkedToTransactions(transactions){
  const ids=new Set(transactions.map(t=>t&&t.id).filter(Boolean));
  if(!ids.size)return;
  state.goals.forEach(goal=>{if(ids.has(goal.completionTransactionId)){goal.completed=false;goal.completionPending=false;goal.completionSource='';goal.completionTransactionId='';goal.completedAt='';}});
}
function addMonths(ym,count){let out=ym;for(let i=0;i<count;i++)out=nextMonth(out);return out}
function goalRealAllocation(){
  const active=activeGoals().filter(g=>Number(g.cost)>0).map(g=>({...g,realAllocated:0}));
  const minimum=Math.max(0,Number(state.cushionMinimum)||0);
  let pool=Math.max(0,balanceAtEndOfMonth(currentMonth())-minimum);
  const ranked=[...active].sort((a,b)=>{const p=goalPriorityWeight(b.priority)-goalPriorityWeight(a.priority);return p||goalDeadlineMonth(a).localeCompare(goalDeadlineMonth(b))});
  ranked.forEach(g=>{if(pool<=0)return;const amount=Math.min(pool,Math.max(0,Number(g.cost)||0));g.realAllocated=amount;pool-=amount});
  return Object.fromEntries(active.map(g=>[g.id,Math.min(Number(g.cost)||0,g.realAllocated)]));
}
function goalMonthsLeft(g,from=currentMonth()){
  const deadlineMonth=goalDeadlineMonth(g);
  const startMonth=(g.startDate&&monthOf(g.startDate)>from)?monthOf(g.startDate):from;
  if(startMonth>deadlineMonth)return 0;
  const months=(Number(deadlineMonth.slice(0,4))-Number(startMonth.slice(0,4)))*12+(Number(deadlineMonth.slice(5,7))-Number(startMonth.slice(5,7)))+1;
  return Math.max(0,months);
}
function goalPlan(){
  const active=activeGoals().filter(g=>Number(g.cost)>Number(g.saved)).map(g=>({...g,plannedSaved:Number(g.saved)||0,allocated:0,missed:false}));
  const plans={};
  active.forEach(g=>plans[g.id]={total:Number(g.saved)||0,monthly:{},cushion:0});
  if(!active.length)return {plans,cushionMinimum:Math.max(0,Number(state.cushionMinimum)||0),cushionIdeal:Math.max(0,Number(state.cushionIdeal)||0),months:[]};

  const min=Math.max(0,Number(state.cushionMinimum)||0);
  const ideal=Math.max(min,Number(state.cushionIdeal)||0);
  const lastDeadline=active.map(goalDeadlineMonth).sort().at(-1);
  const start=currentMonth();
  // Estendiamo la simulazione oltre l'ultima scadenza per stimare anche quando un obiettivo in ritardo potrà essere raggiunto.
  const horizon=addMonths(lastDeadline,60);
  const months=monthRange(start,horizon);
  let projectedBalance=balanceAtStartOfMonth(start);
  let protectedCushion=Math.min(Math.max(0,projectedBalance),ideal);
  // La previsione viene calcolata una sola volta in sequenza: gli stessi valori di forecast(),
  // senza ricostruire da capo tutti i mesi precedenti ad ogni passaggio della simulazione.
  let forecastRunningBalance=balanceAtStartOfMonth(start);

  months.forEach(ym=>{
    const forecastParts=forecastComponents(ym);
    forecastRunningBalance+=forecastParts.net;
    const f={...forecastParts,endBalance:forecastRunningBalance};
    const monthIncome=Math.max(0,Number(f.income)||0);
    const monthNet=Math.max(0,Number(f.net)||0);
    projectedBalance+=Number(f.net)||0;
    const eligible=active.filter(g=>g.plannedSaved<g.cost);
    let availableForGoals=0;

    // Senza entrate nel mese non viene erogata alcuna quota agli obiettivi.
    if(monthIncome>0&&monthNet>0&&eligible.length){
      // Prima viene protetto il cuscinetto minimo. Se il saldo previsto non lo raggiunge,
      // l'intero risparmio del mese serve a ricostruirlo.
      if(projectedBalance>min){
        let safeSurplus=Math.min(monthNet,Math.max(0,projectedBalance-min));
        if(ideal>min&&projectedBalance<ideal){
          // Tra minimo e ideale: metà del nuovo risparmio rafforza il cuscinetto,
          // l'altra metà resta disponibile per gli obiettivi.
          const towardIdeal=Math.min(safeSurplus/2,Math.max(0,ideal-protectedCushion));
          protectedCushion=Math.min(ideal,protectedCushion+towardIdeal);
          safeSurplus=Math.max(0,safeSurplus-towardIdeal);
        }else{
          protectedCushion=Math.min(ideal,Math.max(protectedCushion,min));
        }
        availableForGoals=safeSurplus;
      }
    }

    if(availableForGoals>0&&eligible.length){
      const ranked=[...eligible].sort((a,b)=>{
        const pa=goalPriorityWeight(a.priority),pb=goalPriorityWeight(b.priority);
        if(pb!==pa)return pb-pa;
        const da=goalDeadlineMonth(a),db=goalDeadlineMonth(b);
        if(da!==db)return da.localeCompare(db);
        const ra=(a.cost-a.plannedSaved)/Math.max(1,goalMonthsLeft(a,ym));
        const rb=(b.cost-b.plannedSaved)/Math.max(1,goalMonthsLeft(b,ym));
        return rb-ra;
      });
      // Prima proviamo a finanziare la quota minima necessaria, in ordine di priorità.
      let pool=availableForGoals;
      ranked.forEach(g=>{
        if(pool<=0)return;
        const monthsLeft=Math.max(1,goalMonthsLeft(g,ym));
        const needNow=Math.max(0,(g.cost-g.plannedSaved)/monthsLeft);
        const amount=Math.min(pool,needNow,g.cost-g.plannedSaved);
        g.plannedSaved+=amount;g.allocated+=amount;plans[g.id].total+=amount;plans[g.id].monthly[ym]=(plans[g.id].monthly[ym]||0)+amount;pool-=amount;
      });
      // Eventuale surplus: sempre prima alla priorità più alta e alla scadenza più vicina.
      ranked.forEach(g=>{
        if(pool<=0)return;
        const amount=Math.min(pool,g.cost-g.plannedSaved);
        g.plannedSaved+=amount;g.allocated+=amount;plans[g.id].total+=amount;plans[g.id].monthly[ym]=(plans[g.id].monthly[ym]||0)+amount;pool-=amount;
      });
    }
  });

  active.forEach(g=>{
    let running=Number(g.saved)||0, completionMonth='', deadlineReachable=false;
    months.forEach(ym=>{running+=Number(plans[g.id].monthly[ym]||0);if(!completionMonth&&running+0.005>=g.cost)completionMonth=ym;if(ym===goalDeadlineMonth(g))deadlineReachable=running+0.005>=g.cost});
    plans[g.id].reachable=deadlineReachable;
    plans[g.id].completionMonth=completionMonth;
    plans[g.id].plannedSaved=plans[g.id].total
  });
  return {plans,cushionMinimum:min,cushionIdeal:ideal,months};
}
function goalCard(g){
  const a=analyseGoal(g);
  const predicted=Math.min(g.cost,Math.max(0,a.predictedByDeadline));
  const pct=Math.min(100,predicted/g.cost*100);
  return `<div class="goal-swipe-wrap" data-goal-id="${g.id}"><div class="swipe-delete-action" onclick="requestDeleteGoal('${g.id}')"><span>⌫</span><small>Elimina</small></div><div class="goal-card swipeable-goal"><div class="goal-content"><div class="goal-top"><div><h3 class="editable-title" onclick="openGoal('${g.id}')">${escapeHtml(g.name)} <b class="positive goal-cost">${euroFmt.format(g.cost)}</b></h3><p>Dal ${displayDate(g.startDate||todayIso())} al ${displayDate(g.deadline)}</p><p>Priorità ${g.priority}</p></div><div class="goal-side"><span class="status ${a.status}">${a.label}</span><div class="goal-visual" aria-hidden="true">${goalVisual(g.name)}</div></div></div><div class="progress" title="Avanzamento stimato dalle previsioni"><i style="width:${pct}%"></i></div><div class="goal-foot"><span>Previsto</span><span>${Math.round(pct)}%</span><span>${euroFmt.format(predicted)}</span></div><div class="goal-actions"><button class="secondary-btn" style="flex:1" onclick="openGoalAnalysis('${g.id}')">Analizza</button><button class="secondary-btn" style="flex:1" onclick="openGoalNotes('${g.id}')">Tieni nota</button></div></div></div></div>`
}
function setGoalTab(tab){state.goalTab=tab==='completed'||tab==='archived'?tab:'active';save();render()}
function archiveGoal(id){const g=state.goals.find(x=>x.id===id);if(!g||!g.completed)return;g.archived=true;state.goalTab='completed';save();render()}
function restoreGoal(id){const g=state.goals.find(x=>x.id===id);if(!g||!g.archived)return;g.archived=false;state.goalTab='completed';save();closeModal();render()}
function openArchivedGoal(id){const g=state.goals.find(x=>x.id===id);if(!g||!g.completed||!g.archived)return;const total=goalNotesTotal(g);openModal(`<div class="modal-head"><div><small>Obiettivo archiviato</small><h2>${escapeHtml(g.name)}</h2></div><button class="close-btn" onclick="closeModal()">×</button></div><div class="goal-card completed-goal-card" style="margin-top:16px"><div class="goal-content"><div class="goal-top"><div><h3>${escapeHtml(g.name)} <b class="positive goal-cost">${euroFmt.format(g.cost)}</b></h3><p>Completato il ${displayDate(g.completedAt||todayIso())}</p><p>Spesa registrata ${euroFmt.format(total||g.completionAmount||0)}</p></div><div class="goal-side"><span class="status good">✓ Completato</span><div class="goal-visual" aria-hidden="true">${goalVisual(g.name)}</div></div></div><div class="goal-actions"><button class="secondary-btn" style="flex:1" onclick="openGoalNotes('${g.id}',true)">Consulta</button><button class="secondary-btn" style="flex:1" onclick="restoreGoal('${g.id}')">Ripristina</button></div></div></div><div class="modal-actions"><button type="button" class="secondary-btn" onclick="closeModal()">Chiudi</button></div>`)}
function goalNotesTotal(g){return sum((Array.isArray(g.notes)?g.notes:[]).map(n=>Number(n.amount)||0))}
function openGoalNotes(id,readonly=false){
  const g=state.goals.find(x=>x.id===id);if(!g)return;
  if(!Array.isArray(g.notes))g.notes=[];
  const rows=g.notes.map((n,i)=>({n,i})).sort((a,b)=>(a.n.date||'').localeCompare(b.n.date||'')).map(({n,i})=>`<div class="goal-note-row"><input type="text" value="${displayDate(n.date||todayIso())}" data-finance-date-input="1" data-date-name="noteDate${i}" data-note-date-display="${i}" readonly ${readonly?'disabled':''}><input type="hidden" value="${escapeHtml(n.date||todayIso())}" name="noteDate${i}" data-note-date="${i}"><input type="text" value="${escapeHtml(n.description||'')}" placeholder="Descrizione" data-note-description="${i}" ${readonly?'disabled':''}><input type="number" min="0.01" step="0.01" value="${Number(n.amount)||''}" placeholder="€" data-note-amount="${i}" ${readonly?'disabled':''}>${readonly?'':'<button type="button" class="danger-btn goal-note-delete" data-note-delete="'+i+'">×</button>'}</div>`).join('');
  const controls=readonly?`<div class="analysis-box good"><b>Obiettivo completato</b><p>Questa scheda è conservata come storico delle spese annotate.</p></div>`:`<div class="goal-notes-actions"><button type="button" class="secondary-btn" onclick="addGoalNoteRow('${g.id}')">＋ Aggiungi spesa</button><button type="button" class="primary-btn" onclick="saveGoalNotes('${g.id}')">Salva note</button></div><button type="button" class="primary-btn goal-finish-btn" onclick="finishGoalNotes('${g.id}')">FINE OBIETTIVO</button>`;
  openModal(`<div class="modal-head"><div><small>Obiettivo</small><h2>${escapeHtml(g.name)}</h2></div><button class="close-btn" onclick="closeModal()">×</button></div><div class="goal-notes-box"><div class="goal-notes-head"><span>Data</span><span>Descrizione</span><span>Spesa</span></div><div id="goalNotesRows">${rows||'<div class="empty">Nessuna spesa annotata.</div>'}</div><div class="goal-notes-total"><span>TOTALE</span><b id="goalNotesTotal">${euroFmt.format(goalNotesTotal(g))}</b></div></div>${controls}<div class="modal-actions"><button type="button" class="secondary-btn" onclick="closeModal()">Chiudi</button></div>`);
  syncGoalNotesTotal();
  document.querySelectorAll('[data-note-amount]').forEach(el=>el.addEventListener('input',syncGoalNotesTotal));
  document.querySelectorAll('[data-note-delete]').forEach(btn=>btn.onclick=()=>{const i=Number(btn.dataset.noteDelete);g.notes.splice(i,1);openGoalNotes(g.id,false)});
}
function syncGoalNotesTotal(){const total=[...document.querySelectorAll('[data-note-amount]')].reduce((s,e)=>s+(Number(e.value)||0),0);const el=document.getElementById('goalNotesTotal');if(el)el.textContent=euroFmt.format(total)}
function addGoalNoteRow(id){const g=state.goals.find(x=>x.id===id);if(!g)return;const inputs=[...document.querySelectorAll('[data-note-date]')];g.notes=(inputs.length?inputs.map((_,i)=>({date:document.querySelector(`[data-note-date=\"${i}\"]`)?.value||todayIso(),description:document.querySelector(`[data-note-description=\"${i}\"]`)?.value||'',amount:Number(document.querySelector(`[data-note-amount=\"${i}\"]`)?.value)||0})):g.notes)||[];g.notes.push({date:todayIso(),description:'',amount:0});openGoalNotes(id,false)}
function saveGoalNotes(id){const g=state.goals.find(x=>x.id===id);if(!g)return;g.notes=[...document.querySelectorAll('[data-note-date]')].map((_,i)=>({date:document.querySelector(`[data-note-date=\"${i}\"]`)?.value||todayIso(),description:document.querySelector(`[data-note-description=\"${i}\"]`)?.value?.trim()||'',amount:Number(document.querySelector(`[data-note-amount=\"${i}\"]`)?.value)||0})).filter(n=>n.description||n.amount>0);save();openGoalNotes(id,false)}
function finishGoalNotes(id){
  const g=state.goals.find(x=>x.id===id);if(!g)return;
  saveGoalNotes(id);
  openModal(`<div class="confirm-card"><div class="confirm-icon">🏁</div><h2>Fine obiettivo</h2><p>Hai inserito tutte le spese?</p><div class="modal-actions confirm-actions"><button type="button" class="secondary-btn" onclick="closeModal();openGoalNotes('${g.id}',false)">No</button><button type="button" class="primary-btn" onclick="completeGoalFromNotes('${g.id}')">Sì</button></div></div>`);
}
function completeGoalFromNotes(id){
  const g=state.goals.find(x=>x.id===id);if(!g)return;
  const total=goalNotesTotal(g);if(total<=0){alert('Inserisci almeno una spesa prima di concludere l’obiettivo.');return}
  const transaction={id:uid(),date:todayIso(),type:'expense',category:'Obiettivi',description:g.name,amount:Number(total.toFixed(2)),createdAt:Date.now()};
  state.transactions.push(transaction);
  g.saved=Math.max(Number(g.saved)||0,total);
  g.completionPending=true;g.completionSource='notes';g.completionTransactionId=transaction.id;
  state.goalTab='active';save();closeModal();render();setTimeout(()=>showGoalVictory(g.id),80);
}
function completedGoalCard(g){const total=goalNotesTotal(g);return `<div class="goal-card completed-goal-card"><div class="goal-content"><div class="goal-top"><div><h3>${escapeHtml(g.name)} <b class="positive goal-cost">${euroFmt.format(g.cost)}</b></h3><p>Completato il ${displayDate(g.completedAt||todayIso())}</p><p>Spesa registrata ${euroFmt.format(total||g.completionAmount||0)}</p></div><div class="goal-side"><span class="status good">✓ Completato</span><div class="goal-visual" aria-hidden="true">${goalVisual(g.name)}</div></div></div><div class="goal-actions"><button class="secondary-btn" style="flex:1" onclick="openGoalNotes('${g.id}',true)">Consulta</button><button class="secondary-btn" style="flex:1" onclick="archiveGoal('${g.id}')">Archivia</button></div></div></div>`}
function cachedGoalPlan(){
  if(!goalPlanCache)goalPlanCache=goalPlan();
  return goalPlanCache;
}
function analyseGoal(g){
  const reference=currentMonth(), months=goalMonthsLeft(g,reference);
  const plan=cachedGoalPlan(), p=plan.plans[g.id]||{};
  const deadlineMonth=goalDeadlineMonth(g);
  const predictedByDeadline=Math.min(g.cost,Number(g.saved)||0 + sum(Object.entries(p.monthly||{}).filter(([ym])=>ym<=deadlineMonth).map(([,v])=>Number(v)||0)));
  const needed=months>0?Math.max(0,(g.cost-(Number(g.saved)||0))/months):Math.max(0,g.cost-(Number(g.saved)||0));
  const capacity=months>0?Math.max(0,(predictedByDeadline-(Number(g.saved)||0))/months):0;
  const completionMonth=p.completionMonth||'';
  const deadlineReachable=!!p.reachable;
  let status='good',label='✓ In linea';
  if(!deadlineReachable){status=completionMonth?'watch':'bad';label=completionMonth?'⚠ In ritardo':'✕ Non finanziabile'}
  const completionDate=completionMonth?monthName(completionMonth):'';
  const monthDifference=completionMonth?((Number(completionMonth.slice(0,4))-Number(deadlineMonth.slice(0,4)))*12+(Number(completionMonth.slice(5,7))-Number(deadlineMonth.slice(5,7)))):null;
  return {monthsLeft:months,needed,capacity,status,label,completionMonth,completionDate,deadlineReachable,monthDifference,predictedByDeadline,cushionMinimum:plan.cushionMinimum,cushionIdeal:plan.cushionIdeal}
}
function movements(){
  const months=availableDataMonths();
  const items=state.transactions.filter(t=>(state.movementMonth==='all'||monthOf(t.date)===state.movementMonth)&&(state.movementFilter==='all'||t.type===state.movementFilter)).slice().sort((a,b)=>{const byDate=b.date.localeCompare(a.date);if(byDate)return byDate;return Number(b.createdAt||0)-Number(a.createdAt||0)});
  return `<section class="page ${state.page==='movements'?'active':''}"><div class="page-head"><div><h1>Movimenti</h1></div><button class="primary-btn" onclick="openTransaction('income')">＋</button></div><div class="movement-controls"><button type="button" class="movement-month-trigger" onclick="openMovementMonthPicker()">${state.movementMonth==='all'?'Tutti i mesi':monthName(state.movementMonth)} <span>▾</span></button><div class="filters"><button class="filter-btn ${state.movementFilter==='all'?'active':''}" onclick="setFilter('all')">Tutti</button><button class="filter-btn ${state.movementFilter==='income'?'active':''}" onclick="setFilter('income')">Entrate</button><button class="filter-btn ${state.movementFilter==='expense'?'active':''}" onclick="setFilter('expense')">Uscite</button></div></div><div class="movement-list">${items.map(t=>{const isGoal=t.type==='expense'&&canonicalCategory(t.category)==='Obiettivi';const tone=isGoal?'goal':(t.type==='income'?'income':'expense');const icon=isGoal?goalMovementIcon(t):eventIcon(t.description,t.category,t.type);return `<div class="movement-swipe-wrap" data-transaction-id="${t.id}"><div class="swipe-delete-action" onclick="requestDeleteTransaction('${t.id}')"><span>⌫</span><small>Elimina</small></div><div class="movement-row movement-${tone} swipeable-movement" onclick="openTransaction('${t.type}','','${t.id}')"><div class="event-icon">${icon}</div><div class="event-meta"><b class="${isGoal?'goal-movement-title':''}">${escapeHtml(t.description||t.category)}</b><small>${t.category} · ${displayDate(t.date)}</small></div><div class="event-actions"><strong class="movement-amount ${isGoal?'goal-amount':(t.type==='income'?'positive':'negative')}">${t.type==='income'?'+':'-'}${euroFmt.format(t.amount)}</strong></div></div></div>`}).join('')||'<div class="empty">Nessun movimento.</div>'}</div></section>`
}
function setMovementMonth(m){state.movementMonth=m;save();render()}
// Popup MatteosFinance per le sole selezioni richieste: mese Dashboard, categorie movimento/evento e mese Previsioni.
function pickerRoot(){let root=document.getElementById('financePickerRoot');if(!root){root=document.createElement('div');root.id='financePickerRoot';document.body.appendChild(root)}return root}
function closeFinancePicker(){const root=document.getElementById('financePickerRoot');if(root)root.innerHTML=''}
function openFinanceChoice(title,options,selected,onSelect,labeler){const root=pickerRoot();root.innerHTML=`<div class="finance-picker-backdrop" onclick="if(event.target===this)closeFinancePicker()"><div class="finance-picker-card finance-select-picker"><div class="finance-picker-head"><div><small>Matteo's Finance</small><h2>${escapeHtml(title)}</h2></div><button type="button" class="finance-picker-close" onclick="closeFinancePicker()">×</button></div><div class="finance-option-list">${options.map((value,i)=>{const label=labeler?labeler(value):value;return `<button type="button" class="finance-option ${value===selected?'selected':''}" data-choice-index="${i}"><span>${escapeHtml(label)}</span><i>${value===selected?'✓':''}</i></button>`}).join('')}</div></div></div>`;root.querySelectorAll('[data-choice-index]').forEach(btn=>btn.onclick=()=>{const value=options[Number(btn.dataset.choiceIndex)];closeFinancePicker();onSelect(value)})}
function monthNameShort(ym){return new Date(ym+'-01T12:00:00').toLocaleDateString('it-IT',{month:'long',year:'2-digit'})}
function monthPickerLabel(ym){return new Date(ym+'-01T12:00:00').toLocaleDateString('it-IT',{month:'long',year:'numeric'})}
function openFinanceMonthPicker(title,selected,onSelect){
  const root=pickerRoot();
  let [viewYear,viewMonth]=String(selected||currentMonth()).split('-').map(Number); viewMonth--;
  root.innerHTML=`<div class="finance-picker-backdrop"><div class="finance-picker-card finance-month-picker"><div class="finance-picker-head"><div><small>Matteo's Finance</small><h2>${escapeHtml(title)}</h2></div></div><div class="finance-calendar-nav"><button type="button" data-month-prev>‹</button><b data-month-title></b><button type="button" data-month-next>›</button></div><div class="finance-month-grid" data-month-grid></div></div></div>`;
  const backdrop=root.querySelector('.finance-picker-backdrop'),grid=root.querySelector('[data-month-grid]'),titleEl=root.querySelector('[data-month-title]');
  backdrop.addEventListener('click',e=>{if(e.target===backdrop)closeFinancePicker()});
  const render=()=>{
    titleEl.textContent=String(viewYear);
    const today=currentMonth();
    grid.innerHTML=Array.from({length:12},(_,i)=>{const ym=`${viewYear}-${pad2(i+1)}`;return `<button type="button" class="finance-month-cell ${ym===selected?'selected':''} ${ym===today?'today':''}" data-finance-month="${ym}">${MONTH_LABELS[i]}</button>`}).join('');
    grid.querySelectorAll('[data-finance-month]').forEach(btn=>btn.onclick=()=>{const ym=btn.dataset.financeMonth;closeFinancePicker();onSelect(ym)});
  };
  root.querySelector('[data-month-prev]').onclick=()=>{viewYear--;render()};
  root.querySelector('[data-month-next]').onclick=()=>{viewYear++;render()};
  render();
}
function openDashboardMonthPicker(){openFinanceMonthPicker('Seleziona mese',state.dashboardMonth,setDashboardMonth)}
function openMovementMonthPicker(){const months=availableDataMonths();const options=['all',...months];const selected=state.movementMonth;openFinanceChoice('Seleziona mese',options,selected,setMovementMonth,value=>value==='all'?'Tutti i mesi':monthName(value))}
function openForecastMonthPicker(){openFinanceMonthPicker('Mese di riferimento',state.forecastMonth,m=>{state.forecastMonth=m;save();render();requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'auto'}))})}
function openStartingCapitalMonthPicker(){
  const input=document.getElementById('startingCapitalMonthInput');
  if(!input)return;
  openFinanceMonthPicker('Imposta mese',input.value||currentMonth(),ym=>{input.value=ym;const display=document.getElementById('startingCapitalMonthDisplay');if(display)display.textContent=monthPickerLabel(ym)});
}
function openTransactionCategoryPicker(){const form=document.getElementById('transactionForm'),category=document.getElementById('transactionCategory');if(!form||!category)return;openFinanceChoice('Categoria',categoriesForType(form.dataset.type),category.value,value=>{category.value=value;const trigger=document.getElementById('transactionCategoryTrigger');if(trigger)trigger.innerHTML=`${escapeHtml(value)} <span>▾</span>`;syncTransactionDescriptionRequirement()})}
function openFutureCategoryPicker(){const form=document.getElementById('futureForm'),category=document.getElementById('futureCategory');if(!form||!category)return;openFinanceChoice('Categoria',futureCategoriesForType(form.dataset.type),category.value,value=>{category.value=value;const trigger=document.getElementById('futureCategoryTrigger');if(trigger)trigger.innerHTML=`${escapeHtml(value)} <span>▾</span>`})}
function monthTitle(year,month){return new Date(year,month,1).toLocaleDateString('it-IT',{month:'long',year:'numeric'})}
function pickerLabelFor(el){const field=el.closest('.field');return field?.querySelector('label')?.textContent?.trim()||el.getAttribute('aria-label')||'Seleziona'}
function openFinanceDate(input){
  if(!input||input.disabled)return;
  const root=pickerRoot();
  const dateName=input.dataset.dateName||input.name;
  const hidden=input.form?.querySelector(`input[type="hidden"][name="${dateName}"]`)||input.parentElement?.querySelector(`input[type="hidden"][name="${dateName}"]`);
  let selected=hidden?.value||input.dataset.dateValue||input.value||'';
  let initial=selected?new Date(selected+'T12:00:00'):new Date();
  if(dateName==='deadline'){
    const start= input.form?.querySelector('input[type="hidden"][name="startDate"]')?.value;
    if(start)initial=new Date(start+'T12:00:00')
  }
  let viewYear=initial.getFullYear(),viewMonth=initial.getMonth();

  root.innerHTML=`<div class="finance-picker-backdrop"><div class="finance-picker-card finance-date-picker"><div class="finance-calendar-nav"><button type="button" data-finance-prev>‹</button><b data-finance-month-title></b><button type="button" data-finance-next>›</button></div><div class="finance-weekdays"><span>L</span><span>M</span><span>M</span><span>G</span><span>V</span><span>S</span><span>D</span></div><div class="finance-calendar-grid" data-finance-calendar-grid></div></div></div>`;

  const backdrop=root.querySelector('.finance-picker-backdrop');
  const grid=root.querySelector('[data-finance-calendar-grid]');
  const monthTitleEl=root.querySelector('[data-finance-month-title]');

  backdrop.addEventListener('click',event=>{
    if(event.target===backdrop)closeFinancePicker();
  });

  const renderCalendar=()=>{
    const days=new Date(Date.UTC(viewYear,viewMonth+1,0)).getUTCDate();
    const start=(new Date(Date.UTC(viewYear,viewMonth,1)).getUTCDay()+6)%7;
    monthTitleEl.textContent=monthTitle(viewYear,viewMonth);
    let cells='';
    for(let i=0;i<start;i++)cells+='<span class="finance-day empty" aria-hidden="true"></span>';
    for(let day=1;day<=days;day++){
      const iso=`${viewYear}-${pad2(viewMonth+1)}-${pad2(day)}`;
      cells+=`<button type="button" class="finance-day ${iso===selected?'selected':''} ${iso===todayIso()?'today':''}" data-finance-date="${iso}">${day}</button>`;
    }
    grid.innerHTML=cells;
    grid.querySelectorAll('[data-finance-date]').forEach(btn=>btn.onclick=()=>{
      const iso=btn.dataset.financeDate;
      selected=iso;
      if(hidden)hidden.value=iso;
      input.dataset.dateValue=iso;
      input.value=displayDate(iso);
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
      closeFinancePicker();
    });
  };

  root.querySelector('[data-finance-prev]').onclick=()=>{
    viewMonth--;
    if(viewMonth<0){viewMonth=11;viewYear--}
    renderCalendar();
  };
  root.querySelector('[data-finance-next]').onclick=()=>{
    viewMonth++;
    if(viewMonth>11){viewMonth=0;viewYear++}
    renderCalendar();
  };

  renderCalendar();
}
function initFinancePickers(){if(document.body.dataset.financePickersReady)return;document.body.dataset.financePickersReady='1';document.addEventListener('click',event=>{const date=event.target.closest?.('input[data-finance-date-input="1"]');if(!date)return;event.preventDefault();event.stopImmediatePropagation();openFinanceDate(date)},true)}
initFinancePickers();

function render(){
  const app=document.getElementById('app');
  try{
    // Ottimizzazione prestazioni: viene costruita soltanto la pagina attualmente visualizzata.
    // Le funzioni delle singole pagine e i relativi calcoli restano invariati.
    const pages={dashboard,movements,forecasts,goals};
    const buildPage=pages[state.page]||dashboard;
    app.innerHTML=buildPage();

    document.querySelectorAll('[data-nav]').forEach(b=>{
      b.classList.toggle('active',b.dataset.nav===state.page);
      b.addEventListener('click',()=>changePage(b.dataset.nav));
    });

    const quick=document.getElementById('quickAdd');
    if(quick) quick.onclick=()=>openTransaction();
    const weekViewport=document.querySelector('.week-viewport');
    if(weekViewport){
      let startX=0,startY=0,tracking=false;
      weekViewport.addEventListener('touchstart',e=>{if(e.touches.length!==1)return;const t=e.touches[0];startX=t.clientX;startY=t.clientY;tracking=true},{passive:true});
      weekViewport.addEventListener('touchend',e=>{if(!tracking)return;tracking=false;const t=e.changedTouches[0];const dx=t.clientX-startX,dy=t.clientY-startY;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.2){shiftDashboardWeek(dx<0?1:-1)}},{passive:true});
    }

    // Inizializziamo soltanto gli eventi della pagina che è stata effettivamente renderizzata.
    if(state.page==='forecasts') initFutureEventSwipe();
    if(state.page==='movements') initMovementSwipe();
    if(state.page==='goals'){initGoalSwipe();setTimeout(handleGoalPageEntry,0);}
  }catch(err){
    console.error('Errore durante il rendering',err);
    app.innerHTML=`<section class="page active"><div class="panel" style="padding:24px;text-align:center"><h2>Matteo's Finance ha recuperato un problema</h2><p>Non sono andati persi i tuoi dati. Puoi ripristinare l'avvio sicuro dell'app.</p><button class="primary-btn" onclick="resetDemo()">Ripristina dati sicuri</button></div></section>`;
  }
}
function setFilter(x){state.movementFilter=x;save();render()}
function openModal(content){document.getElementById('modalRoot').innerHTML=`<div class="modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="modal">${content}</div></div>`}
function closeModal(){document.getElementById('modalRoot').innerHTML=''}
function openTransaction(defaultType='income',presetDate='',editId=''){
  const existing=editId?state.transactions.find(t=>t.id===editId):null;
  let type=existing?.type||defaultType||'income';
  const fallbackDate=existing?.date||presetDate||`${state.dashboardMonth||currentMonth()}-${pad2(new Date().getDate())}`;
  openModal(`<div class="modal-head"><h2>${existing?'Modifica movimento':'Nuovo movimento'}</h2><button class="close-btn" onclick="closeModal()">×</button></div><div class="type-switch"><button id="typeIncome" class="income ${type==='income'?'active':''}" onclick="selectType('income')">↓ Entrata</button><button id="typeExpense" class="expense ${type==='expense'?'active':''}" onclick="selectType('expense')">↑ Uscita</button></div><form id="transactionForm" class="form-grid"><div class="form-grid two"><div class="field"><label>Data</label><input type="text" value="${displayDate(fallbackDate)}" data-finance-date-input="1" data-date-name="date" readonly><input type="hidden" name="date" value="${fallbackDate}" required></div><div class="field"><label>Categoria</label><input type="hidden" id="transactionCategory" name="category" value="${escapeHtml(existing?.category||categoriesForType(type)[0]||'')}"><button type="button" id="transactionCategoryTrigger" class="finance-field-choice" onclick="openTransactionCategoryPicker()">${escapeHtml(existing?.category||categoriesForType(type)[0]||'Seleziona categoria')} <span>▾</span></button></div></div><div class="field"><label id="transactionDescriptionLabel">Descrizione <small>(facoltativa)</small></label><input id="transactionDescription" name="description" type="text" value="${escapeHtml(existing?.description||'')}" placeholder="Es. Stipendio settembre o Revisione auto"></div><div class="field"><label>Importo</label><input name="amount" type="number" min="0.01" step="0.01" value="${existing?.amount??''}" required></div><div class="modal-actions"><button type="button" class="secondary-btn" onclick="closeModal()">Annulla</button><button class="primary-btn">${existing?'Salva modifiche':'Salva movimento'}</button></div></form>`);
  const form=document.getElementById('transactionForm');form.dataset.type=type;if(existing)form.dataset.editId=existing.id;
  const category=document.getElementById('transactionCategory');if(category)category.addEventListener('change',syncTransactionDescriptionRequirement);
  syncTransactionDescriptionRequirement();
  form.addEventListener('submit',submitTransaction)
}
function syncTransactionDescriptionRequirement(){const category=document.getElementById('transactionCategory'),input=document.getElementById('transactionDescription'),label=document.getElementById('transactionDescriptionLabel');if(!category||!input||!label)return;const required=canonicalCategory(category.value)==='Obiettivi';input.required=required;label.innerHTML=required?'Descrizione <small>(obbligatoria per gli Obiettivi)</small>':'Descrizione <small>(facoltativa)</small>';}
function selectType(type){const f=document.getElementById('transactionForm');f.dataset.type=type;document.getElementById('typeIncome').classList.toggle('active',type==='income');document.getElementById('typeExpense').classList.toggle('active',type==='expense');const category=document.getElementById('transactionCategory'),trigger=document.getElementById('transactionCategoryTrigger');if(category){const options=categoriesForType(type);const current=options.includes(category.value)?category.value:(options[0]||'');category.value=current;if(trigger)trigger.innerHTML=`${escapeHtml(current||'Seleziona categoria')} <span>▾</span>`;syncTransactionDescriptionRequirement();}}
function submitTransaction(ev){
  ev.preventDefault();
  const f=ev.currentTarget,d=new FormData(f),amount=Number(d.get('amount')),description=String(d.get('description')||'').trim();
  const data={date:d.get('date'),type:f.dataset.type,category:d.get('category'),description,amount};
  if(canonicalCategory(data.category)==='Obiettivi'&&!description){alert('Per un movimento Obiettivi la descrizione è obbligatoria.');return;}
  const existingId=f.dataset.editId;
  const previous=existingId?state.transactions.find(t=>t.id===existingId):null;
  const proceed=()=>finalizeTransactionRegistration(data,existingId,previous);
  if(!existingId)missingMonthRegistrationWarning(data,proceed);else proceed();
}
function finalizeTransactionRegistration(data,existingId,previous){
  const transaction=existingId?{...previous,...data}:{id:uid(),createdAt:Date.now(),...data};
  if(existingId){const i=state.transactions.findIndex(t=>t.id===existingId);if(i>=0)state.transactions[i]=transaction}else state.transactions.push(transaction);
  const match=existingId?null:findMatchingFutureEvent(transaction);
  if(match){
    const event=match.event;
    const sameEvent=confirm(`Possibile evento futuro trovato.

Hai appena registrato: ${transaction.description||transaction.category} — ${euroFmt.format(transaction.amount)}

Potrebbe corrispondere all'evento futuro: ${event.description} — ${euroFmt.format(event.amount)}

Era per caso l'evento futuro che stavamo aspettando?

Premi OK per confermare oppure Annulla se è un'altra spesa/entrata.`);
    if(sameEvent)state.futureEvents=state.futureEvents.filter(e=>e.id!==event.id);
  }
  if(!existingId){const goalMatch=findMatchingGoal(transaction);if(goalMatch)markGoalForVictory(goalMatch.goal.id,'movement',transaction.id);}
  recalculateBalance();save();closeModal();render();
}

function requestDeleteTransaction(id){const t=state.transactions.find(x=>x.id===id);if(!t)return;openModal(`<div class="confirm-card"><div class="confirm-icon">🗑</div><h2>Eliminare movimento?</h2><p>Vuoi eliminare <b>${escapeHtml(t.description||t.category)}</b> dai movimenti?</p><div class="modal-actions confirm-actions"><button type="button" class="secondary-btn" onclick="closeModal()">Annulla</button><button type="button" class="danger-btn" onclick="deleteTransaction('${id}')">Elimina</button></div></div>`)}
function deleteTransaction(id){const transaction=state.transactions.find(x=>x.id===id);state.transactions=state.transactions.filter(x=>x.id!==id);restoreGoalsLinkedToTransactions(transaction?[transaction]:[]);recalculateBalance();save();closeModal();render()}
function openFutureEvent(editId=null){const existing=editId?state.futureEvents.find(e=>e.id===editId):null;let type=existing?existing.type:'expense';const title=existing?'Modifica evento previsto':'Nuovo evento previsto';openModal(`<div class="modal-head"><h2>${title}</h2><button class="close-btn" onclick="closeModal()">×</button></div><div class="type-switch"><button id="typeIncome" class="income ${type==='income'?'active':''}" onclick="selectFutureType('income')">↓ Entrata</button><button id="typeExpense" class="expense ${type==='expense'?'active':''}" onclick="selectFutureType('expense')">↑ Uscita</button></div><form id="futureForm" class="form-grid"><div class="form-grid two"><div class="field"><label>Data</label><input type="text" value="${displayDate(existing?existing.date:state.forecastMonth+'-15')}" data-finance-date-input="1" data-date-name="date" readonly><input type="hidden" name="date" value="${existing?existing.date:state.forecastMonth+'-15'}" required></div><div class="field"><label>Categoria</label><input type="hidden" id="futureCategory" name="category" value="${escapeHtml(existing?.category||futureCategoriesForType(type)[0]||'')}"><button type="button" id="futureCategoryTrigger" class="finance-field-choice" onclick="openFutureCategoryPicker()">${escapeHtml(existing?.category||futureCategoriesForType(type)[0]||'Seleziona categoria')} <span>▾</span></button></div></div><div class="field"><label>Descrizione</label><input name="description" value="${escapeHtml(existing?.description||'')}" required></div><div class="field"><label>Importo</label><input name="amount" type="number" min="0.01" step="0.01" value="${existing?.amount??''}" required></div><div class="modal-actions"><button type="button" class="secondary-btn" onclick="closeModal()">Annulla</button><button class="primary-btn">${existing?'Salva modifiche':'Salva evento'}</button></div></form>`);const form=document.getElementById('futureForm');form.dataset.type=type;if(editId)form.dataset.editId=editId;form.addEventListener('submit',submitFuture)}
function selectFutureType(type){const f=document.getElementById('futureForm');f.dataset.type=type;document.getElementById('typeIncome').classList.toggle('active',type==='income');document.getElementById('typeExpense').classList.toggle('active',type==='expense');const category=document.getElementById('futureCategory'),trigger=document.getElementById('futureCategoryTrigger');if(category){const options=futureCategoriesForType(type);const current=options.includes(category.value)?category.value:(options[0]||'');category.value=current;if(trigger)trigger.innerHTML=`${escapeHtml(current||'Seleziona categoria')} <span>▾</span>`;}}
function submitFuture(ev){ev.preventDefault();const f=ev.currentTarget,d=new FormData(f);const data={date:d.get('date'),type:f.dataset.type,category:d.get('category'),description:d.get('description'),amount:Number(d.get('amount'))};if(f.dataset.editId){const i=state.futureEvents.findIndex(e=>e.id===f.dataset.editId);if(i>=0)state.futureEvents[i]={...state.futureEvents[i],...data}}else state.futureEvents.push({id:uid(),...data});save();closeModal();render()}
function initDashboardWeekSwipe(){
  const viewport=document.querySelector('.dashboard-week-swipe');
  if(!viewport||viewport.dataset.swipeReady)return;
  viewport.dataset.swipeReady='1';
  let startX=0,startY=0,tracking=false;
  viewport.addEventListener('touchstart',e=>{if(e.touches.length!==1)return;startX=e.touches[0].clientX;startY=e.touches[0].clientY;tracking=true},{passive:true});
  viewport.addEventListener('touchmove',e=>{if(!tracking)return;const dx=e.touches[0].clientX-startX,dy=e.touches[0].clientY-startY;if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>8)tracking=false},{passive:true});
  viewport.addEventListener('touchend',e=>{if(!tracking)return;tracking=false;const dx=(e.changedTouches[0]?.clientX||startX)-startX;if(Math.abs(dx)>48)shiftDashboardWeek(dx<0?1:-1)},{passive:true});
  viewport.addEventListener('touchcancel',()=>{tracking=false},{passive:true});
}
function initFutureEventSwipe(){document.querySelectorAll('.event-swipe-wrap').forEach(wrap=>{const row=wrap.querySelector('.swipeable-event');let startX=0,startY=0,currentX=0,dragging=false,locked=false;const reset=()=>{row.style.transition='transform .22s ease';row.style.transform='translateX(0)';wrap.classList.remove('open');setTimeout(()=>row.style.transition='',230)};row.addEventListener('touchstart',e=>{if(e.touches.length!==1)return;startX=e.touches[0].clientX;startY=e.touches[0].clientY;currentX=0;dragging=true;locked=false;row.style.transition='none'},{passive:true});row.addEventListener('touchmove',e=>{if(!dragging)return;const dx=e.touches[0].clientX-startX,dy=e.touches[0].clientY-startY;if(!locked&&Math.abs(dy)>Math.abs(dx)){dragging=false;reset();return}if(Math.abs(dx)>8)locked=true;if(!locked)return;currentX=Math.max(-108,Math.min(0,dx));row.style.transform=`translateX(${currentX}px)`},{passive:true});row.addEventListener('touchend',()=>{if(!dragging)return;dragging=false;if(currentX<-48){row.style.transition='transform .22s ease';row.style.transform='translateX(-96px)';wrap.classList.add('open')}else reset()},{passive:true});row.addEventListener('touchcancel',reset,{passive:true})});}
function initSwipeDelete(wrapperSelector,rowSelector){document.querySelectorAll(wrapperSelector).forEach(wrap=>{const row=wrap.querySelector(rowSelector);if(!row)return;let startX=0,startY=0,currentX=0,dragging=false,locked=false;const reset=()=>{row.style.transition='transform .22s ease';row.style.transform='translateX(0)';wrap.classList.remove('open');setTimeout(()=>row.style.transition='',230)};row.addEventListener('touchstart',e=>{if(e.touches.length!==1)return;startX=e.touches[0].clientX;startY=e.touches[0].clientY;currentX=0;dragging=true;locked=false;row.style.transition='none'},{passive:true});row.addEventListener('touchmove',e=>{if(!dragging)return;const dx=e.touches[0].clientX-startX,dy=e.touches[0].clientY-startY;if(!locked&&Math.abs(dy)>Math.abs(dx)){dragging=false;reset();return}if(Math.abs(dx)>8)locked=true;if(!locked)return;currentX=Math.max(-108,Math.min(0,dx));row.style.transform=`translateX(${currentX}px)`},{passive:true});row.addEventListener('touchend',()=>{if(!dragging)return;dragging=false;if(currentX<-48){row.style.transition='transform .22s ease';row.style.transform='translateX(-96px)';wrap.classList.add('open')}else reset()},{passive:true});row.addEventListener('touchcancel',reset,{passive:true})})}
function initMovementSwipe(){initSwipeDelete('.movement-swipe-wrap','.swipeable-movement')}
function initGoalSwipe(){initSwipeDelete('.goal-swipe-wrap','.swipeable-goal')}
function requestDeleteFutureEvent(id){const event=state.futureEvents.find(e=>e.id===id);if(!event)return;openModal(`<div class="confirm-card"><div class="confirm-icon">🗑</div><h2>Eliminare evento?</h2><p>Vuoi rimuovere <b>${escapeHtml(event.description)}</b> dalle previsioni?</p><div class="modal-actions confirm-actions"><button type="button" class="secondary-btn" onclick="closeModal()">Annulla</button><button type="button" class="danger-btn" onclick="deleteFutureEvent('${id}')">Elimina</button></div></div>`)}
function deleteFutureEvent(id){state.futureEvents=state.futureEvents.filter(e=>e.id!==id);save();closeModal();render()}
function openGoal(editId=null){const existing=editId?state.goals.find(g=>g.id===editId):null;let priority=existing?.priority||'media';const title=existing?'Modifica obiettivo':'Nuovo obiettivo';openModal(`<div class="modal-head"><h2>${title}</h2><button class="close-btn" onclick="closeModal()">×</button></div><form id="goalForm" class="form-grid"><div class="field"><label>Quale meta vuoi raggiungere?</label><input name="name" value="${escapeHtml(existing?.name||'')}" placeholder="Es. Chitarra nuova" required></div><div class="field"><label>Quanto costa?</label><input name="cost" type="number" min="1" step="0.01" value="${existing?.cost??''}" required></div><div class="field"><label>Periodo previsto</label><div class="goal-date-range"><div><small>Dal</small><input type="text" value="${displayDate(existing?.startDate||todayIso())}" data-goal-date="1" data-finance-date-input="1" data-date-name="startDate" readonly><input type="hidden" name="startDate" value="${existing?.startDate||todayIso()}"></div><div><small>Al</small><input type="text" value="${displayDate(existing?.deadline||'2026-12-31')}" data-goal-date="1" data-finance-date-input="1" data-date-name="deadline" readonly><input type="hidden" name="deadline" value="${existing?.deadline||'2026-12-31'}"></div></div></div><div class="field"><label>Dai una priorità a questo obiettivo</label><div class="priority-switch"><button type="button" data-p="bassa" class="${priority==='bassa'?'active':''}">♧ Bassa</button><button type="button" data-p="media" class="${priority==='media'?'active':''}">◉ Media</button><button type="button" data-p="alta" class="${priority==='alta'?'active':''}">♥ Alta</button></div></div><div class="modal-actions"><button type="button" class="secondary-btn" onclick="closeModal()">Annulla</button><button class="primary-btn">${existing?'Salva modifiche':'Analizza obiettivo'}</button></div></form>`);document.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{priority=b.dataset.p;document.querySelectorAll('[data-p]').forEach(x=>x.classList.toggle('active',x===b))});const form=document.getElementById('goalForm');form.addEventListener('submit',ev=>{ev.preventDefault();const d=new FormData(ev.currentTarget),data={name:d.get('name'),cost:Number(d.get('cost')),startDate:d.get('startDate')||todayIso(),deadline:d.get('deadline'),priority};if(data.startDate>data.deadline){alert('La data iniziale deve essere precedente o uguale alla data finale.');return}if(existing){const i=state.goals.findIndex(g=>g.id===existing.id);if(i>=0)state.goals[i]={...state.goals[i],...data};save();closeModal();render()}else{const g={id:uid(),...data,saved:0,createdAt:todayIso()};state.goals.push(g);save();closeModal();openGoalAnalysis(g.id)}})}
function openGoalAnalysis(id){
  const g=state.goals.find(x=>x.id===id);if(!g)return;
  const a=analyseGoal(g);
  const priority=g.priority.charAt(0).toUpperCase()+g.priority.slice(1);
  let result='';
  if(a.completionDate){
    if(a.monthDifference!==null&&a.monthDifference<0)result=`Il tuo obiettivo può essere realizzato in ${a.completionDate}, circa ${Math.abs(a.monthDifference)} ${Math.abs(a.monthDifference)===1?'mese':'mesi'} prima della scadenza.`;
    else if(a.monthDifference===0)result=`Il tuo obiettivo è previsto in ${a.completionDate}, in linea con la scadenza.`;
    else result=`Il tuo obiettivo può essere realizzato in ${a.completionDate}, circa ${a.monthDifference} ${a.monthDifference===1?'mese':'mesi'} dopo la scadenza.`;
  }else result='Con le previsioni attuali e le priorità impostate non risultano ancora risorse sufficienti per stimare una data di realizzazione.';
  const monthlyComparison=a.needed>0?`<div class="forecast-row"><span>Per rispettare la scadenza</span><b>${euroFmt.format(a.needed)}/mese</b></div><div class="forecast-row"><span>Previsione attuale</span><b>${euroFmt.format(a.capacity)}/mese</b></div>`:'';
  openModal(`<div class="modal-head"><h2>Analisi obiettivo</h2><button class="close-btn" onclick="closeModal()">×</button></div><div class="analysis-box ${a.status}" style="margin-top:16px"><h3 style="margin-top:0">${escapeHtml(g.name)} <b class="goal-analysis-cost">${euroFmt.format(g.cost)}</b></h3><div class="forecast-row"><span>Priorità</span><b>${priority}</b></div><div class="forecast-row"><span>Periodo</span><b>Dal ${displayDate(g.startDate||todayIso())} al ${displayDate(g.deadline)}</b></div>${monthlyComparison}<h3>${a.label}</h3><p>${result}</p><p><small>La barra dell'obiettivo rappresenta la quota che le previsioni stimano di poter destinare entro la scadenza. Può avanzare o retrocedere quando cambiano entrate, uscite, eventi futuri, priorità o cuscinetto.</small></p></div><div class="modal-actions"><button class="primary-btn" onclick="closeModal();render()">Chiudi</button></div>`)
}
function showGoalVictory(goalId){
  const goal=state.goals.find(g=>g.id===goalId);if(!goal||goal.completed)return;
  document.getElementById('modalRoot').innerHTML=`<div class="victory-screen"><div class="confetti-field">${Array.from({length:90},(_,i)=>`<i style="left:${(i*37)%100}%;animation-delay:${-(i%18)*.12}s;animation-duration:${2.6+(i%7)*.23}s"></i>`).join('')}</div><div class="victory-content"><div class="victory-word">VITTORIA</div><div class="victory-icon">${goalVisual(goal.name)}</div><h2>${escapeHtml(goal.name)}</h2><p>Obiettivo raggiunto. Risparmio trasformato in qualcosa di reale.</p><button class="victory-btn" onclick="finalizeGoalVictory('${goal.id}')">OBIETTIVO RAGGIUNTO</button></div></div>`;
}
function finalizeGoalVictory(goalId){
  const goal=state.goals.find(g=>g.id===goalId);if(!goal)return;
  const card=document.querySelector(`[data-goal-id="${goalId}"]`);document.getElementById('modalRoot').innerHTML='';
  const complete=()=>{goal.completed=true;goal.completionPending=false;goal.completedAt=todayIso();goal.completionAmount=goal.completionTransactionId?Number(state.transactions.find(t=>t.id===goal.completionTransactionId)?.amount)||goalNotesTotal(goal):goalNotesTotal(goal);state.goalTab='completed';save();render();setTimeout(()=>{const tab=document.getElementById('completedGoalsTab');if(tab){tab.classList.add('completed-pulse');setTimeout(()=>tab.classList.remove('completed-pulse'),4200)}},80)};
  if(card){card.classList.add('goal-card-victory-fade');setTimeout(complete,720)}else complete();
}
function handleGoalPageEntry(){
  if(state.page!=='goals'||document.querySelector('.victory-screen')||document.querySelector('.modal-backdrop'))return;
  const pending=activeGoals().find(g=>g.completionPending);
  if(pending){showGoalVictory(pending.id);return;}
  const today=todayIso();
  const due=activeGoals().find(g=>g.deadline<=today&&!hasObjectiveMovementForGoal(g)&&g.lastDeadlinePrompt!==g.deadline);
  if(!due)return;
  due.lastDeadlinePrompt=due.deadline;save();
  openModal(`<div class="modal-head"><h2>Obiettivo in scadenza</h2><button class="close-btn" onclick="closeModal()">×</button></div><div class="analysis-box watch" style="margin-top:16px"><h3 style="margin-top:0">${escapeHtml(due.name)}</h3><p>La data prevista per questo obiettivo è arrivata. Sei riuscito a raggiungerlo?</p></div><div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Non ancora</button><button class="primary-btn" onclick="confirmGoalReached('${due.id}')">Sì, obiettivo raggiunto</button></div>`);
}
function confirmGoalReached(goalId){const goal=state.goals.find(g=>g.id===goalId);if(!goal)return;markGoalForVictory(goalId,'deadline');closeModal();showGoalVictory(goalId)}
function requestDeleteGoal(id){const g=state.goals.find(x=>x.id===id);if(!g)return;openModal(`<div class="confirm-card"><div class="confirm-icon">🗑</div><h2>Eliminare obiettivo?</h2><p>Vuoi eliminare <b>${escapeHtml(g.name)}</b> dai tuoi obiettivi?</p><div class="modal-actions confirm-actions"><button type="button" class="secondary-btn" onclick="closeModal()">Annulla</button><button type="button" class="danger-btn" onclick="deleteGoal('${id}')">Elimina</button></div></div>`)}
function deleteGoal(id){state.goals=state.goals.filter(g=>g.id!==id);save();closeModal();render()}
function openSettings(){openModal(`<div class="modal-head"><h2>⚙ Impostazioni</h2><button class="close-btn" onclick="closeModal()">×</button></div>
<div class="settings-section"><h3>💰 Capitale iniziale</h3><p>Indica il capitale disponibile quando hai iniziato a utilizzare Matteo's Finance e il mese da cui vuoi iniziare a registrare tutti i movimenti.</p><div class="form-grid two"><div class="field"><label>Capitale iniziale</label><input id="startingCapitalInput" type="number" min="0" step="0.01" value="${Number(state.startingCapital)||0}"></div><div class="field"><label>Mese di inizio registrazione</label><input id="startingCapitalMonthInput" type="hidden" value="${escapeHtml(state.startingCapitalMonth||currentMonth())}"><button type="button" id="startingCapitalMonthDisplay" class="finance-field-choice" onclick="openStartingCapitalMonthPicker()">${escapeHtml(monthPickerLabel(state.startingCapitalMonth||currentMonth()))} <span>▾</span></button></div></div><button class="primary-btn" style="width:100%" onclick="saveStartingCapital()">Salva capitale iniziale</button></div>
<div class="settings-section"><h3>🛡 Cuscinetto di sicurezza</h3><p>È una riserva globale: prima viene protetto il minimo, poi gli eventuali risparmi vengono distribuiti anche in base alle priorità degli obiettivi.</p><div class="field"><label>Minimo di sicurezza</label><input id="cushionMinimumInput" type="number" min="0" step="0.01" value="${Number(state.cushionMinimum)||0}"></div><div class="field"><label>Obiettivo ideale del cuscinetto</label><input id="cushionIdealInput" type="number" min="0" step="0.01" value="${Number(state.cushionIdeal)||0}"></div><button class="primary-btn" style="width:100%" onclick="saveCushionSettings()">Salva cuscinetto</button></div>
<div class="settings-section"><h3>Gestione entrate e uscite</h3><p>Puoi cancellare un singolo mese oppure tutti i movimenti.</p><button class="danger-btn" onclick="openDeleteTransactions()">Cancella entrate/uscite</button></div>
<div class="settings-section"><h3>Backup ed esportazione dati</h3><p>Salva una copia completa dei dati dell'app oppure importa un backup precedentemente esportato.</p><div class="settings-actions"><button class="primary-btn" onclick="exportBackup()">Esporta dati</button><button class="secondary-btn" onclick="document.getElementById('backupImportInput').click()">Importa backup</button></div><input id="backupImportInput" type="file" accept="application/json,.json" style="display:none" onchange="importBackup(event)"></div>
<div class="settings-section"><h3>Reset</h3><div class="settings-actions"><button class="secondary-btn" onclick="confirmResetMonth()">Reset mese</button><button class="danger-btn" onclick="confirmResetTotal()">Reset totale</button></div></div>
<div class="analysis-box"><b>Dati salvati sul dispositivo</b><p>Le modifiche rimangono nel browser tramite memoria locale.</p></div>`)}
function saveCushionSettings(){const min=Math.max(0,Number(document.getElementById('cushionMinimumInput').value)||0);const ideal=Math.max(min,Number(document.getElementById('cushionIdealInput').value)||0);state.cushionMinimum=min;state.cushionIdeal=ideal;save();closeModal();render()}
function exportBackup(){
  const backup={app:'Matteo’s Finance',version:1,exportedAt:new Date().toISOString(),data:state};
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`matteos-finance-backup-${todayIso()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function importBackup(event){
  const file=event.target.files?.[0];
  event.target.value='';
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const parsed=JSON.parse(reader.result);
      const imported=parsed?.data&&typeof parsed.data==='object'?parsed.data:parsed;
      if(!imported||typeof imported!=='object'||!Array.isArray(imported.transactions))throw new Error('Backup non valido');
      if(!confirm('Importando il backup i dati attuali verranno sostituiti. Vuoi continuare?'))return;
      const safe={
        ...structuredClone(DEFAULT_STATE),
        ...imported,
        transactions:Array.isArray(imported.transactions)?imported.transactions:[],
        futureEvents:Array.isArray(imported.futureEvents)?imported.futureEvents:[],
        goals:Array.isArray(imported.goals)?imported.goals:[],
        cushionMinimum:Math.max(0,Number(imported.cushionMinimum)||0),
        cushionIdeal:Math.max(0,Number(imported.cushionIdeal)||0)
      };
      Object.keys(state).forEach(key=>delete state[key]);
      Object.assign(state,safe);
      recalculateBalance();
      save();
      closeModal();
      render();
      alert('Backup importato correttamente.');
    }catch(err){
      alert('Impossibile importare il backup: il file non è valido.');
      console.warn('Errore importazione backup:',err);
    }
  };
  reader.readAsText(file);
}
function saveStartingCapital(){const v=Math.max(0,Number(document.getElementById('startingCapitalInput').value)||0);const m=document.getElementById('startingCapitalMonthInput').value||currentMonth();state.startingCapital=v;state.startingCapitalMonth=m;recalculateBalance();save();closeModal();render()}
function openDeleteTransactions(){const months=[...new Set(state.transactions.map(t=>monthOf(t.date)))].sort();openModal(`<div class="modal-head"><h2>Cancella entrate/uscite</h2><button class="close-btn" onclick="closeModal()">×</button></div><div class="form-grid"><div class="field"><label>Seleziona il mese da cancellare</label><select id="deleteMonth"><option value="">— Seleziona un mese —</option>${months.map(m=>`<option value="${m}">${monthName(m)}</option>`).join('')}</select></div><button class="secondary-btn" onclick="confirmDeleteMonth()">Cancella il mese selezionato</button><button class="danger-btn" onclick="confirmDeleteAllTransactions()">Cancella tutti i mesi</button><button class="secondary-btn" onclick="openSettings()">Annulla</button></div>`)}
function confirmDeleteMonth(){const m=document.getElementById('deleteMonth').value;if(!m)return;if(confirm('SICURO CHE VUOI CANCELLARE tutti i dati di '+monthName(m)+'?')){const removed=state.transactions.filter(t=>monthOf(t.date)===m);state.transactions=state.transactions.filter(t=>monthOf(t.date)!==m);restoreGoalsLinkedToTransactions(removed);recalculateBalance();save();closeModal();render()}}
function confirmDeleteAllTransactions(){if(confirm('SICURO CHE VUOI CANCELLARE tutte le entrate e le uscite?')){const removed=[...state.transactions];state.transactions=[];restoreGoalsLinkedToTransactions(removed);recalculateBalance();save();closeModal();render()}}
function confirmResetMonth(){const m=currentMonth();if(confirm('Vuoi davvero cancellare i dati del mese corrente?')){const removed=state.transactions.filter(t=>monthOf(t.date)===m);state.transactions=state.transactions.filter(t=>monthOf(t.date)!==m);restoreGoalsLinkedToTransactions(removed);state.futureEvents=state.futureEvents.filter(e=>monthOf(e.date)!==m);recalculateBalance();save();closeModal();render()}}
function confirmResetTotal(){if(confirm('Vuoi davvero cancellare TUTTI i dati? Questa operazione non si può annullare.')){state.balance=0;state.startingCapital=0;state.startingCapitalMonth='';state.transactions=[];state.futureEvents=[];state.goals=[];state.cushionMinimum=0;state.cushionIdeal=0;save();closeModal();render()}}
function recalculateBalance(){const from=state.startingCapitalMonth?state.startingCapitalMonth+'-01':null;const relevant=from?state.transactions.filter(t=>t.date>=from):state.transactions;state.balance=(state.startingCapital||0)+sum(relevant.map(t=>t.type==='income'?t.amount:-t.amount))}

function resetDemo(){if(confirm('Ripristinare i dati iniziali?')){localStorage.removeItem('matteos-finance-v1');location.reload()}}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
render();
