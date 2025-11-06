// ==== CONFIG ====
const API_KEY = "YOUR_API_KEY_HERE"; // <-- Replace with your OpenWeatherMap key
// ===============

const els = {
  cityInput: document.getElementById('cityInput'),
  searchBtn: document.getElementById('searchBtn'),
  geoBtn: document.getElementById('geoBtn'),
  unitBtn: document.getElementById('unitBtn'),
  error: document.getElementById('error'),
  current: document.getElementById('current'),
  temp: document.getElementById('temp'),
  city: document.getElementById('cityName'),
  desc: document.getElementById('desc'),
  meta: document.getElementById('meta'),
  icon: document.getElementById('wIcon'),
  forecast: document.getElementById('forecast'),
};

let units = 'metric'; // 'metric' => °C, 'imperial' => °F

function iconUrl(code){ return `https://openweathermap.org/img/wn/${code}@2x.png`; }
function fmtTemp(t){ return Math.round(t) + (units==='metric' ? '°C' : '°F'); }
function windUnit(){ return units==='metric' ? 'm/s' : 'mph'; }

function setError(msg=''){ els.error.textContent = msg; }

function setLoading(isLoading){
  els.searchBtn.disabled = isLoading;
  els.geoBtn.disabled = isLoading;
  els.searchBtn.textContent = isLoading ? 'Loading…' : 'Search';
}

async function fetchJSON(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function getByCity(q){
  const base = 'https://api.openweathermap.org/data/2.5';
  const weatherUrl = `${base}/weather?q=${encodeURIComponent(q)}&appid=${API_KEY}&units=${units}`;
  const forecastUrl = `${base}/forecast?q=${encodeURIComponent(q)}&appid=${API_KEY}&units=${units}`;
  const [weather, forecast] = await Promise.all([fetchJSON(weatherUrl), fetchJSON(forecastUrl)]);
  return { weather, forecast };
}

async function getByCoords(lat, lon){
  const base = 'https://api.openweathermap.org/data/2.5';
  const weatherUrl = `${base}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${units}`;
  const forecastUrl = `${base}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${units}`;
  const [weather, forecast] = await Promise.all([fetchJSON(weatherUrl), fetchJSON(forecastUrl)]);
  return { weather, forecast };
}

function renderCurrent(w){
  els.current.style.display = 'flex';
  els.city.textContent = `${w.name}, ${w.sys?.country ?? ''}`.replace(/, $/,'');
  const cond = w.weather?.[0];
  els.desc.textContent = cond ? cond.description : '—';
  els.icon.src = cond ? iconUrl(cond.icon) : '';
  els.icon.alt = cond ? cond.main : '';
  els.temp.textContent = fmtTemp(w.main.temp);
  els.meta.innerHTML =
    `<span>Feels like ${fmtTemp(w.main.feels_like)}</span>` +
    `<span>Humidity ${w.main.humidity}%</span>` +
    `<span>Wind ${Math.round(w.wind.speed)} ${windUnit()}</span>`;
}

function pickMiddayPerDay(list){
  // Group by date (YYYY-MM-DD), pick the entry nearest to 12:00:00 UTC
  const byDay = {};
  list.forEach(item=>{
    const dt = new Date(item.dt * 1000);
    const key = dt.toISOString().slice(0,10);
    if(!byDay[key]) byDay[key] = [];
    byDay[key].push(item);
  });
  const picks = Object.keys(byDay).sort().map(day=>{
    const targetHour = 12; // noon UTC
    let best = byDay[day][0], bestDiff = 99;
    byDay[day].forEach(x=>{
      const h = new Date(x.dt*1000).getUTCHours();
      const d = Math.abs(h - targetHour);
      if(d < bestDiff){ bestDiff = d; best = x; }
    });
    return best;
  });
  const todayKey = new Date().toISOString().slice(0,10);
  const filtered = picks.filter(p => new Date(p.dt*1000).toISOString().slice(0,10) !== todayKey);
  return filtered.slice(0,3);
}

function renderForecast(f){
  els.forecast.innerHTML = '';
  const days = pickMiddayPerDay(f.list || []);
  days.forEach(item=>{
    const dt = new Date(item.dt * 1000);
    const dayName = dt.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
    const cond = item.weather?.[0] || {};
    const hi = Math.round(item.main.temp_max);
    const lo = Math.round(item.main.temp_min);
    const el = document.createElement('div');
    el.className = 'tile';
    el.innerHTML = `
      <div class="muted">${dayName}</div>
      <div style="display:flex; align-items:center; gap:8px; margin:6px 0;">
        <img class="icon" src="${iconUrl(cond.icon)}" alt="${cond.main || ''}" />
        <div style="font-weight:600;">${cond.description || ''}</div>
      </div>
      <div class="muted">High: ${fmtTemp(hi)} • Low: ${fmtTemp(lo)}</div>
    `;
    els.forecast.appendChild(el);
  });
}

async function run(fetcher){
  try {
    if(API_KEY === 'YOUR_API_KEY_HERE'){
      setError('Add your OpenWeatherMap API key in app.js.');
      return;
    }
    setError(''); setLoading(true);
    const { weather, forecast } = await fetcher();
    renderCurrent(weather);
    renderForecast(forecast);
  } catch (e){
    setError('Could not fetch weather. Check city name, permissions, or API key limits.');
    console.error(e);
  } finally {
    setLoading(false);
  }
}

// Events
async function searchCity(){
  const q = els.cityInput.value.trim();
  if(!q) return setError('Type a city name to search.');
  await run(async ()=> await getByCity(q));
}

async function useGeo(){
  if(!('geolocation' in navigator)) return setError('Geolocation not supported on this device.');
  setError('');
  navigator.geolocation.getCurrentPosition(async pos=>{
    const { latitude:lat, longitude:lon } = pos.coords;
    await run(async ()=> await getByCoords(lat, lon));
  }, err=>{
    setError('Location permission denied or unavailable.');
  }, { enableHighAccuracy:false, maximumAge:120000, timeout:8000 });
}

els.searchBtn.addEventListener('click', searchCity);
els.cityInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter') searchCity(); });
els.geoBtn.addEventListener('click', useGeo);
els.unitBtn.addEventListener('click', ()=>{
  units = (units === 'metric') ? 'imperial' : 'metric';
  if(els.city.textContent){
    const name = els.city.textContent.split(',')[0];
    run(async ()=> await getByCity(name));
  }
});

// Optional: auto-start with geolocation
// useGeo();
