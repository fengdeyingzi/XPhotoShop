// 工具函数集合

// 颜色工具函数
export const ColorUtils = {
    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    },

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
};

// 数学工具函数
export const MathUtils = {
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },

    distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }
};

// DOM操作工具函数
export const DOMUtils = {
    createElement(tag, className, parent) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (parent) parent.appendChild(el);
        return el;
    },

    clearElement(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }
};

// 图像处理工具函数
export const ImageUtils = {
    createCanvas(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    },

    cloneCanvas(sourceCanvas) {
        const canvas = this.createCanvas(sourceCanvas.width, sourceCanvas.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(sourceCanvas, 0, 0);
        return canvas;
    }
};
