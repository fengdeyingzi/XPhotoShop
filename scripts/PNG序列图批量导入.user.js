// ==UserScript==
// @name         PhotoShop - PNG序列图批量导入
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  批量导入PNG序列图，支持裁剪区域选择
// @author       风的影子
// @match        file://*/PhotoShop/index.html
// @match        file://*/PhotoShop/PhotoShop.html
// @match        http://127.0.0.1:5500/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function initPlugin() {
        const app = window.photoShopApp;
        if (!app) return false;

        app.menuManager.addMenuItem('文件', {
            label: '导入PNG序列图...',
            action: 'import-png-sequence',
            handler: () => showImportDialog(app),
            position: 'bottom'
        });

        return true;
    }

    function tryInit() {
        if (!initPlugin()) {
            const interval = setInterval(() => {
                if (initPlugin()) clearInterval(interval);
            }, 100);
        }
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', tryInit);
    } else {
        tryInit();
    }

    function showImportDialog(app) {
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'dialog-box';
        dialog.style.width = '800px';

        const title = document.createElement('div');
        title.className = 'dialog-title';
        title.textContent = '导入PNG序列图';

        const content = document.createElement('div');
        content.style.padding = '20px';
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.style.gap = '15px';

        // 文件选择
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.accept = '.png';
        fileInput.style.display = 'none';

        const fileBtn = document.createElement('button');
        fileBtn.textContent = '选择PNG文件...';
        fileBtn.className = 'dialog-btn';
        fileBtn.onclick = () => fileInput.click();

        const fileInfo = document.createElement('div');
        fileInfo.style.color = '#888';
        fileInfo.style.fontSize = '12px';

        // 预览画布容器
        const previewContainer = document.createElement('div');
        previewContainer.style.display = 'none';
        previewContainer.style.flexDirection = 'column';
        previewContainer.style.gap = '10px';

        const previewCanvas = document.createElement('canvas');
        previewCanvas.style.border = '1px solid #666';
        previewCanvas.style.maxWidth = '100%';
        previewCanvas.style.cursor = 'crosshair';

        const cropInfo = document.createElement('div');
        cropInfo.style.color = '#aaa';
        cropInfo.style.fontSize = '12px';

        previewContainer.append(previewCanvas, cropInfo);

        // 选项
        const optionsRow = document.createElement('div');
        optionsRow.style.display = 'flex';
        optionsRow.style.gap = '20px';
        optionsRow.style.flexWrap = 'wrap';

        const sortSelect = document.createElement('select');
        sortSelect.className = 'dialog-input';
        sortSelect.innerHTML = `<option value="numeric">按数字排序</option><option value="filename">按文件名</option>`;

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'dialog-input';
        nameInput.value = 'Frame {number}';
        nameInput.style.flex = '1';

        optionsRow.append(sortSelect, nameInput);

        content.append(fileBtn, fileInfo, previewContainer, optionsRow);

        // 按钮
        const buttons = document.createElement('div');
        buttons.className = 'dialog-buttons';

        const importBtn = document.createElement('button');
        importBtn.textContent = '导入';
        importBtn.className = 'dialog-btn dialog-btn-ok';
        importBtn.disabled = true;

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.className = 'dialog-btn dialog-btn-cancel';
        cancelBtn.onclick = () => document.body.removeChild(overlay);

        buttons.append(importBtn, cancelBtn);
        dialog.append(title, content, buttons);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        let cropRect = null;
        let firstImg = null;

        fileInput.onchange = async () => {
            if (!fileInput.files.length) return;

            fileInfo.textContent = `已选择 ${fileInput.files.length} 个文件`;
            firstImg = await loadImage(fileInput.files[0]);

            previewCanvas.width = Math.min(firstImg.width, 760);
            previewCanvas.height = Math.min(firstImg.height, 400);
            const scale = Math.min(previewCanvas.width / firstImg.width, previewCanvas.height / firstImg.height);

            const ctx = previewCanvas.getContext('2d');
            ctx.drawImage(firstImg, 0, 0, firstImg.width * scale, firstImg.height * scale);

            previewContainer.style.display = 'flex';
            cropInfo.textContent = '拖动鼠标选择裁剪区域（可选）';
            importBtn.disabled = false;

            setupCropSelection(previewCanvas, firstImg, scale, (rect) => {
                cropRect = rect;
                cropInfo.textContent = rect ?
                    `裁剪区域: ${rect.x},${rect.y} - ${rect.w}×${rect.h}` :
                    '拖动鼠标选择裁剪区域（可选）';
            });
        };

        importBtn.onclick = async () => {
            importBtn.disabled = true;
            importBtn.textContent = '导入中...';
            try {
                await importSequence(app, fileInput.files, {
                    sortMethod: sortSelect.value,
                    namePattern: nameInput.value,
                    cropRect: cropRect,
                    firstImg: firstImg
                });
                document.body.removeChild(overlay);
            } catch (e) {
                alert('导入失败: ' + e.message);
                importBtn.disabled = false;
                importBtn.textContent = '导入';
            }
        };
    }

    function setupCropSelection(canvas, img, scale, onChange) {
        let startX, startY, isDrawing = false;
        const ctx = canvas.getContext('2d');

        canvas.onmousedown = (e) => {
            const rect = canvas.getBoundingClientRect();
            startX = e.clientX - rect.left;
            startY = e.clientY - rect.top;
            isDrawing = true;
        };

        canvas.onmousemove = (e) => {
            if (!isDrawing) return;
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, img.width * scale, img.height * scale);

            ctx.strokeStyle = '#0ff';
            ctx.lineWidth = 2;
            ctx.strokeRect(startX, startY, x - startX, y - startY);
        };

        canvas.onmouseup = (e) => {
            if (!isDrawing) return;
            isDrawing = false;

            const rect = canvas.getBoundingClientRect();
            const endX = e.clientX - rect.left;
            const endY = e.clientY - rect.top;

            const x = Math.min(startX, endX) / scale;
            const y = Math.min(startY, endY) / scale;
            const w = Math.abs(endX - startX) / scale;
            const h = Math.abs(endY - startY) / scale;

            if (w > 5 && h > 5) {
                onChange({ x: Math.floor(x), y: Math.floor(y), w: Math.floor(w), h: Math.floor(h) });
            } else {
                onChange(null);
            }
        };
    }

    function sortFiles(files, method) {
        return files.sort((a, b) => {
            if (method === 'numeric') {
                const numA = parseInt(a.name.match(/\d+/)?.[0] || '999999');
                const numB = parseInt(b.name.match(/\d+/)?.[0] || '999999');
                return numA - numB;
            }
            return a.name.localeCompare(b.name);
        });
    }

    async function importSequence(app, files, options) {
        const sorted = sortFiles(Array.from(files), options.sortMethod);
        const crop = options.cropRect;
        const w = crop ? crop.w : options.firstImg.width;
        const h = crop ? crop.h : options.firstImg.height;

        app.canvasManager.resize(w, h);
        app.selectionManager.resize(w, h);
        app.config.width = w;
        app.config.height = h;

        const group = app.layerManager.addGroup(`序列图 (${sorted.length}帧)`);

        for (let i = 0; i < sorted.length; i++) {
            const img = i === 0 ? options.firstImg : await loadImage(sorted[i]);
            const name = options.namePattern.replace('{number}', String(i + 1).padStart(2, '0'));
            const layer = app.layerManager.addLayer(w, h, name);

            const idx = app.layerManager.layers.indexOf(layer);
            if (idx !== -1) app.layerManager.layers.splice(idx, 1);

            if (crop) {
                layer.ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, w, h);
            } else {
                layer.ctx.drawImage(img, 0, 0);
            }

            group.addChild(layer);
        }

        app.renderLayerList();
        app.render();
        app.saveHistory();
        alert(`导入完成！共 ${sorted.length} 个图层`);
    }

    function loadImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('加载失败'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('读取失败'));
            reader.readAsDataURL(file);
        });
    }
})();
