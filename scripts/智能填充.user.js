// ==UserScript==
// @name         PhotoShop - 智能填充 Pro Max (Gradient + Content-Aware)
// @namespace    http://tampermonkey.net/
// @version      3.0.0
// @description  为XPhotoShop添加高级填充功能：包含拉普拉斯扩散内容识别、线性/径向渐变填充
// @author       风的影子
// @match        file://*/PhotoShop/index.html
// @match        file://*/PhotoShop/PhotoShop.html
// @match        http://127.0.0.1:5500/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // === 样式注入 ===
    const style = document.createElement('style');
    style.textContent = `
        .ps-dialog-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.5); z-index: 9999;
            display: flex; justify-content: center; align-items: center;
            font-family: "Segoe UI", sans-serif; font-size: 13px; color: #dcdcdc;
            user-select: none;
        }
        .ps-dialog {
            background: #3a3a3a; border: 1px solid #555; box-shadow: 0 8px 24px rgba(0,0,0,0.6);
            width: 340px; display: flex; flex-direction: column; border-radius: 3px;
        }
        .ps-dialog-header {
            background: #2a2a2a; padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #222;
            display: flex; justify-content: space-between; align-items: center;
        }
        .ps-dialog-body { padding: 20px; }
        
        .ps-form-group { margin-bottom: 12px; display: flex; align-items: center; }
        .ps-form-group label { width: 80px; color: #aaa; font-size: 12px; }
        .ps-form-group select, .ps-form-group input[type="number"], .ps-form-group input[type="text"] {
            flex: 1; background: #222; border: 1px solid #555; color: #eee; padding: 5px; outline: none;
        }
        
        /* 渐变设置区域 */
        .ps-gradient-panel {
            background: #2d2d2d; padding: 10px; border: 1px solid #444; margin-bottom: 12px; border-radius: 3px;
            display: none; /* 默认隐藏 */
        }
        .ps-gradient-panel.active { display: block; }

        .ps-gradient-preview {
            width: 100%; height: 60px; border: 1px solid #555; margin-bottom: 10px;
            background: #222; border-radius: 2px;
        }
        
        .ps-color-row { display: flex; gap: 10px; margin-bottom: 8px; }
        .ps-color-input { 
            flex: 1; height: 24px; border: 1px solid #555; cursor: pointer; position: relative;
        }
        .ps-color-input input[type="color"] {
            opacity: 0; width: 100%; height: 100%; cursor: pointer;
        }
        .ps-color-preview {
            position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none;
        }

        .ps-dialog-footer {
            display: flex; justify-content: flex-end; padding: 12px; gap: 10px;
            border-top: 1px solid #444; background: #333;
        }
        .ps-btn {
            background: #555; border: 1px solid #222; color: #eee; padding: 5px 16px; 
            cursor: pointer; border-radius: 2px; transition: background 0.2s;
        }
        .ps-btn:hover { background: #666; }
        .ps-btn.primary { background: #1f65a3; border-color: #103f69; }
        .ps-btn.primary:hover { background: #267ac1; }
        
        .ps-spinner {
            border: 2px solid #444; border-top: 2px solid #3498db; border-radius: 50%;
            width: 14px; height: 14px; animation: spin 1s linear infinite; display: none;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);

    // === 初始化 ===
    const waitForApp = setInterval(() => {
        if (window.photoShopApp) {
            clearInterval(waitForApp);
            initFillPlugin(window.photoShopApp);
        }
    }, 500);

    function initFillPlugin(app) {
        app.menuManager.addMenuItem('编辑', {
            label: '填充 (Fill)...',
            action: 'edit-fill-pro-max',
            handler: () => showFillDialog(app),
            position: 'bottom',
            divider: true
        });

        document.addEventListener('keydown', (e) => {
            if (e.shiftKey && e.key === 'F5') {
                e.preventDefault();
                showFillDialog(app);
            }
        });
    }

    // === UI 构建 ===
    function showFillDialog(app) {
        if (!app.layerManager.activeItem || app.layerManager.activeItem.isGroup) {
            Toast.show('请先选择一个普通图层', 'warning');
            return;
        }

        const overlay = document.createElement('div');
        overlay.className = 'ps-dialog-overlay';
        
        // 默认颜色
        const fgColor = app.tools.color || '#000000';
        const bgColor = '#ffffff'; // 默认背景色

        overlay.innerHTML = `
            <div class="ps-dialog">
                <div class="ps-dialog-header">
                    <span>填充</span>
                    <div class="ps-spinner" id="fill-spinner"></div>
                </div>
                <div class="ps-dialog-body">
                    <div class="ps-form-group">
                        <label>内容:</label>
                        <select id="fill-content">
                            <option value="foreground">前景色</option>
                            <option value="background">背景色</option>
                            <option value="gradient">渐变 (Gradient)</option>
                            <option value="content-aware">内容识别 (智能)</option>
                            <option value="color">纯色...</option>
                            <option value="pattern">图案</option>
                            <option value="black">黑色</option>
                            <option value="white">白色</option>
                            <option value="50gray">50% 灰色</option>
                        </select>
                    </div>

                    <!-- 渐变设置面板 -->
                    <div id="gradient-panel" class="ps-gradient-panel">
                        <canvas id="gradient-preview" class="ps-gradient-preview" width="300" height="60"></canvas>
                        <div class="ps-form-group">
                            <label>类型:</label>
                            <select id="grad-type">
                                <option value="linear">线性 (Linear)</option>
                                <option value="radial">径向 (Radial)</option>
                            </select>
                        </div>
                        <div class="ps-color-row">
                            <div class="ps-color-input" title="起始颜色">
                                <div class="ps-color-preview" style="background:${fgColor}" id="preview-start"></div>
                                <input type="color" id="grad-start" value="${fgColor}">
                            </div>
                            <div class="ps-color-input" title="结束颜色">
                                <div class="ps-color-preview" style="background:${bgColor}" id="preview-end"></div>
                                <input type="color" id="grad-end" value="${bgColor}">
                            </div>
                        </div>
                        <div class="ps-form-group" id="angle-group">
                            <label>角度:</label>
                            <input type="number" id="grad-angle" value="90" min="0" max="360"> 度
                        </div>
                    </div>

                    <div class="ps-form-group">
                        <label>不透明度:</label>
                        <input type="number" id="fill-opacity" value="100" min="0" max="100"> %
                    </div>
                    
                    <!-- 隐藏的通用取色器 -->
                    <input type="color" id="fill-color-picker" style="display:none;">
                </div>
                <div class="ps-dialog-footer">
                    <button class="ps-btn" id="btn-cancel">取消</button>
                    <button class="ps-btn primary" id="btn-ok">确定</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // === 元素获取 ===
        const select = overlay.querySelector('#fill-content');
        const gradPanel = overlay.querySelector('#gradient-panel');
        const gradPreview = overlay.querySelector('#gradient-preview');
        const gradPreviewCtx = gradPreview.getContext('2d');
        const gradType = overlay.querySelector('#grad-type');
        const angleGroup = overlay.querySelector('#angle-group');
        const gradStart = overlay.querySelector('#grad-start');
        const gradEnd = overlay.querySelector('#grad-end');
        const gradAngle = overlay.querySelector('#grad-angle');
        const previewStart = overlay.querySelector('#preview-start');
        const previewEnd = overlay.querySelector('#preview-end');

        const colorPicker = overlay.querySelector('#fill-color-picker');
        const opacityInput = overlay.querySelector('#fill-opacity');
        const spinner = overlay.querySelector('#fill-spinner');
        const btnOk = overlay.querySelector('#btn-ok');

        let customSolidColor = '#000000';

        // === 渐变预览更新函数 ===
        function updateGradientPreview() {
            const w = gradPreview.width;
            const h = gradPreview.height;
            const cx = w / 2;
            const cy = h / 2;

            let gradient;
            if (gradType.value === 'linear') {
                const angleRad = parseFloat(gradAngle.value) * (Math.PI / 180);
                const halfDiag = Math.sqrt(w**2 + h**2) / 2;
                const x1 = cx + Math.cos(angleRad) * halfDiag;
                const y1 = cy + Math.sin(angleRad) * halfDiag;
                const x0 = cx - Math.cos(angleRad) * halfDiag;
                const y0 = cy - Math.sin(angleRad) * halfDiag;
                gradient = gradPreviewCtx.createLinearGradient(x0, y0, x1, y1);
            } else {
                const radius = Math.sqrt(w**2 + h**2) / 2;
                gradient = gradPreviewCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            }

            gradient.addColorStop(0, gradStart.value);
            gradient.addColorStop(1, gradEnd.value);

            gradPreviewCtx.fillStyle = gradient;
            gradPreviewCtx.fillRect(0, 0, w, h);
        }

        // === 事件绑定 ===
        
        // 1. 内容切换逻辑
        select.addEventListener('change', (e) => {
            const val = e.target.value;

            // 显示/隐藏渐变面板
            if (val === 'gradient') {
                gradPanel.classList.add('active');
                updateGradientPreview();
            } else {
                gradPanel.classList.remove('active');
            }

            // 纯色取色器逻辑
            if (val === 'color') {
                colorPicker.click();
            }
        });

        // 2. 渐变类型切换 (径向没有角度)
        gradType.addEventListener('change', (e) => {
            if (e.target.value === 'radial') {
                angleGroup.style.display = 'none';
            } else {
                angleGroup.style.display = 'flex';
            }
            updateGradientPreview();
        });

        // 3. 颜色预览更新
        gradStart.addEventListener('input', (e) => {
            previewStart.style.background = e.target.value;
            updateGradientPreview();
        });
        gradEnd.addEventListener('input', (e) => {
            previewEnd.style.background = e.target.value;
            updateGradientPreview();
        });
        gradAngle.addEventListener('input', () => updateGradientPreview());
        colorPicker.addEventListener('input', (e) => customSolidColor = e.target.value);

        // 4. 关闭
        overlay.querySelector('#btn-cancel').addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        // 5. 确定执行
        btnOk.addEventListener('click', () => {
            const options = {
                mode: select.value,
                opacity: parseInt(opacityInput.value) / 100,
                solidColor: customSolidColor,
                gradient: {
                    type: gradType.value,
                    startColor: gradStart.value,
                    endColor: gradEnd.value,
                    angle: parseInt(overlay.querySelector('#grad-angle').value)
                }
            };

            // UI Loading
            btnOk.disabled = true;
            btnOk.textContent = '处理中...';
            spinner.style.display = 'block';

            setTimeout(() => {
                try {
                    executeFill(app, options);
                } catch (err) {
                    console.error(err);
                    Toast.show('操作失败', 'error');
                }
                document.body.removeChild(overlay);
            }, 50);
        });
    }

    // === 核心执行逻辑 ===
    function executeFill(app, options) {
        const layer = app.layerManager.getActiveLayer();
        const ctx = layer.ctx;
        const width = layer.canvas.width;
        const height = layer.canvas.height;
        const selection = app.selectionManager;

        // 创建临时画布用于绘制填充内容
        let fillCanvas = document.createElement('canvas');
        fillCanvas.width = width;
        fillCanvas.height = height;
        const fCtx = fillCanvas.getContext('2d');

        // 根据模式绘制内容
        if (options.mode === 'content-aware' && selection.hasSelection) {
            // 智能内容识别 (拉普拉斯扩散)
            performSmartInpainting(app, layer, fCtx);
            Toast.show('已应用智能内容识别', 'success');
        } 
        else if (options.mode === 'gradient') {
            // 渐变填充
            drawGradient(app, fCtx, width, height, options.gradient);
        } 
        else {
            // 普通纯色/图案填充
            let style = getSimpleFillStyle(app, options.mode, options.solidColor, ctx);
            fCtx.fillStyle = style;
            fCtx.fillRect(0, 0, width, height);
        }

        // 应用选区遮罩 (Destination-In)
        if (selection.hasSelection) {
            fCtx.globalCompositeOperation = 'destination-in';
            fCtx.drawImage(selection.canvas, 0, 0);
        }

        // 合成到原图层
        ctx.save();
        ctx.globalAlpha = options.opacity;
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(fillCanvas, 0, 0);
        ctx.restore();

        app.render();
        app.saveHistory();
    }

    // === 渐变绘制算法 ===
    function drawGradient(app, ctx, w, h, gradOpts) {
        // 1. 确定渐变范围 (如果有选区，基于选区边界；否则基于全图)
        let bounds = app.selectionManager.getBounds();
        if (!bounds) {
            bounds = { x: 0, y: 0, width: w, height: h };
        }

        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y + bounds.height / 2;
        
        let gradient;

        if (gradOpts.type === 'linear') {
            // 计算线性渐变坐标
            // 将角度转换为弧度 (CSS标准: 0deg向上, 90deg向右... 但Canvas通常 0是右)
            // 这里我们采用直观逻辑：0度是从左到右，90度是从上到下
            const angleRad = (gradOpts.angle) * (Math.PI / 180);
            
            // 计算半对角线长度，确保渐变能覆盖矩形旋转后的任意角落
            const halfDiag = Math.sqrt(bounds.width**2 + bounds.height**2) / 2;
            
            // 计算起点和终点 (围绕中心点旋转)
            // 终点
            const x1 = cx + Math.cos(angleRad) * halfDiag;
            const y1 = cy + Math.sin(angleRad) * halfDiag;
            // 起点 (反向)
            const x0 = cx - Math.cos(angleRad) * halfDiag;
            const y0 = cy - Math.sin(angleRad) * halfDiag;

            gradient = ctx.createLinearGradient(x0, y0, x1, y1);

        } else {
            // 径向渐变
            // 从中心开始，半径为半对角线长
            const radius = Math.sqrt(bounds.width**2 + bounds.height**2) / 2;
            gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        }

        gradient.addColorStop(0, gradOpts.startColor);
        gradient.addColorStop(1, gradOpts.endColor);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h); // 填满整个临时画布，后续会被选区裁剪
    }

    // === 辅助：获取简单填充样式 ===
    function getSimpleFillStyle(app, mode, customColor, ctx) {
        switch (mode) {
            case 'foreground': return app.tools.color;
            case 'background': return '#ffffff';
            case 'color': return customColor;
            case 'black': return '#000000';
            case 'white': return '#ffffff';
            case '50gray': return '#808080';
            case 'pattern': return createCheckerPattern(ctx);
            default: return app.tools.color;
        }
    }

    // === 辅助：图案生成 ===
    function createCheckerPattern(ctx) {
        const pCanvas = document.createElement('canvas');
        pCanvas.width = 20; pCanvas.height = 20;
        const pCtx = pCanvas.getContext('2d');
        pCtx.fillStyle = '#ccc'; pCtx.fillRect(0, 0, 20, 20);
        pCtx.fillStyle = '#999'; pCtx.fillRect(0, 0, 10, 10); pCtx.fillRect(10, 10, 10, 10);
        return ctx.createPattern(pCanvas, 'repeat');
    }

    // === 高级算法：拉普拉斯扩散 (Content Aware) ===
    function performSmartInpainting(app, layer, targetCtx) {
        const bounds = app.selectionManager.getBounds();
        if (!bounds) return;

        const padding = 20; 
        const x = Math.max(0, bounds.x - padding);
        const y = Math.max(0, bounds.y - padding);
        const w = Math.min(layer.canvas.width - x, bounds.width + padding * 2);
        const h = Math.min(layer.canvas.height - y, bounds.height + padding * 2);

        const srcData = layer.ctx.getImageData(x, y, w, h);
        const data = srcData.data;
        const selData = app.selectionManager.ctx.getImageData(x, y, w, h).data;

        const mask = new Uint8Array(w * h);
        const pixels = new Float32Array(w * h * 4);
        
        let validR = 0, validG = 0, validB = 0, validCount = 0;
        let varianceSum = 0;

        // 1. 初始化与统计
        for (let i = 0; i < w * h; i++) {
            const idx = i * 4;
            const isSelected = selData[idx + 3] > 0 && selData[idx] > 128;
            mask[i] = isSelected ? 1 : 0;

            if (!isSelected) {
                pixels[idx] = data[idx];
                pixels[idx+1] = data[idx+1];
                pixels[idx+2] = data[idx+2];
                pixels[idx+3] = data[idx+3];

                if (data[idx+3] > 0) {
                    validR += data[idx]; validG += data[idx+1]; validB += data[idx+2];
                    validCount++;
                }
            }
        }

        const avgR = validCount ? validR / validCount : 255;
        const avgG = validCount ? validG / validCount : 255;
        const avgB = validCount ? validB / validCount : 255;

        // 计算纹理特征(标准差)
        if (validCount > 0) {
            for (let i = 0; i < w * h; i++) {
                if (mask[i] === 0 && data[i*4+3] > 0) {
                    const dr = data[i*4] - avgR;
                    const dg = data[i*4+1] - avgG;
                    const db = data[i*4+2] - avgB;
                    varianceSum += (dr*dr + dg*dg + db*db) / 3;
                }
            }
        }
        const stdDev = validCount ? Math.sqrt(varianceSum / validCount) : 0;

        // 预填充
        for (let i = 0; i < w * h; i++) {
            if (mask[i] === 1) {
                const idx = i * 4;
                pixels[idx] = avgR; pixels[idx+1] = avgG; pixels[idx+2] = avgB; pixels[idx+3] = 255;
            }
        }

        // 2. 迭代扩散
        const iterations = 40;
        const newPixels = new Float32Array(pixels);

        for (let iter = 0; iter < iterations; iter++) {
            for (let r = 1; r < h - 1; r++) {
                for (let c = 1; c < w - 1; c++) {
                    const i = r * w + c;
                    if (mask[i] === 1) {
                        const idx = i * 4;
                        const up = (i - w) * 4, down = (i + w) * 4, left = (i - 1) * 4, right = (i + 1) * 4;
                        newPixels[idx] = (pixels[up] + pixels[down] + pixels[left] + pixels[right]) * 0.25;
                        newPixels[idx+1] = (pixels[up+1] + pixels[down+1] + pixels[left+1] + pixels[right+1]) * 0.25;
                        newPixels[idx+2] = (pixels[up+2] + pixels[down+2] + pixels[left+2] + pixels[right+2]) * 0.25;
                    }
                }
            }
            pixels.set(newPixels);
        }

        // 3. 噪声注入
        for (let i = 0; i < w * h; i++) {
            if (mask[i] === 1) {
                const idx = i * 4;
                const noise = (Math.random() - 0.5) * 2;
                const intensity = stdDev * 0.8; 
                pixels[idx] = Math.max(0, Math.min(255, pixels[idx] + noise * intensity));
                pixels[idx+1] = Math.max(0, Math.min(255, pixels[idx+1] + noise * intensity));
                pixels[idx+2] = Math.max(0, Math.min(255, pixels[idx+2] + noise * intensity));
            }
        }

        // 写回
        for (let i = 0; i < data.length; i++) data[i] = pixels[i];
        
        const tempC = document.createElement('canvas');
        tempC.width = w; tempC.height = h;
        tempC.getContext('2d').putImageData(srcData, 0, 0);
        targetCtx.drawImage(tempC, x, y);
    }

})();