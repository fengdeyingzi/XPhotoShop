// ==UserScript==
// @name         PhotoShop - 图像阵列 Ultimate (Smart Crop)
// @namespace    http://tampermonkey.net/
// @version      3.0.0
// @description  基于内容裁切的高级图像阵列：支持紧密宫格、蜂窝交错、基于半径的旋转阵列
// @author       风的影子
// @match        file://*/PhotoShop/index.html
// @match        file://*/PhotoShop/PhotoShop.html
// @match        http://127.0.0.1:5500/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // === CSS 样式 (保持一致) ===
    const style = document.createElement('style');
    style.textContent = `
        .ps-dialog-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.5); z-index: 9999;
            display: flex; justify-content: center; align-items: center;
            font-family: "Segoe UI", sans-serif; font-size: 13px; color: #dcdcdc;
            user-select: none;
        }
        .ps-array-dialog {
            background: #3a3a3a; border: 1px solid #555; box-shadow: 0 10px 30px rgba(0,0,0,0.7);
            width: 780px; height: 560px; display: flex; flex-direction: column; border-radius: 4px;
        }
        .ps-dialog-header {
            background: #2a2a2a; padding: 10px 15px; font-weight: 600; border-bottom: 1px solid #222;
        }
        .ps-dialog-content {
            display: flex; flex: 1; overflow: hidden;
        }
        .ps-panel-left {
            width: 280px; background: #333; border-right: 1px solid #444; padding: 15px;
            display: flex; flex-direction: column; gap: 12px; overflow-y: auto;
        }
        .ps-control-group { display: flex; flex-direction: column; gap: 5px; }
        .ps-control-group label { color: #aaa; font-size: 12px; display: flex; justify-content: space-between; }
        .ps-control-group select, .ps-control-group input[type="number"] {
            background: #222; border: 1px solid #555; color: #eee; padding: 6px; outline: none; border-radius: 2px;
        }
        .ps-control-group input:focus { border-color: #3498db; }
        .ps-row-inputs { display: flex; gap: 8px; }
        .ps-row-inputs input { flex: 1; min-width: 0; }
        .ps-checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; color: #eee; }
        .ps-checkbox-label input { margin: 0; }
        .ps-divider { height: 1px; background: #444; margin: 5px 0; }
        .ps-hint { font-size: 11px; color: #777; margin-top: 2px; }
        .ps-panel-right {
            flex: 1; background: #222; display: flex; justify-content: center; align-items: center;
            position: relative; overflow: hidden;
            background-image: linear-gradient(45deg, #2a2a2a 25%, transparent 25%), 
                              linear-gradient(-45deg, #2a2a2a 25%, transparent 25%), 
                              linear-gradient(45deg, transparent 75%, #2a2a2a 75%), 
                              linear-gradient(-45deg, transparent 75%, #2a2a2a 75%);
            background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
        }
        canvas.preview-canvas {
            box-shadow: 0 0 15px rgba(0,0,0,0.5); cursor: crosshair;
            max-width: 95%; max-height: 95%; border: 1px solid #444;
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

    // === 初始化 ===
    const waitForApp = setInterval(() => {
        if (window.photoShopApp) {
            clearInterval(waitForApp);
            initArrayPlugin(window.photoShopApp);
        }
    }, 500);

    function initArrayPlugin(app) {
        app.menuManager.addMenuItem('滤镜', {
            label: '图像阵列 (Image Array)...',
            action: 'filter-array-ultimate',
            handler: () => showArrayDialog(app),
            position: 'bottom',
            divider: true
        });
    }

    /**
     * 核心工具：裁切图层数据 (Smart Crop)
     * 返回非透明区域的最小包围盒及独立Canvas
     */
    function cropLayerData(layer) {
        const canvas = layer.canvas;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        let minX = canvas.width;
        let minY = canvas.height;
        let maxX = 0;
        let maxY = 0;
        let hasContent = false;

        // 查找非透明像素的边界
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const alpha = data[(y * canvas.width + x) * 4 + 3];
                if (alpha > 0) {
                    hasContent = true;
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        // 如果全透明
        if (!hasContent) {
            return { isEmpty: true };
        }

        // 创建裁切后的画布
        const croppedWidth = maxX - minX + 1;
        const croppedHeight = maxY - minY + 1;
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = croppedWidth;
        croppedCanvas.height = croppedHeight;
        const croppedCtx = croppedCanvas.getContext('2d');

        croppedCtx.drawImage(
            canvas,
            minX, minY, croppedWidth, croppedHeight,
            0, 0, croppedWidth, croppedHeight
        );

        return {
            isEmpty: false,
            x: minX,
            y: minY,
            width: croppedWidth,
            height: croppedHeight,
            canvas: croppedCanvas
        };
    }

    // === 主逻辑 ===
    function showArrayDialog(app) {
        const activeLayer = app.layerManager.getActiveLayer();
        if (!activeLayer || activeLayer.isGroup) {
            Toast.show('请选择一个普通图层', 'warning');
            return;
        }

        // 1. 获取文档尺寸
        const docW = app.config.width;
        const docH = app.config.height;

        // 2. 执行智能裁切 (Smart Crop)
        const croppedData = cropLayerData(activeLayer);
        
        if (croppedData.isEmpty) {
            Toast.show('当前图层是空的', 'warning');
            return;
        }

        // 3. 初始状态
        const state = {
            mode: 'grid',
            grid: { x: 0, y: 0, rows: 3, cols: 3, autoFill: true },
            // 旋转中心默认设为文档中心
            rotation: { angle: 45, count: 6, cx: Math.floor(docW / 2), cy: Math.floor(docH / 2) },
            honeycomb: { x: 0, y: 0, autoFill: true, rows: 5, cols: 5 }
        };

        // 4. 构建 UI
        const overlay = document.createElement('div');
        overlay.className = 'ps-dialog-overlay';
        overlay.innerHTML = `
            <div class="ps-array-dialog">
                <div class="ps-dialog-header">图像阵列生成器 (Smart Content)</div>
                <div class="ps-dialog-content">
                    <div class="ps-panel-left">
                        <div class="ps-control-group">
                            <label>阵列模式</label>
                            <select id="array-mode">
                                <option value="grid">宫格阵列 (Grid)</option>
                                <option value="honeycomb">蜂窝阵列 (Honeycomb)</option>
                                <option value="rotation">旋转阵列 (Rotation)</option>
                            </select>
                        </div>
                        <div class="ps-divider"></div>

                        <!-- 宫格参数 -->
                        <div id="params-grid">
                            <label class="ps-checkbox-label" style="margin-bottom:10px;">
                                <input type="checkbox" id="grid-auto" checked> 自动填充画布
                            </label>
                            <div class="ps-control-group" id="grid-count-group" style="display:none; opacity:0.5;">
                                <label>行列数量</label>
                                <div class="ps-row-inputs">
                                    <input type="number" id="grid-cols" value="3" min="1" placeholder="列">
                                    <input type="number" id="grid-rows" value="3" min="1" placeholder="行">
                                </div>
                            </div>
                            <div class="ps-control-group">
                                <label>间距 (Gap X / Y)</label>
                                <div class="ps-row-inputs">
                                    <input type="number" id="grid-gap-x" value="0">
                                    <input type="number" id="grid-gap-y" value="0">
                                </div>
                            </div>
                        </div>

                        <!-- 蜂窝参数 -->
                        <div id="params-honeycomb" style="display:none;">
                            <label class="ps-checkbox-label" style="margin-bottom:10px;">
                                <input type="checkbox" id="honey-auto" checked> 自动填充画布
                            </label>
                            <div class="ps-control-group" id="honey-count-group" style="display:none; opacity:0.5;">
                                <label>行列数量</label>
                                <div class="ps-row-inputs">
                                    <input type="number" id="honey-cols" value="5" min="1">
                                    <input type="number" id="honey-rows" value="5" min="1">
                                </div>
                            </div>
                            <div class="ps-control-group">
                                <label>间距 (Gap X / Y)</label>
                                <div class="ps-row-inputs">
                                    <input type="number" id="honey-gap-x" value="0">
                                    <input type="number" id="honey-gap-y" value="0">
                                </div>
                            </div>
                        </div>

                        <!-- 旋转参数 -->
                        <div id="params-rotation" style="display:none;">
                            <div class="ps-control-group">
                                <label>旋转角度 (Angle)</label>
                                <input type="number" id="rot-angle" value="45">
                            </div>
                            <div class="ps-control-group">
                                <label>副本数量 (Count)</label>
                                <input type="number" id="rot-count" value="6" min="1">
                            </div>
                            <div class="ps-divider"></div>
                            <div class="ps-control-group">
                                <label>中心点 (Center X / Y)</label>
                                <div class="ps-row-inputs">
                                    <input type="number" id="rot-cx" value="${state.rotation.cx}">
                                    <input type="number" id="rot-cy" value="${state.rotation.cy}">
                                </div>
                                <span class="ps-hint">提示：点击右侧预览图可设置中心</span>
                            </div>
                        </div>
                    </div>

                    <div class="ps-panel-right">
                        <canvas id="array-preview" class="preview-canvas"></canvas>
                    </div>
                </div>
                <div class="ps-dialog-footer">
                    <button class="ps-btn" id="btn-cancel">取消</button>
                    <button class="ps-btn primary" id="btn-ok">应用到画布</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // 5. 绑定元素
        const previewCanvas = overlay.querySelector('#array-preview');
        const previewCtx = previewCanvas.getContext('2d');
        
        const inputs = {
            mode: overlay.querySelector('#array-mode'),
            gridAuto: overlay.querySelector('#grid-auto'),
            gridCols: overlay.querySelector('#grid-cols'),
            gridRows: overlay.querySelector('#grid-rows'),
            gridGapX: overlay.querySelector('#grid-gap-x'),
            gridGapY: overlay.querySelector('#grid-gap-y'),
            gridCountGroup: overlay.querySelector('#grid-count-group'),
            honeyAuto: overlay.querySelector('#honey-auto'),
            honeyCols: overlay.querySelector('#honey-cols'),
            honeyRows: overlay.querySelector('#honey-rows'),
            honeyGapX: overlay.querySelector('#honey-gap-x'),
            honeyGapY: overlay.querySelector('#honey-gap-y'),
            honeyCountGroup: overlay.querySelector('#honey-count-group'),
            rotAngle: overlay.querySelector('#rot-angle'),
            rotCount: overlay.querySelector('#rot-count'),
            rotCx: overlay.querySelector('#rot-cx'),
            rotCy: overlay.querySelector('#rot-cy'),
            panels: {
                grid: overlay.querySelector('#params-grid'),
                honeycomb: overlay.querySelector('#params-honeycomb'),
                rotation: overlay.querySelector('#params-rotation')
            }
        };

        // 6. 预览适配
        const maxPreviewDim = 600;
        const aspect = docW / docH;
        let pWidth, pHeight, scaleRatio;

        if (docW > docH) {
            pWidth = Math.min(docW, maxPreviewDim);
            pHeight = pWidth / aspect;
        } else {
            pHeight = Math.min(docH, maxPreviewDim);
            pWidth = pHeight * aspect;
        }
        
        previewCanvas.width = pWidth;
        previewCanvas.height = pHeight;
        scaleRatio = docW / pWidth;

        // === 核心绘制逻辑 ===
        const drawArray = (ctx, isPreview) => {
            // 使用裁切后的内容尺寸
            const w = croppedData.width;
            const h = croppedData.height;
            const srcImg = croppedData.canvas;
            
            if (isPreview) {
                ctx.clearRect(0, 0, pWidth, pHeight);
                ctx.save();
                ctx.scale(1 / scaleRatio, 1 / scaleRatio);
            }

            if (state.mode === 'grid') {
                const gapX = state.grid.x;
                const gapY = state.grid.y;
                let cols = state.grid.cols;
                let rows = state.grid.rows;

                if (state.grid.autoFill) {
                    // 自动计算铺满画布需要的数量
                    cols = Math.ceil(docW / (w + gapX));
                    rows = Math.ceil(docH / (h + gapY));
                }

                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        // 宫格模式默认从 (0,0) 开始铺满画布，类似图案填充
                        ctx.drawImage(srcImg, c * (w + gapX), r * (h + gapY));
                    }
                }

            } else if (state.mode === 'honeycomb') {
                const gapX = state.honeycomb.x;
                const gapY = state.honeycomb.y;
                let cols = state.honeycomb.cols;
                let rows = state.honeycomb.rows;

                if (state.honeycomb.autoFill) {
                    cols = Math.ceil(docW / (w + gapX)) + 1;
                    rows = Math.ceil(docH / (h + gapY));
                }

                for (let r = 0; r < rows; r++) {
                    const isOddRow = r % 2 !== 0;
                    const offsetX = isOddRow ? (w + gapX) / 2 : 0;
                    
                    for (let c = 0; c < cols; c++) {
                        // 蜂窝交错排列
                        const x = c * (w + gapX) - (isOddRow ? 0 : 0) + offsetX;
                        const y = r * (h + gapY);
                        // 稍微优化，不绘制屏幕外的
                        if (x > -w && x < docW && y > -h && y < docH) {
                            ctx.drawImage(srcImg, x, y);
                        }
                    }
                }

            } else if (state.mode === 'rotation') {
                const cx = state.rotation.cx;
                const cy = state.rotation.cy;
                const angleRad = state.rotation.angle * Math.PI / 180;
                
                // 计算裁切内容相对于旋转中心的原始偏移量
                // 这样旋转时，物体会保持相对于中心的“半径”距离
                const relX = croppedData.x - cx;
                const relY = croppedData.y - cy;

                for (let i = 0; i < state.rotation.count; i++) {
                    ctx.save();
                    ctx.translate(cx, cy); // 移到旋转中心
                    ctx.rotate(i * angleRad); // 旋转坐标系
                    // 在相对于新坐标系的原始偏移位置绘制
                    ctx.drawImage(srcImg, relX, relY);
                    ctx.restore();
                }
            }

            if (isPreview) {
                // 绘制旋转中心辅助线
                if (state.mode === 'rotation') {
                    const cx = state.rotation.cx;
                    const cy = state.rotation.cy;
                    ctx.strokeStyle = '#ff3333';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(cx - 15, cy); ctx.lineTo(cx + 15, cy);
                    ctx.moveTo(cx, cy - 15); ctx.lineTo(cx, cy + 15);
                    ctx.stroke();
                }
                ctx.restore();
            }
        };

        // 7. 状态更新
        const updateState = () => {
            state.grid.autoFill = inputs.gridAuto.checked;
            state.grid.cols = parseInt(inputs.gridCols.value) || 1;
            state.grid.rows = parseInt(inputs.gridRows.value) || 1;
            state.grid.x = parseInt(inputs.gridGapX.value) || 0;
            state.grid.y = parseInt(inputs.gridGapY.value) || 0;
            inputs.gridCountGroup.style.display = state.grid.autoFill ? 'none' : 'block';

            state.honeycomb.autoFill = inputs.honeyAuto.checked;
            state.honeycomb.cols = parseInt(inputs.honeyCols.value) || 1;
            state.honeycomb.rows = parseInt(inputs.honeyRows.value) || 1;
            state.honeycomb.x = parseInt(inputs.honeyGapX.value) || 0;
            state.honeycomb.y = parseInt(inputs.honeyGapY.value) || 0;
            inputs.honeyCountGroup.style.display = state.honeycomb.autoFill ? 'none' : 'block';

            state.rotation.angle = parseFloat(inputs.rotAngle.value) || 0;
            state.rotation.count = parseInt(inputs.rotCount.value) || 1;
            state.rotation.cx = parseInt(inputs.rotCx.value) || 0;
            state.rotation.cy = parseInt(inputs.rotCy.value) || 0;

            drawArray(previewCtx, true);
        };

        // 绑定事件
        inputs.mode.addEventListener('change', (e) => {
            state.mode = e.target.value;
            Object.values(inputs.panels).forEach(p => p.style.display = 'none');
            inputs.panels[state.mode].style.display = 'block';
            updateState();
        });

        const bindInputs = [
            inputs.gridAuto, inputs.gridCols, inputs.gridRows, inputs.gridGapX, inputs.gridGapY,
            inputs.honeyAuto, inputs.honeyCols, inputs.honeyRows, inputs.honeyGapX, inputs.honeyGapY,
            inputs.rotAngle, inputs.rotCount, inputs.rotCx, inputs.rotCy
        ];
        bindInputs.forEach(el => el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', updateState));

        // 交互式中心点
        previewCanvas.addEventListener('mousedown', (e) => {
            if (state.mode !== 'rotation') return;
            const rect = previewCanvas.getBoundingClientRect();
            const realX = Math.round((e.clientX - rect.left) * scaleRatio);
            const realY = Math.round((e.clientY - rect.top) * scaleRatio);
            
            state.rotation.cx = realX;
            state.rotation.cy = realY;
            inputs.rotCx.value = realX;
            inputs.rotCy.value = realY;
            updateState();
        });

        // 应用按钮
        overlay.querySelector('#btn-ok').addEventListener('click', () => {
            // 调整图层大小为文档大小，防止裁剪
            activeLayer.canvas.width = docW;
            activeLayer.canvas.height = docH;
            
            // 清空并绘制
            activeLayer.ctx.clearRect(0, 0, docW, docH);
            drawArray(activeLayer.ctx, false);
            
            app.render();
            app.renderLayerList();
            app.saveHistory();
            
            document.body.removeChild(overlay);
            Toast.show('阵列已生成', 'success');
        });

        overlay.querySelector('#btn-cancel').addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        // 初始渲染
        updateState();
    }
})();