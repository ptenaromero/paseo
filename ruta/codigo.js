const map = L.map('map').setView([40.4115, -3.6900], 15);
const STORAGE_KEY = 'paradasVisitadas';

// Mapa base de MapTiler en vista satélite
L.tileLayer('https://api.maptiler.com/maps/basic/256/{z}/{x}/{y}.png?key=1tfd0I7XjBQX8BJhjTX3', {
    attribution: '&copy; <a href="https://www.maptiler.com/">MapTiler</a> contributors'
}).addTo(map);


const listaParadas = document.getElementById('lista-paradas');
const modalContainer = document.createElement('div');
document.body.appendChild(modalContainer); // Los modales se insertan al final del body

// Cargar las paradas
fetch('puntos.json')
    .then(res => res.json())
    .then(data => {
    let polylineCoords = [];
    data.forEach((p,index) => {
        polylineCoords.push([p.lat, p.lng]);
        const popup = `
        <div class="card border-0" style=" width: 16rem;">
            <img src="${p.imagen1}" class="card-img-top" alt="${p.nombre}" style="object-fit: cover; height: 150px;">
            <div class="card-body p-2">
            <h6 class="card-title">${p.nombre}</h6>
            <p class="card-text text-muted small">${p.descripcion.substring(0, 80)}...</p>
            <button onclick="window.location.href='${p.id}.html?id=${p.id}'" class="btn btn-sm btn-primary" style="opacity: 1; text-decoration: none;"> Ver más </button>
            </div>
        </div>
        `;
        const marker = L.marker([p.lat, p.lng]).addTo(map).bindPopup(popup);
        marker.bindTooltip(String(index + 1), {
            permanent: true,
            direction: 'center',
            className: 'marker-num'
        });
        const btn = document.createElement('button');
        btn.className = 'btn btn-parada border';
        btn.textContent = `${index + 1}. ${p.nombre}`;
        btn.addEventListener('click', () => {
            map.setView([p.lat, p.lng], 17);
            marker.openPopup();
        });
        listaParadas.appendChild(btn);
        /*modalContainer.innerHTML += `
            <div class="modal fade" id="modal-${index}" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">${p.nombre}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="${p.imagen1}" class="img-fluid mb-3 rounded">
                    <p>${p.descripcion}</p>
                    <audio controls class="w-100 mt-3">
                    <source src="${p.audio}" type="audio/mpeg">
                    </audio>
                </div>
                </div>
            </div>
            </div>
        `;*/
            });   
            updateProgress();
            checkCompletion(); //para actualizar la barra de progreso   
    L.polyline(polylineCoords, { color: 'blue', weight: 0.8, opacity: 0.8, dashArray: '4, 10' }).addTo(map);
});


const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('toggleSidebar');


toggleBtn.addEventListener('click', () => {
    const isOpen = sidebar.style.transform === 'translateX(0%)';
    sidebar.style.transform = isOpen ? 'translateX(100%)' : 'translateX(0%)';

    if(isOpen){
        document.body.classList.remove('sidebar-open');
    }else{
        document.body.classList.add('sidebar-open');
    }
});

document.addEventListener('click', (e) => {
    if (document.body.classList.contains('sidebar-open') && !sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
        sidebar.style.transform = 'translateX(100%)';
        document.body.classList.remove('sidebar-open');
    }
});


// Leemos de storage (o empezamos con array vacío)
const visitadas = new Set(
    JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
);


function hideProgressBar() {
    const wrap = document.getElementById('progreso-wrapper');
    if (wrap) wrap.remove();
}

function checkCompletion() {
    const total = document.querySelectorAll('#lista-paradas button').length; 
    if (!total) return;
    const pct = (visitadas.size / total) * 100;

    if (pct >= 100) {
        hideProgressBar();                               
        if (continueBtn) continueBtn.style.display = 'inline-block';
    } else {
        // estado intermedio: mostrar barra, ocultar botón
        if (progressWrapEl) progressWrapEl.style.display = 'block';
        if (continueBtn) continueBtn.style.display = 'none';
    }
}

// Función para actualizar la barra
function updateProgress() {
    const total = document.querySelectorAll('#lista-paradas button').length;
    const progreso = document.getElementById('progresoRuta');
    if (!progreso || total === 0) return;
    const pct = (visitadas.size / total) * 100;
    progreso.style.width = `${pct}%`;
    checkCompletion();
}

// --- Referencia al botón
const progressWrapEl = document.getElementById('progress-wrapper');
const progressEl     = document.getElementById('progresoRuta');
const continueBtn = document.getElementById('continueBtn');

// --- Redirección al pulsar (cambia 'final.html' si quieres otro destino)
continueBtn.addEventListener('click', () => {
    window.location.href = 'Resumen.html';
});

// Listener de apertura de popup: añadimos y guardamos 
map.on('popupopen', (e) => {
    const { lat, lng } = e.popup._latlng;
    const clave = `${lat.toFixed(5)},${lng.toFixed(5)}`;

    if (!visitadas.has(clave)) {
        visitadas.add(clave);
        // Guardamos el array actualizado
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(visitadas)));
    }
    updateProgress();
});

//  Al cargar el mapa: restauramos el progreso 
map.whenReady(() => {
    updateProgress();
});

function mostrarModal(index) {
    map.closePopup();
    const modal = new bootstrap.Modal(document.getElementById(`modal-${index}`));
    modal.show();
    
}

