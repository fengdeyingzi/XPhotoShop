// ==UserScript==
// @name         PhotoShop - 图层切割优化
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  分析并优化图层切割，用于Sprite导出优化 (修复匹配算法)
// @author       风的影子
// @match        file://*/PhotoShop/index.html
// @match        file://*/PhotoShop/PhotoShop.html
// @match        http://127.0.0.1:5500/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ==================== CSS 样式 ====================
    const STYLES = `
        .opt-dialog-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.7); z-index: 9999;
            display: flex; justify-content: center; align-items: center;
            font-family: 'Segoe UI', sans-serif; color: #ddd;
        }
        .opt-dialog {
            background: #2a2a2a; width: 90%; max-width: 1200px; height: 85vh;
            border-radius: 8px; display: flex; flex-direction: column;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5); overflow: hidden;
        }
        .opt-header {
            padding: 15px 20px; background: #222; border-bottom: 1px solid #333;
            display: flex; justify-content: space-between; align-items: center;
        }
        .opt-title { font-size: 18px; font-weight: bold; color: #fff; }
        .opt-body {
            flex: 1; display: flex; overflow: hidden;
        }
        .opt-sidebar {
            width: 300px; background: #252525; border-right: 1px solid #333;
            display: flex; flex-direction: column; padding: 15px; gap: 20px; overflow-y: auto;
        }
        .opt-main {
            flex: 1; display: flex; flex-direction: column; padding: 15px; gap: 15px; overflow: hidden;
        }
        .opt-section-title {
            font-size: 12px; color: #888; text-transform: uppercase; margin-bottom: 8px; font-weight: bold;
        }
        .opt-control-group { margin-bottom: 15px; }
        .opt-label { display: block; margin-bottom: 5px; font-size: 13px; }
        .opt-select, .opt-input {
            width: 100%; background: #333; border: 1px solid #444; color: #ddd;
            padding: 6px; border-radius: 4px;
        }
        .opt-layer-list {
            background: #1a1a1a; border: 1px solid #333; border-radius: 4px;
            height: 150px; overflow-y: auto; padding: 5px;
        }
        .opt-layer-item {
            padding: 4px 8px; font-size: 12px; cursor: pointer;
        }
        .opt-layer-item:hover { background: #333; }
        .opt-layer-item.selected { background: #4b6cb7; color: white; }
        
        .opt-preview-area {
            flex: 1; background: #1a1a1a; border: 1px solid #333; border-radius: 4px;
            position: relative; overflow: hidden; display: flex; flex-direction: column;
        }
        .opt-preview-toolbar {
            padding: 8px; background: #222; border-bottom: 1px solid #333;
            display: flex; gap: 10px; align-items: center;
        }
        .opt-btn-sm {
            padding: 2px 8px; font-size: 11px; background: #444; border: none; color: #ddd;
            border-radius: 3px; cursor: pointer;
        }
        .opt-btn-sm:hover { background: #555; }
        .opt-btn-sm.active { background: #4b6cb7; color: white; }
        
        .opt-canvas-container {
            flex: 1; overflow: auto; display: flex; justify-content: center; align-items: center;
            position: relative;
            background-image: linear-gradient(45deg, #222 25%, transparent 25%), 
                              linear-gradient(-45deg, #222 25%, transparent 25%), 
                              linear-gradient(45deg, transparent 75%, #222 75%), 
                              linear-gradient(-45deg, transparent 75%, #222 75%);
            background-size: 20px 20px;
            background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
        }
        .opt-preview-canvas {
            image-rendering: pixelated; box-shadow: 0 0 10px rgba(0,0,0,0.5);
            cursor: crosshair;
        }
        
        .opt-results-area {
            height: 200px; background: #252525; border-top: 1px solid #333;
            display: flex; flex-direction: column;
        }
        .opt-results-header {
            padding: 8px 15px; background: #222; font-weight: bold; font-size: 13px;
        }
        .opt-results-list {
            flex: 1; overflow-y: auto; padding: 10px;
        }
        .opt-result-item {
            background: #333; border-radius: 4px; margin-bottom: 8px; overflow: hidden;
        }
        .opt-result-summary {
            padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;
            cursor: pointer;
        }
        .opt-result-summary:hover { background: #3a3a3a; }
        .opt-result-details {
            padding: 10px; background: #2a2a2a; border-top: 1px solid #444; display: none;
        }
        .opt-result-details.expanded { display: block; }
        
        .opt-match-group { margin-bottom: 8px; }
        .opt-match-title { font-size: 11px; font-weight: bold; margin-bottom: 4px; }
        .opt-match-title.part1 { color: #ff9800; } /* 橙色 */
        .opt-match-title.part2 { color: #ff5722; } /* 橘色 */
        
        .opt-match-tag {
            display: inline-block; padding: 2px 6px; background: #444; border-radius: 3px;
            font-size: 11px; margin-right: 5px; margin-bottom: 3px; cursor: pointer;
            border: 1px solid transparent;
        }
        .opt-match-tag:hover { border-color: #888; }
        
        .opt-footer {
            padding: 15px 20px; background: #222; border-top: 1px solid #333;
            display: flex; justify-content: flex-end; gap: 10px;
        }
        .opt-btn {
            padding: 8px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;
        }
        .opt-btn-primary { background: #4b6cb7; color: white; }
        .opt-btn-primary:hover { background: #3d5a9b; }
        .opt-btn-secondary { background: #444; color: #ddd; }
        .opt-btn-secondary:hover { background: #555; }
        
        /* 匹配预览弹窗 */
        .opt-match-preview {
            position: fixed; background: #333; border: 1px solid #555; border-radius: 4px;
            padding: 10px; z-index: 10000; box-shadow: 0 5px 15px rgba(0,0,0,0.5);
            display: flex; gap: 15px;
        }
        .opt-match-col { display: flex; flex-direction: column; align-items: center; gap: 5px; }
        .opt-match-img { border: 2px solid; max-width: 200px; max-height: 200px; image-rendering: pixelated; background: #222; }
        .opt-match-label { font-size: 11px; color: #aaa; }
    `;

    // ==================== 初始化 ====================

    function initPlugin() {
        if (!window.photoShopApp) return false;
        
        const app = window.photoShopApp;
        console.log('图层切割优化插件已加载');

        // 添加样式
        const styleEl = document.createElement('style');
        styleEl.textContent = STYLES;
        document.head.appendChild(styleEl);

        // 添加菜单项
        app.menuManager.addMenuItem('图层', {
            label: '图层切割优化...',
            action: 'layer-cut-optimize',
            handler: () => showMainDialog(app),
            position: 'bottom',
            divider: true
        });

        return true;
    }

    // 轮询初始化
    let attempts = 0;
    const interval = setInterval(() => {
        if (initPlugin() || attempts++ > 10) clearInterval(interval);
    }, 1000);

    // ==================== 主逻辑 ====================

    function showMainDialog(app) {
        // 状态管理
        const state = {
            direction: 'horizontal', // 'horizontal' | 'vertical'
            tolerance: 0,
            zoom: 1,
            showCutEffect: false,
            selectedLayer: null,
            cutPos: 0, // 相对图层bounds的偏移
            analysisResults: [], // { layer, cutPos, matches: { part1: [], part2: [] }, bounds }
            previewScale: 1
        };

        // 创建 DOM
        const overlay = document.createElement('div');
        overlay.className = 'opt-dialog-overlay';
        
        const dialog = document.createElement('div');
        dialog.className = 'opt-dialog';
        
        // --- Header ---
        const header = document.createElement('div');
        header.className = 'opt-header';
        header.innerHTML = `<div class="opt-title">图层切割优化</div>`;
        
        // --- Body ---
        const body = document.createElement('div');
        body.className = 'opt-body';
        
        // --- Sidebar ---
        const sidebar = document.createElement('div');
        sidebar.className = 'opt-sidebar';
        
        // 配置区域
        const configSection = document.createElement('div');
        configSection.innerHTML = `
            <div class="opt-section-title">配置</div>
            <div class="opt-control-group">
                <label class="opt-label">切割方向</label>
                <select class="opt-select" id="opt-dir-select">
                    <option value="horizontal">横向切割 (上下分离)</option>
                    <option value="vertical">纵向切割 (左右分离)</option>
                </select>
            </div>
            <div class="opt-control-group">
                <label class="opt-label">容差: <span id="opt-tol-val">0</span></label>
                <input type="range" class="opt-input" id="opt-tol-range" min="0" max="50" value="0">
            </div>
        `;
        
        // 选中图层列表
        const listSection = document.createElement('div');
        listSection.innerHTML = `<div class="opt-section-title">待分析图层</div>`;
        const layerListEl = document.createElement('div');
        layerListEl.className = 'opt-layer-list';
        listSection.appendChild(layerListEl);
        
        sidebar.appendChild(configSection);
        sidebar.appendChild(listSection);
        
        // --- Main Area ---
        const main = document.createElement('div');
        main.className = 'opt-main';
        
        // 预览区域
        const previewArea = document.createElement('div');
        previewArea.className = 'opt-preview-area';
        
        const toolbar = document.createElement('div');
        toolbar.className = 'opt-preview-toolbar';
        toolbar.innerHTML = `
            <span style="font-size:12px;color:#aaa">缩放:</span>
            <button class="opt-btn-sm active" data-zoom="1">1x</button>
            <button class="opt-btn-sm" data-zoom="2">2x</button>
            <button class="opt-btn-sm" data-zoom="4">4x</button>
            <button class="opt-btn-sm" data-zoom="8">8x</button>
            <div style="width:1px;height:15px;background:#444;margin:0 5px"></div>
            <label style="font-size:12px;display:flex;align-items:center;gap:5px;cursor:pointer">
                <input type="checkbox" id="opt-cut-effect"> 显示切割效果
            </label>
            <div style="flex:1"></div>
            <span id="opt-coord-info" style="font-size:11px;color:#888"></span>
        `;
        
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'opt-canvas-container';
        const previewCanvas = document.createElement('canvas');
        previewCanvas.className = 'opt-preview-canvas';
        canvasContainer.appendChild(previewCanvas);
        
        previewArea.appendChild(toolbar);
        previewArea.appendChild(canvasContainer);
        
        // 分析结果区域
        const resultsArea = document.createElement('div');
        resultsArea.className = 'opt-results-area';
        resultsArea.innerHTML = `<div class="opt-results-header">分析结果</div>`;
        const resultsList = document.createElement('div');
        resultsList.className = 'opt-results-list';
        resultsArea.appendChild(resultsList);
        
        main.appendChild(previewArea);
        main.appendChild(resultsArea);
        
        body.appendChild(sidebar);
        body.appendChild(main);
        
        // --- Footer ---
        const footer = document.createElement('div');
        footer.className = 'opt-footer';
        
        const analyzeBtn = document.createElement('button');
        analyzeBtn.className = 'opt-btn opt-btn-primary';
        analyzeBtn.textContent = '开始分析';
        
        const applyBtn = document.createElement('button');
        applyBtn.className = 'opt-btn opt-btn-primary';
        applyBtn.textContent = '应用切割';
        applyBtn.disabled = true;
        applyBtn.style.opacity = '0.5';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'opt-btn opt-btn-secondary';
        cancelBtn.textContent = '取消';
        
        footer.appendChild(analyzeBtn);
        footer.appendChild(applyBtn);
        footer.appendChild(cancelBtn);
        
        dialog.appendChild(header);
        dialog.appendChild(body);
        dialog.appendChild(footer);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // ==================== 事件绑定与逻辑 ====================

        // 1. 初始化列表
        const selectedItems = getFlatSelectedLayers(app);
        renderLayerList(selectedItems);
        if (selectedItems.length > 0) {
            selectLayer(selectedItems[0]);
        }

        // 2. 配置事件
        const dirSelect = sidebar.querySelector('#opt-dir-select');
        const tolRange = sidebar.querySelector('#opt-tol-range');
        const tolVal = sidebar.querySelector('#opt-tol-val');
        
        dirSelect.onchange = (e) => {
            state.direction = e.target.value;
            updatePreview();
        };
        
        tolRange.oninput = (e) => {
            state.tolerance = parseInt(e.target.value);
            tolVal.textContent = state.tolerance;
        };

        // 3. 预览控制
        toolbar.querySelectorAll('[data-zoom]').forEach(btn => {
            btn.onclick = () => {
                toolbar.querySelectorAll('[data-zoom]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.zoom = parseInt(btn.dataset.zoom);
                updatePreview();
            };
        });
        
        const cutEffectCheck = toolbar.querySelector('#opt-cut-effect');
        cutEffectCheck.onchange = (e) => {
            state.showCutEffect = e.target.checked;
            updatePreview();
        };

        // 4. 画布交互 (拖动切割线)
        let isDragging = false;
        
        previewCanvas.onmousedown = (e) => {
            if (!state.selectedLayer) return;
            const rect = previewCanvas.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left) / state.zoom);
            const y = Math.floor((e.clientY - rect.top) / state.zoom);
            
            // 更新切割位置
            const bounds = state.selectedLayer.bounds;
            if (state.direction === 'horizontal') {
                state.cutPos = Math.max(1, Math.min(bounds.height - 1, y));
            } else {
                state.cutPos = Math.max(1, Math.min(bounds.width - 1, x));
            }
            isDragging = true;
            updatePreview();
        };
        
        window.addEventListener('mousemove', (e) => {
            if (isDragging && state.selectedLayer) {
                const rect = previewCanvas.getBoundingClientRect();
                const x = Math.floor((e.clientX - rect.left) / state.zoom);
                const y = Math.floor((e.clientY - rect.top) / state.zoom);
                const bounds = state.selectedLayer.bounds;
                
                if (state.direction === 'horizontal') {
                    state.cutPos = Math.max(1, Math.min(bounds.height - 1, y));
                } else {
                    state.cutPos = Math.max(1, Math.min(bounds.width - 1, x));
                }
                updatePreview();
            }
        });
        
        window.addEventListener('mouseup', () => {
            isDragging = false;
        });

        previewCanvas.onmousemove = (e) => {
            const rect = previewCanvas.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left) / state.zoom);
            const y = Math.floor((e.clientY - rect.top) / state.zoom);
            document.getElementById('opt-coord-info').textContent = `X: ${x}, Y: ${y}`;
        };

        // 5. 按钮事件
        analyzeBtn.onclick = async () => {
            analyzeBtn.textContent = '分析中...';
            analyzeBtn.disabled = true;
            
            // 延时执行以免阻塞UI渲染
            setTimeout(async () => {
                try {
                    await startAnalysis(app, selectedItems, state);
                    renderResults();
                } catch (e) {
                    console.error(e);
                    alert('分析出错: ' + e.message);
                } finally {
                    analyzeBtn.textContent = '开始分析';
                    analyzeBtn.disabled = false;
                    applyBtn.disabled = false;
                    applyBtn.style.opacity = '1';
                }
            }, 50);
        };
        
        applyBtn.onclick = async () => {
            if (confirm('确定要应用切割优化吗？这将修改图层结构。')) {
                await applyCutting(app, state.analysisResults);
                document.body.removeChild(overlay);
            }
        };
        
        cancelBtn.onclick = () => {
            document.body.removeChild(overlay);
        };

        // ==================== 辅助函数 ====================

        function getFlatSelectedLayers(app) {
            const result = [];
            const queue = [...app.layerManager.selectedItems];
            
            while (queue.length > 0) {
                const item = queue.shift();
                if (item.isGroup) {
                    queue.push(...item.children);
                } else if (item.visible) {
                    result.push(item);
                }
            }
            return result;
        }

        function renderLayerList(items) {
            layerListEl.innerHTML = '';
            items.forEach((item, index) => {
                const div = document.createElement('div');
                div.className = 'opt-layer-item';
                div.textContent = item.name;
                div.onclick = () => selectLayer(item);
                div.dataset.id = index;
                layerListEl.appendChild(div);
            });
        }

        function selectLayer(layer) {
            // 计算边界
            const bounds = getLayerBounds(layer);
            state.selectedLayer = {
                original: layer,
                bounds: bounds,
                // 缓存图像数据用于预览
                canvas: layer.canvas // cropLayer(layer, bounds)
            };
            
            // 设置默认切割位置 (中间)
            state.cutPos = state.direction === 'horizontal' ? 
                Math.floor(bounds.height / 2) : Math.floor(bounds.width / 2);
            
            // 高亮列表
            layerListEl.querySelectorAll('.opt-layer-item').forEach(el => el.classList.remove('selected'));
            const items = Array.from(layerListEl.children);
            const idx = getFlatSelectedLayers(app).indexOf(layer);
            if (items[idx]) items[idx].classList.add('selected');
            
            updatePreview();
        }

        function updatePreview() {
            if (!state.selectedLayer) return;
            
            const { canvas, bounds } = state.selectedLayer;
            const ctx = previewCanvas.getContext('2d');
            const zoom = state.zoom;
            
            // 设置画布尺寸
            let displayW = canvas.width;
            let displayH = canvas.height;
            
            // 如果开启切割效果，增加间距
            const gap = state.showCutEffect ? 10 : 0;
            if (state.direction === 'horizontal') displayH += gap;
            else displayW += gap;
            
            previewCanvas.width = displayW * zoom;
            previewCanvas.height = displayH * zoom;
            previewCanvas.style.width = displayW * zoom + 'px';
            previewCanvas.style.height = displayH * zoom + 'px';
            
            ctx.imageSmoothingEnabled = false;
            ctx.scale(zoom, zoom);
            
            // 绘制
            if (!state.showCutEffect) {
                // 正常模式
                ctx.drawImage(canvas, 0, 0);
                
                // 绘制切割线
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 1 / zoom;
                ctx.beginPath();
                if (state.direction === 'horizontal') {
                    const y = state.cutPos;
                    ctx.moveTo(0, y );
                    ctx.lineTo(canvas.width, y );
                } else {
                    const x = state.cutPos;
                    ctx.moveTo(x , 0);
                    ctx.lineTo(x , canvas.height);
                }
                ctx.stroke();
            } else {
                // 切割模式
                if (state.direction === 'horizontal') {
                    const y = state.cutPos;
                    // 上部分
                    ctx.drawImage(canvas, 0, 0, canvas.width, y, 0, 0, canvas.width, y);
                    // 下部分
                    ctx.drawImage(canvas, 0, y, canvas.width, canvas.height - y, 0, y + gap, canvas.width, canvas.height - y);
                } else {
                    const x = state.cutPos;
                    // 左部分
                    ctx.drawImage(canvas, 0, 0, x, canvas.height, 0, 0, x, canvas.height);
                    // 右部分
                    ctx.drawImage(canvas, x, 0, canvas.width - x, canvas.height, x + gap, 0, canvas.width - x, canvas.height);
                }
            }
        }

        // 获取切割后的两张图片 xldebug
        function getCutCanvases(canvas, cutPos, direction) {
            const width = canvas.width;
            const height = canvas.height;
            const gap = 0; // 切割间隙
            let canvas1, canvas2;
            if (direction === 'horizontal') {
                // 上下切割
                canvas1 = document.createElement('canvas');
                canvas1.width = width;
                canvas1.height = cutPos;
                const ctx1 = canvas1.getContext('2d');
                ctx1.drawImage(canvas, 0, 0, width, cutPos, 0, 0, width, cutPos);
                canvas2 = document.createElement('canvas');
                canvas2.width = width;
                canvas2.height = height - cutPos;
                const ctx2 = canvas2.getContext('2d');
                ctx2.drawImage(canvas, 0, cutPos, width, height - cutPos, 0, 0, width, height - cutPos);
            }
            else {
                // 左右切割
                canvas1 = document.createElement('canvas');
                canvas1.width = cutPos;
                canvas1.height = height;
                const ctx1 = canvas1.getContext('2d');
                ctx1.drawImage(canvas, 0, 0, cutPos, height, 0, 0, cutPos, height);
                canvas2 = document.createElement('canvas');
                canvas2.width = width - cutPos;
                canvas2.height = height;
                const ctx2 = canvas2.getContext('2d');
                ctx2.drawImage(canvas, cutPos, 0, width - cutPos, height, 0, 0, width - cutPos, height);
            }
            return [canvas1, canvas2];
        }

        //
        async function startAnalysis(app, layers, state) {
            state.analysisResults = [];
            
            // 1. 预处理所有图层 (忽略 visible 属性，获取所有图层)
            // 缓存所有图层的裁切后数据，加速匹配
            const allLayers = getAllLayers(app).map(layer => {
                const bounds = getLayerBounds(layer);
                if (bounds.width === 0 || bounds.height === 0) return null;

                return layer;
            }).filter(item => item !== null);

            
            // 2. 分析选中的图层
            for (const layer of layers) {
                // 重新计算边界，确保准确
                const bounds = getLayerBounds(layer);
                if (bounds.width === 0 || bounds.height === 0) continue;
                
                
                const bestCut = analyzeLayer( allLayers, layer, state);
                
                state.analysisResults.push({
                    layer: layer,
                    bounds: bounds,
                    cutPos: bestCut.pos,
                    direction: state.direction,
                    matches: bestCut.matches,
                    canvas: layer.canvas
                });
            }
        }

                // xldebug
        function analyzeLayer( allLayers, selfLayer, state) {
            console.log(`[分析] 开始分析图层: ${selfLayer.name}`);
     
            const isHorz = state.direction === 'horizontal';

            // 创建临时的result对象用于getBoundsPart函数
            const tempResult = {
                direction: state.direction,
                cutPos: state.cutPos,
                bounds: getLayerBounds(selfLayer)
            };

            // 获取切割后的图片
            var selfCanvas = selfLayer.canvas;
            var pars = getCutCanvases(selfCanvas, state.cutPos, state.direction);
            
            const part1 = pars[0]; //canvas
            const part2 = pars[1]; //canvas
            //xldebug
            var bounds1 = getBoundsPart(1, tempResult);
            var bounds2 = getBoundsPart(2, tempResult);
            bounds1 = getRectIntersection(bounds1, getLayerBounds(selfLayer));
            bounds2 = getRectIntersection(bounds2, getLayerBounds(selfLayer));

            const trim1= trimImageData(part1.getContext('2d').getImageData(bounds1.x, bounds1.y, bounds1.width, bounds1.height));
            const trim2= trimImageData(part2.getContext('2d').getImageData(bounds2.x, bounds2.y, bounds2.width, bounds2.height));
            var matches = { part1: [], part2: [] };
            // 4. 与所有图层进行比较
            for (const target of allLayers) {
                if (target.layer === selfLayer) continue;

                // 比较 Part 1: 检查目标图层是否在对应位置包含该部分的像素
                const result1 = findCanvasInCanvas(target.canvas, trim1,  state.tolerance);
                if (result1.found) {
                    matches.part1.push({ layer: target, rect: {x:result1.position.x, y: result1.position.y, width: trim1.width, height: trim1.height} });
                    console.log(`[匹配] Part1 匹配到: ${target.name}`, result1.position);
                }

                // 比较 Part 2: 检查目标图层是否在对应位置包含该部分的像素
                const result2 = findCanvasInCanvas(target.canvas, trim2,  state.tolerance);
                if (result2.found) {
                    matches.part2.push({ layer: target, rect: {x:result2.position.x, y:result2.position.y, width:trim2.width, height: trim2.height} });
                    console.log(`[匹配] Part2 匹配到: ${target.name} `, result2.position);
                }
            }

            const score = matches.part1.length + matches.part2.length;
            
                
                
               
                console.log(`[最佳] 得分${score} (Part1:${matches.part1.length}, Part2:${matches.part2.length})`);
            return { pos: state.cutPos, matches: matches  };
        }


        // 辅助：裁切 ImageData 中的透明边缘，返回裁切后的数据和偏移量
        function trimImageData(sourceData) {
            const w = sourceData.width;
            const h = sourceData.height;
            const d = sourceData.data;

            let minX = w, minY = h, maxX = 0, maxY = 0;
            let found = false;

            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const idx = (y * w + x) * 4;
                    if (d[idx + 3] > 0) {
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                        found = true;
                    }
                }
            }

            if (!found) return null;

            const trimW = maxX - minX + 1;
            const trimH = maxY - minY + 1;

            // 如果不需要裁切，直接返回
            if (trimW === w && trimH === h) {
                return { data: sourceData, width: w, height: h, offsetX: 0, offsetY: 0 };
            }

            // 创建新的 ImageData
            const canvas = document.createElement('canvas');
            canvas.width = trimW;
            canvas.height = trimH;
            const ctx = canvas.getContext('2d');

            // 临时绘制原数据到 canvas 以便裁切
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = w;
            tempCanvas.height = h;
            tempCanvas.getContext('2d').putImageData(sourceData, 0, 0);

            ctx.drawImage(tempCanvas, minX, minY, trimW, trimH, 0, 0, trimW, trimH);

            return {
                data: ctx.getImageData(0, 0, trimW, trimH),
                width: trimW,
                height: trimH,
                offsetX: minX,
                offsetY: minY
            };
        }

        // 辅助：检查目标图层是否在对应位置包含该部分的像素
        function isPartContainedInLayer(trimmedPart, partGlobalRect, targetLayer, tolerance) {
            const targetBounds = targetLayer.bounds;

            // 计算交集区域
            const intersectX = Math.max(partGlobalRect.x, targetBounds.x);
            const intersectY = Math.max(partGlobalRect.y, targetBounds.y);
            const intersectX2 = Math.min(partGlobalRect.x + partGlobalRect.width, targetBounds.x + targetBounds.width);
            const intersectY2 = Math.min(partGlobalRect.y + partGlobalRect.height, targetBounds.y + targetBounds.height);

            // 没有交集
            if (intersectX >= intersectX2 || intersectY >= intersectY2) return false;

            const intersectW = intersectX2 - intersectX;
            const intersectH = intersectY2 - intersectY;

            // 交集必须完全覆盖切割部分
            if (intersectW !== partGlobalRect.width || intersectH !== partGlobalRect.height) return false;

            // 比较像素
            const partData = trimmedPart.data.data;
            const targetData = targetLayer.data.data;

            for (let y = 0; y < intersectH; y++) {
                for (let x = 0; x < intersectW; x++) {
                    const partIdx = (y * partGlobalRect.width + x) * 4;
                    const targetX = intersectX - targetBounds.x + x;
                    const targetY = intersectY - targetBounds.y + y;
                    const targetIdx = (targetY * targetBounds.width + targetX) * 4;

                    const a1 = partData[partIdx + 3];
                    const a2 = targetData[targetIdx + 3];

                    if (Math.abs(a1 - a2) > tolerance) return false;
                    if (a1 === 0 && a2 === 0) continue;

                    if (Math.abs(partData[partIdx] - targetData[targetIdx]) > tolerance ||
                        Math.abs(partData[partIdx + 1] - targetData[targetIdx + 1]) > tolerance ||
                        Math.abs(partData[partIdx + 2] - targetData[targetIdx + 2]) > tolerance) {
                        return false;
                    }
                }
            }
            return true;
        }

/**
 * 检查canvasB是否完全包含在canvasA中（作为子图像）
 * 支持在全图范围内搜索匹配，支持容差
 * @param {HTMLCanvasElement} canvasA - 大Canvas
 * @param {HTMLCanvasElement} canvasB - 小Canvas
 * @param {number} tolerance - 容差值 (0-255)
 * @returns {Object} - 返回结果对象，包含是否匹配和匹配位置
 */
function findCanvasInCanvas(canvasA, canvasB, tolerance = 0) {
    // 参数验证
    if (!(canvasA instanceof HTMLCanvasElement) || !(canvasB instanceof HTMLCanvasElement)) {
        throw new Error('参数必须是HTMLCanvasElement类型');
    }
    
    if (tolerance < 0 || tolerance > 255) {
        throw new Error('容差值必须在0-255之间');
    }
    
    const ctxA = canvasA.getContext('2d');
    const ctxB = canvasB.getContext('2d');
    
    const widthA = canvasA.width;
    const heightA = canvasA.height;
    const widthB = canvasB.width;
    const heightB = canvasB.height;
    
    // 如果B比A大，直接返回false
    if (widthB > widthA || heightB > heightA) {
        console.warn('目标Canvas比源Canvas大，无法匹配');
        return {
            found: false,
            position: null,
            confidence: 0
        };
    }
    
    // 获取像素数据
    const imageDataA = ctxA.getImageData(0, 0, widthA, heightA);
    const imageDataB = ctxB.getImageData(0, 0, widthB, heightB);
    
    const dataA = imageDataA.data;
    const dataB = imageDataB.data;
    
    // 搜索范围
    const searchWidth = widthA - widthB + 1;
    const searchHeight = heightA - heightB + 1;
    
    // 可能的优化：先检查第一行像素，快速排除不匹配的位置
    const firstRowPixelCount = widthB;
    const firstRowIndicesB = new Array(firstRowPixelCount);
    for (let x = 0; x < widthB; x++) {
        firstRowIndicesB[x] = x * 4; // 第一行的像素索引
    }
    
    // 遍历所有可能的位置
    for (let startY = 0; startY < searchHeight; startY++) {
 
        for (let startX = 0; startX < searchWidth; startX++) {
            // 快速检查：先比较第一行
            let firstRowMatches = true;
            for (let x = 0; x < widthB; x++) {
                const indexB = firstRowIndicesB[x];
                const indexA = ((startY) * widthA + (startX + x)) * 4;
                
                // 比较RGBA四个通道
                for (let channel = 0; channel < 4; channel++) {
                    if (Math.abs(dataA[indexA + channel] - dataB[indexB + channel]) > tolerance) {
                        firstRowMatches = false;
                        break;
                    }
                }
                if (!firstRowMatches) break;
            }
            
            // 如果第一行不匹配，跳过当前位置
            if (!firstRowMatches) continue;
            console.log("匹配到第一行");
            // 详细检查整个区域
            let allPixelsMatch = true;
            
            // 检查剩余行
            for (let y = 1; y < heightB && allPixelsMatch; y++) {
                for (let x = 0; x < widthB && allPixelsMatch; x++) {
                    const indexB = (y * widthB + x) * 4;
                    const indexA = ((startY + y) * widthA + (startX + x)) * 4;
                    
                    // 比较RGBA四个通道
                    for (let channel = 0; channel < 4; channel++) {
                        if (Math.abs(dataA[indexA + channel] - dataB[indexB + channel]) > tolerance) {
                            allPixelsMatch = false;
                            break;
                        }
                    }
                }
            }
            
            if (allPixelsMatch) {
                // 计算匹配置信度
                const totalPixels = widthB * heightB;
                let matchingPixels = 0;
                
                // 可选：计算精确的匹配像素数
                for (let y = 0; y < heightB; y++) {
                    for (let x = 0; x < widthB; x++) {
                        const indexB = (y * widthB + x) * 4;
                        const indexA = ((startY + y) * widthA + (startX + x)) * 4;
                        
                        let pixelMatch = true;
                        for (let channel = 0; channel < 4; channel++) {
                            if (Math.abs(dataA[indexA + channel] - dataB[indexB + channel]) > tolerance) {
                                pixelMatch = false;
                                break;
                            }
                        }
                        if (pixelMatch) matchingPixels++;
                    }
                }
                
                const confidence = matchingPixels / totalPixels;
                
                return {
                    found: true,
                    position: { x: startX, y: startY },
                    confidence: confidence
                };
            }
        }
    }
    
    return {
        found: false,
        position: null,
        confidence: 0
    };
}

        function renderResults() {
            resultsList.innerHTML = '';
            
            state.analysisResults.forEach((res, idx) => {
                const div = document.createElement('div');
                div.className = 'opt-result-item';
                
                const matchCount = res.matches.part1.length + res.matches.part2.length;
                const dirText = res.direction === 'horizontal' ? '横向' : '纵向';
                
                div.innerHTML = `
                    <div class="opt-result-summary" onclick="this.nextElementSibling.classList.toggle('expanded')">
                        <span>${res.layer.name}</span>
                        <span style="font-size:11px;color:#aaa">
                            ${dirText} @ ${res.cutPos}px | 匹配: ${matchCount} | 尺寸: ${res.bounds.width}x${res.bounds.height}
                        </span>
                    </div>
                    <div class="opt-result-details">
                        <div class="opt-match-group">
                            <div class="opt-match-title part1">部分 1 (匹配 ${res.matches.part1.length})</div>
                            <div class="opt-match-list-1"></div>
                        </div>
                        <div class="opt-match-group">
                            <div class="opt-match-title part2">部分 2 (匹配 ${res.matches.part2.length})</div>
                            <div class="opt-match-list-2"></div>
                        </div>
                    </div>
                `;
                
                // 填充匹配列表
                const list1 = div.querySelector('.opt-match-list-1');
                res.matches.part1.forEach(m => {
                    const tag = createMatchTag(res, 1, m);
                    list1.appendChild(tag);
                });
                
                const list2 = div.querySelector('.opt-match-list-2');
                res.matches.part2.forEach(m => {
                    const tag = createMatchTag(res, 2, m);
                    list2.appendChild(tag);
                });
                
                resultsList.appendChild(div);
            });
        }

        function createMatchTag(result, partNum, match) {
            const span = document.createElement('span');
            span.className = 'opt-match-tag';
            span.textContent = match.layer.name;
            span.style.color = partNum === 1 ? '#ffb74d' : '#ff8a65';
            span.style.borderColor = partNum === 1 ? '#ff9800' : '#ff5722';
            
            span.onclick = (e) => {
                e.stopPropagation();
                showMatchPreview(result, partNum, match, e.clientX, e.clientY);
            };
            
            return span;
        }


        function showMatchPreview(result, partNum, match, x, y) {
            console.log("showMatchPreview ", result, match, x, y);
            // 移除旧弹窗
            const old = document.querySelector('.opt-match-preview');
            if (old) document.body.removeChild(old);

            const popup = document.createElement('div');
            popup.className = 'opt-match-preview';

            const srcW = match.rect.width;
            const srcH = match.rect.height;
            const zoom = state.zoom;

            // 提取源图层的切割部分
            const isHorz = result.direction === 'horizontal';
            const srcX = isHorz ? 0 : (partNum === 1 ? 0 : result.cutPos);
            const srcY = isHorz ? (partNum === 1 ? 0 : result.cutPos) : 0;
            const srcRawW = isHorz ? result.bounds.width : (partNum === 1 ? result.cutPos : result.bounds.width - result.cutPos);
            const srcRawH = isHorz ? (partNum === 1 ? result.cutPos : result.bounds.height - result.cutPos) : result.bounds.height;
            const clip0 = {x:srcX, y: srcY, width: srcRawW, height: srcRawH};

            debugger;
            
            const color = partNum === 1 ? '#ff9800' : '#ff5722';

            popup.innerHTML = `
                <div class="opt-match-col">
                    <div class="opt-match-label" style="color:${color}">源: ${result.layer.name} (Part ${partNum})</div>
                    <canvas class="opt-match-img" style="border-color:${color}"></canvas>
                    <div class="opt-match-label">${srcRawW} x ${srcRawH}</div>
                </div>
                <div class="opt-match-col">
                    <div class="opt-match-label" style="color:${color}">匹配: ${match.layer.name}</div>
                    <canvas class="opt-match-img" style="border-color:${color}"></canvas>
                    <div class="opt-match-label">${srcW} x ${srcH}</div>
                </div>
            `;

            // 填充 Canvas 并应用缩放
            const canvases = popup.querySelectorAll('canvas');
            canvases[0].width = result.canvas.width * zoom;
            canvases[0].height = result.canvas.height * zoom;
            canvases[0].style.width = result.canvas.width * zoom + 'px';
            canvases[0].style.height = result.canvas.height * zoom + 'px';
            const ctx0 = canvases[0].getContext('2d');
            const bounds0 = getRectIntersection(getLayerBounds(result.layer), clip0);
            
            
            ctx0.imageSmoothingEnabled = false;
            ctx0.scale(zoom, zoom);
            ctx0.drawImage(result.canvas, 0, 0);
            // 绘制红色线框
            ctx0.strokeStyle = '#ff0000';
            ctx0.lineWidth = 1 / zoom;
            ctx0.strokeRect(bounds0.x, bounds0.y, srcRawW, srcRawH);

            canvases[1].width = match.layer.canvas.width * zoom;
            canvases[1].height = match.layer.canvas.height * zoom;
            canvases[1].style.width = match.layer.canvas.width * zoom + 'px';
            canvases[1].style.height = match.layer.canvas.height * zoom + 'px';
            const ctx1 = canvases[1].getContext('2d');
            ctx1.imageSmoothingEnabled = false;
            ctx1.scale(zoom, zoom);
            ctx1.drawImage(match.layer.canvas, 0, 0);
             // 绘制红色线框
            ctx1.strokeStyle = '#ff0000';
            ctx1.lineWidth = 1 / zoom;
            ctx1.strokeRect(match.rect.x, match.rect.y, srcW, srcH);
            
            // 定位
            popup.style.left = Math.min(window.innerWidth - 450, x + 10) + 'px';
            popup.style.top = Math.min(window.innerHeight - 250, y + 10) + 'px';
            
            document.body.appendChild(popup);
            
            // 点击外部关闭
            const closeHandler = (e) => {
                if (!popup.contains(e.target) && e.target !== popup) {
                    document.body.removeChild(popup);
                    window.removeEventListener('mousedown', closeHandler);
                }
            };
            setTimeout(() => window.addEventListener('mousedown', closeHandler), 0);
        }

        async function applyCutting(app, results) {
            for (const res of results) {
                const layer = res.layer;
                const bounds = res.bounds;
                const cutPos = res.cutPos;
                const isHorz = res.direction === 'horizontal';
                
                // 1. 准备两个图块的 Canvas (全尺寸，因为要保留位置)
                const canvas1 = document.createElement('canvas');
                canvas1.width = app.config.width;
                canvas1.height = app.config.height;
                const ctx1 = canvas1.getContext('2d');
                
                const canvas2 = document.createElement('canvas');
                canvas2.width = app.config.width;
                canvas2.height = app.config.height;
                const ctx2 = canvas2.getContext('2d');
                
                // 2. 绘制分割后的图像到对应位置
                // 原图层数据在 res.canvas (已裁切)
                // 绘制位置需要加上 bounds.x, bounds.y
                
                if (isHorz) {
                    // 上部分 -> Tile 1
                    ctx1.drawImage(res.canvas, 
                        0, 0, bounds.width, cutPos, 
                        bounds.x, bounds.y, bounds.width, cutPos
                    );
                    // 下部分 -> Tile 2
                    ctx2.drawImage(res.canvas, 
                        0, cutPos, bounds.width, bounds.height - cutPos, 
                        bounds.x, bounds.y + cutPos, bounds.width, bounds.height - cutPos
                    );
                } else {
                    // 左部分 -> Tile 1
                    ctx1.drawImage(res.canvas, 
                        0, 0, cutPos, bounds.height, 
                        bounds.x, bounds.y, cutPos, bounds.height
                    );
                    // 右部分 -> Tile 2
                    ctx2.drawImage(res.canvas, 
                        cutPos, 0, bounds.width - cutPos, bounds.height, 
                        bounds.x + cutPos, bounds.y, bounds.width - cutPos, bounds.height
                    );
                }
                
                // 3. 创建新结构
                const parent = layer.parent;
                const index = parent ? parent.children.indexOf(layer) : app.layerManager.layers.indexOf(layer);
                
                const frameGroup = {
                    name: layer.name, // 保持原名
                    visible: layer.visible,
                    opacity: layer.opacity,
                    isGroup: true,
                    expanded: true,
                    children: [],
                    parent: parent
                };
                
                const tile1 = {
                    name: 'Tile 1',
                    visible: true,
                    opacity: 1,
                    canvas: canvas1,
                    ctx: ctx1,
                    isGroup: false,
                    parent: frameGroup
                };
                
                const tile2 = {
                    name: 'Tile 2',
                    visible: true,
                    opacity: 1,
                    canvas: canvas2,
                    ctx: ctx2,
                    isGroup: false,
                    parent: frameGroup
                };
                
                frameGroup.children.push(tile1, tile2);
                
                // 4. 替换原图层
                if (parent) {
                    parent.children[index] = frameGroup;
                } else {
                    app.layerManager.layers[index] = frameGroup;
                }
            }
            
            app.renderLayerList();
            app.render();
            app.saveHistory();
        }

        function getAllLayers(app) {
            const result = [];
            function traverse(items) {
                for (const item of items) {
                    if (item.isGroup) {
                        traverse(item.children);
                    } else {
                        result.push(item);
                    }
                }
            }
            traverse(app.layerManager.layers);
            return result;
        }

        function getLayerBounds(layer) {
            const canvas = layer.canvas;
            const w = canvas.width;
            const h = canvas.height;
            const ctx = canvas.getContext('2d');
            const data = ctx.getImageData(0, 0, w, h).data;
            
            let minX = w, minY = h, maxX = 0, maxY = 0;
            let found = false;
            
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const idx = (y * w + x) * 4;
                    if (data[idx + 3] > 0) {
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                        found = true;
                    }
                }
            }
            
            if (!found) return { x: 0, y: 0, width: 0, height: 0 };
            return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
        }

        /**
 * 获取两个矩形的交集
 * @param {Object} rect1 - 矩形1 {x, y, width, height}
 * @param {Object} rect2 - 矩形2 {x, y, width, height}
 * @returns {Object|null} - 交集矩形，如果没有交集返回null
 */
function getRectIntersection(rect1, rect2) {
    // 计算两个矩形在X轴上的交集
    const x1 = Math.max(rect1.x, rect2.x);
    const x2 = Math.min(rect1.x + rect1.width, rect2.x + rect2.width);
    
    // 计算两个矩形在Y轴上的交集
    const y1 = Math.max(rect1.y, rect2.y);
    const y2 = Math.min(rect1.y + rect1.height, rect2.y + rect2.height);
    
    // 检查是否有交集
    if (x2 > x1 && y2 > y1) {
        return {
            x: x1,
            y: y1,
            width: x2 - x1,
            height: y2 - y1
        };
    }
    
    return {x:0, y:0, width:0, height:0}; // 没有交集
}

// 获取区域
        function getBoundsPart(partNum, result) {
            const isHorz = result.direction === 'horizontal';
            const srcX = isHorz ? 0 : (partNum === 1 ? 0 : result.cutPos);
            const srcY = isHorz ? (partNum === 1 ? 0 : result.cutPos) : 0;
            const srcRawW = isHorz ? result.bounds.width : (partNum === 1 ? result.cutPos : result.bounds.width - result.cutPos);
            const srcRawH = isHorz ? (partNum === 1 ? result.cutPos : result.bounds.height - result.cutPos) : result.bounds.height;
            return { x: srcX, y: srcY, width: srcRawW, height: srcRawH };
        }

        // 裁切图层到边界
        function cropLayer(layer, bounds) {
            const canvas = document.createElement('canvas');
            canvas.width = bounds.width;
            canvas.height = bounds.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(layer.canvas, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
            return canvas;
        }
    }
})();