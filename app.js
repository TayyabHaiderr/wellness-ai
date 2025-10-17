// Simple router for tabs
document.querySelectorAll('.tab').forEach(btn=>{
  btn.onclick=()=>{ document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); document.querySelectorAll('.panel').forEach(p=>p.classList.remove('show'));
    document.getElementById(btn.dataset.tab).classList.add('show'); }
});

const state = {
  foods: [],
  today: new Date().toISOString().slice(0,10),
  logs: JSON.parse(localStorage.getItem('logs')||'{}') // { [date]: { meals:[], water:[], mood:'', wellness:[] } }
};
if(!state.logs[state.today]) state.logs[state.today] = { meals:[], water_ml:0, mood:'😐 Neutral', wellness:[] };

// --- Load foods JSON ---
fetch('data/foods-large.json').then(r=>r.json()).then(data=>{
  state.foods = data;
  setupFoodSearch();
}).catch(()=>{ alert('Failed to load foods-large.json'); });

function save(){ localStorage.setItem('logs', JSON.stringify(state.logs)); render(); }

function setupFoodSearch(){
  const q = document.getElementById('foodSearch');
  const results = document.getElementById('foodResults');
  const selectedEl = document.getElementById('selectedFood');
  let sel = null;

  function renderResults(list){
    results.innerHTML = '';
    list.slice(0,30).forEach(f=>{
      const item = document.createElement('div'); item.className='item';
      const kcal = f.per_100g?.calories ?? 0;
      item.innerHTML = `<span>${f.name}</span><span class="muted">${kcal} kcal/100g</span>`;
      item.onclick=()=>{ sel = f; selectedEl.textContent = f.name; };
      results.appendChild(item);
    });
  }

  let t=null; q.oninput=()=>{
    clearTimeout(t); t = setTimeout(()=>{
      const term = q.value.toLowerCase().trim();
      const list = state.foods.filter(f=>f.name.toLowerCase().includes(term));
      renderResults(list);
    }, 200);
  };

  document.getElementById('addFood').onclick=()=>{
    if(!sel){ alert('Pick a food from results'); return; }
    const grams = parseFloat(document.getElementById('grams').value)||0;
    if(grams<=0){ alert('Enter grams'); return; }
    const factor = grams/100;
    const p = sel.per_100g;
    const entry = {
      meal: document.getElementById('mealType').value,
      name: sel.name, grams,
      kcal: +(p.calories*factor).toFixed(1),
      protein_g: +(p.protein_g*factor).toFixed(1),
      carbs_g: +(p.carbs_g*factor).toFixed(1),
      fat_g: +(p.fat_g*factor).toFixed(1)
    };
    state.logs[state.today].meals.push(entry);
    save();
  };

  render();
}

// --- Hydration & Mood ---
document.querySelectorAll('.chip[data-water]').forEach(b=>{
  b.onclick=()=>{ addWater(+b.dataset.water); };
});
document.getElementById('addWater').onclick=()=> {
  addWater(+document.getElementById('waterMl').value||0);
};
function addWater(ml){ if(ml<=0) return; state.logs[state.today].water_ml += ml; save(); }
document.getElementById('saveMood').onclick=()=>{
  state.logs[state.today].mood = document.getElementById('moodSel').value;
  save();
};

// --- Wellness ---
document.getElementById('saveWellness').onclick=()=>{
  const w = {
    sleep: +document.getElementById('sleepH').value||0,
    stress: +document.getElementById('stress').value||0,
    energy: +document.getElementById('energy').value||0,
    notes: document.getElementById('notes').value||""
  };
  state.logs[state.today].wellness.push(w);
  save();
};

// --- Render logs & charts ---
let calChart, waterChart;
function render(){
  const today = state.logs[state.today];

  // Meal log
  const mealLog = document.getElementById('mealLog');
  mealLog.innerHTML = '';
  today.meals.forEach(m=>{
    const div=document.createElement('div'); div.className='item';
    div.innerHTML = `<span>${m.meal}: ${m.name} (${m.grams}g)</span><span>${m.kcal} kcal</span>`;
    mealLog.appendChild(div);
  });

  // Totals
  const totals = today.meals.reduce((a,m)=>({
    kcal:a.kcal+m.kcal, p:a.p+m.protein_g, c:a.c+m.carbs_g, f:a.f+m.fat_g
  }), {kcal:0,p:0,c:0,f:0});
  document.getElementById('totals').innerHTML = `
    <div>Total: <strong>${totals.kcal.toFixed(0)} kcal</strong></div>
    <div class="muted">Protein ${totals.p.toFixed(1)}g • Carbs ${totals.c.toFixed(1)}g • Fat ${totals.f.toFixed(1)}g</div>
  `;

  // 7-day calories chart
  const days = [...Array(7)].map((_,i)=>{
    const d = new Date(Date.now() - (6-i)*86400000).toISOString().slice(0,10);
    const log = state.logs[d]||{meals:[],water_ml:0,mood:'😐 Neutral',wellness:[]};
    const kcal = log.meals.reduce((s,m)=>s+m.kcal,0);
    return {d,kcal,water:log.water_ml};
  });

  const labels = days.map(x=>x.d.slice(5));
  const kcals = days.map(x=>x.kcal);
  const waters = days.map(x=>x.water);

  if(calChart) calChart.destroy();
  calChart = new Chart(document.getElementById('calChart'), {
    type:'bar', data:{ labels, datasets:[{label:'Calories', data:kcals}] }, options:{responsive:true}
  });
  if(waterChart) waterChart.destroy();
  waterChart = new Chart(document.getElementById('waterChart'), {
    type:'line', data:{ labels, datasets:[{label:'Water (ml)', data:waters}] }, options:{responsive:true}
  });

  // Wellness list
  const wList=document.getElementById('wellnessList');
  wList.innerHTML = today.wellness.map(w=>`<div class="item"><span>Sleep ${w.sleep}h • Stress ${w.stress} • Energy ${w.energy}</span><span class="muted">${w.notes}</span></div>`).join('');
}

// --- AI Advice ---
document.getElementById('genAdvice').onclick=async()=>{
  const today = state.logs[state.today];
  const goal = document.getElementById('goal').value;
  const activity = document.getElementById('activity').value;
  const fitness = document.getElementById('fitness').value;
  const totals = today.meals.reduce((a,m)=>({
    kcal:a.kcal+m.kcal, p:a.p+m.protein_g, c:a.c+m.carbs_g, f:a.f+m.fat_g
  }), {kcal:0,p:0,c:0,f:0});
  const last7 = Object.entries(state.logs).slice(-7).map(([d,v])=>({
    date:d, kcal:v.meals.reduce((s,m)=>s+m.kcal,0), water:v.water_ml
  }));
  const recentSummary = {
    avgCalories: +(last7.reduce((s,x)=>s+x.kcal,0)/Math.max(1,last7.length)).toFixed(0),
    avgWater_ml: +(last7.reduce((s,x)=>s+x.water,0)/Math.max(1,last7.length)).toFixed(0)
  };

  const payload = {
    goal, activityLevel:activity, fitnessLevel:fitness,
    today: {
      calories: +totals.kcal.toFixed(0),
      macros: { protein_g:+totals.p.toFixed(1), carbs_g:+totals.c.toFixed(1), fat_g:+totals.f.toFixed(1) },
      meals: today.meals,
      water_ml: today.water_ml,
      mood: today.mood,
      sleep_hours: (today.wellness.at(-1)||{}).sleep || 0,
      stress: (today.wellness.at(-1)||{}).stress || 0,
      energy: (today.wellness.at(-1)||{}).energy || 0,
      symptoms: (today.wellness.at(-1)||{}).notes || ""
    },
    recentSummary
  };

  const res = await fetch('/api/openai', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  if(!res.ok){ alert('AI error'); return; }
  const data = await res.json().catch(()=>null);
  renderAdvice(data || {});
};

function renderAdvice(json){
  const box = document.getElementById('adviceCards');
  const safe = (x)=>Array.isArray(x)?x:[]; const text=(x)=> (typeof x==='string'?x:'');
  const workout = safe(json.workout).map(w=>`<div class="card"><h3>${w.title||'Workout'}</h3><ul>${(w.steps||[]).map(s=>`<li>${s}</li>`).join('')}</ul></div>`).join('');
  const nutrition = safe(json.nutrition).map(n=>`<div class="card"><h3>Nutrition</h3><p>${n.tip||''}</p></div>`).join('');
  const hs = safe(json.hydration_sleep).map(n=>`<div class="card"><h3>Hydration & Sleep</h3><p>${n.tip||''}</p></div>`).join('');
  const mot = `<div class="card"><h3>Motivation</h3><p>${text(json.motivation)||'You got this!'}</p></div>`;
  box.innerHTML = workout + nutrition + hs + mot;
}
