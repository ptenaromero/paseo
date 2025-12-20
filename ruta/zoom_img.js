/* ============================================================
    1) MODAL GLOBAL PARA IMÁGENES (#imageModal) — SIEMPRE ACTIVO
    Para usarlo en cualquier HTML:
        <img src="mini.jpg"
            data-full="grande.jpg"           (opcional)
            data-caption="Leyenda"           (opcional)
            data-bs-toggle="modal"
            data-bs-target="#imageModal"
            class="img-thumb">
============================================================ */
(() => {
  // CSS (se puede mover a style.css)
    if (!document.getElementById('global-image-modal-style')) {
    const st = document.createElement('style');
    st.id = 'global-image-modal-style';
    st.textContent = `
        .img-thumb{cursor:zoom-in;}
        #imageModalImg{max-height:75vh;object-fit:contain;}
    `;
    document.head.appendChild(st);
    }

  // Crea el modal si no existe
    if (!document.getElementById('imageModal')) {
        document.body.insertAdjacentHTML('beforeend', `
        <div class="modal fade" id="imageModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-lg">
            <div class="modal-content border-0 shadow-lg">
                <div class="card m-0 border-0">
                <div class="card-header d-flex align-items-center justify-content-between">
                    <h5 class="m-0" id="imageModalLabel">Vista previa</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                </div>
                <div class="card-body p-0 bg-dark">
                    <img id="imageModalImg" src="" alt="" class="w-100 d-block" />
                </div>
                <div class="card-footer">
                    <small id="imageModalCaption" class="text-muted"></small>
                </div>
                </div>
            </div>
            </div>
        </div>
        `);
    }

  // Delegación: abre el modal para cualquier imagen que lo apunte
document.addEventListener('click', (e) => {
    const thumb = e.target.closest('[data-bs-target="#imageModal"]');
    if (!thumb) return;
    if (thumb.tagName === 'A') e.preventDefault();

    const fullSrc = thumb.dataset.full || thumb.currentSrc || thumb.src;
    let caption = thumb.dataset.caption || '';
    if (!caption) {
        const fig = thumb.closest('figure');
        caption = fig ? (fig.querySelector('figcaption')?.innerText || '').trim() : '';
    }
    caption = caption || thumb.alt || 'Imagen';

    const modal = document.getElementById('imageModal');
    modal.querySelector('#imageModalImg').src = fullSrc;
    modal.querySelector('#imageModalImg').alt = caption;
    modal.querySelector('#imageModalLabel').textContent = caption;
    });

  // Limpieza al cerrar
document.getElementById('imageModal')
    .addEventListener('hidden.bs.modal', () => {
        const img = document.querySelector('#imageModalImg');
        img.src = ''; img.alt = '';
    });
})();