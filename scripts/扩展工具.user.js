// ==UserScript==
// @name         PhotoShop - 高级工具包 (Blur, Smudge, Wand, Shapes, Crop)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  修复形状工具、裁剪工具、套索预览及涂抹模糊状态问题
// @author       风的影子
// @match        file://*/PhotoShop/index.html
// @match        file://*/PhotoShop/PhotoShop.html
// @match        http://127.0.0.1:5500/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function init() {
        const app = window.photoShopApp;
        if (!app) {
            setTimeout(init, 100);
            return;
        }
        registerAdvancedTools(app);
        console.log('PhotoShop 高级工具包 v1.1 已加载');
    }

    function registerAdvancedTools(app) {

        // ==========================================
        // 1. 模糊工具 (Blur Tool)
        // ==========================================
        app.registerTool({
            id: 'blur',
            name: '模糊工具',
            icon: '💧',
            shortcut: 'R',
            cursor: 'crosshair',
            weight: 35,
            optionsHTML: `
                <label>强度:</label>
                <input type="range" id="blur-strength" min="1" max="10" value="1">
                <span id="blur-strength-val">1</span>
                <label style="margin-left:10px">大小:</label>
                <input type="range" id="blur-size" min="10" max="100" value="30">
                <span id="blur-size-val">30</span>
            `,
            onOptionsInit: (container, { tools }) => {
                const strInput = container.querySelector('#blur-strength');
                const strVal = container.querySelector('#blur-strength-val');
                const sizeInput = container.querySelector('#blur-size');
                const sizeVal = container.querySelector('#blur-size-val');

                tools.blurStrength = 1;
                tools.blurSize = 30;

                strInput.oninput = (e) => { tools.blurStrength = parseInt(e.target.value); strVal.innerText = e.target.value; };
                sizeInput.oninput = (e) => { tools.blurSize = parseInt(e.target.value); sizeVal.innerText = e.target.value; };
            },
            onStart: (x, y, { tools }) => { tools.isBlurring = true; },
            onMove: (x, y, { layer, tools, app }) => {
                if (!tools.isBlurring || !layer) return;

                const size = tools.blurSize;
                const radius = size / 2;
                const r = Math.floor(radius);
                const sx = Math.max(0, x - r);
                const sy = Math.max(0, y - r);
                const sw = Math.min(layer.canvas.width - sx, size);
                const sh = Math.min(layer.canvas.height - sy, size);

                if (sw <= 0 || sh <= 0) return;

                const imgData = layer.ctx.getImageData(sx, sy, sw, sh);
                const blurred = boxBlur(imgData, tools.blurStrength);

                // 应用圆形遮罩和选区遮罩
                const sm = app.selectionManager;
                const data = blurred.data;
                const radiusSq = radius * radius;

                for (let py = 0; py < sh; py++) {
                    for (let px = 0; px < sw; px++) {
                        const worldX = sx + px;
                        const worldY = sy + py;

                        // 计算到圆心的距离
                        const dx = worldX - x;
                        const dy = worldY - y;
                        const distSq = dx * dx + dy * dy;

                        const idx = (py * sw + px) * 4;

                        // 如果在圆形外或选区外，恢复原始像素
                        if (distSq > radiusSq || (sm && sm.hasSelection && !sm.isSelected(worldX, worldY))) {
                            data[idx] = imgData.data[idx];
                            data[idx + 1] = imgData.data[idx + 1];
                            data[idx + 2] = imgData.data[idx + 2];
                            data[idx + 3] = imgData.data[idx + 3];
                        }
                    }
                }

                layer.ctx.putImageData(blurred, sx, sy);

                app.render();
            },
            onEnd: (x, y, { tools, app }) => {
                if (tools.isBlurring) {
                    tools.isBlurring = false;
                    app.render();
                    app.saveHistory();
                }
            }
        });

        // ==========================================
        // 2. 涂抹工具 (Smudge Tool)
        // ==========================================
        app.registerTool({
            id: 'smudge',
            name: '涂抹工具',
            icon: '👆',
            shortcut: 'U',
            cursor: 'pointer',
            weight: 36,
            optionsHTML: `
                <label>强度:</label>
                <input type="range" id="smudge-strength" min="10" max="100" value="30">
                <span id="smudge-val">30%</span>
                <label style="margin-left:10px">大小:</label>
                <input type="range" id="smudge-size" min="10" max="100" value="30">
                <span id="smudge-size-val">30</span>
            `,
            onOptionsInit: (container, { tools }) => {
                tools.smudgeStrength = 0.3;
                tools.smudgeSize = 30;
                container.querySelector('#smudge-strength').oninput = (e) => {
                    tools.smudgeStrength = parseInt(e.target.value) / 100;
                    container.querySelector('#smudge-val').innerText = e.target.value + '%';
                };
                container.querySelector('#smudge-size').oninput = (e) => {
                    tools.smudgeSize = parseInt(e.target.value);
                    container.querySelector('#smudge-size-val').innerText = e.target.value;
                };
            },
            onStart: (x, y, { layer, tools, app }) => {
                if(!layer) return;
                tools.isSmudging = true;
                const s = tools.smudgeSize;
                // 抓取初始样本
                tools.smudgeSample = layer.ctx.getImageData(x - s/2, y - s/2, s, s);
            },
            onMove: (x, y, { layer, tools, app }) => {
                if (!tools.isSmudging || !layer || !tools.smudgeSample) return;

                const s = tools.smudgeSize;
                const radius = s / 2;
                const ctx = layer.ctx;
                const sm = app.selectionManager;

                const tempC = document.createElement('canvas');
                tempC.width = s; tempC.height = s;
                tempC.getContext('2d').putImageData(tools.smudgeSample, 0, 0);

                // 如果有选区或需要圆形遮罩，使用裁剪
                ctx.save();

                // 创建圆形裁剪路径
                ctx.beginPath();
                const radiusSq = radius * radius;
                const r = Math.floor(radius);
                const startX = Math.max(0, Math.floor(x - r));
                const startY = Math.max(0, Math.floor(y - r));
                const endX = Math.min(layer.canvas.width, Math.ceil(x + r));
                const endY = Math.min(layer.canvas.height, Math.ceil(y + r));

                for (let py = startY; py < endY; py++) {
                    for (let px = startX; px < endX; px++) {
                        // 计算到圆心的距离
                        const dx = px - x;
                        const dy = py - y;
                        const distSq = dx * dx + dy * dy;

                        // 在圆形内且（无选区或在选区内）
                        if (distSq <= radiusSq && (!sm || !sm.hasSelection || sm.isSelected(px, py))) {
                            ctx.rect(px, py, 1, 1);
                        }
                    }
                }
                ctx.clip();

                ctx.globalAlpha = tools.smudgeStrength;
                ctx.drawImage(tempC, x - s/2, y - s/2);
                ctx.restore();

                // 更新样本
                tools.smudgeSample = ctx.getImageData(x - s/2, y - s/2, s, s);

                app.render();
            },
            onEnd: (x, y, { tools, app }) => {
                if (tools.isSmudging) {
                    tools.isSmudging = false;
                    tools.smudgeSample = null;
                    app.render();
                    app.saveHistory();
                }
            }
        });

        // ==========================================
        // 3. 魔棒工具 (Magic Wand)
        // ==========================================
        app.registerTool({
            id: 'magicWand',
            name: '魔棒工具',
            icon: '🪄',
            shortcut: 'W',
            cursor: 'crosshair',
            weight: 65,
            optionsHTML: `
                <label>容差:</label>
                <input type="number" id="wand-tolerance" min="0" max="255" value="32" style="width:50px">
                <label style="margin-left:10px"><input type="checkbox" id="wand-contiguous" checked> 连续</label>
                <label style="margin-left:10px">模式:</label>
                <select id="wand-mode">
                    <option value="new">新选区</option>
                    <option value="add">添加</option>
                    <option value="subtract">减去</option>
                </select>
            `,
            onOptionsInit: (container, { tools }) => {
                tools.wandTolerance = 32;
                tools.wandContiguous = true;
                tools.wandMode = 'new';
                container.querySelector('#wand-tolerance').oninput = (e) => tools.wandTolerance = parseInt(e.target.value);
                container.querySelector('#wand-contiguous').onchange = (e) => tools.wandContiguous = e.target.checked;
                container.querySelector('#wand-mode').onchange = (e) => tools.wandMode = e.target.value;
            },
            onStart: (x, y, { layer, app, tools }) => {
                if (!layer) return;
                
                const mask = floodFillSelection(layer, parseInt(x), parseInt(y), tools.wandTolerance, tools.wandContiguous);
                const sm = app.selectionManager;
                
                if (tools.wandMode === 'new') sm.clear();
                
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = sm.width;
                tempCanvas.height = sm.height;
                tempCanvas.getContext('2d').putImageData(mask, 0, 0);
                
                const ctx = sm.ctx;
                ctx.save();
                if (tools.wandMode === 'subtract') {
                    ctx.globalCompositeOperation = 'destination-out';
                } else if (tools.wandMode === 'intersect') {
                    ctx.globalCompositeOperation = 'destination-in';
                } else {
                    ctx.globalCompositeOperation = 'source-over';
                }
                ctx.drawImage(tempCanvas, 0, 0);
                ctx.restore();
                
                sm.hasSelection = true;
                app.render();
            }
        });

        // ==========================================
        // 4. 多边形套索 (Polygon Lasso)
        // ==========================================
        app.registerTool({
            id: 'polyLasso',
            name: '多边形套索',
            icon: '📐',
            shortcut: 'L',
            cursor: 'crosshair',
            weight: 62,
            optionsHTML: `<span style="font-size:12px; color:#aaa">点击添加点，双击闭合</span>`,
            onStart: (x, y, { app, tools }) => {
                if (!tools.polyPoints) tools.polyPoints = [];

                // 双击检测
                if (tools.polyPoints.length > 2) {
                    const last = tools.polyPoints[tools.polyPoints.length - 1];
                    // 如果点击位置非常接近上一个点（双击），则闭合
                    const dist = Math.sqrt((x-last.x)**2 + (y-last.y)**2);
                    if (dist < 5) {
                        closePolygon(app, tools.polyPoints);
                        tools.polyPoints = null;
                        tools.polyLassoPreview = null;
                        return;
                    }
                }

                tools.polyPoints.push({x, y});
                // 更新预览状态
                tools.polyLassoPreview = {
                    points: tools.polyPoints,
                    currentX: x,
                    currentY: y
                };
            },
            onMove: (x, y, { app, tools }) => {
                if (tools.polyPoints && tools.polyPoints.length > 0) {
                    // 更新预览状态
                    tools.polyLassoPreview = {
                        points: tools.polyPoints,
                        currentX: x,
                        currentY: y
                    };
                }
            },
            onEnd: (x, y, { tools }) => {
                // 如果还在绘制多边形，保持 isDrawing 状态以继续接收 onMove 事件
                if (tools.polyPoints && tools.polyPoints.length > 0) {
                    // 使用 setTimeout 确保在 stopDrawing 之后重新设置状态
                    setTimeout(() => {
                        tools.isDrawing = true;
                    }, 0);
                } else {
                    // 清理预览状态
                    tools.polyLassoPreview = null;
                }
            }
        });

        // ==========================================
        // 5. 形状工具集 (矩形/圆角/椭圆)
        // ==========================================
        const shapeOptions = `
            <label>填充:</label><input type="checkbox" id="shape-fill" checked>
            <label>描边:</label><input type="checkbox" id="shape-stroke" checked>
            <label>线宽:</label><input type="number" id="shape-width" value="2" min="1" style="width:40px">
        `;
        
        const initShapeOptions = (container, { tools }) => {
            tools.shapeFill = true;
            tools.shapeStroke = true;
            tools.shapeWidth = 2;
            container.querySelector('#shape-fill').onchange = e => tools.shapeFill = e.target.checked;
            container.querySelector('#shape-stroke').onchange = e => tools.shapeStroke = e.target.checked;
            container.querySelector('#shape-width').oninput = e => tools.shapeWidth = parseInt(e.target.value);
        };

        const commonShapeLogic = (drawFn) => ({
            onStart: (x, y, { layer, tools, shiftKey }) => {
                if (!layer) return;
                tools.shapeStart = {x, y};
                tools.isDrawingShape = true;
                tools.shapeConstrainProportions = shiftKey || false;
                // 保存当前画布状态
                tools.shapeSnapshot = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
            },
            onMove: (x, y, { layer, tools, app }) => {
                if (!tools.isDrawingShape || !tools.shapeStart || !layer) return;

                let w = x - tools.shapeStart.x;
                let h = y - tools.shapeStart.y;

                // 按住 Shift 键时，强制绘制正方形/正圆
                if (tools.shapeConstrainProportions) {
                    const size = Math.max(Math.abs(w), Math.abs(h));
                    w = w >= 0 ? size : -size;
                    h = h >= 0 ? size : -size;
                }

                // 恢复状态
                layer.ctx.putImageData(tools.shapeSnapshot, 0, 0);
                // 绘制预览
                drawFn(layer.ctx, tools.shapeStart.x, tools.shapeStart.y, w, h, tools, app);
                app.render();
            },
            onEnd: (x, y, { tools, app }) => {
                if (tools.isDrawingShape) {
                    tools.isDrawingShape = false;
                    tools.shapeStart = null;
                    tools.shapeSnapshot = null;
                    tools.shapeConstrainProportions = false;
                    app.render();
                    app.saveHistory();
                }
            }
        });

        // 矩形
        app.registerTool({
            id: 'rectShape', name: '矩形工具', icon: '⬜', weight: 55,
            optionsHTML: shapeOptions, onOptionsInit: initShapeOptions,
            ...commonShapeLogic((ctx, x, y, w, h, tools, app) => {
                ctx.fillStyle = app.tools.color;
                ctx.strokeStyle = app.tools.color;
                ctx.lineWidth = tools.shapeWidth;
                if(tools.shapeFill) ctx.fillRect(x, y, w, h);
                if(tools.shapeStroke) ctx.strokeRect(x, y, w, h);
            })
        });

        // 圆角矩形
        app.registerTool({
            id: 'roundRectShape', name: '圆角矩形', icon: '▢', weight: 56,
            optionsHTML: shapeOptions + `<label>圆角:</label><input type="number" id="shape-radius" value="10" style="width:40px">`,
            onOptionsInit: (c, ctx) => { initShapeOptions(c, ctx); ctx.tools.shapeRadius = 10; c.querySelector('#shape-radius').oninput = e => ctx.tools.shapeRadius = parseInt(e.target.value); },
            ...commonShapeLogic((ctx, x, y, w, h, tools, app) => {
                ctx.fillStyle = app.tools.color;
                ctx.strokeStyle = app.tools.color;
                ctx.lineWidth = tools.shapeWidth;
                ctx.beginPath();
                ctx.roundRect(x, y, w, h, tools.shapeRadius);
                if(tools.shapeFill) ctx.fill();
                if(tools.shapeStroke) ctx.stroke();
            })
        });

        // 椭圆
        app.registerTool({
            id: 'ellipseShape', name: '椭圆工具', icon: '⚪', weight: 57,
            optionsHTML: shapeOptions, onOptionsInit: initShapeOptions,
            ...commonShapeLogic((ctx, x, y, w, h, tools, app) => {
                ctx.fillStyle = app.tools.color;
                ctx.strokeStyle = app.tools.color;
                ctx.lineWidth = tools.shapeWidth;
                ctx.beginPath();
                ctx.ellipse(x + w/2, y + h/2, Math.abs(w/2), Math.abs(h/2), 0, 0, 2 * Math.PI);
                if(tools.shapeFill) ctx.fill();
                if(tools.shapeStroke) ctx.stroke();
            })
        });

        // ==========================================
        // 6. 裁剪工具 (Crop Tool) - 修复版
        // ==========================================
        app.registerTool({
            id: 'crop',
            name: '裁剪工具',
            icon: '✂️',
            shortcut: 'C',
            cursor: 'crosshair',
            weight: 90,
            optionsHTML: `<button id="crop-confirm">确认裁剪</button>`,
            onOptionsInit: (container, { tools, app }) => {
                container.querySelector('#crop-confirm').onclick = () => {
                    if (tools.cropRect && tools.cropRect.w > 0 && tools.cropRect.h > 0) {
                        executeCrop(app, tools.cropRect);
                        tools.cropRect = null;
                        tools.cropStart = null;
                        tools.cropPreview = null;
                        // 强制重绘以清除遮罩
                        app.render();
                    } else {
                        Toast.show('请先拖拽选择裁剪区域', 'warning');
                    }
                };
            },
            onStart: (x, y, { tools }) => {
                tools.cropStart = {x, y};
                tools.cropRect = {x, y, w:0, h:0};
                tools.cropPreview = {x, y, w:0, h:0};
            },
            onMove: (x, y, { tools, app }) => {
                if (!tools.cropStart) return;
                const w = x - tools.cropStart.x;
                const h = y - tools.cropStart.y;
                tools.cropRect = {
                    x: w > 0 ? tools.cropStart.x : x,
                    y: h > 0 ? tools.cropStart.y : y,
                    w: Math.abs(w),
                    h: Math.abs(h)
                };

                // 更新预览状态
                tools.cropPreview = tools.cropRect;
            },
            onEnd: (x, y, { tools }) => {
                // 裁剪工具不自动结束，等待点击确认按钮
                // 但需要重置拖拽状态
                tools.cropStart = null;
            }
        });
    }

    // ==========================================
    // 辅助函数
    // ==========================================

    function boxBlur(imageData, radius) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const output = new Uint8ClampedArray(data.length);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r=0, g=0, b=0, a=0, count=0;
                for (let ky = -radius; ky <= radius; ky++) {
                    for (let kx = -radius; kx <= radius; kx++) {
                        const nx = x + kx;
                        const ny = y + ky;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const i = (ny * width + nx) * 4;
                            r += data[i]; g += data[i+1]; b += data[i+2]; a += data[i+3];
                            count++;
                        }
                    }
                }
                const i = (y * width + x) * 4;
                output[i] = r/count; output[i+1] = g/count; output[i+2] = b/count; output[i+3] = a/count;
            }
        }
        return new ImageData(output, width, height);
    }

    function floodFillSelection(layer, startX, startY, tolerance, contiguous) {
        const w = layer.canvas.width;
        const h = layer.canvas.height;
        const srcData = layer.ctx.getImageData(0, 0, w, h).data;
        const maskData = new Uint8ClampedArray(w * h * 4);
        
        const startIdx = (startY * w + startX) * 4;
        const sr = srcData[startIdx], sg = srcData[startIdx+1], sb = srcData[startIdx+2], sa = srcData[startIdx+3];
        
        const match = (idx) => {
            const r = srcData[idx], g = srcData[idx+1], b = srcData[idx+2], a = srcData[idx+3];
            const dist = Math.abs(r-sr) + Math.abs(g-sg) + Math.abs(b-sb) + Math.abs(a-sa);
            return dist <= tolerance * 4;
        };

        if (contiguous) {
            const stack = [[startX, startY]];
            const visited = new Uint8Array(w * h);
            
            while(stack.length) {
                const [x, y] = stack.pop();
                const idx = y * w + x;
                if (visited[idx]) continue;
                
                const pixelIdx = idx * 4;
                if (match(pixelIdx)) {
                    visited[idx] = 1;
                    maskData[pixelIdx] = 255; 
                    maskData[pixelIdx+1] = 255; 
                    maskData[pixelIdx+2] = 255; 
                    maskData[pixelIdx+3] = 255;

                    if (x > 0) stack.push([x-1, y]);
                    if (x < w-1) stack.push([x+1, y]);
                    if (y > 0) stack.push([x, y-1]);
                    if (y < h-1) stack.push([x, y+1]);
                }
            }
        } else {
            for (let i = 0; i < srcData.length; i+=4) {
                if (match(i)) {
                    maskData[i] = 255; maskData[i+1] = 255; maskData[i+2] = 255; maskData[i+3] = 255;
                }
            }
        }
        
        return new ImageData(maskData, w, h);
    }

    function closePolygon(app, points) {
        const sm = app.selectionManager;
        sm.clear();
        
        const ctx = sm.ctx;
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();
        ctx.fill();
        
        sm.hasSelection = true;
        app.render();
    }

    function executeCrop(app, rect) {
        // 确保坐标为整数
        const rx = Math.floor(rect.x);
        const ry = Math.floor(rect.y);
        const rw = Math.floor(rect.w);
        const rh = Math.floor(rect.h);

        if (rw <= 0 || rh <= 0) return;
        
        // 1. 调整所有图层
        app.layerManager.layers.forEach(item => {
            cropItemRecursively(item, rx, ry, rw, rh);
        });
        
        // 2. 调整选区
        const sm = app.selectionManager;
        const selData = sm.ctx.getImageData(rx, ry, rw, rh);
        sm.resize(rw, rh);
        sm.ctx.putImageData(selData, 0, 0);
        
        // 3. 调整画布配置
        app.config.width = rw;
        app.config.height = rh;
        app.canvasManager.resize(rw, rh);
        
        app.render();
        app.saveHistory();
        Toast.show('裁剪完成', 'success');
    }

    function cropItemRecursively(item, x, y, w, h) {
        if (item.isGroup) {
            item.children.forEach(child => cropItemRecursively(child, x, y, w, h));
        } else {
            // 获取裁剪区域的数据
            // 注意：如果裁剪区域超出原图层范围，getImageData 会自动填充透明像素，这正是我们需要的
            const data = item.ctx.getImageData(x, y, w, h);
            
            // 调整图层画布大小
            item.canvas.width = w;
            item.canvas.height = h;
            
            // 放回数据
            item.ctx.putImageData(data, 0, 0);
        }
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();