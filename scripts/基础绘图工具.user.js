// ==UserScript==
// @name         基础绘图工具
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  为 XPhotoShop 添加画笔、油漆桶、移动工具
// @author       You
// @match        file://*/PhotoShop/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function init() {
        if (!window.photoShopApp || !window.photoShopApp.registerTool) {
            console.error('photoShopApp not found');
            return;
        }
        registerTools();
    }

    function registerTools() {
        const app = window.photoShopApp;

        // 注册画笔工具
        app.registerTool({
            id: 'brush',
            name: '画笔',
            icon: '🖌️',
            shortcut: 'B',
            cursor: 'none',
            weight: 20,
            optionsHTML: `
                <label>大小：</label>
                <input type="range" id="brushToolSize" min="1" max="50" value="3">
                <span id="brushToolSizeLabel">3</span>
                <span style="margin-left: 5px;">px</span>
            `,
            onOptionsInit: (container, { tools }) => {
                const sizeInput = container.querySelector('#brushToolSize');
                const sizeLabel = container.querySelector('#brushToolSizeLabel');
                sizeInput.addEventListener('input', (e) => {
                    const size = parseInt(e.target.value);
                    tools.setBrushSize(size);
                    sizeLabel.textContent = size;
                });
            },
            onStart: (x, y, { layer, shiftKey, tools }) => {
                if (!layer || !layer.visible) return;
                if (shiftKey && tools.lastDrawnPos) {
                    drawLine(x, y, tools.lastDrawnPos.x, tools.lastDrawnPos.y, layer, tools);
                    tools.lastDrawnPos = { x, y };
                } else {
                    tools.lastPos = { x, y };
                    drawBrush(x, y, layer, tools);
                    tools.lastDrawnPos = { x, y };
                }
            },
            onMove: (x, y, { layer, tools }) => {
                if (!layer || !layer.visible) return;
                if (tools.lastPos) {
                    drawLine(x, y, tools.lastPos.x, tools.lastPos.y, layer, tools);
                } else {
                    drawBrush(x, y, layer, tools);
                }
                tools.lastPos = { x, y };
            },
            onEnd: (x, y, { tools }) => {
                if (tools.lastPos) {
                    tools.lastDrawnPos = { ...tools.lastPos };
                }
                tools.lastPos = null;
            }
        });

        // 注册油漆桶工具
        app.registerTool({
            id: 'bucket',
            name: '油漆桶',
            icon: '🪣',
            shortcut: 'G',
            cursor: 'crosshair',
            weight: 50,
            optionsHTML: `
                <label>
                    <input type="checkbox" id="bucketContiguous" checked>
                    连续
                </label>
            `,
            onOptionsInit: (container, { tools }) => {
                const contiguousCheckbox = container.querySelector('#bucketContiguous');
                tools.bucketContiguous = contiguousCheckbox.checked;
                contiguousCheckbox.addEventListener('change', (e) => {
                    tools.bucketContiguous = e.target.checked;
                });
            },
            onStart: (x, y, { layer, tools, app }) => {
                if (!layer || !layer.visible) return;
                fillBucket(x, y, layer, tools);
                app.renderLayerList();
                app.render();
                app.saveHistory();
            }
        });

        // 注册移动工具
        app.registerTool({
            id: 'move',
            name: '移动工具',
            icon: '✥',
            shortcut: 'V',
            cursor: 'move',
            weight: 8,
            optionsHTML: `
                <label>
                    <input type="checkbox" id="moveAutoSelect">
                    自动选择图层
                </label>
            `,
            onOptionsInit: (container, { tools }) => {
                const autoSelect = container.querySelector('#moveAutoSelect');
                autoSelect.addEventListener('change', (e) => {
                    tools.autoSelect = e.target.checked;
                });
            },
            onStart: (x, y, { layer, tools, app }) => {
                if (!layer) return;

                if (tools.autoSelect) {
                    const clickedLayerIndex = findLayerAtPoint(x, y, app.layerManager);
                    if (clickedLayerIndex !== -1) {
                        app.layerManager.setActiveLayer(clickedLayerIndex);
                    }
                }

                tools.moveStartPos = { x, y };
                tools.moveLayerData = {
                    imageData: layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height),
                    hasSelection: app.selectionManager.hasSelection,
                    selectionBounds: app.selectionManager.getBounds(),
                    // 保存原始选区数据
                    selectionData: app.selectionManager.hasSelection ?
                        app.selectionManager.ctx.getImageData(0, 0, app.selectionManager.width, app.selectionManager.height) : null
                };
            },
            onMove: (x, y, { layer, tools, app }) => {
                if (!tools.moveStartPos || !tools.moveLayerData) return;
                if (!layer) return;

                const dx = x - tools.moveStartPos.x;
                const dy = y - tools.moveStartPos.y;

                layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);

                if (tools.moveLayerData.hasSelection && tools.moveLayerData.selectionBounds && tools.moveLayerData.selectionData) {
                    // 仅移动选中的区域
                    const bounds = tools.moveLayerData.selectionBounds;

                    // 首先，恢复未选中的区域
                    layer.ctx.putImageData(tools.moveLayerData.imageData, 0, 0);

                    // 清除选中的区域（使用原始选区数据）
                    const selData = tools.moveLayerData.selectionData.data;
                    for (let py = 0; py < tools.moveLayerData.selectionData.height; py++) {
                        for (let px = 0; px < tools.moveLayerData.selectionData.width; px++) {
                            const idx = (py * tools.moveLayerData.selectionData.width + px) * 4;
                            if (selData[idx + 3] > 0) { // 如果在原始选区内
                                layer.ctx.clearRect(px, py, 1, 1);
                            }
                        }
                    }

                    // 在新位置绘制选中的像素
                    const selectedData = tools.moveLayerData.imageData;
                    for (let py = 0; py < tools.moveLayerData.selectionData.height; py++) {
                        for (let px = 0; px < tools.moveLayerData.selectionData.width; px++) {
                            const idx = (py * tools.moveLayerData.selectionData.width + px) * 4;
                            if (selData[idx + 3] > 0) { // 如果在原始选区内
                                const i = (py * layer.canvas.width + px) * 4;
                                const newX = px + dx;
                                const newY = py + dy;

                                if (newX >= 0 && newX < layer.canvas.width && newY >= 0 && newY < layer.canvas.height) {
                                    const r = selectedData.data[i];
                                    const g = selectedData.data[i + 1];
                                    const b = selectedData.data[i + 2];
                                    const a = selectedData.data[i + 3];

                                    if (a > 0) {
                                        layer.ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
                                        layer.ctx.fillRect(newX, newY, 1, 1);
                                    }
                                }
                            }
                        }
                    }

                    // 更新选区位置 - 移动整个选区
                    app.selectionManager.clear();
                    const newSelData = app.selectionManager.ctx.createImageData(
                        app.selectionManager.width,
                        app.selectionManager.height
                    );
                    const newData = newSelData.data;

                    // 将原始选区数据移动到新位置
                    for (let py = 0; py < tools.moveLayerData.selectionData.height; py++) {
                        for (let px = 0; px < tools.moveLayerData.selectionData.width; px++) {
                            const oldIdx = (py * tools.moveLayerData.selectionData.width + px) * 4;
                            const newX = px + dx;
                            const newY = py + dy;

                            if (newX >= 0 && newX < app.selectionManager.width &&
                                newY >= 0 && newY < app.selectionManager.height) {
                                const newIdx = (newY * app.selectionManager.width + newX) * 4;
                                newData[newIdx] = selData[oldIdx];
                                newData[newIdx + 1] = selData[oldIdx + 1];
                                newData[newIdx + 2] = selData[oldIdx + 2];
                                newData[newIdx + 3] = selData[oldIdx + 3];
                            }
                        }
                    }

                    app.selectionManager.ctx.putImageData(newSelData, 0, 0);
                    app.selectionManager.hasSelection = true;
                } else {
                    // 移动整个图层
                    layer.ctx.putImageData(tools.moveLayerData.imageData, dx, dy);
                }
            },
            onEnd: (x, y, { layer, tools }) => {
                tools.moveStartPos = null;
                tools.moveLayerData = null;
            }
        });

        console.log('基础绘图工具已加载');
    }

    // 辅助函数：绘制画笔
    function drawBrush(x, y, layer, tools) {
        const ctx = layer.ctx;
        const size = tools.brushSize;
        const radius = Math.floor(size / 2);

        ctx.fillStyle = tools.color;

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= radius) {
                    const px = x + dx;
                    const py = y + dy;
                    if (px >= 0 && px < layer.canvas.width && py >= 0 && py < layer.canvas.height) {
                        if (!tools.selectionManager.hasSelection || tools.selectionManager.isSelected(px, py)) {
                            ctx.fillRect(px, py, 1, 1);
                        }
                    }
                }
            }
        }
    }

    // 辅助函数：绘制直线
    function drawLine(x1, y1, x0, y0, layer, tools) {
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = (x0 < x1) ? 1 : -1;
        const sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        while (true) {
            drawBrush(x0, y0, layer, tools);
            if ((x0 === x1) && (y0 === y1)) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }
    }

    // 辅助函数：油漆桶填充
    function fillBucket(x, y, layer, tools) {
        const ctx = layer.ctx;
        const width = layer.canvas.width;
        const height = layer.canvas.height;

        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        const targetIndex = (y * width + x) * 4;
        const targetR = data[targetIndex];
        const targetG = data[targetIndex + 1];
        const targetB = data[targetIndex + 2];
        const targetA = data[targetIndex + 3];

        const fillColor = hexToRgb(tools.color);
        const fillR = fillColor.r;
        const fillG = fillColor.g;
        const fillB = fillColor.b;
        const fillA = 255;

        if (targetR === fillR && targetG === fillG && targetB === fillB && targetA === fillA) {
            return;
        }

        const contiguous = tools.bucketContiguous !== false; // 默认为true

        if (contiguous) {
            // 连续模式：只填充相连的区域
            const stack = [[x, y]];
            const visited = new Set();

            while (stack.length > 0) {
                const [px, py] = stack.pop();
                const key = `${px},${py}`;

                if (visited.has(key) || px < 0 || px >= width || py < 0 || py >= height) {
                    continue;
                }

                const index = (py * width + px) * 4;
                const r = data[index];
                const g = data[index + 1];
                const b = data[index + 2];
                const a = data[index + 3];

                if (r !== targetR || g !== targetG || b !== targetB || a !== targetA) {
                    continue;
                }

                if (tools.selectionManager.hasSelection && !tools.selectionManager.isSelected(px, py)) {
                    continue;
                }

                visited.add(key);

                data[index] = fillR;
                data[index + 1] = fillG;
                data[index + 2] = fillB;
                data[index + 3] = fillA;

                stack.push([px + 1, py]);
                stack.push([px - 1, py]);
                stack.push([px, py + 1]);
                stack.push([px, py - 1]);
            }
        } else {
            // 非连续模式：填充所有相同颜色的像素
            for (let py = 0; py < height; py++) {
                for (let px = 0; px < width; px++) {
                    const index = (py * width + px) * 4;
                    const r = data[index];
                    const g = data[index + 1];
                    const b = data[index + 2];
                    const a = data[index + 3];

                    if (r === targetR && g === targetG && b === targetB && a === targetA) {
                        if (!tools.selectionManager.hasSelection || tools.selectionManager.isSelected(px, py)) {
                            data[index] = fillR;
                            data[index + 1] = fillG;
                            data[index + 2] = fillB;
                            data[index + 3] = fillA;
                        }
                    }
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }

    // 辅助函数：查找点击位置的图层
    function findLayerAtPoint(x, y, layerManager) {
        for (let i = layerManager.layers.length - 1; i >= 0; i--) {
            const layer = layerManager.layers[i];
            if (!layer.visible) continue;

            const pixel = layer.ctx.getImageData(x, y, 1, 1).data;
            if (pixel[3] > 0) {
                return i;
            }
        }
        return -1;
    }

    // 辅助函数：十六进制转RGB
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
