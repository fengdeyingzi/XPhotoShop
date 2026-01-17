// 画布管理器 - 处理画布渲染和显示
export class CanvasManager {
    constructor(displayCanvas, canvasContainer) {
        this.displayCanvas = displayCanvas;
        this.displayCtx = displayCanvas.getContext('2d');
        this.displayCtx.imageSmoothingEnabled = false;
        this.canvasContainer = canvasContainer;
        this.width = 64;
        this.height = 64;
        this.zoom = 8;
    }

    resize(width, height) {
        this.width = width;
        this.height = height;
        this.displayCanvas.width = width;
        this.displayCanvas.height = height;
        this.updateZoom();
    }

    updateZoom() {
        const w = this.width * this.zoom;
        const h = this.height * this.zoom;
        this.canvasContainer.style.width = `${w}px`;
        this.canvasContainer.style.height = `${h}px`;
        this.displayCanvas.style.width = `${w}px`;
        this.displayCanvas.style.height = `${h}px`;
    }

    setZoom(zoom) {
        this.zoom = Math.max(1, Math.min(30, zoom));
        this.updateZoom();
    }

    // 调整缩放级别，delta为正时缩小，负时放大
    adjustZoom(delta) {
        if (delta < 0) {
            this.zoom = Math.min(this.zoom + 1, 30);
        } else {
            this.zoom = Math.max(this.zoom - 1, 1);
        }
        this.updateZoom();
    }

    render(layers) {
        this.displayCtx.clearRect(0, 0, this.width, this.height);

        // 递归渲染图层，遵循组的可见性
        const renderItem = (item) => {
            if (item.isGroup) {
                // 仅在组可见时渲染子项
                if (item.visible) {
                    item.children.forEach(child => renderItem(child));
                }
            } else {
                // 检查图层和所有父组是否可见
                let isVisible = item.visible;
                let parent = item.parent;
                while (parent && isVisible) {
                    if (!parent.visible) {
                        isVisible = false;
                    }
                    parent = parent.parent;
                }

                if (isVisible) {
                    // 应用图层和所有父组的不透明度
                    let totalOpacity = item.opacity;
                    parent = item.parent;
                    while (parent) {
                        totalOpacity *= parent.opacity;
                        parent = parent.parent;
                    }

                    this.displayCtx.globalAlpha = totalOpacity;
                    this.displayCtx.drawImage(item.canvas, 0, 0);
                }
            }
        };

        layers.forEach(item => renderItem(item));
        this.displayCtx.globalAlpha = 1.0;
    }

    getMousePos(evt) {
        const rect = this.displayCanvas.getBoundingClientRect();
        const scaleX = this.displayCanvas.width / rect.width;
        const scaleY = this.displayCanvas.height / rect.height;
        const result = {
            x: Math.floor((evt.clientX - rect.left) * scaleX),
            y: Math.floor((evt.clientY - rect.top) * scaleY)
        };

        return result;
    }
}
