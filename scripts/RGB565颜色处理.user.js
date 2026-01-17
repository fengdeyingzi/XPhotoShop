// ==UserScript==
// @name         PhotoShop - RGB565颜色处理工具
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  将图层转换为RGB565色彩空间，支持多种抖动算法
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

        console.log('RGB565颜色处理插件已加载');

        app.menuManager.addMenuItem('滤镜', {
            label: 'RGB565颜色处理...',
            action: 'rgb565-process',
            handler: () => showRGB565Dialog(app),
            position: 'bottom',
            divider: true
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

    // Bayer 8x8 矩阵
    const bayerMatrix = [
        [ 0, 32,  8, 40,  2, 34, 10, 42],
        [48, 16, 56, 24, 50, 18, 58, 26],
        [12, 44,  4, 36, 14, 46,  6, 38],
        [60, 28, 52, 20, 62, 30, 54, 22],
        [ 3, 35, 11, 43,  1, 33,  9, 41],
        [51, 19, 59, 27, 49, 17, 57, 25],
        [15, 47,  7, 39, 13, 45,  5, 37],
        [63, 31, 55, 23, 61, 29, 53, 21]
    ];

    function quantize(value, bits) {
        const max = (1 << bits) - 1;
        value = Math.max(0, Math.min(255, value));
        const shift = 8 - bits;
        const quantized = (value >> shift);
        const reconstructed = Math.round((quantized * 255) / max);
        return {
            val: reconstructed,
            err: value - reconstructed
        };
    }

    function distributeError(data, x, y, w, h, er, eg, eb, factor) {
        if (x < 0 || x >= w || y < 0 || y >= h) return;
        const idx = (y * w + x) * 4;
        data[idx] += er * factor;
        data[idx + 1] += eg * factor;
        data[idx + 2] += eb * factor;
    }

    function processLayerRGB565(layer, method, intensity) {
        const w = layer.canvas.width;
        const h = layer.canvas.height;
        const imageData = layer.ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        if (method === 'diffusion') {
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const idx = (y * w + x) * 4;
                    const oldR = data[idx];
                    const oldG = data[idx + 1];
                    const oldB = data[idx + 2];

                    const qR = quantize(oldR, 5);
                    const qG = quantize(oldG, 6);
                    const qB = quantize(oldB, 5);

                    data[idx] = qR.val;
                    data[idx + 1] = qG.val;
                    data[idx + 2] = qB.val;

                    const errR = qR.err * intensity;
                    const errG = qG.err * intensity;
                    const errB = qB.err * intensity;

                    distributeError(data, x + 1, y, w, h, errR, errG, errB, 7/16);
                    distributeError(data, x - 1, y + 1, w, h, errR, errG, errB, 3/16);
                    distributeError(data, x, y + 1, w, h, errR, errG, errB, 5/16);
                    distributeError(data, x + 1, y + 1, w, h, errR, errG, errB, 1/16);
                }
            }
        } else {
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const idx = (y * w + x) * 4;
                    let r = data[idx];
                    let g = data[idx + 1];
                    let b = data[idx + 2];

                    let offset = 0;
                    if (method === 'pattern') {
                        const mapVal = bayerMatrix[y % 8][x % 8];
                        offset = (mapVal - 31.5) * intensity;
                    } else if (method === 'noise') {
                        offset = (Math.random() - 0.5) * 64 * intensity;
                    }

                    const qR = quantize(r + offset, 5);
                    const qG = quantize(g + offset, 6);
                    const qB = quantize(b + offset, 5);

                    data[idx] = qR.val;
                    data[idx + 1] = qG.val;
                    data[idx + 2] = qB.val;
                }
            }
        }

        layer.ctx.putImageData(imageData, 0, 0);
    }

    function showRGB565Dialog(app) {
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'dialog-box';
        dialog.style.width = '700px';
        dialog.style.maxHeight = '90vh';
        dialog.style.overflow = 'auto';

        const title = document.createElement('div');
        title.className = 'dialog-title';
        title.textContent = 'RGB565颜色处理';

        const content = document.createElement('div');
        content.style.padding = '15px';

        const description = document.createElement('div');
        description.innerHTML = '<p style="color: #aaa; margin-bottom: 15px;">将图层转换为RGB565色彩空间（5位红，6位绿，5位蓝）</p>';
        content.appendChild(description);

        // 预览画布
        const previewContainer = document.createElement('div');
        previewContainer.style.marginBottom = '15px';
        previewContainer.style.padding = '10px';
        previewContainer.style.background = '#222';
        previewContainer.style.borderRadius = '5px';
        previewContainer.style.textAlign = 'center';

        const previewLabel = document.createElement('div');
        previewLabel.textContent = '预览效果';
        previewLabel.style.color = '#aaa';
        previewLabel.style.marginBottom = '10px';
        previewLabel.style.fontSize = '12px';

        const previewCanvas = document.createElement('canvas');
        previewCanvas.style.maxWidth = '100%';
        previewCanvas.style.maxHeight = '300px';
        previewCanvas.style.imageRendering = 'pixelated';
        previewCanvas.style.border = '1px solid #444';

        previewContainer.appendChild(previewLabel);
        previewContainer.appendChild(previewCanvas);
        content.appendChild(previewContainer);

        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.flexDirection = 'column';
        controls.style.gap = '15px';

        // 应用范围
        const scopeGroup = document.createElement('div');
        scopeGroup.style.display = 'flex';
        scopeGroup.style.alignItems = 'center';
        scopeGroup.style.gap = '10px';

        const scopeLabel = document.createElement('label');
        scopeLabel.textContent = '应用范围:';
        scopeLabel.style.color = '#ddd';
        scopeLabel.style.minWidth = '100px';

        const scopeSelect = document.createElement('select');
        scopeSelect.style.flex = '1';
        scopeSelect.style.padding = '6px';
        scopeSelect.style.background = '#2b2b2b';
        scopeSelect.style.color = '#ddd';
        scopeSelect.style.border = '1px solid #555';
        scopeSelect.style.borderRadius = '3px';
        scopeSelect.innerHTML = `
            <option value="selected">选中的图层</option>
            <option value="all">所有图层</option>
        `;

        scopeGroup.appendChild(scopeLabel);
        scopeGroup.appendChild(scopeSelect);

        // 抖动算法
        const methodGroup = document.createElement('div');
        methodGroup.style.display = 'flex';
        methodGroup.style.alignItems = 'center';
        methodGroup.style.gap = '10px';

        const methodLabel = document.createElement('label');
        methodLabel.textContent = '抖动算法:';
        methodLabel.style.color = '#ddd';
        methodLabel.style.minWidth = '100px';

        const methodSelect = document.createElement('select');
        methodSelect.style.flex = '1';
        methodSelect.style.padding = '6px';
        methodSelect.style.background = '#2b2b2b';
        methodSelect.style.color = '#ddd';
        methodSelect.style.border = '1px solid #555';
        methodSelect.style.borderRadius = '3px';
        methodSelect.innerHTML = `
            <option value="none">无 (直接截断)</option>
            <option value="diffusion" selected>扩散 (Floyd-Steinberg)</option>
            <option value="pattern">图案 (Bayer有序)</option>
            <option value="noise">杂色 (随机噪点)</option>
        `;

        methodGroup.appendChild(methodLabel);
        methodGroup.appendChild(methodSelect);

        // 强度
        const intensityGroup = document.createElement('div');
        intensityGroup.style.display = 'flex';
        intensityGroup.style.alignItems = 'center';
        intensityGroup.style.gap = '10px';

        const intensityLabel = document.createElement('label');
        intensityLabel.textContent = '抖动强度:';
        intensityLabel.style.color = '#ddd';
        intensityLabel.style.minWidth = '100px';

        const intensitySelect = document.createElement('select');
        intensitySelect.style.flex = '1';
        intensitySelect.style.padding = '6px';
        intensitySelect.style.background = '#2b2b2b';
        intensitySelect.style.color = '#ddd';
        intensitySelect.style.border = '1px solid #555';
        intensitySelect.style.borderRadius = '3px';
        intensitySelect.innerHTML = `
            <option value="0.5">低</option>
            <option value="0.8">中</option>
            <option value="1.0" selected>标准</option>
            <option value="1.2">高</option>
        `;

        intensityGroup.appendChild(intensityLabel);
        intensityGroup.appendChild(intensitySelect);

        controls.appendChild(scopeGroup);
        controls.appendChild(methodGroup);
        controls.appendChild(intensityGroup);
        content.appendChild(controls);

        // 更新预览
        function updatePreview() {
            const scope = scopeSelect.value;
            let previewLayer = null;

            if (scope === 'selected') {
                const selected = app.layerManager.selectedItems.filter(item => !item.isGroup);
                if (selected.length > 0) previewLayer = selected[0];
            } else {
                const allItems = app.layerManager.getAllItems();
                const layers = allItems.filter(item => !item.isGroup);
                if (layers.length > 0) previewLayer = layers[0];
            }

            if (!previewLayer) {
                previewLabel.textContent = '预览效果 - 无可用图层';
                return;
            }

            const method = methodSelect.value;
            const intensity = parseFloat(intensitySelect.value);

            // 复制图层数据
            const w = previewLayer.canvas.width;
            const h = previewLayer.canvas.height;
            previewCanvas.width = w;
            previewCanvas.height = h;
            const previewCtx = previewCanvas.getContext('2d');
            previewCtx.drawImage(previewLayer.canvas, 0, 0);

            // 处理预览
            const imageData = previewCtx.getImageData(0, 0, w, h);
            const data = imageData.data;

            if (method === 'diffusion') {
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const idx = (y * w + x) * 4;
                        const oldR = data[idx];
                        const oldG = data[idx + 1];
                        const oldB = data[idx + 2];

                        const qR = quantize(oldR, 5);
                        const qG = quantize(oldG, 6);
                        const qB = quantize(oldB, 5);

                        data[idx] = qR.val;
                        data[idx + 1] = qG.val;
                        data[idx + 2] = qB.val;

                        const errR = qR.err * intensity;
                        const errG = qG.err * intensity;
                        const errB = qB.err * intensity;

                        distributeError(data, x + 1, y, w, h, errR, errG, errB, 7/16);
                        distributeError(data, x - 1, y + 1, w, h, errR, errG, errB, 3/16);
                        distributeError(data, x, y + 1, w, h, errR, errG, errB, 5/16);
                        distributeError(data, x + 1, y + 1, w, h, errR, errG, errB, 1/16);
                    }
                }
            } else {
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const idx = (y * w + x) * 4;
                        let r = data[idx];
                        let g = data[idx + 1];
                        let b = data[idx + 2];

                        let offset = 0;
                        if (method === 'pattern') {
                            const mapVal = bayerMatrix[y % 8][x % 8];
                            offset = (mapVal - 31.5) * intensity;
                        } else if (method === 'noise') {
                            offset = (Math.random() - 0.5) * 64 * intensity;
                        }

                        const qR = quantize(r + offset, 5);
                        const qG = quantize(g + offset, 6);
                        const qB = quantize(b + offset, 5);

                        data[idx] = qR.val;
                        data[idx + 1] = qG.val;
                        data[idx + 2] = qB.val;
                    }
                }
            }

            previewCtx.putImageData(imageData, 0, 0);
            previewLabel.textContent = `预览效果 - ${previewLayer.name}`;
        }

        // 监听参数变化
        scopeSelect.addEventListener('change', updatePreview);
        methodSelect.addEventListener('change', updatePreview);
        intensitySelect.addEventListener('change', updatePreview);

        // 初始预览
        setTimeout(updatePreview, 100);

        const buttons = document.createElement('div');
        buttons.className = 'dialog-buttons';
        buttons.style.marginTop = '20px';

        const okBtn = document.createElement('button');
        okBtn.textContent = '应用';
        okBtn.className = 'dialog-btn dialog-btn-ok';
        okBtn.onclick = () => {
            const scope = scopeSelect.value;
            const method = methodSelect.value;
            const intensity = parseFloat(intensitySelect.value);

            const layersToProcess = [];
            if (scope === 'selected') {
                const selected = app.layerManager.selectedItems.filter(item => !item.isGroup);
                if (selected.length === 0) {
                    alert('请先选择至少一个图层');
                    return;
                }
                layersToProcess.push(...selected);
            } else {
                const allItems = app.layerManager.getAllItems();
                layersToProcess.push(...allItems.filter(item => !item.isGroup));
            }

            layersToProcess.forEach(layer => {
                processLayerRGB565(layer, method, intensity);
            });

            app.renderLayerList();
            app.render();
            app.saveHistory();
            document.body.removeChild(overlay);
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.className = 'dialog-btn dialog-btn-cancel';
        cancelBtn.onclick = () => document.body.removeChild(overlay);

        buttons.appendChild(okBtn);
        buttons.appendChild(cancelBtn);

        dialog.appendChild(title);
        dialog.appendChild(content);
        dialog.appendChild(buttons);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }
})();
