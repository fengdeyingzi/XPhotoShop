// ==UserScript==
// @name         PhotoShop - 索引色调色板 (Indexed Palette)
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @description  分析图层颜色生成索引色板，支持色彩量化（减色）功能，修复主程序颜色未刷新问题
// @author       风的影子
// @match        file://*/PhotoShop/index.html
// @match        file://*/PhotoShop/PhotoShop.html
// @match        http://127.0.0.1:5500/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 独立的存储Key，避免冲突
    const STORAGE_KEY = 'photoshop-indexed-palette-colors';
    
    let panel = null;
    let colors = []; // 存储格式: ['#RRGGBB', ...]
    let content = null;
    let gridContainer = null;

    // === 核心逻辑 ===

    // 加载颜色
    function loadColors() {
        const saved = localStorage.getItem(STORAGE_KEY);
        colors = saved ? JSON.parse(saved) : [];
    }

    // 保存颜色
    function saveColors() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
    }

    // 解析当前图层颜色
    function parseLayerColors(app) {
        const layer = app.layerManager.getActiveLayer();
        if (!layer) {
            Toast.show('请先选择一个图层', 'warning');
            return;
        }

        Toast.show('正在分析颜色...', 'info');

        setTimeout(() => {
            const width = layer.canvas.width;
            const height = layer.canvas.height;
            const ctx = layer.ctx;
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            const colorMap = new Map();

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const a = data[i + 3];

                if (a === 0) continue;

                const hex = rgbToHex(r, g, b);
                colorMap.set(hex, (colorMap.get(hex) || 0) + 1);
            }

            if (colorMap.size === 0) {
                Toast.show('图层为空或全透明', 'warning');
                return;
            }

            const sortedColors = [...colorMap.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 256)
                .map(entry => entry[0]);

            colors = sortedColors;
            saveColors();
            renderGrid(app);
            Toast.show(`解析完成，生成 ${colors.length} 个索引色`, 'success');
        }, 50);
    }

    // 减色处理
    function reduceColors(app, count) {
        const layer = app.layerManager.getActiveLayer();
        if (!layer || colors.length === 0) return;

        const palette = colors.slice(0, count).map(hex => hexToRgb(hex));
        const width = layer.canvas.width;
        const height = layer.canvas.height;
        const ctx = layer.ctx;
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        const colorCache = {}; 

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a === 0) continue;

            const key = `${r},${g},${b}`;
            
            let nearest;
            if (colorCache[key]) {
                nearest = colorCache[key];
            } else {
                nearest = findNearestColor(r, g, b, palette);
                colorCache[key] = nearest;
            }

            data[i] = nearest.r;
            data[i + 1] = nearest.g;
            data[i + 2] = nearest.b;
        }

        ctx.putImageData(imageData, 0, 0);
        app.render();
        app.saveHistory();
        Toast.show(`已将颜色减少至 ${count} 色`, 'success');
    }

    function findNearestColor(r, g, b, palette) {
        let minDist = Infinity;
        let nearest = palette[0];

        for (let i = 0; i < palette.length; i++) {
            const p = palette[i];
            const dist = (r - p.r) ** 2 + (g - p.g) ** 2 + (b - p.b) ** 2;
            
            if (dist < minDist) {
                minDist = dist;
                nearest = p;
                if (dist === 0) break;
            }
        }
        return nearest;
    }

    // === UI 组件 ===

    function showReduceDialog(app) {
        if (colors.length === 0) {
            Toast.show('请先解析图层颜色', 'warning');
            return;
        }

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 10000;
            display: flex; justify-content: center; align-items: center;
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: #3c3f41; border: 1px solid #111; border-radius: 6px;
            padding: 20px; width: 300px; box-shadow: 0 4px 16px rgba(0,0,0,0.5);
            color: #dcdcdc; font-family: sans-serif;
        `;

        const maxColors = colors.length;
        
        dialog.innerHTML = `
            <h3 style="margin: 0 0 15px 0; font-size: 16px;">图层减色 (Quantization)</h3>
            <div style="margin-bottom: 20px;">
                <label style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <span>颜色数量:</span>
                    <span id="colorCountVal">${maxColors}</span>
                </label>
                <input type="range" id="colorCountRange" min="2" max="${maxColors}" value="${maxColors}" style="width: 100%;">
            </div>
            <div style="display: flex; gap: 10px;">
                <button id="btnCancel" style="flex: 1; padding: 8px; background: #555; color: #fff; border: none; border-radius: 4px; cursor: pointer;">取消</button>
                <button id="btnConfirm" style="flex: 1; padding: 8px; background: #4a90e2; color: white; border: none; border-radius: 4px; cursor: pointer;">确定</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const range = dialog.querySelector('#colorCountRange');
        const valDisplay = dialog.querySelector('#colorCountVal');
        const btnCancel = dialog.querySelector('#btnCancel');
        const btnConfirm = dialog.querySelector('#btnConfirm');

        range.addEventListener('input', (e) => {
            valDisplay.textContent = e.target.value;
        });

        btnCancel.addEventListener('click', () => overlay.remove());

        btnConfirm.addEventListener('click', () => {
            const count = parseInt(range.value);
            overlay.remove();
            setTimeout(() => reduceColors(app, count), 50);
        });
    }

    // 创建色块 (修复了颜色同步问题)
    function createColorBlock(color, index, app) {
        const block = document.createElement('div');
        block.style.cssText = `
            width: 100%; padding-bottom: 100%; /* 正方形 */
            background-color: ${color};
            border: 1px solid #222;
            cursor: pointer;
            border-radius: 2px;
            position: relative;
        `;
        block.title = `${color} (Index: ${index})`;
        
        block.addEventListener('click', () => {
            // 1. 更新工具逻辑颜色
            app.tools.setColor(color);
            
            // 2. 更新主程序 UI 上的颜色选择器显示 (修复点)
            if (app.colorPicker) {
                app.colorPicker.value = color;
                // 触发事件以防有其他监听器
                app.colorPicker.dispatchEvent(new Event('input'));
                app.colorPicker.dispatchEvent(new Event('change'));
            }

            // 3. 视觉反馈
            block.style.borderColor = '#fff';
            setTimeout(() => block.style.borderColor = '#222', 200);
            Toast.show(`已选择索引色 ${index}: ${color}`, 'info', 1000);
        });

        return block;
    }

    // 渲染网格
    function renderGrid(app) {
        gridContainer.innerHTML = '';
        if (colors.length === 0) {
            gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #777; padding: 20px; font-size: 12px;">暂无颜色<br>请点击"解析图层"</div>`;
            return;
        }

        colors.forEach((color, index) => {
            const block = createColorBlock(color, index, app);
            gridContainer.appendChild(block);
        });
    }

    // 创建面板内容
    function createPanelContent(app) {
        const container = document.createElement('div');
        container.style.cssText = 'display: flex; flex-direction: column; height: 100%;';

        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'padding: 8px; border-bottom: 1px solid #444; display: flex; gap: 8px;';

        const btnParse = document.createElement('button');
        btnParse.textContent = '解析图层';
        btnParse.style.cssText = 'flex: 1; padding: 6px; background: #4a4d4f; color: #eee; border: 1px solid #222; border-radius: 3px; cursor: pointer; font-size: 12px;';
        btnParse.onclick = () => parseLayerColors(app);

        const btnReduce = document.createElement('button');
        btnReduce.textContent = '图层减色';
        btnReduce.style.cssText = 'flex: 1; padding: 6px; background: #4a4d4f; color: #eee; border: 1px solid #222; border-radius: 3px; cursor: pointer; font-size: 12px;';
        btnReduce.onclick = () => showReduceDialog(app);

        toolbar.appendChild(btnParse);
        toolbar.appendChild(btnReduce);
        container.appendChild(toolbar);

        gridContainer = document.createElement('div');
        gridContainer.style.cssText = `
            flex: 1; 
            overflow-y: auto; 
            padding: 8px; 
            display: grid; 
            grid-template-columns: repeat(8, 1fr); 
            gap: 2px; 
            align-content: start;
        `;
        
        container.appendChild(gridContainer);
        
        loadColors();
        renderGrid(app);

        return container;
    }

    // 面板管理
    function togglePanel(app) {
        if (panel) {
            app.panelManager.removePanel('indexed-palette');
            panel = null;
        } else {
            content = createPanelContent(app);
            panel = app.panelManager.addPanel({
                id: 'indexed-palette',
                title: '索引调色板',
                content: content,
                width: 260,
                height: 300,
                onClose: () => {
                    panel = null;
                    content = null;
                    gridContainer = null;
                }
            });
        }
    }

    // 辅助函数
    function rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    }

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    // 初始化
    function init() {
        const waitForApp = setInterval(() => {
            if (window.photoShopApp) {
                clearInterval(waitForApp);
                const app = window.photoShopApp;

                app.menuManager.addMenuItem('视图', {
                    label: '索引调色板 (Indexed)',
                    action: 'toggle-indexed-palette',
                    handler: (app) => togglePanel(app)
                });
            }
        }, 100);
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();