// 工具模块 - 处理绘图工具
export class Tools {
    constructor(layerManager, canvasManager, selectionManager) {
        this.layerManager = layerManager;
        this.canvasManager = canvasManager;
        this.selectionManager = selectionManager;
        this.currentTool = 'pencil';
        this.color = '#000000';
        this.brushSize = 3;
        this.isDrawing = false;
        this.lastPos = null;
        this.lastDrawnPos = null;

        // 矩形选择工具相关
        this.selectionStart = null;
        this.selectionPreview = null;
        this.selectionMode = 'new'; // 新建、添加、减去、相交

        // 移动工具相关
        this.moveStartPos = null;
        this.moveLayerData = null;
        this.autoSelect = false; // 点击时自动选择图层

        // 橡皮擦工具相关
        this.eraserShape = 'circle'; // 圆形或方形
    }

    setTool(toolName) {
        this.currentTool = toolName;
        // 切换工具时清理预览状态
        this.cropPreview = null;
        this.polyLassoPreview = null;
        this.polyPoints = null;
        this.cropRect = null;
        this.cropStart = null;
    }

    setColor(color) {
        this.color = color;
    }

    setBrushSize(size) {
        this.brushSize = size;
    }

    setSelectionMode(mode) {
        this.selectionMode = mode;
    }

    setAutoSelect(enabled) {
        this.autoSelect = enabled;
    }

    setEraserShape(shape) {
        this.eraserShape = shape;
    }

    // Bresenham直线算法，用于平滑绘制
    drawLine(x0, y0, x1, y1) {
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = (x0 < x1) ? 1 : -1;
        const sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        while (true) {
            this.draw(x0, y0);
            if ((x0 === x1) && (y0 === y1)) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }
    }

    draw(x, y) {
        const layer = this.layerManager.getActiveLayer();
        if (!layer || !layer.visible) return;

        switch (this.currentTool) {
            case 'pencil':
                this.drawPencil(x, y);
                break;
            case 'brush':
                this.drawBrush(x, y);
                break;
            case 'eraser':
                this.eraseBrush(x, y);
                break;
            case 'picker':
                this.pickColor(x, y);
                break;
            case 'bucket':
                this.fillBucket(x, y);
                break;
        }
    }

    drawPencil(x, y) {
        const layer = this.layerManager.getActiveLayer();
        const ctx = layer.ctx;
        const size = this.brushSize;
        const radius = Math.floor(size / 2);

        ctx.fillStyle = this.color;

        // 为铅笔工具绘制方形
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const px = x + dx;
                const py = y + dy;
                // 检查边界和选区
                if (px >= 0 && px < layer.canvas.width && py >= 0 && py < layer.canvas.height) {
                    // 只有在没有选区或像素被选中时才绘制
                    if (!this.selectionManager.hasSelection || this.selectionManager.isSelected(px, py)) {
                        ctx.fillRect(px, py, 1, 1);
                    }
                }
            }
        }
    }

    drawBrush(x, y) {
        const layer = this.layerManager.getActiveLayer();
        const ctx = layer.ctx;
        const size = this.brushSize;
        const radius = Math.floor(size / 2);

        ctx.fillStyle = this.color;

        // 为画笔工具绘制圆形
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= radius) {
                    const px = x + dx;
                    const py = y + dy;
                    // 检查边界和选区
                    if (px >= 0 && px < layer.canvas.width && py >= 0 && py < layer.canvas.height) {
                        // 只有在没有选区或像素被选中时才绘制
                        if (!this.selectionManager.hasSelection || this.selectionManager.isSelected(px, py)) {
                            ctx.fillRect(px, py, 1, 1);
                        }
                    }
                }
            }
        }
    }

    eraseBrush(x, y) {
        const layer = this.layerManager.getActiveLayer();
        const ctx = layer.ctx;
        const size = this.brushSize;
        const radius = Math.floor(size / 2);

        if (this.eraserShape === 'circle') {
            // 以圆形模式擦除
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance <= radius) {
                        const px = x + dx;
                        const py = y + dy;
                        // 检查边界和选区
                        if (px >= 0 && px < layer.canvas.width && py >= 0 && py < layer.canvas.height) {
                            // 只有在没有选区或像素被选中时才擦除
                            if (!this.selectionManager.hasSelection || this.selectionManager.isSelected(px, py)) {
                                ctx.clearRect(px, py, 1, 1);
                            }
                        }
                    }
                }
            }
        } else if (this.eraserShape === 'square') {
            // 以方形模式擦除
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const px = x + dx;
                    const py = y + dy;
                    // 检查边界和选区
                    if (px >= 0 && px < layer.canvas.width && py >= 0 && py < layer.canvas.height) {
                        // 只有在没有选区或像素被选中时才擦除
                        if (!this.selectionManager.hasSelection || this.selectionManager.isSelected(px, py)) {
                            ctx.clearRect(px, py, 1, 1);
                        }
                    }
                }
            }
        }
    }

    pickColor(x, y) {
        const displayCtx = this.canvasManager.displayCtx;
        const p = displayCtx.getImageData(x, y, 1, 1).data;
        if (p[3] > 0) {
            const hex = this.rgbToHex(p[0], p[1], p[2]);
            this.color = hex;
            // 不自动切换到画笔工具 - 让用户继续拾取颜色
            return hex;
        }
        return null;
    }

    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    fillBucket(x, y) {
        const layer = this.layerManager.getActiveLayer();
        const ctx = layer.ctx;
        const width = layer.canvas.width;
        const height = layer.canvas.height;

        // 获取图像数据
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // 获取点击位置的目标颜色
        const targetIndex = (y * width + x) * 4;
        const targetR = data[targetIndex];
        const targetG = data[targetIndex + 1];
        const targetB = data[targetIndex + 2];
        const targetA = data[targetIndex + 3];

        // 解析填充颜色
        const fillColor = this.hexToRgb(this.color);
        const fillR = fillColor.r;
        const fillG = fillColor.g;
        const fillB = fillColor.b;
        const fillA = 255;

        // 检查目标颜色是否与填充颜色相同
        if (targetR === fillR && targetG === fillG && targetB === fillB && targetA === fillA) {
            return; // 无需填充
        }

        // 使用栈的洪水填充算法
        const stack = [[x, y]];
        const visited = new Set();

        while (stack.length > 0) {
            const [px, py] = stack.pop();
            const key = `${px},${py}`;

            // 如果已访问或超出边界则跳过
            if (visited.has(key) || px < 0 || px >= width || py < 0 || py >= height) {
                continue;
            }

            // 检查像素是否匹配目标颜色
            const index = (py * width + px) * 4;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];
            const a = data[index + 3];

            if (r !== targetR || g !== targetG || b !== targetB || a !== targetA) {
                continue;
            }

            // 如果存在选区则检查选区
            if (this.selectionManager.hasSelection && !this.selectionManager.isSelected(px, py)) {
                continue;
            }

            // 标记为已访问
            visited.add(key);

            // 填充像素
            data[index] = fillR;
            data[index + 1] = fillG;
            data[index + 2] = fillB;
            data[index + 3] = fillA;

            // 将邻居添加到栈中
            stack.push([px + 1, py]);
            stack.push([px - 1, py]);
            stack.push([px, py + 1]);
            stack.push([px, py - 1]);
        }

        // 将修改后的图像数据放回
        ctx.putImageData(imageData, 0, 0);
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    startDrawing(x, y, shiftKey = false) {
        this.isDrawing = true;

        // 检查自定义工具
        if (window.photoShopApp && window.photoShopApp.customTools.has(this.currentTool)) {
            const customTool = window.photoShopApp.customTools.get(this.currentTool);
            if (customTool.onStart) {
                const context = {
                    layer: this.layerManager.getActiveLayer(),
                    shiftKey,
                    app: window.photoShopApp,
                    tools: this
                };
                customTool.onStart(x, y, context);
            }
            return;
        }

        switch (this.currentTool) {
            case 'rectSelect':
                this.startRectSelection(x, y);
                break;
            case 'move':
                this.startMove(x, y);
                break;
            case 'bucket':
                this.draw(x, y);
                this.isDrawing = false;
                break;
            case 'picker':
                this.draw(x, y);
                break;
            case 'pencil':
            case 'brush':
                if (shiftKey && this.lastDrawnPos) {
                    this.drawLine(this.lastDrawnPos.x, this.lastDrawnPos.y, x, y);
                    this.lastDrawnPos = { x, y };
                } else {
                    this.lastPos = { x, y };
                    this.draw(x, y);
                    this.lastDrawnPos = { x, y };
                }
                break;
            default:
                this.lastPos = { x, y };
                this.draw(x, y);
                break;
        }
    }

    continueDrawing(x, y) {
        if (!this.isDrawing) return;

        // 检查自定义工具
        if (window.photoShopApp && window.photoShopApp.customTools.has(this.currentTool)) {
            const customTool = window.photoShopApp.customTools.get(this.currentTool);
            if (customTool.onMove) {
                const context = {
                    layer: this.layerManager.getActiveLayer(),
                    app: window.photoShopApp,
                    tools: this
                };
                customTool.onMove(x, y, context);
            }
            return;
        }

        switch (this.currentTool) {
            case 'rectSelect':
                this.updateRectSelection(x, y);
                break;
            case 'move':
                this.continueMove(x, y);
                break;
            case 'picker':
                this.draw(x, y);
                break;
            default:
                if (this.lastPos) {
                    this.drawLine(this.lastPos.x, this.lastPos.y, x, y);
                } else {
                    this.draw(x, y);
                }
                this.lastPos = { x, y };
                break;
        }
    }

    stopDrawing() {
        // 检查自定义工具
        if (window.photoShopApp && window.photoShopApp.customTools.has(this.currentTool)) {
            const customTool = window.photoShopApp.customTools.get(this.currentTool);
            if (customTool.onEnd && this.isDrawing) {
                const context = {
                    layer: this.layerManager.getActiveLayer(),
                    app: window.photoShopApp,
                    tools: this
                };
                customTool.onEnd(this.lastPos?.x || 0, this.lastPos?.y || 0, context);
            }
        }

        this.isDrawing = false;
        if (this.lastPos && (this.currentTool === 'pencil' || this.currentTool === 'brush')) {
            this.lastDrawnPos = { ...this.lastPos };
        }
        this.lastPos = null;
        this.selectionStart = null;
        this.selectionPreview = null;
        this.moveStartPos = null;
    }

    // 矩形选择工具
    startRectSelection(x, y) {
        console.log('[DEBUG] startRectSelection at:', x, y);
        this.selectionStart = { x, y };
        this.isDrawing = true;
        console.log('[DEBUG] selectionStart set to:', this.selectionStart, 'isDrawing:', this.isDrawing);
    }

    updateRectSelection(x, y) {
        if (!this.selectionStart) {
            console.log('[DEBUG] updateRectSelection - no selectionStart!');
            return;
        }

        const startX = Math.min(this.selectionStart.x, x);
        const startY = Math.min(this.selectionStart.y, y);
        const width = Math.abs(x - this.selectionStart.x);
        const height = Math.abs(y - this.selectionStart.y);

        this.selectionPreview = { x: startX, y: startY, width, height };
        console.log('[DEBUG] updateRectSelection - preview:', this.selectionPreview);
    }

    finishRectSelection(x, y) {
        console.log('[DEBUG] finishRectSelection at:', x, y, 'selectionStart:', this.selectionStart);
        if (!this.selectionStart) {
            console.log('[DEBUG] finishRectSelection - no selectionStart!');
            return;
        }

        const startX = Math.min(this.selectionStart.x, x);
        const startY = Math.min(this.selectionStart.y, y);
        const width = Math.abs(x - this.selectionStart.x);
        const height = Math.abs(y - this.selectionStart.y);

        console.log('[DEBUG] finishRectSelection - rect:', { x: startX, y: startY, width, height }, 'mode:', this.selectionMode);
        if (width > 0 && height > 0) {
            console.log('[DEBUG] calling selectionManager.selectRect with mode:', this.selectionMode);
            this.selectionManager.selectRect(startX, startY, width, height, this.selectionMode);
        } else {
            console.log('[DEBUG] 矩形太小，不创建选区');
        }

        this.selectionStart = null;
        this.selectionPreview = null;
    }

    getSelectionPreview() {
        return this.selectionPreview;
    }

    getPolyLassoPreview() {
        return this.polyLassoPreview;
    }

    getCropPreview() {
        return this.cropPreview;
    }

    // 移动工具
    startMove(x, y) {
        const layer = this.layerManager.getActiveLayer();
        if (!layer) return;

        // 如果启用了自动选择，则自动选择图层
        if (this.autoSelect) {
            const clickedLayerIndex = this.findLayerAtPoint(x, y);
            if (clickedLayerIndex !== -1) {
                this.layerManager.setActiveLayer(clickedLayerIndex);
            }
        }

        this.moveStartPos = { x, y };
        this.isDrawing = true;

        // 存储当前图层数据和选区数据
        this.moveLayerData = {
            imageData: layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height),
            hasSelection: this.selectionManager.hasSelection,
            selectionBounds: this.selectionManager.getBounds(),
            // 保存原始选区数据
            selectionData: this.selectionManager.hasSelection ?
                this.selectionManager.ctx.getImageData(0, 0, this.selectionManager.width, this.selectionManager.height) : null
        };
    }

    // 查找在指定点处具有非透明像素的图层
    findLayerAtPoint(x, y) {
        // 从上到下检查图层
        for (let i = this.layerManager.layers.length - 1; i >= 0; i--) {
            const layer = this.layerManager.layers[i];
            if (!layer.visible) continue;

            const pixel = layer.ctx.getImageData(x, y, 1, 1).data;
            if (pixel[3] > 0) {             // 有透明度
                return i;
            }
        }
        return -1;
    }

    continueMove(x, y) {
        if (!this.moveStartPos || !this.moveLayerData) return;

        const layer = this.layerManager.getActiveLayer();
        if (!layer) return;

        const dx = x - this.moveStartPos.x;
        const dy = y - this.moveStartPos.y;

        // Clear layer
        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);

        if (this.moveLayerData.hasSelection && this.moveLayerData.selectionBounds && this.moveLayerData.selectionData) {
            // 仅移动选中的区域
            const bounds = this.moveLayerData.selectionBounds;

            // 首先，恢复未选中的区域
            layer.ctx.putImageData(this.moveLayerData.imageData, 0, 0);

            // 清除选中的区域（使用原始选区数据）
            const selData = this.moveLayerData.selectionData.data;
            for (let py = 0; py < this.moveLayerData.selectionData.height; py++) {
                for (let px = 0; px < this.moveLayerData.selectionData.width; px++) {
                    const idx = (py * this.moveLayerData.selectionData.width + px) * 4;
                    if (selData[idx + 3] > 0) { // 如果在原始选区内
                        layer.ctx.clearRect(px, py, 1, 1);
                    }
                }
            }

            // 在新位置绘制选中的像素
            const selectedData = this.moveLayerData.imageData;
            for (let py = 0; py < this.moveLayerData.selectionData.height; py++) {
                for (let px = 0; px < this.moveLayerData.selectionData.width; px++) {
                    const idx = (py * this.moveLayerData.selectionData.width + px) * 4;
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
            this.selectionManager.clear();
            const newSelData = this.selectionManager.ctx.createImageData(
                this.selectionManager.width,
                this.selectionManager.height
            );
            const newData = newSelData.data;

            // 将原始选区数据移动到新位置
            for (let py = 0; py < this.moveLayerData.selectionData.height; py++) {
                for (let px = 0; px < this.moveLayerData.selectionData.width; px++) {
                    const oldIdx = (py * this.moveLayerData.selectionData.width + px) * 4;
                    const newX = px + dx;
                    const newY = py + dy;

                    if (newX >= 0 && newX < this.selectionManager.width &&
                        newY >= 0 && newY < this.selectionManager.height) {
                        const newIdx = (newY * this.selectionManager.width + newX) * 4;
                        newData[newIdx] = selData[oldIdx];
                        newData[newIdx + 1] = selData[oldIdx + 1];
                        newData[newIdx + 2] = selData[oldIdx + 2];
                        newData[newIdx + 3] = selData[oldIdx + 3];
                    }
                }
            }

            this.selectionManager.ctx.putImageData(newSelData, 0, 0);
            this.selectionManager.hasSelection = true;
        } else {
            // 移动整个图层
            layer.ctx.putImageData(this.moveLayerData.imageData, dx, dy);
        }
    }

    finishMove(x, y) {
        if (this.moveStartPos && this.moveLayerData) {
            this.continueMove(x, y);
        }
        this.moveStartPos = null;
        this.moveLayerData = null;
    }

    // 判断当前系统是否是手机
    isMobile() {
        return /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform));
    }
}
