// ==UserScript==
// @name         PhotoShop图像编辑增强
// @namespace    http://tampermonkey.net/
// @version      1.0
// @author       风的影子
// @description  添加描边、亮度/对比度、色相/饱和度、锐化功能
// @match        file://*/PhotoShop/index.html
// @match        file://*/PhotoShop/PhotoShop.html
// @match        http://127.0.0.1:5500/*PhotoShop*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // CSS样式
    const style = document.createElement('style');
    style.textContent = `
        .ps-dialog-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.5); z-index: 9999;
            display: flex; justify-content: center; align-items: center;
            font-family: "Segoe UI", sans-serif; font-size: 13px; color: #dcdcdc;
        }
        .ps-edit-dialog {
            background: #3a3a3a; border: 1px solid #555; box-shadow: 0 10px 30px rgba(0,0,0,0.7);
            width: 700px; display: flex; flex-direction: column; border-radius: 4px;
        }
        .ps-dialog-header {
            background: #2a2a2a; padding: 10px 15px; font-weight: 600; border-bottom: 1px solid #222;
        }
        .ps-dialog-content {
            display: flex; padding: 20px; gap: 20px;
        }
        .ps-panel-left {
            width: 250px; display: flex; flex-direction: column; gap: 15px;
        }
        .ps-panel-right {
            flex: 1; background: #222; display: flex; justify-content: center; align-items: center;
            background-image: linear-gradient(45deg, #2a2a2a 25%, transparent 25%),
                              linear-gradient(-45deg, #2a2a2a 25%, transparent 25%),
                              linear-gradient(45deg, transparent 75%, #2a2a2a 75%),
                              linear-gradient(-45deg, transparent 75%, #2a2a2a 75%);
            background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
        }
        .ps-control-row {
            display: flex; flex-direction: column; gap: 5px;
        }
        .ps-control-row label {
            color: #aaa; font-size: 12px;
        }
        .ps-slider-container {
            display: flex; align-items: center; gap: 10px;
        }
        .ps-slider-container input[type="range"] {
            flex: 1; cursor: pointer;
        }
        .ps-slider-val {
            width: 40px; text-align: right; color: #3498db; font-weight: bold;
        }
        canvas.preview-canvas {
            max-width: 100%; max-height: 350px; border: 1px solid #444;
        }
        .ps-dialog-footer {
            padding: 12px 15px; background: #2a2a2a; border-top: 1px solid #222;
            display: flex; justify-content: flex-end; gap: 10px;
        }
        .ps-btn {
            background: #555; border: 1px solid #222; color: #eee; padding: 6px 20px;
            cursor: pointer; border-radius: 2px;
        }
        .ps-btn:hover { background: #666; }
        .ps-btn.primary { background: #1f65a3; border-color: #103f69; }
        .ps-btn.primary:hover { background: #267ac1; }
    `;
    document.head.appendChild(style);

    // 等待应用加载
    const waitForApp = setInterval(() => {
        if (window.photoShopApp) {
            clearInterval(waitForApp);
            initPlugin(window.photoShopApp);
        }
    }, 500);

    function initPlugin(app) {
        // 添加菜单项
        app.menuManager.addMenuItem('编辑', {
            label: '描边...',
            action: 'stroke',
            handler: () => showStrokeDialog(app),
            position: 'bottom',
            divider: true
        });

        app.menuManager.addMenuItem('图像', {
            label: '亮度/对比度...',
            action: 'brightness-contrast',
            handler: () => showBrightnessContrastDialog(app),
            position: 'bottom'
        });

        app.menuManager.addMenuItem('图像', {
            label: '色相/饱和度...',
            action: 'hue-saturation',
            handler: () => showHueSaturationDialog(app),
            position: 'bottom'
        });

        app.menuManager.addMenuItem('图像', {
            label: '锐化...',
            action: 'sharpen',
            handler: () => showSharpenDialog(app),
            position: 'bottom',
            divider: true
        });

        Toast.show('图像编辑增强插件已加载', 'success');
    }

    // 描边对话框
    function showStrokeDialog(app) {
        const layer = app.layerManager.getActiveLayer();
        if (!layer) {
            Toast.show('请先选择图层', 'warning');
            return;
        }

        const state = { color: '#000000', width: 1, type: 'center', opacity: 100, antiAlias: true };
        const originalData = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);

        const overlay = createDialog('描边', `
            <div class="ps-control-row">
                <label>描边颜色</label>
                <input type="color" id="stroke-color" value="${state.color}" style="width:100%; height:30px; cursor:pointer;">
            </div>
            <div class="ps-control-row">
                <label>描边宽度</label>
                <div class="ps-slider-container">
                    <input type="range" id="stroke-width" min="1" max="20" value="${state.width}">
                    <span class="ps-slider-val" id="val-width">${state.width}</span>
                </div>
            </div>
            <div class="ps-control-row">
                <label>描边类型</label>
                <select id="stroke-type" style="width:100%; background:#222; border:1px solid #555; color:#eee; padding:4px; border-radius:2px;">
                    <option value="center">居中</option>
                    <option value="outside">外部</option>
                    <option value="inside">内部</option>
                </select>
            </div>
            <div class="ps-control-row">
                <label>不透明度</label>
                <div class="ps-slider-container">
                    <input type="range" id="stroke-opacity" min="0" max="100" value="${state.opacity}">
                    <span class="ps-slider-val" id="val-opacity">${state.opacity}%</span>
                </div>
            </div>
            <div class="ps-control-row">
                <label style="display:flex; align-items:center; gap:5px;">
                    <input type="checkbox" id="stroke-antialias" checked style="cursor:pointer;">
                    <span>抗锯齿</span>
                </label>
            </div>
        `);

        const previewCanvas = overlay.querySelector('#preview-canvas');
        const previewCtx = previewCanvas.getContext('2d');
        setupPreviewCanvas(previewCanvas, layer.canvas);

        const updatePreview = () => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = layer.canvas.width;
            tempCanvas.height = layer.canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(originalData, 0, 0);

            strokeLayer(tempCtx, layer.canvas.width, layer.canvas.height,
                app.selectionManager, state);

            drawPreview(previewCtx, previewCanvas, tempCanvas);
        };

        overlay.querySelector('#stroke-color').addEventListener('input', (e) => {
            state.color = e.target.value;
            updatePreview();
        });

        overlay.querySelector('#stroke-width').addEventListener('input', (e) => {
            state.width = parseInt(e.target.value);
            overlay.querySelector('#val-width').textContent = state.width;
            updatePreview();
        });

        overlay.querySelector('#stroke-type').addEventListener('change', (e) => {
            state.type = e.target.value;
            updatePreview();
        });

        overlay.querySelector('#stroke-opacity').addEventListener('input', (e) => {
            state.opacity = parseInt(e.target.value);
            overlay.querySelector('#val-opacity').textContent = state.opacity + '%';
            updatePreview();
        });

        overlay.querySelector('#stroke-antialias').addEventListener('change', (e) => {
            state.antiAlias = e.target.checked;
            updatePreview();
        });

        overlay.querySelector('#btn-cancel').addEventListener('click', () => document.body.removeChild(overlay));
        overlay.querySelector('#btn-ok').addEventListener('click', () => {
            strokeLayer(layer.ctx, layer.canvas.width, layer.canvas.height,
                app.selectionManager, state);
            app.render();
            app.saveHistory();
            document.body.removeChild(overlay);
            Toast.show('描边完成', 'success');
        });

        updatePreview();
        document.body.appendChild(overlay);
    }

    // 亮度/对比度对话框
    function showBrightnessContrastDialog(app) {
        const layer = app.layerManager.getActiveLayer();
        if (!layer) {
            Toast.show('请先选择图层', 'warning');
            return;
        }

        const state = { brightness: 0, contrast: 0 };
        const originalData = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);

        const overlay = createDialog('亮度/对比度', `
            <div class="ps-control-row">
                <label>亮度</label>
                <div class="ps-slider-container">
                    <input type="range" id="brightness" min="-100" max="100" value="0">
                    <span class="ps-slider-val" id="val-brightness">0</span>
                </div>
            </div>
            <div class="ps-control-row">
                <label>对比度</label>
                <div class="ps-slider-container">
                    <input type="range" id="contrast" min="-100" max="100" value="0">
                    <span class="ps-slider-val" id="val-contrast">0</span>
                </div>
            </div>
        `);

        const previewCanvas = overlay.querySelector('#preview-canvas');
        const previewCtx = previewCanvas.getContext('2d');
        setupPreviewCanvas(previewCanvas, layer.canvas);

        const updatePreview = () => {
            const imageData = new ImageData(
                new Uint8ClampedArray(originalData.data),
                originalData.width, originalData.height
            );
            adjustBrightnessContrast(imageData, state.brightness, state.contrast);

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = layer.canvas.width;
            tempCanvas.height = layer.canvas.height;
            tempCanvas.getContext('2d').putImageData(imageData, 0, 0);

            drawPreview(previewCtx, previewCanvas, tempCanvas);
        };

        overlay.querySelector('#brightness').addEventListener('input', (e) => {
            state.brightness = parseInt(e.target.value);
            overlay.querySelector('#val-brightness').textContent = state.brightness;
            updatePreview();
        });

        overlay.querySelector('#contrast').addEventListener('input', (e) => {
            state.contrast = parseInt(e.target.value);
            overlay.querySelector('#val-contrast').textContent = state.contrast;
            updatePreview();
        });

        overlay.querySelector('#btn-cancel').addEventListener('click', () => document.body.removeChild(overlay));
        overlay.querySelector('#btn-ok').addEventListener('click', () => {
            const imageData = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
            adjustBrightnessContrast(imageData, state.brightness, state.contrast);
            layer.ctx.putImageData(imageData, 0, 0);
            app.render();
            app.saveHistory();
            document.body.removeChild(overlay);
            Toast.show('亮度/对比度调整完成', 'success');
        });

        updatePreview();
        document.body.appendChild(overlay);
    }

    // 色相/饱和度对话框
    function showHueSaturationDialog(app) {
        const layer = app.layerManager.getActiveLayer();
        if (!layer) {
            Toast.show('请先选择图层', 'warning');
            return;
        }

        const state = { hue: 0, saturation: 0 };
        const originalData = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);

        const overlay = createDialog('色相/饱和度', `
            <div class="ps-control-row">
                <label>色相</label>
                <div class="ps-slider-container">
                    <input type="range" id="hue" min="-180" max="180" value="0">
                    <span class="ps-slider-val" id="val-hue">0</span>
                </div>
            </div>
            <div class="ps-control-row">
                <label>饱和度</label>
                <div class="ps-slider-container">
                    <input type="range" id="saturation" min="-100" max="100" value="0">
                    <span class="ps-slider-val" id="val-saturation">0</span>
                </div>
            </div>
        `);

        const previewCanvas = overlay.querySelector('#preview-canvas');
        const previewCtx = previewCanvas.getContext('2d');
        setupPreviewCanvas(previewCanvas, layer.canvas);

        const updatePreview = () => {
            const imageData = new ImageData(
                new Uint8ClampedArray(originalData.data),
                originalData.width, originalData.height
            );
            adjustHueSaturation(imageData, state.hue, state.saturation);

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = layer.canvas.width;
            tempCanvas.height = layer.canvas.height;
            tempCanvas.getContext('2d').putImageData(imageData, 0, 0);

            drawPreview(previewCtx, previewCanvas, tempCanvas);
        };

        overlay.querySelector('#hue').addEventListener('input', (e) => {
            state.hue = parseInt(e.target.value);
            overlay.querySelector('#val-hue').textContent = state.hue;
            updatePreview();
        });

        overlay.querySelector('#saturation').addEventListener('input', (e) => {
            state.saturation = parseInt(e.target.value);
            overlay.querySelector('#val-saturation').textContent = state.saturation;
            updatePreview();
        });

        overlay.querySelector('#btn-cancel').addEventListener('click', () => document.body.removeChild(overlay));
        overlay.querySelector('#btn-ok').addEventListener('click', () => {
            const imageData = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
            adjustHueSaturation(imageData, state.hue, state.saturation);
            layer.ctx.putImageData(imageData, 0, 0);
            app.render();
            app.saveHistory();
            document.body.removeChild(overlay);
            Toast.show('色相/饱和度调整完成', 'success');
        });

        updatePreview();
        document.body.appendChild(overlay);
    }

    // 锐化对话框
    function showSharpenDialog(app) {
        const layer = app.layerManager.getActiveLayer();
        if (!layer) {
            Toast.show('请先选择图层', 'warning');
            return;
        }

        const state = { strength: 1 };
        const originalData = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);

        const overlay = createDialog('锐化', `
            <div class="ps-control-row">
                <label>锐化强度</label>
                <div class="ps-slider-container">
                    <input type="range" id="strength" min="1" max="5" value="1">
                    <span class="ps-slider-val" id="val-strength">1</span>
                </div>
            </div>
        `);

        const previewCanvas = overlay.querySelector('#preview-canvas');
        const previewCtx = previewCanvas.getContext('2d');
        setupPreviewCanvas(previewCanvas, layer.canvas);

        const updatePreview = () => {
            const imageData = new ImageData(
                new Uint8ClampedArray(originalData.data),
                originalData.width, originalData.height
            );
            sharpenImage(imageData, state.strength);

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = layer.canvas.width;
            tempCanvas.height = layer.canvas.height;
            tempCanvas.getContext('2d').putImageData(imageData, 0, 0);

            drawPreview(previewCtx, previewCanvas, tempCanvas);
        };

        overlay.querySelector('#strength').addEventListener('input', (e) => {
            state.strength = parseInt(e.target.value);
            overlay.querySelector('#val-strength').textContent = state.strength;
            updatePreview();
        });

        overlay.querySelector('#btn-cancel').addEventListener('click', () => document.body.removeChild(overlay));
        overlay.querySelector('#btn-ok').addEventListener('click', () => {
            const imageData = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
            sharpenImage(imageData, state.strength);
            layer.ctx.putImageData(imageData, 0, 0);
            app.render();
            app.saveHistory();
            document.body.removeChild(overlay);
            Toast.show('锐化完成', 'success');
        });

        updatePreview();
        document.body.appendChild(overlay);
    }

    // 工具函数
    function createDialog(title, controlsHTML) {
        const overlay = document.createElement('div');
        overlay.className = 'ps-dialog-overlay';
        overlay.innerHTML = `
            <div class="ps-edit-dialog">
                <div class="ps-dialog-header">${title}</div>
                <div class="ps-dialog-content">
                    <div class="ps-panel-left">${controlsHTML}</div>
                    <div class="ps-panel-right">
                        <canvas id="preview-canvas" class="preview-canvas"></canvas>
                    </div>
                </div>
                <div class="ps-dialog-footer">
                    <button class="ps-btn" id="btn-cancel">取消</button>
                    <button class="ps-btn primary" id="btn-ok">确定</button>
                </div>
            </div>
        `;
        return overlay;
    }

    function setupPreviewCanvas(canvas, sourceCanvas) {
        const maxSize = 350;
        const scale = Math.min(1, maxSize / Math.max(sourceCanvas.width, sourceCanvas.height));
        canvas.width = sourceCanvas.width * scale;
        canvas.height = sourceCanvas.height * scale;
    }

    function drawPreview(ctx, canvas, sourceCanvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
    }

    // 描边实现
    function strokeLayer(ctx, w, h, selectionManager, state) {
        const { color, width, type, opacity, antiAlias } = state;
        const alpha = opacity / 100;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.imageSmoothingEnabled = antiAlias;

        if (selectionManager.hasSelection) {
            const segments = selectionManager.detectEdgeSegments();
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.lineCap = 'square';
            segments.horizontal.forEach(seg => {
                ctx.beginPath();
                ctx.moveTo(seg.x1, seg.y);
                ctx.lineTo(seg.x2, seg.y);
                ctx.stroke();
            });
            segments.vertical.forEach(seg => {
                ctx.beginPath();
                ctx.moveTo(seg.x, seg.y1);
                ctx.lineTo(seg.x, seg.y2);
                ctx.stroke();
            });
        } else {
            const imageData = ctx.getImageData(0, 0, w, h);
            const data = imageData.data;
            const edges = new Map();

            // 检测边缘
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const i = (y * w + x) * 4;
                    if (data[i + 3] > 0) {
                        const isEdge = x === 0 || x === w - 1 || y === 0 || y === h - 1 ||
                            data[((y - 1) * w + x) * 4 + 3] === 0 ||
                            data[((y + 1) * w + x) * 4 + 3] === 0 ||
                            data[(y * w + (x - 1)) * 4 + 3] === 0 ||
                            data[(y * w + (x + 1)) * 4 + 3] === 0;

                        if (isEdge) {
                            edges.set(`${x},${y}`, true);
                        }
                    }
                }
            }

            // 根据类型绘制描边
            const strokePixels = new Set();
            edges.forEach((_, key) => {
                const [x, y] = key.split(',').map(Number);

                for (let dy = -width; dy <= width; dy++) {
                    for (let dx = -width; dx <= width; dx++) {
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > width) continue;

                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;

                        const ni = (ny * w + nx) * 4;
                        const hasPixel = data[ni + 3] > 0;

                        // 根据类型判断是否绘制
                        if (type === 'outside' && hasPixel) continue;
                        if (type === 'inside' && !hasPixel) continue;

                        strokePixels.add(`${nx},${ny}`);
                    }
                }
            });

            // 绘制描边
            const rgb = hexToRgb(color);
            strokePixels.forEach(pos => {
                const [x, y] = pos.split(',').map(Number);
                ctx.fillStyle = color;
                ctx.fillRect(x, y, 1, 1);
            });
        }

        ctx.restore();
    }

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    // 亮度/对比度实现
    function adjustBrightnessContrast(imageData, brightness, contrast) {
        const data = imageData.data;
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) continue;

            let r = data[i] + brightness;
            let g = data[i + 1] + brightness;
            let b = data[i + 2] + brightness;

            r = factor * (r - 128) + 128;
            g = factor * (g - 128) + 128;
            b = factor * (b - 128) + 128;

            data[i] = Math.max(0, Math.min(255, r));
            data[i + 1] = Math.max(0, Math.min(255, g));
            data[i + 2] = Math.max(0, Math.min(255, b));
        }
    }

    // 色相/饱和度实现
    function adjustHueSaturation(imageData, hue, saturation) {
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) continue;

            const r = data[i] / 255;
            const g = data[i + 1] / 255;
            const b = data[i + 2] / 255;

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            let h, s, l = (max + min) / 2;

            if (max === min) {
                h = s = 0;
            } else {
                const d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                switch (max) {
                    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                    case g: h = ((b - r) / d + 2) / 6; break;
                    case b: h = ((r - g) / d + 4) / 6; break;
                }
            }

            h = (h + hue / 360) % 1;
            if (h < 0) h += 1;
            s = Math.max(0, Math.min(1, s + saturation / 100));

            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };

            let nr, ng, nb;
            if (s === 0) {
                nr = ng = nb = l;
            } else {
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;
                nr = hue2rgb(p, q, h + 1/3);
                ng = hue2rgb(p, q, h);
                nb = hue2rgb(p, q, h - 1/3);
            }

            data[i] = Math.round(nr * 255);
            data[i + 1] = Math.round(ng * 255);
            data[i + 2] = Math.round(nb * 255);
        }
    }

    // 锐化实现
    function sharpenImage(imageData, strength) {
        const w = imageData.width;
        const h = imageData.height;
        const data = imageData.data;
        const output = new Uint8ClampedArray(data);

        const center = 4 + strength;
        const kernel = [0, -1, 0, -1, center, -1, 0, -1, 0];

        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const i = (y * w + x) * 4;
                if (data[i + 3] === 0) continue;

                for (let c = 0; c < 3; c++) {
                    let sum = 0;
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const ki = ((y + ky) * w + (x + kx)) * 4;
                            sum += data[ki + c] * kernel[(ky + 1) * 3 + (kx + 1)];
                        }
                    }
                    output[i + c] = Math.max(0, Math.min(255, sum));
                }
            }
        }

        for (let i = 0; i < data.length; i++) {
            data[i] = output[i];
        }
    }

})();
