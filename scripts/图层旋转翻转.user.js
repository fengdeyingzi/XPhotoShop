// ==UserScript==
// @name         PhotoShop - 图层旋转/翻转
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  对选中图层进行旋转和翻转操作，支持设置中心点
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

        console.log('图层旋转/翻转插件已加载');

        app.menuManager.addMenuItem('图层', {
            label: '旋转图层...',
            action: 'rotate-layer',
            handler: () => showRotateDialog(app),
            position: 'bottom',
            divider: true
        });

        app.menuManager.addMenuItem('图层', {
            label: '翻转图层...',
            action: 'flip-layer',
            handler: () => showFlipDialog(app),
            position: 'bottom',
            divider: false
        });

        return true;
    }

    function tryInit() {
        if (!initPlugin()) {
            let attempts = 0;
            const interval = setInterval(() => {
                if (++attempts >= 100 || initPlugin()) clearInterval(interval);
            }, 100);
        }
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', tryInit);
    } else {
        tryInit();
    }

    function getBounds(layer) {
        const imageData = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
        const data = imageData.data;
        let minX = layer.canvas.width, minY = layer.canvas.height;
        let maxX = 0, maxY = 0;

        for (let y = 0; y < layer.canvas.height; y++) {
            for (let x = 0; x < layer.canvas.width; x++) {
                const alpha = data[(y * layer.canvas.width + x) * 4 + 3];
                if (alpha > 0) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        if (maxX < minX) return null;
        return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
    }

    function showRotateDialog(app) {
        const layer = app.layerManager.getActiveLayer();
        if (!layer) {
            alert('没有选中的图层');
            return;
        }

        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'dialog-box';
        dialog.style.width = '350px';

        const title = document.createElement('div');
        title.className = 'dialog-title';
        title.textContent = '旋转图层';

        const form = document.createElement('div');
        form.style.display = 'flex';
        form.style.flexDirection = 'column';
        form.style.gap = '15px';
        form.style.marginBottom = '15px';

        // 旋转角度
        const angleGroup = document.createElement('div');
        const angleLabel = document.createElement('label');
        angleLabel.textContent = '旋转角度:';
        angleLabel.style.color = '#ddd';
        angleLabel.style.marginBottom = '5px';
        angleLabel.style.display = 'block';

        const angleSelect = document.createElement('select');
        angleSelect.className = 'dialog-input';
        ['90', '180', '270', '360'].forEach(angle => {
            const option = document.createElement('option');
            option.value = angle;
            option.textContent = angle + '°';
            angleSelect.appendChild(option);
        });

        angleGroup.appendChild(angleLabel);
        angleGroup.appendChild(angleSelect);

        // 中心点位置
        const pivotGroup = document.createElement('div');
        const pivotLabel = document.createElement('label');
        pivotLabel.textContent = '中心点位置:';
        pivotLabel.style.color = '#ddd';
        pivotLabel.style.marginBottom = '5px';
        pivotLabel.style.display = 'block';

        const pivotGrid = document.createElement('div');
        pivotGrid.style.display = 'grid';
        pivotGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
        pivotGrid.style.gap = '5px';

        const positions = [
            ['左上', 'tl'], ['上中', 'tc'], ['右上', 'tr'],
            ['左中', 'ml'], ['中心', 'mc'], ['右中', 'mr'],
            ['左下', 'bl'], ['下中', 'bc'], ['右下', 'br']
        ];

        let selectedPivot = 'mc';
        positions.forEach(([label, value]) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.style.padding = '8px';
            btn.style.border = '1px solid #555';
            btn.style.background = value === 'mc' ? '#4CAF50' : '#333';
            btn.style.color = '#fff';
            btn.style.cursor = 'pointer';
            btn.style.borderRadius = '3px';
            btn.onclick = () => {
                pivotGrid.querySelectorAll('button').forEach(b => b.style.background = '#333');
                btn.style.background = '#4CAF50';
                selectedPivot = value;
            };
            pivotGrid.appendChild(btn);
        });

        pivotGroup.appendChild(pivotLabel);
        pivotGroup.appendChild(pivotGrid);

        form.appendChild(angleGroup);
        form.appendChild(pivotGroup);

        const buttons = document.createElement('div');
        buttons.className = 'dialog-buttons';

        const okBtn = document.createElement('button');
        okBtn.textContent = '确定';
        okBtn.className = 'dialog-btn dialog-btn-ok';
        okBtn.onclick = () => {
            document.body.removeChild(overlay);
            rotateLayer(app, layer, parseInt(angleSelect.value), selectedPivot);
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.className = 'dialog-btn dialog-btn-cancel';
        cancelBtn.onclick = () => document.body.removeChild(overlay);

        buttons.appendChild(okBtn);
        buttons.appendChild(cancelBtn);

        dialog.appendChild(title);
        dialog.appendChild(form);
        dialog.appendChild(buttons);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }

    function showFlipDialog(app) {
        const layer = app.layerManager.getActiveLayer();
        if (!layer) {
            alert('没有选中的图层');
            return;
        }

        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'dialog-box';
        dialog.style.width = '350px';

        const title = document.createElement('div');
        title.className = 'dialog-title';
        title.textContent = '翻转图层';

        const form = document.createElement('div');
        form.style.display = 'flex';
        form.style.flexDirection = 'column';
        form.style.gap = '15px';
        form.style.marginBottom = '15px';

        // 翻转方向
        const dirGroup = document.createElement('div');
        const dirLabel = document.createElement('label');
        dirLabel.textContent = '翻转方向:';
        dirLabel.style.color = '#ddd';
        dirLabel.style.marginBottom = '5px';
        dirLabel.style.display = 'block';

        const dirSelect = document.createElement('select');
        dirSelect.className = 'dialog-input';
        [['水平翻转', 'horizontal'], ['垂直翻转', 'vertical']].forEach(([label, value]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            dirSelect.appendChild(option);
        });

        dirGroup.appendChild(dirLabel);
        dirGroup.appendChild(dirSelect);

        // 中心点位置
        const pivotGroup = document.createElement('div');
        const pivotLabel = document.createElement('label');
        pivotLabel.textContent = '中心点位置:';
        pivotLabel.style.color = '#ddd';
        pivotLabel.style.marginBottom = '5px';
        pivotLabel.style.display = 'block';

        const pivotGrid = document.createElement('div');
        pivotGrid.style.display = 'grid';
        pivotGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
        pivotGrid.style.gap = '5px';

        const positions = [
            ['左上', 'tl'], ['上中', 'tc'], ['右上', 'tr'],
            ['左中', 'ml'], ['中心', 'mc'], ['右中', 'mr'],
            ['左下', 'bl'], ['下中', 'bc'], ['右下', 'br']
        ];

        let selectedPivot = 'mc';
        positions.forEach(([label, value]) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.style.padding = '8px';
            btn.style.border = '1px solid #555';
            btn.style.background = value === 'mc' ? '#4CAF50' : '#333';
            btn.style.color = '#fff';
            btn.style.cursor = 'pointer';
            btn.style.borderRadius = '3px';
            btn.onclick = () => {
                pivotGrid.querySelectorAll('button').forEach(b => b.style.background = '#333');
                btn.style.background = '#4CAF50';
                selectedPivot = value;
            };
            pivotGrid.appendChild(btn);
        });

        pivotGroup.appendChild(pivotLabel);
        pivotGroup.appendChild(pivotGrid);

        form.appendChild(dirGroup);
        form.appendChild(pivotGroup);

        const buttons = document.createElement('div');
        buttons.className = 'dialog-buttons';

        const okBtn = document.createElement('button');
        okBtn.textContent = '确定';
        okBtn.className = 'dialog-btn dialog-btn-ok';
        okBtn.onclick = () => {
            document.body.removeChild(overlay);
            flipLayer(app, layer, dirSelect.value, selectedPivot);
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.className = 'dialog-btn dialog-btn-cancel';
        cancelBtn.onclick = () => document.body.removeChild(overlay);

        buttons.appendChild(okBtn);
        buttons.appendChild(cancelBtn);

        dialog.appendChild(title);
        dialog.appendChild(form);
        dialog.appendChild(buttons);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }

    function getPivotPoint(bounds, pivot) {
        const map = {
            tl: [bounds.x, bounds.y],
            tc: [bounds.x + bounds.width / 2, bounds.y],
            tr: [bounds.x + bounds.width, bounds.y],
            ml: [bounds.x, bounds.y + bounds.height / 2],
            mc: [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2],
            mr: [bounds.x + bounds.width, bounds.y + bounds.height / 2],
            bl: [bounds.x, bounds.y + bounds.height],
            bc: [bounds.x + bounds.width / 2, bounds.y + bounds.height],
            br: [bounds.x + bounds.width, bounds.y + bounds.height]
        };
        return map[pivot] || map.mc;
    }

    function rotateLayer(app, layer, angle, pivot) {
        const bounds = getBounds(layer);
        if (!bounds) {
            alert('图层为空');
            return;
        }

        const [px, py] = getPivotPoint(bounds, pivot);
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = layer.canvas.width;
        tempCanvas.height = layer.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(layer.canvas, 0, 0);

        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        layer.ctx.save();
        layer.ctx.translate(px, py);
        layer.ctx.rotate((angle * Math.PI) / 180);
        layer.ctx.translate(-px, -py);
        layer.ctx.drawImage(tempCanvas, 0, 0);
        layer.ctx.restore();

        app.render();
        app.renderLayerList();
        app.saveHistory();
    }

    function flipLayer(app, layer, direction, pivot) {
        const bounds = getBounds(layer);
        if (!bounds) {
            alert('图层为空');
            return;
        }

        const [px, py] = getPivotPoint(bounds, pivot);
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = layer.canvas.width;
        tempCanvas.height = layer.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(layer.canvas, 0, 0);

        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        layer.ctx.save();
        layer.ctx.translate(px, py);
        if (direction === 'horizontal') {
            layer.ctx.scale(-1, 1);
        } else {
            layer.ctx.scale(1, -1);
        }
        layer.ctx.translate(-px, -py);
        layer.ctx.drawImage(tempCanvas, 0, 0);
        layer.ctx.restore();

        app.render();
        app.renderLayerList();
        app.saveHistory();
    }
})();
