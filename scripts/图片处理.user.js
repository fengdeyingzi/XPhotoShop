// ==UserScript==
// @name         PhotoShop - QQ截图效果 (UI美化版)
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  保留核心逻辑，仅美化UI为仿QQ截图风格
// @author       风的影子
// @match        file://*/PhotoShop/index.html
// @match        file://*/PhotoShop/PhotoShop.html
// @match        http://127.0.0.1:5500/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    console.log("QQ截图效果插件开始加载...");

    // SVG 图标常量
    const ICONS = {
        select: '<svg viewBox="0 0 1024 1024" width="20" height="20" fill="currentColor"><path d="M1016.32 494.08l-143.872-143.36c-9.728-9.728-26.112-9.728-35.84 0-9.728 9.728-9.728 26.112 0 35.84L936.96 486.4h-399.36V87.04l99.84 100.352c9.728 9.728 26.112 9.728 35.84 0 9.728-9.728 9.728-26.112 0-35.84l-143.36-143.872c-9.728-9.728-26.112-9.728-35.84 0l-143.36 143.872c-9.728 9.728-9.728 26.112 0 35.84 9.728 9.728 26.112 9.728 35.84 0L486.4 87.04v399.36H87.04l100.352-99.84c9.728-9.728 9.728-26.112 0-35.84-9.728-9.728-26.112-9.728-35.84 0l-143.872 143.36c-9.728 9.728-9.728 26.112 0 35.84l143.872 143.36c9.728 9.728 26.112 9.728 35.84 0 9.728-9.728 9.728-26.112 0-35.84L87.04 537.6h399.36v399.36l-99.84-100.352c-9.728-9.728-26.112-9.728-35.84 0-9.728 9.728-9.728 26.112 0 35.84l143.36 143.872c9.728 9.728 26.112 9.728 35.84 0l143.36-143.872c9.728-9.728 9.728-26.112 0-35.84-9.728-9.728-26.112-9.728-35.84 0L537.6 936.96v-399.36h399.36l-100.352 99.84c-9.728 9.728-9.728 26.112 0 35.84 9.728 9.728 26.112 9.728 35.84 0l143.872-143.36c10.24-9.728 10.24-26.112 0-35.84z"/></svg>',
        rect: '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.5" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>',
        ellipse: '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.5" fill="none"><circle cx="12" cy="12" r="9" /></svg>',
        arrow: '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.5" fill="none"><line x1="5" y1="19" x2="19" y2="5" /><path d="M5 5h14v14" /></svg>',
        text: '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.5" fill="none"><path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" /></svg>',
        mosaic: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="3" y="3" width="6" height="6"/><rect x="10" y="3" width="6" height="6"/><rect x="17" y="3" width="4" height="6"/><rect x="3" y="10" width="6" height="6"/><rect x="10" y="10" width="6" height="6"/><rect x="17" y="10" width="4" height="6"/><rect x="3" y="17" width="6" height="4"/><rect x="10" y="17" width="6" height="4"/><rect x="17" y="17" width="4" height="4"/></svg>',
        undo: '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.5" fill="none"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" /></svg>',
        download: '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.5" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>',
        close: '<svg viewBox="0 0 24 24" width="20" height="20" stroke="#ff4d4f" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>',
        ok: '<svg viewBox="0 0 24 24" width="20" height="20" stroke="#52c41a" stroke-width="2" fill="none"><polyline points="20 6 9 17 4 12" /></svg>'
    };

    // 截图工具状态管理 (保持原逻辑不变)
    const ScreenshotTool = {
        tools: {
            RECTANGLE: 'rectangle',
            ELLIPSE: 'ellipse',
            TEXT: 'text',
            ARROW: 'arrow',
            MOSAIC: 'mosaic',
            SELECT: 'select'
        },
        
        currentTool: 'rectangle',
        isDrawing: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        
        elements: [],
        selectedElementIndex: -1,
        
        strokeColor: '#ff0000',
        fillColor: 'rgba(255, 0, 0, 0)', // 默认改为透明，避免遮挡
        lineWidth: 2,
        fontSize: 16,
        fontFamily: 'Arial, sans-serif',
        mosaicSize: 10,
        
        tempCanvas: null,
        tempCtx: null,
        
        init: function(app) {
            this.app = app;
        },
        
        setTool: function(tool) {
            this.currentTool = tool;
        },
        
        startDraw: function(x, y) {
            this.isDrawing = true;
            this.startX = x;
            this.startY = y;
            this.currentX = x;
            this.currentY = y;
            
            if (this.currentTool === this.tools.SELECT) {
                this.selectedElementIndex = this.getElementAtPoint(x, y);
                if (this.selectedElementIndex !== -1) {
                    return true;
                }
            }
            return false;
        },
        
        continueDraw: function(x, y) {
            if (!this.isDrawing) return;
            this.currentX = x;
            this.currentY = y;
            
            if (this.currentTool === this.tools.SELECT && this.selectedElementIndex !== -1) {
                const element = this.elements[this.selectedElementIndex];
                const dx = x - this.startX;
                const dy = y - this.startY;
                element.x += dx;
                element.y += dy;
                if (element.x2) element.x2 += dx;
                if (element.y2) element.y2 += dy;
                this.startX = x;
                this.startY = y;
                this.renderTempCanvas();
                return;
            }
            this.renderTempCanvas();
        },
        
        endDraw: function() {
            if (!this.isDrawing) return;
            this.isDrawing = false;
            
            if (this.currentTool !== this.tools.SELECT || this.selectedElementIndex === -1) {
                this.createElement();
            }
            this.selectedElementIndex = -1;
            this.renderTempCanvas();
        },
        
        createElement: function() {
            let x1, y1, x2, y2;
            if (this.currentTool === this.tools.ARROW) {
                x1 = this.startX; y1 = this.startY;
                x2 = this.currentX; y2 = this.currentY;
            } else {
                x1 = Math.min(this.startX, this.currentX);
                y1 = Math.min(this.startY, this.currentY);
                x2 = Math.max(this.startX, this.currentX);
                y2 = Math.max(this.startY, this.currentY);
            }

            const width = Math.abs(x2 - x1);
            const height = Math.abs(y2 - y1);

            if (width < 3 && height < 3 && this.currentTool !== this.tools.TEXT) return;

            const element = {
                type: this.currentTool,
                x: x1, y: y1, x2: x2, y2: y2,
                width: width, height: height,
                strokeColor: this.strokeColor,
                fillColor: this.fillColor,
                lineWidth: this.lineWidth,
                fontSize: this.fontSize,
                mosaicSize: this.mosaicSize,
                text: '',
                id: Date.now() + Math.random()
            };

            if (this.currentTool === this.tools.TEXT) {
                // 为了不破坏原逻辑，这里还是弹窗，虽然有点丑但最稳
                setTimeout(() => {
                    element.text = prompt('请输入文本:', '文本');
                    if (element.text === null) {
                        this.elements.pop(); // 移除刚才添加的空占位
                        this.renderTempCanvas();
                    } else {
                        // 文本位置修正
                        element.x = this.startX;
                        element.y = this.startY;
                        this.renderTempCanvas();
                    }
                }, 10);
            }

            this.elements.push(element);
            this.renderTempCanvas();
        },
        
        getElementAtPoint: function(x, y) {
            for (let i = this.elements.length - 1; i >= 0; i--) {
                const element = this.elements[i];
                if (this.isPointInElement(x, y, element)) return i;
            }
            return -1;
        },
        
        isPointInElement: function(x, y, element) {
            switch (element.type) {
                case this.tools.RECTANGLE:
                    return x >= element.x - 5 && x <= element.x + element.width + 5 &&
                           y >= element.y - 5 && y <= element.y + element.height + 5;
                case this.tools.ELLIPSE:
                    const centerX = element.x + element.width / 2;
                    const centerY = element.y + element.height / 2;
                    const radiusX = element.width / 2 + 5;
                    const radiusY = element.height / 2 + 5;
                    const dx = x - centerX;
                    const dy = y - centerY;
                    return (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY) <= 1;
                case this.tools.TEXT:
                    return x >= element.x - 5 && x <= element.x + element.text.length * element.fontSize * 0.6 &&
                           y >= element.y - element.fontSize && y <= element.y + 5;
                case this.tools.ARROW:
                    return this.isPointNearLine(x, y, element.x, element.y, element.x2, element.y2, 10);
                default:
                    return false;
            }
        },
        
        isPointNearLine: function(px, py, x1, y1, x2, y2, tolerance) {
            const A = px - x1; const B = py - y1;
            const C = x2 - x1; const D = y2 - y1;
            const dot = A * C + B * D;
            const lenSq = C * C + D * D;
            let param = -1;
            if (lenSq !== 0) param = dot / lenSq;
            let xx, yy;
            if (param < 0) { xx = x1; yy = y1; }
            else if (param > 1) { xx = x2; yy = y2; }
            else { xx = x1 + param * C; yy = y1 + param * D; }
            const dx = px - xx; const dy = py - yy;
            return Math.sqrt(dx * dx + dy * dy) <= tolerance;
        },
        
        renderTempCanvas: function() {
            if (!this.tempCtx) return;
            this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
            this.elements.forEach((element, index) => {
                this.drawElement(this.tempCtx, element, index === this.selectedElementIndex);
            });
            if (this.isDrawing && this.currentTool !== this.tools.SELECT) {
                this.drawPreview(this.tempCtx);
            }
        },
        
        drawElement: function(ctx, element, isSelected = false) {
            ctx.save();
            ctx.strokeStyle = element.strokeColor;
            ctx.fillStyle = element.fillColor;
            ctx.lineWidth = element.lineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            if (isSelected) {
                ctx.strokeStyle = '#00ff00';
                ctx.setLineDash([5, 5]);
            }
            
            switch (element.type) {
                case this.tools.RECTANGLE:
                    ctx.beginPath();
                    ctx.rect(element.x, element.y, element.width, element.height);
                    ctx.stroke();
                    // ctx.fill(); // 默认取消填充，只描边，更符合截图习惯
                    break;
                case this.tools.ELLIPSE:
                    ctx.beginPath();
                    ctx.ellipse(element.x + element.width / 2, element.y + element.height / 2, element.width / 2, element.height / 2, 0, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                case this.tools.TEXT:
                    ctx.fillStyle = element.strokeColor;
                    ctx.font = `${element.fontSize}px ${this.fontFamily}`;
                    ctx.textBaseline = 'top';
                    ctx.fillText(element.text, element.x, element.y);
                    break;
                case this.tools.ARROW:
                    this.drawArrow(ctx, element.x, element.y, element.x2, element.y2);
                    break;
                case this.tools.MOSAIC:
                    this.drawMosaic(ctx, element);
                    break;
            }
            ctx.restore();
        },
        
        drawArrow: function(ctx, fromX, fromY, toX, toY) {
            const headLength = 15;
            const angle = Math.atan2(toY - fromY, toX - fromX);
            const arrowBaseX = toX - headLength * Math.cos(angle) * 0.7;
            const arrowBaseY = toY - headLength * Math.sin(angle) * 0.7;
            ctx.beginPath();
            ctx.moveTo(fromX, fromY);
            ctx.lineTo(arrowBaseX, arrowBaseY);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(toX, toY);
            ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fillStyle = ctx.strokeStyle;
            ctx.fill();
        },
        
        drawMosaic: function(ctx, element) {
            const app = this.app;
            const layer = app.layerManager.getActiveLayer();
            if (!layer) return;
            const x = Math.max(0, Math.floor(element.x));
            const y = Math.max(0, Math.floor(element.y));
            const w = Math.min(element.width, layer.canvas.width - x);
            const h = Math.min(element.height, layer.canvas.height - y);
            if (w <= 0 || h <= 0) return;
            const imageData = layer.ctx.getImageData(x, y, w, h);
            const data = imageData.data;
            const blockSize = element.mosaicSize;
            for (let by = 0; by < h; by += blockSize) {
                for (let bx = 0; bx < w; bx += blockSize) {
                    const centerX = Math.min(bx + (blockSize >> 1), w - 1);
                    const centerY = Math.min(by + (blockSize >> 1), h - 1);
                    const idx = (centerY * w + centerX) << 2;
                    ctx.fillStyle = `rgb(${data[idx]},${data[idx + 1]},${data[idx + 2]})`;
                    ctx.fillRect(x + bx, y + by, Math.min(blockSize, w - bx), Math.min(blockSize, h - by));
                }
            }
        },
        
        drawPreview: function(ctx) {
            const x1 = Math.min(this.startX, this.currentX);
            const y1 = Math.min(this.startY, this.currentY);
            const x2 = Math.max(this.startX, this.currentX);
            const y2 = Math.max(this.startY, this.currentY);
            const width = x2 - x1;
            const height = y2 - y1;
            
            ctx.save();
            ctx.strokeStyle = this.strokeColor;
            ctx.lineWidth = this.lineWidth;
            ctx.setLineDash([3, 3]);
            
            switch (this.currentTool) {
                case this.tools.RECTANGLE:
                    ctx.strokeRect(x1, y1, width, height); break;
                case this.tools.ELLIPSE:
                    ctx.beginPath();
                    ctx.ellipse(x1 + width / 2, y1 + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
                    ctx.stroke(); break;
                case this.tools.ARROW:
                    this.drawArrow(ctx, this.startX, this.startY, this.currentX, this.currentY); break;
                case this.tools.MOSAIC:
                    ctx.strokeRect(x1, y1, width, height); break;
            }
            ctx.restore();
        },
        
        applyToLayer: function() {
            const app = this.app;
            const layer = app.layerManager.getActiveLayer();
            if (!layer) { alert('请先选择一个图层'); return; }
            layer.ctx.drawImage(this.tempCanvas, 0, 0);
            this.elements = [];
            this.renderTempCanvas();
            app.render();
            app.saveHistory();
            this.closeDialog();
        },
        
        undo: function() {
            if (this.elements.length > 0) {
                this.elements.pop();
                this.renderTempCanvas();
            }
        },
        
        clear: function() {
            this.elements = [];
            this.renderTempCanvas();
        },
        
        deleteSelected: function() {
            if (this.selectedElementIndex !== -1) {
                this.elements.splice(this.selectedElementIndex, 1);
                this.selectedElementIndex = -1;
                this.renderTempCanvas();
            }
        },

        closeDialog: function() {
            const overlay = document.querySelector('.ss-overlay');
            if (overlay) {
                document.body.removeChild(overlay);
            }
            const style = document.getElementById('screenshot-ui-style');
            if (style) {
                document.head.removeChild(style);
            }
            this.elements = [];
            if (this._mousemoveHandler) {
                window.removeEventListener('mousemove', this._mousemoveHandler);
                window.removeEventListener('mouseup', this._mouseupHandler);
                this._mousemoveHandler = null;
                this._mouseupHandler = null;
            }
        },

        // --- 设置方法 (供UI调用) ---
        setStrokeColor: function(color) { this.strokeColor = color; },
        setLineWidth: function(width) { this.lineWidth = width; },
        setMosaicSize: function(size) { this.mosaicSize = size; },
        setFontSize: function(size) { this.fontSize = size; }
    };

    function initScreenshotPlugin() {
        const app = window.photoShopApp;
        if (!app) return false;
        ScreenshotTool.init(app);
        app.menuManager.addMenuItem('编辑', {
            label: '截图处理',
            action: 'screenshot-tools',
            handler: (app) => { showScreenshotDialog(app); },
            position: 'bottom',
            divider: true
        });
        return true;
    }

    // --- 核心修改：使用仿QQ风格的 UI 替换原有的黑框 ---
    function showScreenshotDialog(app) {
        const activeLayer = app.layerManager.getActiveLayer();
        if (!activeLayer) { alert('请先选择一个图层'); return; }

        // 防止重复打开
        if (document.querySelector('.ss-overlay')) {
            return;
        }

        // 1. 注入 CSS 样式
        const styleId = 'screenshot-ui-style';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .ss-overlay {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0, 0, 0, 0.7); z-index: 9999;
                    display: flex; align-items: center; justify-content: center;
                    user-select: none;
                }
                .ss-dialog {
                    background: #2a2a2a; border-radius: 8px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                    display: flex; flex-direction: column;
                    width: 80vw; height: 80vh;
                    position: relative;
                }
                .ss-header {
                    padding: 12px 16px; background: #1a1a1a;
                    border-radius: 8px 8px 0 0; display: flex;
                    justify-content: space-between; align-items: center;
                }
                .ss-title {
                    color: #fff; font-size: 14px; font-weight: 500;
                }
                .ss-close {
                    width: 24px; height: 24px; border: none;
                    background: transparent; color: #999;
                    cursor: pointer; border-radius: 4px;
                    display: flex; align-items: center; justify-content: center;
                }
                .ss-close:hover { background: #333; color: #fff; }
                .ss-canvas-container {
                    position: relative; overflow: hidden;
                    pointer-events: none; flex: 1;
                }
                .ss-toolbar {
                    padding: 12px; background: #fff;
                    border-radius: 0 0 8px 8px; display: flex; gap: 5px;
                    align-items: center; justify-content: center;
                    pointer-events: auto; position: relative;
                }
                .ss-tool-btn {
                    width: 36px; height: 36px; padding:0px 0px; border: none; background: transparent;
                    border-radius: 4px; color: #666; cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    transition: all 0.2s;
                }
                .ss-tool-btn:hover { background: #f0f0f0; }
                .ss-tool-btn.active { background: #e6f7ff; color: #1890ff; }
                .ss-divider { width: 1px; height: 18px; background: #ddd; margin: 0 5px; }

                /* 属性栏 (颜色/大小) */
                .ss-property-bar {
                    position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
                    margin-top: 8px;
                    background: #fff; padding: 8px 12px; border-radius: 4px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                    display: flex; align-items: center; gap: 12px;
                    z-index: 10;
                }
                .ss-property-bar::before {
                    content: ''; position: absolute; bottom: 100%; left: 50%;
                    transform: translateX(-50%);
                    border-left: 5px solid transparent; border-right: 5px solid transparent;
                    border-bottom: 5px solid #fff;
                }
                .ss-size-dot {
                    background: #ccc; border-radius: 50%; cursor: pointer; transition: 0.2s;
                }
                .ss-size-dot:hover { background: #999; }
                .ss-size-dot.active { background: #1890ff; }
                .ss-size-small { width: 4px; height: 4px; }
                .ss-size-medium { width: 8px; height: 8px; }
                .ss-size-large { width: 12px; height: 12px; }

                .ss-color-box {
                    width: 16px; height: 16px; border: 1px solid #ddd; cursor: pointer;
                    position: relative;
                }
                .ss-color-box.active {
                    box-shadow: 0 0 0 2px #1890ff; border-color: #fff;
                }
            `;
            document.head.appendChild(style);
        }

        // 2. 创建覆盖层
        const overlay = document.createElement('div');
        overlay.className = 'ss-overlay';

        // 3. 创建弹窗
        const dialog = document.createElement('div');
        dialog.className = 'ss-dialog';

        // 4. 创建标题栏
        const header = document.createElement('div');
        header.className = 'ss-header';
        const title = document.createElement('div');
        title.className = 'ss-title';
        title.textContent = '图片处理';
        const closeBtn = document.createElement('button');
        closeBtn.className = 'ss-close';
        closeBtn.innerHTML = '✕';
        closeBtn.onclick = () => ScreenshotTool.closeDialog();
        header.appendChild(title);
        header.appendChild(closeBtn);

        // 5. 画布层 (背景 + 临时绘制)
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'ss-canvas-container';
        
        // 背景原图
        const bgCanvas = document.createElement('canvas');
        bgCanvas.width = activeLayer.canvas.width;
        bgCanvas.height = activeLayer.canvas.height;
        bgCanvas.getContext('2d').drawImage(activeLayer.canvas, 0, 0);
        bgCanvas.style.cssText = `position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); opacity: 0.6; box-sizing: border-box;`;

        // 绘制层
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = activeLayer.canvas.width;
        tempCanvas.height = activeLayer.canvas.height;
        tempCanvas.style.cssText = `position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); cursor: crosshair; pointer-events: auto; border: 2px solid #555; box-shadow: 0 4px 12px rgba(0,0,0,0.3); box-sizing: border-box;`;
        
        ScreenshotTool.tempCanvas = tempCanvas;
        ScreenshotTool.tempCtx = tempCanvas.getContext('2d');
        
        canvasContainer.appendChild(bgCanvas);
        canvasContainer.appendChild(tempCanvas);

        // 4. 构建 UI HTML
        const toolbar = document.createElement('div');
        toolbar.className = 'ss-toolbar';

        // 工具列表
        const toolsData = [
            { id: 'rect', icon: ICONS.rect, type: ScreenshotTool.tools.RECTANGLE, hasProp: true },
            { id: 'ellipse', icon: ICONS.ellipse, type: ScreenshotTool.tools.ELLIPSE, hasProp: true },
            { id: 'arrow', icon: ICONS.arrow, type: ScreenshotTool.tools.ARROW, hasProp: true },
            { id: 'mosaic', icon: ICONS.mosaic, type: ScreenshotTool.tools.MOSAIC, hasProp: true }, // 马赛克也要选大小
            { id: 'text', icon: ICONS.text, type: ScreenshotTool.tools.TEXT, hasProp: true },
            { id: 'select', icon: ICONS.select, type: ScreenshotTool.tools.SELECT, hasProp: false }
        ];

        // 属性栏 (颜色和大小)
        const propBar = document.createElement('div');
        propBar.className = 'ss-property-bar';
        propBar.style.display = 'none'; // 默认隐藏
        
        // 生成大小圆点
        const sizes = [
            { w: 2, f: 16, m: 5, cls: 'ss-size-small' },
            { w: 5, f: 24, m: 10, cls: 'ss-size-medium' },
            { w: 8, f: 32, m: 20, cls: 'ss-size-large' }
        ];
        const sizeGroup = document.createElement('div');
        sizeGroup.style.cssText = 'display:flex; align-items:center; gap:10px; padding-right:10px; border-right:1px solid #eee;';
        
        sizes.forEach((s, idx) => {
            const dot = document.createElement('div');
            dot.className = `ss-size-dot ${s.cls} ${idx===0?'active':''}`; // 默认选中小
            dot.onclick = () => {
                document.querySelectorAll('.ss-size-dot').forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
                ScreenshotTool.setLineWidth(s.w);
                ScreenshotTool.setFontSize(s.f);
                ScreenshotTool.setMosaicSize(s.m);
            };
            sizeGroup.appendChild(dot);
        });
        
        // 生成颜色块
        const colors = ['#ff0000', '#ffc107', '#1890ff', '#52c41a', '#000000', '#ffffff'];
        const colorGroup = document.createElement('div');
        colorGroup.style.cssText = 'display:flex; gap:8px;';
        
        colors.forEach((c, idx) => {
            const box = document.createElement('div');
            box.className = `ss-color-box ${idx===0?'active':''}`; // 默认选中红
            box.style.backgroundColor = c;
            box.onclick = () => {
                document.querySelectorAll('.ss-color-box').forEach(b => b.classList.remove('active'));
                box.classList.add('active');
                ScreenshotTool.setStrokeColor(c);
            };
            colorGroup.appendChild(box);
        });
        
        propBar.appendChild(sizeGroup);
        propBar.appendChild(colorGroup);
        toolbar.appendChild(propBar); // 放入工具栏内部

        // 生成工具按钮
        toolsData.forEach((t, idx) => {
            const btn = document.createElement('button');
            btn.className = `ss-tool-btn ${idx===0?'active':''}`;
            btn.innerHTML = t.icon;
            btn.onclick = () => {
                document.querySelectorAll('.ss-toolbar .ss-tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                ScreenshotTool.setTool(t.type);
                // 只有绘图工具才显示属性栏
                if (t.hasProp) {
                    propBar.style.display = 'flex';
                    // 动态定位到当前按钮下方
                    const btnRect = btn.getBoundingClientRect();
                    const toolbarRect = toolbar.getBoundingClientRect();
                    const btnCenter = btnRect.left + btnRect.width / 2 - toolbarRect.left;
                    propBar.style.left = btnCenter + 'px';
                } else {
                    propBar.style.display = 'none';
                }
            };
            toolbar.appendChild(btn);
        });
        
        // 分割线
        const div = document.createElement('div');
        div.className = 'ss-divider';
        toolbar.appendChild(div);
        
        // 操作按钮 (撤销、确定、关闭)
        const actions = [
            { icon: ICONS.undo, fn: () => ScreenshotTool.undo() },
            { icon: ICONS.close, fn: () => ScreenshotTool.closeDialog() },
            { icon: ICONS.ok, fn: () => ScreenshotTool.applyToLayer() }
        ];
        
        actions.forEach(a => {
            const btn = document.createElement('button');
            btn.className = 'tool-btn';
            btn.innerHTML = a.icon;
            btn.onclick = a.fn;
            toolbar.appendChild(btn);
        });

        dialog.appendChild(header);
        dialog.appendChild(canvasContainer);
        dialog.appendChild(toolbar);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        // 绑定事件
        const getXY = (e) => {
            const rect = tempCanvas.getBoundingClientRect();
            const scaleX = tempCanvas.width / rect.width;
            const scaleY = tempCanvas.height / rect.height;
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY
            };
        };

        tempCanvas.onmousedown = (e) => {
            const pos = getXY(e);
            ScreenshotTool.startDraw(pos.x, pos.y);
        };

        ScreenshotTool._mousemoveHandler = (e) => {
            if(ScreenshotTool.isDrawing) {
                const pos = getXY(e);
                ScreenshotTool.continueDraw(pos.x, pos.y);
            }
        };

        ScreenshotTool._mouseupHandler = () => ScreenshotTool.endDraw();

        window.addEventListener('mousemove', ScreenshotTool._mousemoveHandler);
        window.addEventListener('mouseup', ScreenshotTool._mouseupHandler);
        
        // 键盘快捷键
        overlay.tabIndex = 0;
        overlay.focus();
        overlay.onkeydown = (e) => {
            if(e.key === 'Escape') ScreenshotTool.closeDialog();
            if(e.ctrlKey && e.key === 'z') ScreenshotTool.undo();
        };
        
        // 初始化默认状态
        ScreenshotTool.setTool('rectangle');
        ScreenshotTool.setStrokeColor('#ff0000');
        ScreenshotTool.setLineWidth(2);
    }

    function tryInit() {
        if (!initScreenshotPlugin()) {
            setTimeout(tryInit, 100);
        }
    }
    
    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', tryInit);
    else tryInit();

})();