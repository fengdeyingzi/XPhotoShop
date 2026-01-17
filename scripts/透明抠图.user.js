// ==UserScript==
// @name         PhotoShop - 透明拆分滤镜 (Alpha Split)
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  将不透明图层拆分为“纯色背景层”和“透明前景层”，支持多种Alpha提取算法
// @author       风的影子
// @match        file://*/PhotoShop/index.html
// @match        file://*/PhotoShop/PhotoShop.html
// @match        http://127.0.0.1:5500/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // === CSS 样式 ===
    const style = document.createElement('style');
    style.textContent = `
        .ps-dialog-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.5); z-index: 9999;
            display: flex; justify-content: center; align-items: center;
            font-family: "Segoe UI", sans-serif; font-size: 13px; color: #dcdcdc;
            user-select: none;
        }
        .ps-split-dialog {
            background: #3a3a3a; border: 1px solid #555; box-shadow: 0 10px 30px rgba(0,0,0,0.7);
            width: 900px; height: 600px; display: flex; flex-direction: column; border-radius: 4px;
        }
        .ps-dialog-header {
            background: #2a2a2a; padding: 10px 15px; font-weight: 600; border-bottom: 1px solid #222;
            display: flex; justify-content: space-between; align-items: center;
        }
        .ps-dialog-content {
            display: flex; flex: 1; overflow: hidden;
        }
        
        /* 左侧控制面板 */
        .ps-panel-left {
            width: 320px; background: #333; border-right: 1px solid #444; padding: 15px;
            display: flex; flex-direction: column; gap: 12px; overflow-y: auto;
        }
        
        .ps-group-title {
            font-weight: 600; color: #eee; border-bottom: 1px solid #444; 
            padding-bottom: 5px; margin-bottom: 5px; margin-top: 10px;
        }
        .ps-group-title:first-child { margin-top: 0; }
        
        .ps-control-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .ps-control-row label { color: #aaa; font-size: 12px; }
        
        .ps-input-control {
            background: #222; border: 1px solid #555; color: #eee; padding: 4px; outline: none; border-radius: 2px; flex: 1;
        }
        
        .ps-slider-container { display: flex; align-items: center; gap: 10px; flex: 1; }
        .ps-slider-container input[type="range"] { flex: 1; cursor: pointer; }
        .ps-slider-val { width: 30px; text-align: right; color: #3498db; font-weight: bold; }
        
        .ps-desc { font-size: 11px; color: #777; margin-top: -4px; margin-bottom: 8px; line-height: 1.3; }

        /* 质量条 */
        .ps-quality-bar-bg { height: 6px; background: #222; border-radius: 3px; overflow: hidden; margin-top: 5px; }
        .ps-quality-bar { height: 100%; transition: width 0.3s, background-color 0.3s; }
        .ps-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
        .ps-stat-item { background: #2a2a2a; padding: 5px; text-align: center; border-radius: 3px; }
        .ps-stat-val { color: #eee; font-weight: bold; }
        .ps-stat-label { color: #777; font-size: 10px; }

        /* 右侧预览面板 */
        .ps-panel-right {
            flex: 1; background: #222; display: flex; flex-direction: column;
            position: relative; overflow: hidden;
        }
        .ps-preview-toolbar {
            padding: 8px; background: #2a2a2a; border-bottom: 1px solid #444;
            display: flex; gap: 10px; justify-content: center;
        }
        .ps-preview-btn {
            background: #444; border: 1px solid #555; color: #ccc; padding: 4px 12px; 
            cursor: pointer; font-size: 12px; border-radius: 12px;
        }
        .ps-preview-btn.active { background: #3498db; color: white; border-color: #2980b9; }
        
        .ps-canvas-container {
            flex: 1; display: flex; justify-content: center; align-items: center; overflow: hidden;
            background-image: linear-gradient(45deg, #2a2a2a 25%, transparent 25%), 
                              linear-gradient(-45deg, #2a2a2a 25%, transparent 25%), 
                              linear-gradient(45deg, transparent 75%, #2a2a2a 75%), 
                              linear-gradient(-45deg, transparent 75%, #2a2a2a 75%);
            background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
        }
        canvas.preview-canvas {
            box-shadow: 0 0 15px rgba(0,0,0,0.5); max-width: 95%; max-height: 95%; border: 1px solid #444;
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
        
        .ps-spinner {
            border: 2px solid #444; border-top: 2px solid #3498db; border-radius: 50%;
            width: 14px; height: 14px; animation: spin 1s linear infinite; display: none; margin-right: 10px;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);

    // === 初始化 ===
    const waitForApp = setInterval(() => {
        if (window.photoShopApp) {
            clearInterval(waitForApp);
            initSplitPlugin(window.photoShopApp);
        }
    }, 500);

    function initSplitPlugin(app) {
        app.menuManager.addMenuItem('滤镜', {
            label: '透明拆分 (Alpha Split)...',
            action: 'filter-alpha-split',
            handler: () => showSplitDialog(app),
            position: 'bottom',
            divider: true
        });
    }

    // === 主逻辑 ===
    function showSplitDialog(app) {
        const activeLayer = app.layerManager.getActiveLayer();
        if (!activeLayer || activeLayer.isGroup) {
            Toast.show('请选择一个普通图层', 'warning');
            return;
        }

        // 1. 获取源数据
        const width = activeLayer.canvas.width;
        const height = activeLayer.canvas.height;
        const originalCtx = activeLayer.ctx;
        const originalImageData = originalCtx.getImageData(0, 0, width, height);

        // 2. 状态管理
        const state = {
            bgColor: '#ffffff',
            fgColor: '#000000',
            algorithm: 'alpha_extraction',
            threshold: 10,
            smoothness: 3,
            tolerance: 15,
            gamma: 1.0,
            overlayCount: 1,
            viewMode: 'composite', // composite, transparent, background, difference
            processing: false
        };

        // 3. 自动检测背景色
        state.bgColor = detectBackgroundColor(originalCtx, width, height);

        // 4. 构建 UI
        const overlay = document.createElement('div');
        overlay.className = 'ps-dialog-overlay';
        overlay.innerHTML = `
            <div class="ps-split-dialog">
                <div class="ps-dialog-header">
                    <span>透明图片拆分 (Alpha Split)</span>
                    <div class="ps-spinner" id="split-spinner"></div>
                </div>
                <div class="ps-dialog-content">
                    <!-- 左侧控制 -->
                    <div class="ps-panel-left">
                        <div class="ps-group-title">背景设置</div>
                        <div class="ps-control-row">
                            <label>背景颜色</label>
                            <div style="display:flex; gap:5px;">
                                <input type="color" id="bg-color" value="${state.bgColor}" style="width:50px; height:25px; border:none; cursor:pointer;">
                                <button class="ps-btn" id="btn-detect" style="padding:2px 8px; font-size:11px;">自动检测</button>
                            </div>
                        </div>
                        
                        <div class="ps-group-title">算法选择</div>
                        <select id="algo-select" class="ps-input-control" style="width:100%; margin-bottom:5px;">
                            <option value="alpha_extraction">Alpha提取法 (推荐)</option>
                            <option value="difference_based">基于差异法</option>
                            <option value="threshold_based">阈值分割法</option>
                            <option value="color_keying">色键抠像法</option>
                            <option value="solid_extraction">纯色提取法</option>
                        </select>
                        <div class="ps-desc" id="algo-desc">通过计算每个像素与背景色的差异来生成Alpha通道。</div>

                        <div id="fg-color-group" style="display:none;">
                            <div class="ps-control-row">
                                <label>前景颜色</label>
                                <input type="color" id="fg-color" value="${state.fgColor}" style="width:50px; height:25px; border:none;">
                            </div>
                        </div>

                        <div class="ps-group-title">参数调节</div>
                        
                        <div class="ps-control-row"><label>相似度阈值</label></div>
                        <div class="ps-slider-container">
                            <input type="range" id="sl-threshold" min="0" max="100" value="${state.threshold}">
                            <span class="ps-slider-val" id="val-threshold">${state.threshold}</span>
                        </div>
                        
                        <div class="ps-control-row"><label>边缘平滑度</label></div>
                        <div class="ps-slider-container">
                            <input type="range" id="sl-smoothness" min="0" max="10" value="${state.smoothness}">
                            <span class="ps-slider-val" id="val-smoothness">${state.smoothness}</span>
                        </div>

                        <div class="ps-control-row"><label>颜色容差</label></div>
                        <div class="ps-slider-container">
                            <input type="range" id="sl-tolerance" min="0" max="100" value="${state.tolerance}">
                            <span class="ps-slider-val" id="val-tolerance">${state.tolerance}</span>
                        </div>

                        <div class="ps-control-row"><label>Gamma校正</label></div>
                        <div class="ps-slider-container">
                            <input type="range" id="sl-gamma" min="0.5" max="2.0" step="0.1" value="${state.gamma}">
                            <span class="ps-slider-val" id="val-gamma">${state.gamma}</span>
                        </div>

                        <div class="ps-control-row"><label>叠加预览次数</label></div>
                        <div class="ps-slider-container">
                            <input type="range" id="sl-overlay" min="1" max="20" value="${state.overlayCount}">
                            <span class="ps-slider-val" id="val-overlay">${state.overlayCount}</span>
                        </div>

                        <div class="ps-group-title">质量分析</div>
                        <div class="ps-quality-bar-bg"><div id="quality-bar" class="ps-quality-bar" style="width:0%"></div></div>
                        <div style="text-align:center; font-size:11px; margin-top:2px; color:#aaa;" id="quality-text">计算中...</div>
                        
                        <div class="ps-stat-grid">
                            <div class="ps-stat-item"><div class="ps-stat-val" id="stat-diff">0%</div><div class="ps-stat-label">平均差异</div></div>
                            <div class="ps-stat-item"><div class="ps-stat-val" id="stat-psnr">∞</div><div class="ps-stat-label">PSNR (dB)</div></div>
                        </div>
                    </div>

                    <!-- 右侧预览 -->
                    <div class="ps-panel-right">
                        <div class="ps-preview-toolbar">
                            <button class="ps-preview-btn active" data-mode="composite">合成效果</button>
                            <button class="ps-preview-btn" data-mode="transparent">仅前景(透明)</button>
                            <button class="ps-preview-btn" data-mode="background">仅背景</button>
                            <button class="ps-preview-btn" data-mode="difference">差异分析</button>
                        </div>
                        <div class="ps-canvas-container">
                            <canvas id="preview-canvas" class="preview-canvas"></canvas>
                        </div>
                    </div>
                </div>
                <div class="ps-dialog-footer">
                    <button class="ps-btn" id="btn-cancel">取消</button>
                    <button class="ps-btn primary" id="btn-ok">应用 (创建新图层)</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // 5. 元素绑定
        const previewCanvas = overlay.querySelector('#preview-canvas');
        const previewCtx = previewCanvas.getContext('2d');
        const spinner = overlay.querySelector('#split-spinner');
        
        // 控件
        const inputs = {
            bgColor: overlay.querySelector('#bg-color'),
            fgColor: overlay.querySelector('#fg-color'),
            algo: overlay.querySelector('#algo-select'),
            threshold: overlay.querySelector('#sl-threshold'),
            smoothness: overlay.querySelector('#sl-smoothness'),
            tolerance: overlay.querySelector('#sl-tolerance'),
            gamma: overlay.querySelector('#sl-gamma'),
            overlay: overlay.querySelector('#sl-overlay'),
            btnDetect: overlay.querySelector('#btn-detect'),
            fgGroup: overlay.querySelector('#fg-color-group'),
            algoDesc: overlay.querySelector('#algo-desc')
        };

        // 显示
        const displays = {
            threshold: overlay.querySelector('#val-threshold'),
            smoothness: overlay.querySelector('#val-smoothness'),
            tolerance: overlay.querySelector('#val-tolerance'),
            gamma: overlay.querySelector('#val-gamma'),
            overlayCount: overlay.querySelector('#val-overlay'),
            qualityBar: overlay.querySelector('#quality-bar'),
            qualityText: overlay.querySelector('#quality-text'),
            statDiff: overlay.querySelector('#stat-diff'),
            statPsnr: overlay.querySelector('#stat-psnr')
        };

        // 6. 预览适配
        const maxPreviewDim = 600;
        const aspect = width / height;
        let pWidth, pHeight, scaleRatio;
        if (width > height) {
            pWidth = Math.min(width, maxPreviewDim);
            pHeight = pWidth / aspect;
        } else {
            pHeight = Math.min(height, maxPreviewDim);
            pWidth = pHeight * aspect;
        }
        previewCanvas.width = pWidth;
        previewCanvas.height = pHeight;
        scaleRatio = width / pWidth;

        // 缓存处理结果
        let resultData = {
            transparent: null,
            background: null,
            composite: null,
            difference: null
        };

        // === 核心处理函数 ===
        const processImage = () => {
            if (state.processing) return;
            state.processing = true;
            spinner.style.display = 'block';

            // 延时执行以免阻塞UI
            setTimeout(() => {
                const bgColorRGB = hexToRgb(state.bgColor);
                const fgColorRGB = hexToRgb(state.fgColor);
                
                // 1. 生成纯色背景
                const bgCanvas = document.createElement('canvas');
                bgCanvas.width = width; bgCanvas.height = height;
                const bgCtx = bgCanvas.getContext('2d');
                bgCtx.fillStyle = state.bgColor;
                bgCtx.fillRect(0, 0, width, height);
                resultData.background = bgCanvas;

                // 2. 算法处理
                let transData;
                const pixels = originalImageData.data;
                
                switch(state.algorithm) {
                    case 'alpha_extraction':
                        transData = alphaExtractionAlgorithm(pixels, width, height, bgColorRGB, state.threshold, state.gamma);
                        break;
                    case 'difference_based':
                        transData = differenceBasedAlgorithm(pixels, width, height, bgColorRGB, state.threshold, state.tolerance);
                        break;
                    case 'threshold_based':
                        transData = thresholdBasedAlgorithm(pixels, width, height, bgColorRGB, state.threshold, state.tolerance);
                        break;
                    case 'color_keying':
                        transData = colorKeyingAlgorithm(pixels, width, height, bgColorRGB, state.tolerance);
                        break;
                    case 'solid_extraction':
                        transData = solidExtractionAlgorithm(pixels, width, height, bgColorRGB, fgColorRGB, state.threshold, state.gamma);
                        break;
                    default:
                        transData = alphaExtractionAlgorithm(pixels, width, height, bgColorRGB, state.threshold, state.gamma);
                }

                // 3. 平滑处理
                if (state.smoothness > 0) {
                    applyEdgeSmoothing(transData.data, width, height, state.smoothness);
                }

                const transCanvas = document.createElement('canvas');
                transCanvas.width = width; transCanvas.height = height;
                transCanvas.getContext('2d').putImageData(transData, 0, 0);
                resultData.transparent = transCanvas;

                // 4. 合成验证
                const compCanvas = document.createElement('canvas');
                compCanvas.width = width; compCanvas.height = height;
                const compCtx = compCanvas.getContext('2d');
                
                // 绘制背景
                compCtx.fillStyle = state.bgColor;
                compCtx.fillRect(0, 0, width, height);
                // 叠加透明图
                for(let i=0; i<state.overlayCount; i++) {
                    compCtx.drawImage(transCanvas, 0, 0);
                }
                resultData.composite = compCanvas;

                // 5. 差异分析
                const diffCanvas = document.createElement('canvas');
                diffCanvas.width = width; diffCanvas.height = height;
                const diffCtx = diffCanvas.getContext('2d');
                const compData = compCtx.getImageData(0, 0, width, height);
                const stats = calculateDifference(originalImageData, compData, width, height, diffCtx);
                resultData.difference = diffCanvas;

                // 更新统计UI
                updateStatsUI(stats);

                // 绘制预览
                drawPreview();

                state.processing = false;
                spinner.style.display = 'none';
            }, 10);
        };

        const drawPreview = () => {
            if (!resultData.composite) return;
            
            previewCtx.clearRect(0, 0, pWidth, pHeight);
            previewCtx.save();
            previewCtx.scale(1/scaleRatio, 1/scaleRatio);

            let source;
            switch(state.viewMode) {
                case 'transparent': source = resultData.transparent; break;
                case 'background': source = resultData.background; break;
                case 'difference': source = resultData.difference; break;
                default: source = resultData.composite; break;
            }

            if (source) previewCtx.drawImage(source, 0, 0);
            previewCtx.restore();
        };

        const updateStatsUI = (stats) => {
            displays.statDiff.textContent = stats.avgDifference.toFixed(2) + "%";
            displays.statPsnr.textContent = stats.psnr;
            
            let qualityPercent = 100 - stats.avgDifference;
            qualityPercent = Math.max(0, Math.min(100, qualityPercent));
            
            let color = '#e74c3c'; // poor
            let text = '一般';
            if (qualityPercent > 90) { color = '#2ecc71'; text = '优秀'; }
            else if (qualityPercent > 75) { color = '#f1c40f'; text = '良好'; }
            
            displays.qualityBar.style.width = qualityPercent + "%";
            displays.qualityBar.style.backgroundColor = color;
            displays.qualityText.textContent = text;
        };

        // === 事件绑定 ===
        const updateParam = (key, val) => {
            state[key] = val;
            if (displays[key]) displays[key].textContent = val; // 更新数字显示
            processImage();
        };

        inputs.bgColor.addEventListener('input', (e) => updateParam('bgColor', e.target.value));
        inputs.fgColor.addEventListener('input', (e) => updateParam('fgColor', e.target.value));
        
        inputs.algo.addEventListener('change', (e) => {
            state.algorithm = e.target.value;
            // 更新描述和UI显隐
            const descs = {
                alpha_extraction: "通过计算每个像素与背景色的差异来生成Alpha通道。",
                difference_based: "透明图存储原图与背景色的差值。",
                threshold_based: "使用阈值分割将图像分为前景和背景。",
                color_keying: "类似绿幕抠像，将接近背景色的区域设为透明。",
                solid_extraction: "使用指定前景色，计算Alpha差异。"
            };
            inputs.algoDesc.textContent = descs[state.algorithm] || "";
            inputs.fgGroup.style.display = state.algorithm === 'solid_extraction' ? 'block' : 'none';
            processImage();
        });

        inputs.threshold.addEventListener('input', (e) => updateParam('threshold', parseInt(e.target.value)));
        inputs.smoothness.addEventListener('input', (e) => updateParam('smoothness', parseInt(e.target.value)));
        inputs.tolerance.addEventListener('input', (e) => updateParam('tolerance', parseInt(e.target.value)));
        inputs.gamma.addEventListener('input', (e) => updateParam('gamma', parseFloat(e.target.value)));
        inputs.overlay.addEventListener('input', (e) => updateParam('overlayCount', parseInt(e.target.value)));

        inputs.btnDetect.addEventListener('click', () => {
            state.bgColor = detectBackgroundColor(originalCtx, width, height);
            inputs.bgColor.value = state.bgColor;
            processImage();
        });

        // 视图切换
        const viewBtns = overlay.querySelectorAll('.ps-preview-btn');
        viewBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                viewBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.viewMode = btn.dataset.mode;
                drawPreview();
            });
        });

        // 底部按钮
        overlay.querySelector('#btn-cancel').addEventListener('click', () => document.body.removeChild(overlay));
        
        overlay.querySelector('#btn-ok').addEventListener('click', () => {
            if (!resultData.transparent) return;
            
            // 1. 创建背景层
            const bgLayer = app.layerManager.addLayer(width, height, activeLayer.name + ' (BG)');
            bgLayer.ctx.drawImage(resultData.background, 0, 0);
            
            // 2. 创建前景层
            const fgLayer = app.layerManager.addLayer(width, height, activeLayer.name + ' (FG)');
            fgLayer.ctx.drawImage(resultData.transparent, 0, 0);
            
            // 3. 隐藏原图层
            activeLayer.visible = false;
            
            app.render();
            app.renderLayerList();
            app.saveHistory();
            
            document.body.removeChild(overlay);
            Toast.show('已拆分图层', 'success');
        });

        // 初始运行
        processImage();
    }

    // === 算法实现 (移植自原HTML) ===
    
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 255, g: 255, b: 255 };
    }

    function rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    function detectBackgroundColor(ctx, w, h) {
        // 取四个角
        const corners = [{x:0, y:0}, {x:w-1, y:0}, {x:0, y:h-1}, {x:w-1, y:h-1}];
        let r=0, g=0, b=0;
        corners.forEach(p => {
            const d = ctx.getImageData(p.x, p.y, 1, 1).data;
            r += d[0]; g += d[1]; b += d[2];
        });
        return rgbToHex(Math.round(r/4), Math.round(g/4), Math.round(b/4));
    }

    // Alpha提取算法
    function alphaExtractionAlgorithm(pixels, w, h, bgColor, threshold, gamma) {
        const output = new ImageData(w, h);
        const outData = output.data;
        const normThresh = threshold / 100;
        
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
            const diffR = r - bgColor.r, diffG = g - bgColor.g, diffB = b - bgColor.b;
            const dist = Math.sqrt(diffR*diffR + diffG*diffG + diffB*diffB) / 441.67;
            
            let alpha = 0;
            if (dist > normThresh) {
                alpha = Math.min(1.0, (dist - normThresh) / (1.0 - normThresh));
                alpha = Math.pow(alpha, gamma);
                alpha = Math.round(alpha * 255);
            }
            
            outData[i] = r; outData[i+1] = g; outData[i+2] = b; outData[i+3] = alpha;
        }
        return output;
    }

    // 基于差异算法
    function differenceBasedAlgorithm(pixels, w, h, bgColor, threshold, tolerance) {
        const output = new ImageData(w, h);
        const outData = output.data;
        
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
            const diffR = r - bgColor.r, diffG = g - bgColor.g, diffB = b - bgColor.b;
            const maxDiff = Math.max(Math.abs(diffR), Math.abs(diffG), Math.abs(diffB));
            
            let alpha = 255;
            if (maxDiff < threshold) alpha = Math.round(255 * (maxDiff / threshold));
            if (maxDiff < tolerance) alpha = 0;
            
            outData[i] = Math.max(0, Math.min(255, diffR + 128));
            outData[i+1] = Math.max(0, Math.min(255, diffG + 128));
            outData[i+2] = Math.max(0, Math.min(255, diffB + 128));
            outData[i+3] = alpha;
        }
        return output;
    }

    // 阈值分割
    function thresholdBasedAlgorithm(pixels, w, h, bgColor, threshold, tolerance) {
        const output = new ImageData(w, h);
        const outData = output.data;
        
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
            const diff = Math.abs(r - bgColor.r) + Math.abs(g - bgColor.g) + Math.abs(b - bgColor.b);
            
            let alpha = 255;
            if (diff < threshold) alpha = 0;
            else if (diff < threshold + tolerance) alpha = Math.round(255 * (diff - threshold) / tolerance);
            
            outData[i] = r; outData[i+1] = g; outData[i+2] = b; outData[i+3] = alpha;
        }
        return output;
    }

    // 色键抠像
    function colorKeyingAlgorithm(pixels, w, h, bgColor, tolerance) {
        const output = new ImageData(w, h);
        const outData = output.data;
        const tolSq = tolerance * tolerance;
        
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
            const diffR = r - bgColor.r, diffG = g - bgColor.g, diffB = b - bgColor.b;
            const distSq = diffR*diffR + diffG*diffG + diffB*diffB;
            
            let alpha = 255;
            if (distSq < tolSq) alpha = Math.round(255 * (distSq / tolSq));
            
            outData[i] = r; outData[i+1] = g; outData[i+2] = b; outData[i+3] = alpha;
        }
        return output;
    }

    // 纯色提取
    function solidExtractionAlgorithm(pixels, w, h, bgColor, fgColor, threshold, gamma) {
        const output = new ImageData(w, h);
        const outData = output.data;
        const normThresh = threshold / 100;
        
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
            const diffR = r - bgColor.r, diffG = g - bgColor.g, diffB = b - bgColor.b;
            const dist = Math.sqrt(diffR*diffR + diffG*diffG + diffB*diffB) / 441.67;
            
            let alpha = 0;
            if (dist > normThresh) {
                alpha = Math.min(1.0, (dist - normThresh) / (1.0 - normThresh));
                alpha = Math.pow(alpha, gamma);
                alpha = Math.round(alpha * 255);
            }
            
            outData[i] = fgColor.r; outData[i+1] = fgColor.g; outData[i+2] = fgColor.b; outData[i+3] = alpha;
        }
        return output;
    }

    // 边缘平滑 (高斯模糊Alpha通道)
    function applyEdgeSmoothing(pixels, w, h, smoothness) {
        const radius = smoothness;
        const kernelSize = radius * 2 + 1;
        const kernel = createGaussianKernel(kernelSize, radius / 2);
        
        // 简单卷积实现，仅处理Alpha
        // 为性能考虑，这里只做简单处理，实际可优化
        const alphaCopy = new Uint8Array(w * h);
        for(let i=0; i<w*h; i++) alphaCopy[i] = pixels[i*4+3];

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = (y * w + x) * 4;
                if (pixels[idx+3] > 0 && pixels[idx+3] < 255) {
                    let sum = 0, wSum = 0;
                    for (let ky = -radius; ky <= radius; ky++) {
                        const ny = y + ky;
                        if (ny < 0 || ny >= h) continue;
                        for (let kx = -radius; kx <= radius; kx++) {
                            const nx = x + kx;
                            if (nx < 0 || nx >= w) continue;
                            const weight = kernel[ky+radius][kx+radius];
                            sum += alphaCopy[ny*w+nx] * weight;
                            wSum += weight;
                        }
                    }
                    if (wSum > 0) pixels[idx+3] = Math.round(sum / wSum);
                }
            }
        }
    }

    function createGaussianKernel(size, sigma) {
        const kernel = Array(size).fill().map(() => Array(size).fill(0));
        const center = Math.floor(size / 2);
        let sum = 0;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const dx = x - center, dy = y - center;
                const val = Math.exp(-(dx*dx + dy*dy) / (2 * sigma * sigma));
                kernel[y][x] = val;
                sum += val;
            }
        }
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) kernel[y][x] /= sum;
        return kernel;
    }

    // 差异计算
    function calculateDifference(orig, comp, w, h, ctx) {
        const p1 = orig.data, p2 = comp.data;
        const diffImg = ctx.createImageData(w, h);
        const diffP = diffImg.data;
        
        let totalDiff = 0, maxDiff = 0, mse = 0;
        
        for (let i = 0; i < p1.length; i += 4) {
            const dr = Math.abs(p1[i] - p2[i]);
            const dg = Math.abs(p1[i+1] - p2[i+1]);
            const db = Math.abs(p1[i+2] - p2[i+2]);
            const diff = Math.sqrt(dr*dr + dg*dg + db*db) / 441.67;
            
            totalDiff += diff;
            maxDiff = Math.max(maxDiff, diff);
            mse += (dr*dr + dg*dg + db*db) / 3;
            
            const intensity = Math.round(diff * 255);
            diffP[i] = intensity; diffP[i+1] = 0; diffP[i+2] = 0; diffP[i+3] = 255;
        }
        
        ctx.putImageData(diffImg, 0, 0);
        
        const avgDiff = (totalDiff / (w*h)) * 100;
        mse /= (w*h);
        const psnr = mse === 0 ? "∞" : (10 * Math.log10((255*255)/mse)).toFixed(2);
        
        return { avgDifference: avgDiff, maxDifference: maxDiff, psnr: psnr };
    }

})();