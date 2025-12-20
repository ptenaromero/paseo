// codigo-gps.js

const ORS_PROXY_URL = "https://ors-proxy.ptenaromero.workers.dev/route";

const map = L.map('map').setView([40.4115, -3.6900], 15);
let userCoords = null;
let userMarker = null;
let currentRoute = null;
let paradaCercana = null; // parada activa para la CTA

// 🆕 centrado solo una vez
let hasCenteredOnUser = false;

// 🆕 Control robusto de CTA (distancias, TTL, cooldown global, clave estable)
const R_ENTER = 70;                          // entra a 70 m
const R_EXIT  = 90;                          // sale a 90 m
const DISMISS_TTL_MS         = 3 * 60 * 1000; // 3 min de silencio por-parada
const CTA_GLOBAL_COOLDOWN_MS = 8000;          // 8 s de silencio global tras cerrar CTA
let ctaMutedUntil  = 0;                       // 🆕 silencio global hasta este timestamp
let ctaVisibleId   = null;                    // 🆕 CTA actualmente visible (clave)
let currentCTAId   = null;                    // 🆕 clave de parada candidata actual

// 🆕 Map de descartes con caducidad: key -> timestampHasta
const dismissedUntil = new Map();
const keyFor = (p) => (p?.slug && p.slug.length) ? `slug:${p.slug}` : `id:${p.id}`; // 🆕 clave estable

const isDismissed = (p) => {                 // 🆕
    const k = keyFor(p);
    const until = dismissedUntil.get(k) || 0;
    if (until > Date.now()) return true;
    if (until) dismissedUntil.delete(k); // caducó
    return false;
};
const dismissForTTL = (p) => dismissedUntil.set(keyFor(p), Date.now() + DISMISS_TTL_MS); // 🆕
const clearDismiss  = (p) => dismissedUntil.delete(keyFor(p)); // 🆕

// --- progreso (lo tuyo) ---
const progressWrapEl = document.getElementById('progress-wrapper');
const progressEl     = document.getElementById('progresoRuta');
const continueBtn    = document.getElementById('continueBtn');

continueBtn?.addEventListener('click', () => {
    window.location.href = 'Resumen.html';
});

function hideProgressBar() {
    const wrap = document.getElementById('progreso-wrapper');
    if (wrap) wrap.remove();
}

const STORAGE_KEY = 'paradasVisitadas';
const visitadas = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));

function checkCompletion() {
    const total = paradas.length;
    if (!total) return;
    const pct = (visitadas.size / total) * 100;

    if (pct >= 100) {
        hideProgressBar();
        if (continueBtn) continueBtn.style.display = 'inline-block';
    } else {
        if (progressWrapEl) progressWrapEl.style.display = 'block';
        if (continueBtn) continueBtn.style.display = 'none';
    }
}

function updateProgress() {
    const total = paradas.length;
    const barra = document.getElementById('progresoRuta');
    if (!barra || total === 0) return;
    const pct = (visitadas.size / total) * 100;
    barra.style.width = `${pct}%`;
    checkCompletion();
}

// --- crea la barra CTA si no existe en el HTML ---
function ensureCTA() {
    if (document.getElementById('proximity-cta')) return;
    const div = document.createElement('div');
    div.id = 'proximity-cta';
    div.className = 'position-fixed bottom-0 start-0 end-0 bg-white border-top shadow p-2 d-none';
    div.style.zIndex = '1050';
    div.innerHTML = `
        <div class="d-flex align-items-center justify-content-between">
        <div class="small">
            <i class="bi bi-geo-alt"></i>
            Estás cerca de <strong data-name>la parada</strong>. ¿Quieres escanear?
        </div>
        <div class="d-flex gap-2">
            <button class="btn btn-outline-secondary btn-sm" id="btn-luego">Luego</button>
            <button class="btn btn-primary btn-sm" id="btn-escanear-cta">
            <i class="bi bi-camera"></i> Escanear
            </button>
        </div>
        </div>
    `;
    document.body.appendChild(div);

    // 🔧 “Luego”: descarta la parada visible (TTL) y activa cooldown global + limpia estados
    document.getElementById('btn-luego').onclick = () => {
        div.classList.add('d-none');
        const p = paradaCercana || (paradas.find(x => keyFor(x) === ctaVisibleId) || null); // 🆕
        if (p) dismissForTTL(p);                   // 🆕 silencio por-parada (TTL)
        ctaMutedUntil = Date.now() + CTA_GLOBAL_COOLDOWN_MS; // 🆕 silencio global corto
        ctaVisibleId  = null;                      // 🆕 evita re-render
        currentCTAId  = null;                      // 🆕
        paradaCercana = null;                      // 🆕
    };
}
ensureCTA();

L.tileLayer('https://api.maptiler.com/maps/basic/256/{z}/{x}/{y}.png?key=neXeQJpV7ISGxbEfvveN', {
    attribution: '&copy; <a href="https://www.maptiler.com/">MapTiler</a> contributors'
}).addTo(map);

// Marcar como visitada cuando se abre un popup (manual o por proximidad)
map.on('popupopen', (e) => {
    const { lat, lng } = e.popup._latlng;
    const clave = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (!visitadas.has(clave)) {
        visitadas.add(clave);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(visitadas)));
    }
    updateProgress();
});

function abrirEscaner(slug, idx) {
    const url = new URL('scan.html', location.href);
    if (slug) url.searchParams.set('scope', slug);       // p.ej. "paradas/parada-1.html"
    if (typeof idx === 'number') url.searchParams.set('only', String(idx));
    url.searchParams.set('from', 'gps'); //Origen de donde vengo 
    window.location.href = url.pathname + url.search;
}

// Obtener ubicación
if (navigator.geolocation) {
    navigator.geolocation.watchPosition(pos => {
        // const lat = pos.coords.latitude;
        // const lng = pos.coords.longitude;
        const lat = 40.409;   // Simulación fija (tu caso de prueba)
        const lng = -3.6901;
        userCoords = [lng, lat]; // ORS usa [lng, lat] (GeoJSON)

        // 🆕 centrar solo una vez
        if (!hasCenteredOnUser) {
        map.setView([lat, lng], 16);
        hasCenteredOnUser = true;
        }

        // Actualiza marcador del usuario sin recentrar cada tick
        if (!userMarker) {
        userMarker = L.marker([lat, lng], {
            icon: L.icon({
            iconUrl: "https://cdn-icons-png.flaticon.com/512/64/64113.png",
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            })
        }).addTo(map).bindPopup("Estás aquí");
        } else {
        userMarker.setLatLng([lat, lng]);
        }

        // 🆕 Si hay silencio global activo, NO recalcular CTA este tick
        if (Date.now() < ctaMutedUntil) {
        paradaCercana = null;
        currentCTAId  = null;
        updateCTA();
        return; // 🆕 corta aquí para evitar que se rearme la CTA inmediatamente
        }

        // Detectar proximidad y decidir CTA
        let masCercana = null;
        let minDist = Infinity;

        paradas.forEach(p => {
        const dist = getDistanceMeters(lat, lng, p.lat, p.lng);

        // POPUP: entra < R_ENTER; se resetea > R_EXIT
        if (dist < R_ENTER && !p.mostrado) {
            p.marker.openPopup();
            p.mostrado = true;
        } else if (dist > R_EXIT && p.mostrado) {
            p.mostrado = false;
            clearDismiss(p); // 🆕 al salir del área, olvidar descarte para reofrecer más tarde
        }

        // Candidata CTA: dentro de R_ENTER, no descartada por TTL y más cercana
        if (dist < R_ENTER && !isDismissed(p) && dist < minDist) {
            masCercana = p;
            minDist = dist;
        }
        });

        // Fija la parada activa + clave estable
        if (masCercana) {
        paradaCercana = masCercana;
        currentCTAId  = keyFor(masCercana); // 🆕 clave estable (slug o id)
        } else {
        paradaCercana = null;
        currentCTAId  = null;
        }

        updateCTA();
    }, err => {
        console.error("Error al obtener ubicación:", err);
        alert("Error de geolocalización: " + err.message);
    }, {
        enableHighAccuracy: true
    });
} else {
    alert("Geolocalización no soportada");
}

const paradas = [];

fetch('puntos.json')
    .then(res => res.json())
    .then(data => {
        data.forEach((p,index) => {
        const marker = L.marker([p.lat, p.lng]).addTo(map);

        const popup = `
            <h6 class="mb-1">${p.nombre}</h6>
            ${p.imagen1 ? `<img src="${p.imagen1}" class="card-img-top" alt="${p.nombre}" style="object-fit: cover; height: 150px;">` : ''}
            <p class="text-muted small mb-2">${(p.descripcion || '').substring(0, 80)}...</p>
            <div class="d-flex gap-2">
            <button class="btn btn-sm btn-success" onclick="rutaReal(${p.lng}, ${p.lat})">
                <i class="bi bi-sign-turn-right"></i> Cómo llegar
            </button>
            <button class="btn btn-sm btn-primary" id="scan-btn-${index}">
                <i class="bi bi-camera"></i> Escanear
            </button>
            </div>
        `;
        marker.bindPopup(popup);
        
        marker.bindTooltip(String(index + 1), {
            permanent: true,
            direction: 'center',
            className: 'marker-num'
        });

        marker.on('popupopen', (e) => {
            const btn = e.popup.getElement().querySelector(`#scan-btn-${index}`);
            if (btn) {
            btn.addEventListener('click', () => abrirEscaner(p.slug, p.targetIndex), { once: true });
            }
        });

        // 🔧 Guardamos slug e id para clave estable de CTA
        paradas.push({
            id: index,
            slug: p.slug,           // 🆕 importante para keyFor()
            nombre: p.nombre,
            lat: p.lat,
            lng: p.lng,
            marker: marker,
            mostrado: false,
            targetIndex: p.targetIndex
        });
        });
    });

// ORS
function rutaReal(destLng, destLat) {
    if (!userCoords) {
        alert("Ubicación no disponible aún.");
        return;
    }

    const url = `https://api.openrouteservice.org/v2/directions/foot-walking/geojson`;
    const body = {
        coordinates: [userCoords, [destLng, destLat]]
    };

    const rutaPanel = document.getElementById('ruta-panel');          
    const rutaInfo  = document.getElementById('ruta-info');            
    rutaPanel.classList.remove('d-none');                             
    rutaInfo.textContent = 'Calculando ruta...';                      

    map.closePopup();

    fetch(ORS_PROXY_URL, {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        },
        body: JSON.stringify(body)
    })
        .then(res => res.json())
        .then(data => {
        console.log("Respuesta ORS:", data);
        if (currentRoute) map.removeLayer(currentRoute);

        const coords = data.features[0].geometry.coordinates;
        const latlngs = coords.map(c => [c[1], c[0]]);

        currentRoute = L.polyline(latlngs, {
            color: 'blue',
            weight: 5,
            opacity: 0.8
        }).addTo(map);

        map.fitBounds(currentRoute.getBounds(), { padding: [30, 30] });
    
        const distance = data.features[0].properties.summary.distance;   
        const duration = data.features[0].properties.summary.duration;    
        rutaInfo.textContent = `Distancia: ${(distance / 1000).toFixed(2)} km | Tiempo estimado: ${(duration / 60).toFixed(0)} min`;

        })
        .catch(err => {
        console.error(err);
        alert("Error al calcular ruta.");
        rutaPanel.classList.add('d-none');
        });
}

function cerrarRuta(){
    if (currentRoute) {
        map.removeLayer(currentRoute);
        currentRoute = null;
    }
    document.getElementById('ruta-panel').classList.add('d-none');
    map.closePopup();                     
    // 🔧 ya NO recentramos continuamente; si quieres, añade un botón “volver a mi posición”
    // if (userCoords) map.setView([userCoords[1], userCoords[0]], 16);
}

function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radio de la Tierra en metros
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// 🔧 updateCTA: respeta TTL, cooldown global y evita re-render si ya muestra la misma parada
function updateCTA() {
    const bar = document.getElementById('proximity-cta');
    const btn = document.getElementById('btn-escanear-cta');
    if (!bar || !btn) return;

    // silencio global activo
    if (Date.now() < ctaMutedUntil) {
        bar.classList.add('d-none');
        btn.onclick = null;
        ctaVisibleId = null;
        return;
    }

    if (paradaCercana && !isDismissed(paradaCercana)) {
        const nextId = keyFor(paradaCercana); // clave estable

        // si ya está visible para la misma parada, no tocar DOM (evita parpadeo)
        if (ctaVisibleId !== nextId) {
        bar.querySelector('[data-name]').textContent = paradaCercana.nombre || 'la parada';
        btn.onclick = () => abrirEscaner(paradaCercana.slug, paradaCercana.targetIndex);
        bar.classList.remove('d-none');
        ctaVisibleId = nextId;
        }
    } else {
        if (!bar.classList.contains('d-none')) bar.classList.add('d-none');
        btn.onclick = null;
        ctaVisibleId = null;
    }
}
