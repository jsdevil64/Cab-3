import {db} from './firebase.js';
import {collection,onSnapshot,query,where} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

const box=document.querySelector('#vehicles');
let map, userMarker, villageMarker;
const vehicleMarkers=new Map();
let latestSnapshot=null;
let customerLocation=null;
let villageLocation=null;
let villageName='';
let radiusKm=10;

function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function distanceKm(lat1,lon1,lat2,lon2){
  const R=6371,toRad=v=>v*Math.PI/180;
  const dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function initMap(){
  const status=document.querySelector('#mapStatus');
  map=L.map('map',{zoomControl:true}).setView([11.1271,78.6569],7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
  status.textContent='Map ready';status.className='map-status ready';
  if(latestSnapshot)render(latestSnapshot);
}
function getVisibleProviders(snap){
  const providers=[];
  snap.forEach(d=>{
    const x=d.data();
    if(String(x.status||'').toLowerCase()!=='active'||x.locationSharing===false)return;
    const lat=Number(x.latitude),lng=Number(x.longitude);
    if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
    // When a village is searched, show only vehicles whose latest shared GPS position
    // falls within the selected radius of that village.
    const distance=villageLocation?distanceKm(villageLocation.latitude,villageLocation.longitude,lat,lng):
      customerLocation?distanceKm(customerLocation.latitude,customerLocation.longitude,lat,lng):Infinity;
    if(villageLocation&&distance>radiusKm)return;
    providers.push({id:d.id,data:x,lat,lng,distance});
  });
  return providers.sort((a,b)=>a.distance-b.distance);
}
function render(snap){
  latestSnapshot=snap;box.innerHTML='';
  const seen=new Set(),bounds=[];
  const providers=getVisibleProviders(snap);
  providers.forEach(({id,data:x,lat,lng,distance})=>{
    seen.add(id);bounds.push([lat,lng]);
    const phone=String(x.whatsapp||x.phone||'').replace(/\D/g,'');
    const wa=phone?`<a class="whatsapp" target="_blank" rel="noopener" href="https://wa.me/${phone}">💬 WhatsApp</a>`:'';
    const distanceText=(villageLocation||customerLocation)?`<p class="distance">📏 ${distance.toFixed(1)} km from ${villageLocation?'searched village':'you'}</p>`:`<p class="distance muted">📏 Use your location to see distance</p>`;
    box.insertAdjacentHTML('beforeend',`<article class="card"><span class="pill">ACTIVE</span><h3>${escapeHtml(x.vehicleNumber||'Vehicle')}</h3><p>${escapeHtml(x.name||'Provider')}</p>${distanceText}<p>📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}</p>${wa}</article>`);
    if(!map)return;
    const popup=`<div style="min-width:180px"><strong>${escapeHtml(x.vehicleNumber||'Vehicle')}</strong><br>${escapeHtml(x.name||'Provider')}<br>📏 ${distance.toFixed(1)} km away<br>📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}</div>`;
    let marker=vehicleMarkers.get(id);
    if(marker){marker.setLatLng([lat,lng]);marker.setPopupContent(popup);}
    else{marker=L.marker([lat,lng]).addTo(map).bindPopup(popup);vehicleMarkers.set(id,marker);}
  });
  for(const [id,marker] of vehicleMarkers){if(!seen.has(id)){marker.remove();vehicleMarkers.delete(id);}}
  if(map){
    if(villageLocation){bounds.push([villageLocation.latitude,villageLocation.longitude]);}
    else if(customerLocation&&providers.length===0)bounds.push([customerLocation.latitude,customerLocation.longitude]);
    if(bounds.length)map.fitBounds(bounds,{padding:[30,30],maxZoom:14});
  }
  const count=document.querySelector('#resultsStatus');
  if(count)count.textContent=villageLocation?`${providers.length} vehicle(s) within ${radiusKm} km of ${villageName}.`:`${providers.length} active vehicle(s) shown.`;
  if(!providers.length)box.innerHTML='<p class="muted">No active vehicles with a shared GPS location were found in this area.</p>';
}
async function searchVillage(){
  const input=document.querySelector('#search');
  const status=document.querySelector('#mapStatus');
  const q=input.value.trim();
  if(!q){status.textContent='Enter a village or town name.';status.className='map-status error';return;}
  radiusKm=Number(document.querySelector('#radius').value)||10;
  status.textContent='Searching village on map…';status.className='map-status';
  try{
    const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=in&q=${encodeURIComponent(q+', Tamil Nadu, India')}`;
    const response=await fetch(url,{headers:{'Accept':'application/json'}});
    if(!response.ok)throw new Error('Map search is temporarily unavailable.');
    const results=await response.json();
    if(!results.length)throw new Error('Village not found. Try village name with district name.');
    const place=results[0];villageName=place.display_name.split(',')[0]||q;
    villageLocation={latitude:Number(place.lat),longitude:Number(place.lon)};
    if(villageMarker)villageMarker.remove();
    villageMarker=L.marker([villageLocation.latitude,villageLocation.longitude]).addTo(map).bindPopup(`Searched place: ${escapeHtml(place.display_name)}`).openPopup();
    map.setView([villageLocation.latitude,villageLocation.longitude],13);
    status.textContent=`Map centered on ${villageName}`;status.className='map-status ready';
    if(latestSnapshot)render(latestSnapshot);
  }catch(e){status.textContent=e.message||'Could not search this village.';status.className='map-status error';}
}
function locateMe(){
  if(!navigator.geolocation){alert('Location is not supported on this device.');return;}
  if(!map){alert('Map is still loading. Please try again.');return;}
  navigator.geolocation.getCurrentPosition(pos=>{
    customerLocation={latitude:pos.coords.latitude,longitude:pos.coords.longitude};
    if(!userMarker)userMarker=L.circleMarker([customerLocation.latitude,customerLocation.longitude],{radius:9,weight:3,opacity:1,fillOpacity:.9}).addTo(map);
    else userMarker.setLatLng([customerLocation.latitude,customerLocation.longitude]);
    userMarker.bindPopup(`Your current location (accuracy about ${Math.round(pos.coords.accuracy)} m)`);
    if(!villageLocation)map.setView([customerLocation.latitude,customerLocation.longitude],14);
    if(latestSnapshot)render(latestSnapshot);
  },err=>{
    const messages={1:'Location permission was denied. Allow location access in browser settings.',2:'Your location could not be determined. Please try again.',3:'Location request timed out. Please try again.'};alert(messages[err.code]||'Could not get your location.');
  },{enableHighAccuracy:true,timeout:15000,maximumAge:10000});
}
window.searchProviders=searchVillage;
window.locateMe=locateMe;
document.querySelector('#search').addEventListener('keydown',e=>{if(e.key==='Enter')searchVillage();});
document.querySelector('#radius').addEventListener('change',()=>{radiusKm=Number(document.querySelector('#radius').value)||10;if(latestSnapshot)render(latestSnapshot);});
document.querySelector('#clearSearch').addEventListener('click',()=>{villageLocation=null;villageName='';if(villageMarker){villageMarker.remove();villageMarker=null;}document.querySelector('#search').value='';document.querySelector('#mapStatus').textContent='Showing all active vehicles';document.querySelector('#mapStatus').className='map-status ready';if(latestSnapshot)render(latestSnapshot);});
initMap();
if(navigator.geolocation)navigator.geolocation.getCurrentPosition(pos=>{customerLocation={latitude:pos.coords.latitude,longitude:pos.coords.longitude};if(latestSnapshot)render(latestSnapshot);},()=>{}, {enableHighAccuracy:true,timeout:10000,maximumAge:30000});
onSnapshot(query(collection(db,'providers'),where('status','==','active')),render,err=>{console.error('Provider listener error:',err);const status=document.querySelector('#mapStatus');status.textContent='Could not load active vehicles from Firebase.';status.className='map-status error';});
