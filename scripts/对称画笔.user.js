// ==UserScript==
// @name         PhotoShop - 对称绘制画笔 (Symmetry Brush)
// @namespace    http://tampermonkey.net/
// @version      1.3.0
// @description  为XPhotoShop添加对称绘制功能，支持完美像素绘制（无抗锯齿）和可视化中心设置
// @author       风的影子
// @match        file://*/PhotoShop/index.html
// @match        file://*/PhotoShop/PhotoShop.html
// @match        http://127.0.0.1:5500/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 插件状态管理
    const symConfig = {
        mode: 'horizontal', // horizontal, vertical, quad, radial
        centerX: 0,
        centerY: 0,
        radialCount: 6,
        brushShape: 'circle',
        brushSize: 5,
        antiAlias: false, // 默认关闭抗锯齿
        lastPos: null,
        isPanelOpen: false
    };

    function init() {
        const app = window.photoShopApp;
        if (!app) {
            setTimeout(init, 100);
            return;
        }

        if (app.config) {
            symConfig.centerX = Math.floor(app.config.width / 2);
            symConfig.centerY = Math.floor(app.config.height / 2);
        }

        registerSymmetryTool(app);
        addMenuEntry(app);
        
        console.log('PhotoShop 对称绘制插件 v1.3 已加载');
    }

    // 1. 注册对称画笔工具
    function registerSymmetryTool(app) {
        app.registerTool({
            id: 'sym-brush',
            name: '对称画笔',
            icon: '❄️',
            shortcut: '',
            cursor: 'crosshair',
            weight: 25,

            optionsHTML: `
                <div style="display:flex; align-items:center; gap:10px;">
                    <label>大小:</label>
                    <input type="range" id="sym-size" min="1" max="100" value="${symConfig.brushSize}">
                    <span id="sym-size-val">${symConfig.brushSize}</span>
                    
                    <div style="width:1px; height:20px; background:#ccc; margin:0 5px;"></div>
                    
                    <label>形状:</label>
                    <select id="sym-shape" style="padding:2px;">
                        <option value="circle">圆形</option>
                        <option value="square">方形</option>
                    </select>

                    <div style="width:1px; height:20px; background:#ccc; margin:0 5px;"></div>

                    <label style="display:flex; align-items:center; cursor:pointer;" title="关闭以绘制像素画">
                        <input type="checkbox" id="sym-antialias" ${symConfig.antiAlias ? 'checked' : ''}>
                        <span style="margin-left:4px;">抗锯齿</span>
                    </label>
                </div>
            `,

            onOptionsInit: (container) => {
                const sizeInput = container.querySelector('#sym-size');
                const sizeLabel = container.querySelector('#sym-size-val');
                const shapeSelect = container.querySelector('#sym-shape');
                const aaCheckbox = container.querySelector('#sym-antialias');

                sizeInput.value = symConfig.brushSize;
                shapeSelect.value = symConfig.brushShape;
                aaCheckbox.checked = symConfig.antiAlias;

                sizeInput.addEventListener('input', (e) => {
                    symConfig.brushSize = parseInt(e.target.value);
                    sizeLabel.textContent = symConfig.brushSize;
                });

                shapeSelect.addEventListener('change', (e) => {
                    symConfig.brushShape = e.target.value;
                });

                aaCheckbox.addEventListener('change', (e) => {
                    symConfig.antiAlias = e.target.checked;
                });
            },

            onStart: (x, y, { layer, app }) => {
                if (!layer || !layer.visible) return;
                symConfig.lastPos = { x, y };
                // 绘制单点
                drawSymmetryPoints(app, layer, x, y, x, y);
            },

            onMove: (x, y, { layer, app }) => {
                if (!layer || !symConfig.lastPos) return;
                drawSymmetryPoints(app, layer, symConfig.lastPos.x, symConfig.lastPos.y, x, y);
                symConfig.lastPos = { x, y };
            },

            onEnd: (x, y, { app }) => {
                symConfig.lastPos = null;
                app.saveHistory();
            }
        });
    }

    // 核心绘制入口
    function drawSymmetryPoints(app, layer, x0, y0, x1, y1) {
        const ctx = layer.ctx;
        const sm = app.selectionManager;

        ctx.save();
        ctx.fillStyle = app.tools.color;
        ctx.strokeStyle = app.tools.color;
        ctx.lineWidth = symConfig.brushSize;

        // 如果有选区，设置裁剪区域
        if (sm && sm.hasSelection) {
            const selData = sm.ctx.getImageData(0, 0, sm.width, sm.height);
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = sm.width;
            tempCanvas.height = sm.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(selData, 0, 0);

            // 创建裁剪路径
            ctx.beginPath();
            const imgData = selData.data;
            for (let y = 0; y < sm.height; y++) {
                for (let x = 0; x < sm.width; x++) {
                    const idx = (y * sm.width + x) * 4;
                    if (imgData[idx + 3] > 0) {
                        ctx.rect(x, y, 1, 1);
                    }
                }
            }
            ctx.clip();
        }

        // 计算所有对称后的线段坐标
        const segments = calculateSymmetry(x0, y0, x1, y1);

        if (symConfig.antiAlias) {
            // === 模式 A: 抗锯齿 (使用 Canvas Path) ===
            ctx.lineCap = symConfig.brushShape === 'square' ? 'square' : 'round';
            ctx.lineJoin = symConfig.brushShape === 'square' ? 'miter' : 'round';

            ctx.beginPath();
            segments.forEach(seg => {
                ctx.moveTo(seg.x0, seg.y0);
                ctx.lineTo(seg.x1, seg.y1);
            });
            ctx.stroke();

            // 补点 (点击时)
            if (x0 === x1 && y0 === y1) {
                segments.forEach(seg => {
                    ctx.beginPath();
                    if (symConfig.brushShape === 'circle') {
                        ctx.arc(seg.x1, seg.y1, symConfig.brushSize / 2, 0, Math.PI * 2);
                        ctx.fill();
                    } else {
                        const s = symConfig.brushSize;
                        ctx.fillRect(seg.x1 - s/2, seg.y1 - s/2, s, s);
                    }
                });
            }

        } else {
            // === 模式 B: 无抗锯齿 (使用 Bresenham + 像素填充) ===
            // 这种方式可以画出完美的像素线条
            segments.forEach(seg => {
                // 坐标取整
                const startX = Math.round(seg.x0);
                const startY = Math.round(seg.y0);
                const endX = Math.round(seg.x1);
                const endY = Math.round(seg.y1);

                if (startX === endX && startY === endY) {
                    // 单点绘制
                    drawPixelBrush(ctx, startX, startY, symConfig.brushSize, symConfig.brushShape);
                } else {
                    // 线条插值绘制
                    drawBresenhamLine(ctx, startX, startY, endX, endY, symConfig.brushSize, symConfig.brushShape);
                }
            });
        }

        ctx.restore();
        app.render();
    }

    // 辅助：Bresenham 直线算法 (用于无抗锯齿绘制)
    function drawBresenhamLine(ctx, x0, y0, x1, y1, size, shape) {
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = (x0 < x1) ? 1 : -1;
        const sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        while (true) {
            drawPixelBrush(ctx, x0, y0, size, shape);
            
            if ((x0 === x1) && (y0 === y1)) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }
    }

    // 辅助：绘制单个像素笔刷印记
    function drawPixelBrush(ctx, x, y, size, shape) {
        // 获取选区管理器
        const app = window.photoShopApp;
        const sm = app ? app.selectionManager : null;

        // 居中偏移
        const offset = Math.floor(size / 2);

        if (shape === 'square') {
            // 方形直接填充
            for (let dy = 0; dy < size; dy++) {
                for (let dx = 0; dx < size; dx++) {
                    const px = x - offset + dx;
                    const py = y - offset + dy;
                    // 检查选区
                    if (!sm || !sm.hasSelection || sm.isSelected(px, py)) {
                        ctx.fillRect(px, py, 1, 1);
                    }
                }
            }
        } else {
            // 圆形像素化绘制
            const radiusSq = (size / 2) * (size / 2);
            const center = size / 2 - 0.5; // 微调中心以获得更好的对称性

            for (let dy = 0; dy < size; dy++) {
                for (let dx = 0; dx < size; dx++) {
                    // 计算相对于笔刷中心的距离
                    const distSq = (dx - center) * (dx - center) + (dy - center) * (dy - center);

                    // 简单的距离判断，不进行抗锯齿
                    if (distSq <= radiusSq) {
                        const px = x - offset + dx;
                        const py = y - offset + dy;
                        // 检查选区
                        if (!sm || !sm.hasSelection || sm.isSelected(px, py)) {
                            ctx.fillRect(px, py, 1, 1);
                        }
                    }
                }
            }
        }
    }

    // 计算对称坐标 (返回线段数组)
    function calculateSymmetry(x0, y0, x1, y1) {
        const cx = symConfig.centerX;
        const cy = symConfig.centerY;
        const results = [];

        results.push({ x0, y0, x1, y1 });

        if (symConfig.mode === 'horizontal' || symConfig.mode === 'quad') {
            results.push({
                x0: cx + (cx - x0), y0: y0,
                x1: cx + (cx - x1), y1: y1
            });
        }

        if (symConfig.mode === 'vertical' || symConfig.mode === 'quad') {
            results.push({
                x0: x0, y0: cy + (cy - y0),
                x1: x1, y1: cy + (cy - y1)
            });
        }

        if (symConfig.mode === 'quad') {
            results.push({
                x0: cx + (cx - x0), y0: cy + (cy - y0),
                x1: cx + (cx - x1), y1: cy + (cy - y1)
            });
        }

        if (symConfig.mode === 'radial') {
            const count = symConfig.radialCount;
            const angleStep = (2 * Math.PI) / count;
            results.length = 0; 

            for (let i = 0; i < count; i++) {
                const theta = i * angleStep;
                const cos = Math.cos(theta);
                const sin = Math.sin(theta);
                
                const rotate = (x, y) => ({
                    x: (x - cx) * cos - (y - cy) * sin + cx,
                    y: (x - cx) * sin + (y - cy) * cos + cy
                });

                const p0 = rotate(x0, y0);
                const p1 = rotate(x1, y1);
                results.push({ x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y });
            }
        }
        return results;
    }

    // 2. 创建并显示设置面板
    function showSymmetryPanel(app) {
        if (symConfig.isPanelOpen) {
            app.panelManager.removePanel('symmetry-settings');
        }

        const content = document.createElement('div');
        content.style.padding = '10px';
        content.style.color = '#ccc';
        content.innerHTML = `
            <style>
                .sym-group { margin-bottom: 15px; }
                .sym-label { display:block; margin-bottom:5px; font-size:12px; color:#aaa; }
                .sym-btn { 
                    width: 48%; padding: 6px; margin-bottom: 5px; 
                    background: #444; border: 1px solid #555; color: #eee; 
                    cursor: pointer; border-radius: 3px; font-size: 12px;
                }
                .sym-btn.active { background: #2980b9; border-color: #3498db; }
                .sym-input { 
                    width: 35%; background: #222; border: 1px solid #444; 
                    color: #eee; padding: 4px; border-radius: 3px; 
                }
                .sym-row { display: flex; justify-content: space-between; flex-wrap: wrap; align-items: center;width:200px; }
                .sym-icon-btn {
                    background: #444; border: 1px solid #555; color: #eee;
                    width: 28px; height: 26px; border-radius: 3px; cursor: pointer;
                    display: flex; justify-content: center; align-items: center;
                }
                .sym-icon-btn:hover { background: #555; }
            </style>

            <div class="sym-group">
                <span class="sym-label">对称模式</span>
                <div class="sym-row">
                    <button class="sym-btn ${symConfig.mode === 'horizontal' ? 'active' : ''}" data-mode="horizontal">水平 (H)</button>
                    <button class="sym-btn ${symConfig.mode === 'vertical' ? 'active' : ''}" data-mode="vertical">垂直 (V)</button>
                    <button class="sym-btn ${symConfig.mode === 'quad' ? 'active' : ''}" data-mode="quad">四象限 (+)</button>
                    <button class="sym-btn ${symConfig.mode === 'radial' ? 'active' : ''}" data-mode="radial">径向 (O)</button>
                </div>
            </div>

            <div class="sym-group" id="radial-settings" style="display:${symConfig.mode === 'radial' ? 'block' : 'none'};">
                <span class="sym-label">径向数量 (2-36)</span>
                <input type="range" id="sym-radial-count" min="2" max="36" value="${symConfig.radialCount}" style="width:100%">
                <div style="text-align:right; font-size:12px;" id="sym-radial-val">${symConfig.radialCount}</div>
            </div>

            <div class="sym-group">
                <span class="sym-label">对称中心 (X, Y)</span>
                <div class="sym-row">
                    <input type="number" id="sym-cx" class="sym-input" value="${symConfig.centerX}">
                    <input type="number" id="sym-cy" class="sym-input" value="${symConfig.centerY}">
                    <button id="sym-pick-center" class="sym-icon-btn" title="可视化设置">🎯</button>
                </div>
                <button id="sym-reset-center" style="width:100%; margin-top:5px; background:#555; border:none; color:#fff; padding:4px; cursor:pointer;">重置为画布中心</button>
            </div>
            
            <div style="font-size:11px; color:#777; margin-top:10px;">
                提示: 关闭"抗锯齿"可绘制像素画。
            </div>
        `;

        const modeBtns = content.querySelectorAll('.sym-btn');
        const radialSettings = content.querySelector('#radial-settings');
        const radialInput = content.querySelector('#sym-radial-count');
        const radialVal = content.querySelector('#sym-radial-val');
        const inputCx = content.querySelector('#sym-cx');
        const inputCy = content.querySelector('#sym-cy');
        const btnPick = content.querySelector('#sym-pick-center');
        const btnReset = content.querySelector('#sym-reset-center');

        modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                modeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                symConfig.mode = btn.dataset.mode;
                radialSettings.style.display = symConfig.mode === 'radial' ? 'block' : 'none';
            });
        });

        radialInput.addEventListener('input', (e) => {
            symConfig.radialCount = parseInt(e.target.value);
            radialVal.textContent = symConfig.radialCount;
        });

        const updateCoords = () => {
            symConfig.centerX = parseInt(inputCx.value);
            symConfig.centerY = parseInt(inputCy.value);
        };
        inputCx.addEventListener('change', updateCoords);
        inputCy.addEventListener('change', updateCoords);

        btnPick.addEventListener('click', () => {
            showCenterPicker(app, (x, y) => {
                symConfig.centerX = x;
                symConfig.centerY = y;
                inputCx.value = x;
                inputCy.value = y;
            });
        });

        btnReset.addEventListener('click', () => {
            symConfig.centerX = Math.floor(app.config.width / 2);
            symConfig.centerY = Math.floor(app.config.height / 2);
            inputCx.value = symConfig.centerX;
            inputCy.value = symConfig.centerY;
            Toast.show('对称中心已重置', 'info');
        });

        app.panelManager.addPanel({
            id: 'symmetry-settings',
            title: '对称绘制设置',
            content: content,
            onClose: () => {
                symConfig.isPanelOpen = false;
            }
        });
        
        symConfig.isPanelOpen = true;
    }

    // 3. 可视化中心点选择器
    function showCenterPicker(app, callback) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.6); z-index: 10000;
            display: flex; justify-content: center; align-items: center;
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: #3c3f41; border: 1px solid #555; border-radius: 4px;
            padding: 10px; width: 400px; box-shadow: 0 5px 15px rgba(0,0,0,0.5);
            display: flex; flex-direction: column; gap: 10px;
        `;

        const canvas = document.createElement('canvas');
        const w = 380;
        const h = (app.config.height / app.config.width) * w;
        canvas.width = w;
        canvas.height = h;
        canvas.style.border = '1px solid #666';
        canvas.style.cursor = 'crosshair';
        canvas.style.background = '#222';

        const ctx = canvas.getContext('2d');
        const scale = w / app.config.width;
        
        let currentX = symConfig.centerX;
        let currentY = symConfig.centerY;

        const drawCrosshair = () => {
            ctx.fillStyle = '#333';
            ctx.fillRect(0, 0, w, h);
            if (app.canvasManager.displayCanvas) {
                ctx.drawImage(app.canvasManager.displayCanvas, 0, 0, w, h);
            }
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(0, 0, w, h);

            const cx = currentX * scale;
            const cy = currentY * scale;

            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, cy); ctx.lineTo(w, cy);
            ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(cx, cy, 4, 0, Math.PI * 2);
            ctx.stroke();
        };

        drawCrosshair();

        const updatePos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / scale;
            const y = (e.clientY - rect.top) / scale;
            
            currentX = Math.round(Math.max(0, Math.min(app.config.width, x)));
            currentY = Math.round(Math.max(0, Math.min(app.config.height, y)));
            
            info.textContent = `坐标: ${currentX}, ${currentY}`;
            drawCrosshair();
        };

        canvas.addEventListener('mousedown', (e) => {
            updatePos(e);
            const moveHandler = (ev) => updatePos(ev);
            const upHandler = () => {
                window.removeEventListener('mousemove', moveHandler);
                window.removeEventListener('mouseup', upHandler);
            };
            window.addEventListener('mousemove', moveHandler);
            window.addEventListener('mouseup', upHandler);
        });

        const footer = document.createElement('div');
        footer.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
        
        const info = document.createElement('span');
        info.style.cssText = 'color: #aaa; font-size: 12px;';
        info.textContent = `坐标: ${currentX}, ${currentY}`;

        const btnGroup = document.createElement('div');
        btnGroup.style.display = 'flex';
        btnGroup.style.gap = '10px';

        const btnCancel = document.createElement('button');
        btnCancel.textContent = '取消';
        btnCancel.style.cssText = 'padding: 4px 12px; background: #555; border: none; color: #fff; border-radius: 3px; cursor: pointer;';
        
        const btnOk = document.createElement('button');
        btnOk.textContent = '确定';
        btnOk.style.cssText = 'padding: 4px 12px; background: #2980b9; border: none; color: #fff; border-radius: 3px; cursor: pointer;';

        btnCancel.onclick = () => document.body.removeChild(overlay);
        btnOk.onclick = () => {
            callback(currentX, currentY);
            document.body.removeChild(overlay);
        };

        btnGroup.appendChild(btnCancel);
        btnGroup.appendChild(btnOk);
        footer.appendChild(info);
        footer.appendChild(btnGroup);

        dialog.appendChild(canvas);
        dialog.appendChild(footer);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }

    // 4. 添加菜单项
    function addMenuEntry(app) {
        app.menuManager.addMenuItem('视图', {
            label: '对称设置',
            action: 'toggle-symmetry-panel',
            handler: (app) => {
                if (symConfig.isPanelOpen) {
                    app.panelManager.removePanel('symmetry-settings');
                    symConfig.isPanelOpen = false;
                } else {
                    showSymmetryPanel(app);
                }
            }
        });
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();