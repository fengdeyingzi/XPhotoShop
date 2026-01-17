// ==UserScript==
// @name         PhotoShop - 图层批量导出
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  批量导出图层和文件夹为PNG图片，支持裁切和仅可见图层选项，打包为ZIP下载
// @author       风的影子
// @match        file://*/PhotoShop/index.html
// @match        file://*/PhotoShop/PhotoShop.html
// @match        http://127.0.0.1:5500/index.html
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    console.log("图层批量导出脚本开始执行...");

    // 初始化函数
    function initPlugin() {
        const app = window.photoShopApp;
        if (!app) {
            console.log('PhotoShop应用未加载，等待中...');
            return false;
        }

        console.log('图层批量导出插件已加载');

        // 添加导出图层菜单项
        app.menuManager.addMenuItem('文件', {
            label: '批量导出图层...',
            action: 'batch-export-layers',
            handler: (app) => {
                showExportDialog(app, 'layer');
            },
            position: 'bottom',
            divider: true
        });

        // 添加导出文件夹菜单项
        app.menuManager.addMenuItem('文件', {
            label: '批量导出文件夹...',
            action: 'batch-export-groups',
            handler: (app) => {
                showExportDialog(app, 'group');
            },
            position: 'bottom',
            divider: false
        });

        return true;
    }

    // 尝试初始化，如果失败则轮询等待
    function tryInit() {
        if (!initPlugin()) {
            let attempts = 0;
            const maxAttempts = 100;
            const interval = setInterval(() => {
                attempts++;
                if (initPlugin()) {
                    clearInterval(interval);
                } else if (attempts >= maxAttempts) {
                    clearInterval(interval);
                    console.error('PhotoShop应用加载超时');
                }
            }, 100);
        }
    }

    // 如果DOM已经加载完成，直接初始化；否则等待DOMContentLoaded
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', tryInit);
    } else {
        tryInit();
    }

    /**
     * 显示导出对话框
     * @param {Object} app - PhotoShop应用实例
     * @param {string} type - 导出类型：'layer' 或 'group'
     */
    function showExportDialog(app, type = 'layer') {
        const isLayer = type === 'layer';
        const typeName = isLayer ? '图层' : '文件夹';

        // 获取根目录下的所有图层或文件夹
        const rootItems = app.layerManager.layers.filter(item =>
            isLayer ? !item.isGroup : item.isGroup
        );

        if (rootItems.length === 0) {
            alert(`根目录下没有可导出的${typeName}`);
            return;
        }

        // 创建对话框
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'dialog-box';
        dialog.style.width = '400px';

        const title = document.createElement('div');
        title.className = 'dialog-title';
        title.textContent = `批量导出${typeName}`;

        const form = document.createElement('div');
        form.style.display = 'flex';
        form.style.flexDirection = 'column';
        form.style.gap = '15px';
        form.style.marginBottom = '15px';

        // 提示信息
        const info = document.createElement('div');
        info.style.color = '#aaa';
        info.style.fontSize = '12px';
        info.style.marginBottom = '10px';
        info.textContent = `将导出根目录下的 ${rootItems.length} 个${typeName}为PNG图片`;

        // 裁切选项
        const cropGroup = document.createElement('div');
        cropGroup.style.display = 'flex';
        cropGroup.style.alignItems = 'center';
        cropGroup.style.gap = '10px';

        const cropCheckbox = document.createElement('input');
        cropCheckbox.type = 'checkbox';
        cropCheckbox.id = 'crop-checkbox';
        cropCheckbox.checked = true;

        const cropLabel = document.createElement('label');
        cropLabel.htmlFor = 'crop-checkbox';
        cropLabel.textContent = '裁切透明区域';
        cropLabel.style.color = '#ddd';
        cropLabel.style.cursor = 'pointer';

        cropGroup.appendChild(cropCheckbox);
        cropGroup.appendChild(cropLabel);

        // 仅可见图层选项
        const visibleGroup = document.createElement('div');
        visibleGroup.style.display = 'flex';
        visibleGroup.style.alignItems = 'center';
        visibleGroup.style.gap = '10px';

        const visibleCheckbox = document.createElement('input');
        visibleCheckbox.type = 'checkbox';
        visibleCheckbox.id = 'visible-checkbox';
        visibleCheckbox.checked = false;

        const visibleLabel = document.createElement('label');
        visibleLabel.htmlFor = 'visible-checkbox';
        visibleLabel.textContent = '仅导出可见项';
        visibleLabel.style.color = '#ddd';
        visibleLabel.style.cursor = 'pointer';

        visibleGroup.appendChild(visibleCheckbox);
        visibleGroup.appendChild(visibleLabel);

        // 文件名前缀
        const prefixGroup = document.createElement('div');
        prefixGroup.style.display = 'flex';
        prefixGroup.style.flexDirection = 'column';
        prefixGroup.style.gap = '5px';

        const prefixLabel = document.createElement('label');
        prefixLabel.textContent = '文件名前缀（可选）:';
        prefixLabel.style.color = '#ddd';

        const prefixInput = document.createElement('input');
        prefixInput.type = 'text';
        prefixInput.className = 'dialog-input';
        prefixInput.value = '';
        prefixInput.placeholder = '留空则使用原名称';
        prefixInput.style.marginBottom = '0';

        prefixGroup.appendChild(prefixLabel);
        prefixGroup.appendChild(prefixInput);

        form.appendChild(info);
        form.appendChild(cropGroup);
        form.appendChild(visibleGroup);
        form.appendChild(prefixGroup);

        // 按钮
        const buttons = document.createElement('div');
        buttons.className = 'dialog-buttons';

        const okBtn = document.createElement('button');
        okBtn.textContent = '导出';
        okBtn.className = 'dialog-btn dialog-btn-ok';
        okBtn.onclick = async () => {
            const crop = cropCheckbox.checked;
            const visibleOnly = visibleCheckbox.checked;
            const prefix = prefixInput.value;

            // 禁用按钮防止重复点击
            okBtn.disabled = true;
            okBtn.textContent = '导出中...';

            try {
                await exportItems(app, rootItems, type, crop, visibleOnly, prefix);
                document.body.removeChild(overlay);
            } catch (error) {
                console.error('导出失败:', error);
                alert('导出失败: ' + error.message);
                okBtn.disabled = false;
                okBtn.textContent = '导出';
            }
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.className = 'dialog-btn dialog-btn-cancel';
        cancelBtn.onclick = () => {
            document.body.removeChild(overlay);
        };

        buttons.appendChild(okBtn);
        buttons.appendChild(cancelBtn);

        dialog.appendChild(title);
        dialog.appendChild(form);
        dialog.appendChild(buttons);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // ESC键取消
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                cancelBtn.click();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    }

    /**
     * 导出项目（图层或文件夹）
     */
    async function exportItems(app, items, type, crop, visibleOnly, prefix) {
        const isLayer = type === 'layer';
        const typeName = isLayer ? '图层' : '文件夹';

        // 过滤可见项
        const itemsToExport = visibleOnly ? items.filter(item => item.visible) : items;

        if (itemsToExport.length === 0) {
            alert('没有可导出的项目');
            return;
        }

        console.log(`开始导出 ${itemsToExport.length} 个${typeName}...`);

        // 创建ZIP
        const zip = new JSZip();

        // 导出每个项目
        for (let i = 0; i < itemsToExport.length; i++) {
            const item = itemsToExport[i];
            const fileName = prefix ? `${prefix}${item.name}.png` : `${item.name}.png`;

            console.log(`导出 ${i + 1}/${itemsToExport.length}: ${fileName}`);

            let canvas;
            if (isLayer) {
                // 导出图层
                canvas = await exportLayer(item, crop);
            } else {
                // 导出文件夹（合并所有子图层）
                canvas = await exportGroup(item, app.config.width, app.config.height, crop);
            }

            // 转换为Blob并添加到ZIP
            const blob = await canvasToBlob(canvas);
            zip.file(fileName, blob);
        }

        // 生成ZIP并下载
        console.log('生成ZIP文件...');
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${typeName}导出_${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`导出完成: ${itemsToExport.length} 个${typeName}`);
        alert(`成功导出 ${itemsToExport.length} 个${typeName}`);
    }

    /**
     * 导出单个图层
     */
    async function exportLayer(layer, crop) {
        if (crop) {
            return cropCanvas(layer.canvas);
        } else {
            return layer.canvas;
        }
    }

    /**
     * 导出文件夹（合并所有子图层）
     */
    async function exportGroup(group, width, height, crop) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // 递归渲染所有子项
        function renderItem(item) {
            if (!item.visible) return;

            if (item.isGroup) {
                // 递归渲染文件夹的子项
                item.children.forEach(child => renderItem(child));
            } else {
                // 渲染图层
                ctx.globalAlpha = item.opacity;
                ctx.drawImage(item.canvas, 0, 0);
                ctx.globalAlpha = 1;
            }
        }

        renderItem(group);

        if (crop) {
            return cropCanvas(canvas);
        } else {
            return canvas;
        }
    }

    /**
     * 裁切画布透明区域
     */
    function cropCanvas(sourceCanvas) {
        const ctx = sourceCanvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
        const data = imageData.data;

        let minX = sourceCanvas.width;
        let minY = sourceCanvas.height;
        let maxX = 0;
        let maxY = 0;

        // 查找非透明像素的边界
        for (let y = 0; y < sourceCanvas.height; y++) {
            for (let x = 0; x < sourceCanvas.width; x++) {
                const alpha = data[(y * sourceCanvas.width + x) * 4 + 3];
                if (alpha > 0) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        // 如果全透明，返回1x1画布
        if (minX > maxX || minY > maxY) {
            const emptyCanvas = document.createElement('canvas');
            emptyCanvas.width = 1;
            emptyCanvas.height = 1;
            return emptyCanvas;
        }

        // 创建裁切后的画布
        const croppedWidth = maxX - minX + 1;
        const croppedHeight = maxY - minY + 1;
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = croppedWidth;
        croppedCanvas.height = croppedHeight;
        const croppedCtx = croppedCanvas.getContext('2d');

        croppedCtx.drawImage(
            sourceCanvas,
            minX, minY, croppedWidth, croppedHeight,
            0, 0, croppedWidth, croppedHeight
        );

        return croppedCanvas;
    }

    /**
     * 将Canvas转换为Blob
     */
    function canvasToBlob(canvas) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('无法转换Canvas为Blob'));
                }
            }, 'image/png');
        });
    }

})();
