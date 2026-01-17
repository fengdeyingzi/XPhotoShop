// 选区管理器 - 使用灰度蒙版管理选区
export class SelectionManager {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.hasSelection = false;
        this.selectionColor = '#808080'; // 默认灰色
    }

    // 调整选区蒙版大小
    resize(width, height) {
        const oldCanvas = this.canvas;
        this.width = width;
        this.height = height;
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.ctx.drawImage(oldCanvas, 0, 0);
    }

    // 清除选区
    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.hasSelection = false;
    }

    // 创建矩形选区
    selectRect(x, y, width, height, mode = 'new') {
        if (mode === 'new') {
            this.clear();
            this.ctx.fillStyle = 'white';
            this.ctx.fillRect(x, y, width, height);
        } else if (mode === 'add') {
            this.ctx.fillStyle = 'white';
            this.ctx.fillRect(x, y, width, height);
        } else if (mode === 'subtract') {
            this.ctx.fillStyle = 'black';
            this.ctx.fillRect(x, y, width, height);
        } else if (mode === 'intersect') {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.width;
            tempCanvas.height = this.height;
            const tempCtx = tempCanvas.getContext('2d');

            tempCtx.fillStyle = 'white';
            tempCtx.fillRect(x, y, width, height);

            const currentData = this.ctx.getImageData(0, 0, this.width, this.height);
            const newData = tempCtx.getImageData(0, 0, this.width, this.height);

            for (let i = 0; i < currentData.data.length; i += 4) {
                if (currentData.data[i] > 128 && newData.data[i] > 128) {
                    currentData.data[i] = 255;
                } else {
                    currentData.data[i] = 0;
                }
                currentData.data[i + 1] = currentData.data[i];
                currentData.data[i + 2] = currentData.data[i];
            }

            this.ctx.putImageData(currentData, 0, 0);
        }

        this.hasSelection = true;
    }

    // 添加到选区
    addRect(x, y, width, height) {
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(x, y, width, height);
        this.hasSelection = true;
    }

    // 检查点是否被选中
    isSelected(x, y) {
        if (!this.hasSelection) return false;
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
        const pixel = this.ctx.getImageData(x, y, 1, 1).data;
        return pixel[0] > 128;
    }

    // 获取选区边界
    getBounds() {
        if (!this.hasSelection) return null;

        const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
        const data = imageData.data;

        let minX = this.width, minY = this.height;
        let maxX = -1, maxY = -1;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const i = (y * this.width + x) * 4;
                if (data[i] > 128) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        if (maxX < 0) return null;

        return {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1
        };
    }

    // 检测选区边缘并返回线段
    detectEdgeSegments() {
        const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
        const data = imageData.data;
        const segments = { horizontal: [], vertical: [] };

        // 检测水平线段
        for (let y = 0; y < this.height; y++) {
            let startX = -1;
            for (let x = 0; x <= this.width; x++) {
                const i = (y * this.width + x) * 4;
                const isSelected = x < this.width && data[i] > 128;
                const hasTopEdge = isSelected && (y === 0 || data[((y - 1) * this.width + x) * 4] <= 128);
                const hasBottomEdge = isSelected && (y === this.height - 1 || data[((y + 1) * this.width + x) * 4] <= 128);

                if (hasTopEdge || hasBottomEdge) {
                    if (startX === -1) startX = x;
                } else if (startX !== -1) {
                    const lastX = x - 1;
                    const lastI = (y * this.width + lastX) * 4;
                    const lastHasTopEdge = y === 0 || data[((y - 1) * this.width + lastX) * 4] <= 128;
                    const lastHasBottomEdge = y === this.height - 1 || data[((y + 1) * this.width + lastX) * 4] <= 128;

                    if (lastHasTopEdge) {
                        segments.horizontal.push({ x: startX, y, width: x - startX, edge: 'top' });
                    }
                    if (lastHasBottomEdge) {
                        segments.horizontal.push({ x: startX, y, width: x - startX, edge: 'bottom' });
                    }
                    startX = -1;
                }
            }
        }

        // 检测垂直线段
        for (let x = 0; x < this.width; x++) {
            let startY = -1;
            for (let y = 0; y <= this.height; y++) {
                const i = (y * this.width + x) * 4;
                const isSelected = y < this.height && data[i] > 128;
                const hasLeftEdge = isSelected && (x === 0 || data[(y * this.width + (x - 1)) * 4] <= 128);
                const hasRightEdge = isSelected && (x === this.width - 1 || data[(y * this.width + (x + 1)) * 4] <= 128);

                if (hasLeftEdge || hasRightEdge) {
                    if (startY === -1) startY = y;
                } else if (startY !== -1) {
                    const lastY = y - 1;
                    const lastI = (lastY * this.width + x) * 4;
                    const lastHasLeftEdge = x === 0 || data[(lastY * this.width + (x - 1)) * 4] <= 128;
                    const lastHasRightEdge = x === this.width - 1 || data[(lastY * this.width + (x + 1)) * 4] <= 128;

                    if (lastHasLeftEdge) {
                        segments.vertical.push({ x, y: startY, height: y - startY, edge: 'left' });
                    }
                    if (lastHasRightEdge) {
                        segments.vertical.push({ x, y: startY, height: y - startY, edge: 'right' });
                    }
                    startY = -1;
                }
            }
        }

        return segments;
    }

    // 绘制选区到指定 canvas（使用线段优化）
    drawToCanvas(ctx, zoom = 1) {
        if (!this.hasSelection) return;

        const segments = this.detectEdgeSegments();

        ctx.save();
        ctx.fillStyle = this.selectionColor;

        // 绘制水平线段
        segments.horizontal.forEach(seg => {
            ctx.fillRect(seg.x, seg.y, seg.width, 1);
        });

        // 绘制垂直线段
        segments.vertical.forEach(seg => {
            ctx.fillRect(seg.x, seg.y, 1, seg.height);
        });

        ctx.restore();
    }

    // 设置选区边框颜色
    setSelectionColor(color) {
        this.selectionColor = color;
    }

    // 获取当前选区颜色
    getSelectionColor() {
        return this.selectionColor;
    }

    // 全选
    selectAll() {
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.hasSelection = true;
    }

    // 从图层创建选区
    selectFromLayer(layer) {
        this.clear();

        const imageData = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
        const data = imageData.data;

        const selectionData = this.ctx.createImageData(this.width, this.height);

        for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (alpha > 0) {
                selectionData.data[i] = 255;
                selectionData.data[i + 1] = 255;
                selectionData.data[i + 2] = 255;
                selectionData.data[i + 3] = 255;
            }
        }

        this.ctx.putImageData(selectionData, 0, 0);
        this.hasSelection = true;
    }

    // 反转选区
    invert() {
        const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 - data[i];
            data[i + 1] = 255 - data[i + 1];
            data[i + 2] = 255 - data[i + 2];
        }

        this.ctx.putImageData(imageData, 0, 0);
        this.hasSelection = true;
    }
}
