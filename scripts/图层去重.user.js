// ==UserScript==
// @name         PhotoShop - 图层去重工具
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  检测并去除相邻的重复图层，支持像素误差范围设置
// @author       风的影子
// @match        file://*/PhotoShop/index.html
// @match        file://*/PhotoShop/PhotoShop.html
// @match        http://127.0.0.1:5500/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function initPlugin() {
        const app = window.photoShopApp;
        if (!app) return false;

        console.log('图层去重插件已加载');

        // 在图层菜单中添加去重菜单项
        app.menuManager.addMenuItem('图层', {
            label: '图层去重...',
            action: 'deduplicate-layers',
            handler: () => showDeduplicateDialog(app),
            position: 'bottom',
            divider: true
        });

        return true;
    }

    function tryInit() {
        if (!initPlugin()) {
            let attempts = 0;
            const interval = setInterval(() => {
                if (++attempts >= 100 || initPlugin()) clearInterval(interval);
            }, 100);
        }
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', tryInit);
    } else {
        tryInit();
    }

    function showDeduplicateDialog(app) {
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'dialog-box';
        dialog.style.width = '600px';
        dialog.style.maxHeight = '80vh';
        dialog.style.overflow = 'auto';

        const title = document.createElement('div');
        title.className = 'dialog-title';
        title.textContent = '图层去重工具';

        const content = document.createElement('div');
        content.style.padding = '15px';

        // 说明文字
        const description = document.createElement('div');
        description.innerHTML = '<p style="color: #aaa; margin-bottom: 15px;">检测相邻的重复图层，并根据设置的误差范围进行去重。</p>';
        content.appendChild(description);

        // 控制区域
        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.flexDirection = 'column';
        controls.style.gap = '15px';

        // 误差范围设置
        const toleranceGroup = document.createElement('div');
        toleranceGroup.style.display = 'flex';
        toleranceGroup.style.alignItems = 'center';
        toleranceGroup.style.gap = '10px';

        const toleranceLabel = document.createElement('label');
        toleranceLabel.textContent = '像素误差范围:';
        toleranceLabel.style.color = '#ddd';
        toleranceLabel.style.minWidth = '120px';

        const toleranceSlider = document.createElement('input');
        toleranceSlider.type = 'range';
        toleranceSlider.min = '0';
        toleranceSlider.max = '255';
        toleranceSlider.value = '0';
        toleranceSlider.style.flex = '1';

        const toleranceValue = document.createElement('span');
        toleranceValue.textContent = toleranceSlider.value;
        toleranceValue.style.color = '#aaa';
        toleranceValue.style.minWidth = '40px';
        toleranceValue.style.textAlign = 'right';

        toleranceGroup.appendChild(toleranceLabel);
        toleranceGroup.appendChild(toleranceSlider);
        toleranceGroup.appendChild(toleranceValue);

        // 包含图层组选项
        const includeGroupsGroup = document.createElement('div');
        includeGroupsGroup.style.display = 'flex';
        includeGroupsGroup.style.alignItems = 'center';
        includeGroupsGroup.style.gap = '10px';

        const includeGroupsLabel = document.createElement('label');
        includeGroupsLabel.textContent = '包含图层组:';
        includeGroupsLabel.style.color = '#ddd';
        includeGroupsLabel.style.minWidth = '120px';

        const includeGroupsCheckbox = document.createElement('input');
        includeGroupsCheckbox.type = 'checkbox';
        includeGroupsCheckbox.checked = true;
        includeGroupsCheckbox.style.cursor = 'pointer';

        includeGroupsGroup.appendChild(includeGroupsLabel);
        includeGroupsGroup.appendChild(includeGroupsCheckbox);

        controls.appendChild(toleranceGroup);
        controls.appendChild(includeGroupsGroup);

        // 结果显示区域
        const resultArea = document.createElement('div');
        resultArea.id = 'deduplicateResult';
        resultArea.style.marginTop = '20px';
        resultArea.style.padding = '10px';
        resultArea.style.backgroundColor = '#222';
        resultArea.style.borderRadius = '5px';
        resultArea.style.minHeight = '50px';
        resultArea.style.color = '#ddd';
        resultArea.style.display = 'none';

        // 进度条
        const progressContainer = document.createElement('div');
        progressContainer.id = 'deduplicateProgress';
        progressContainer.style.marginTop = '10px';
        progressContainer.style.display = 'none';

        const progressBar = document.createElement('div');
        progressBar.style.width = '0%';
        progressBar.style.height = '4px';
        progressBar.style.backgroundColor = '#4CAF50';
        progressBar.style.borderRadius = '2px';
        progressBar.style.transition = 'width 0.3s';

        progressContainer.appendChild(progressBar);

        content.appendChild(controls);
        content.appendChild(resultArea);
        content.appendChild(progressContainer);

        // 按钮区域
        const buttons = document.createElement('div');
        buttons.className = 'dialog-buttons';
        buttons.style.marginTop = '20px';

        const analyzeBtn = document.createElement('button');
        analyzeBtn.textContent = '分析重复图层';
        analyzeBtn.className = 'dialog-btn dialog-btn-ok';
        analyzeBtn.style.marginRight = '10px';

        const deduplicateBtn = document.createElement('button');
        deduplicateBtn.textContent = '执行去重';
        deduplicateBtn.className = 'dialog-btn dialog-btn-ok';
        deduplicateBtn.disabled = true;

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.className = 'dialog-btn dialog-btn-cancel';
        cancelBtn.style.marginLeft = '10px';

        buttons.appendChild(analyzeBtn);
        buttons.appendChild(deduplicateBtn);
        buttons.appendChild(cancelBtn);

        // 更新误差值显示
        toleranceSlider.addEventListener('input', () => {
            toleranceValue.textContent = toleranceSlider.value;
        });

        // 分析结果存储
        let analysisResult = null;

        // 获取所有图层（扁平化）
        function getAllLayers(includeGroups = true) {
            const layers = [];
            
            function traverse(items) {
                for (const item of items) {
                    if (item.isGroup && includeGroups) {
                        traverse(item.children);
                    } else if (!item.isGroup) {
                        layers.push(item);
                    }
                }
            }
            
            traverse(app.layerManager.layers);
            return layers;
        }

        // 比较两个图层是否相同（考虑误差范围）
        function areLayersIdentical(layer1, layer2, tolerance) {
            if (layer1.canvas.width !== layer2.canvas.width || layer1.canvas.height !== layer2.canvas.height) {
                return false;
            }

            const width = layer1.canvas.width;
            const height = layer1.canvas.height;

            const data1 = layer1.ctx.getImageData(0, 0, width, height).data;
            const data2 = layer2.ctx.getImageData(0, 0, width, height).data;

            // 如果误差为0，直接比较字节数据
            if (tolerance === 0) {
                for (let i = 0; i < data1.length; i++) {
                    if (data1[i] !== data2[i]) {
                        return false;
                    }
                }
                return true;
            }

            // 考虑误差范围
            for (let i = 0; i < data1.length; i += 4) {
                const r1 = data1[i];
                const g1 = data1[i + 1];
                const b1 = data1[i + 2];
                const a1 = data1[i + 3];

                const r2 = data2[i];
                const g2 = data2[i + 1];
                const b2 = data2[i + 2];
                const a2 = data2[i + 3];

                // 检查透明度
                if (Math.abs(a1 - a2) > tolerance) {
                    return false;
                }

                // 如果不透明，检查RGB通道
                if (a1 > 0 || a2 > 0) {
                    if (Math.abs(r1 - r2) > tolerance ||
                        Math.abs(g1 - g2) > tolerance ||
                        Math.abs(b1 - b2) > tolerance) {
                        return false;
                    }
                }
            }

            return true;
        }

        // 分析重复图层
        analyzeBtn.onclick = () => {
            const tolerance = parseInt(toleranceSlider.value);
            const includeGroups = includeGroupsCheckbox.checked;
            
            // 清空结果
            resultArea.innerHTML = '';
            resultArea.style.display = 'none';
            deduplicateBtn.disabled = true;
            
            // 显示进度
            progressContainer.style.display = 'block';
            progressBar.style.width = '0%';
            
            // 延迟执行以显示进度
            setTimeout(() => {
                try {
                    const allLayers = getAllLayers(includeGroups);
                    const duplicates = [];
                    
                    if (allLayers.length < 2) {
                        resultArea.innerHTML = '<p style="color: #ff6b6b;">需要至少2个图层才能进行去重分析。</p>';
                        resultArea.style.display = 'block';
                        progressContainer.style.display = 'none';
                        return;
                    }
                    
                    // 更新进度
                    progressBar.style.width = '30%';
                    
                    // 分析相邻重复图层
                    for (let i = 0; i < allLayers.length - 1; i++) {
                        const layer1 = allLayers[i];
                        const layer2 = allLayers[i + 1];
                        
                        if (areLayersIdentical(layer1, layer2, tolerance)) {
                            duplicates.push({
                                index1: i,
                                index2: i + 1,
                                layer1: layer1,
                                layer2: layer2,
                                layer1Name: layer1.name,
                                layer2Name: layer2.name
                            });
                        }
                        
                        // 更新进度
                        const progress = 30 + ((i + 1) / (allLayers.length - 1)) * 60;
                        progressBar.style.width = progress + '%';
                    }
                    
                    progressBar.style.width = '100%';
                    
                    // 显示结果
                    if (duplicates.length === 0) {
                        resultArea.innerHTML = '<p style="color: #4CAF50;">🎉 未检测到重复图层！</p>';
                    } else {
                        let html = `<p style="color: #ffa726; margin-bottom: 10px;">检测到 <strong>${duplicates.length}</strong> 组重复图层：</p>`;
                        
                        duplicates.forEach((dup, idx) => {
                            html += `<div style="margin: 5px 0; padding: 5px; background: #333; border-radius: 3px;">
                                <strong>组 ${idx + 1}:</strong> 图层"${dup.layer1Name}" (索引:${dup.index1}) 与 "${dup.layer2Name}" (索引:${dup.index2}) 重复
                            </div>`;
                        });
                        
                        html += `<p style="margin-top: 10px; color: #90caf9;">总计可删除 ${duplicates.length} 个重复图层。</p>`;
                        
                        resultArea.innerHTML = html;
                        deduplicateBtn.disabled = false;
                        analysisResult = {
                            duplicates: duplicates,
                            allLayers: allLayers,
                            includeGroups: includeGroups,
                            tolerance: tolerance
                        };
                    }
                    
                    resultArea.style.display = 'block';
                    
                    // 隐藏进度条
                    setTimeout(() => {
                        progressContainer.style.display = 'none';
                    }, 500);
                    
                } catch (error) {
                    console.error('分析图层时出错:', error);
                    resultArea.innerHTML = `<p style="color: #ff6b6b;">分析失败: ${error.message}</p>`;
                    resultArea.style.display = 'block';
                    progressContainer.style.display = 'none';
                }
            }, 50);
        };

        // 执行去重
        deduplicateBtn.onclick = () => {
            if (!analysisResult || !analysisResult.duplicates || analysisResult.duplicates.length === 0) {
                alert('请先分析重复图层');
                return;
            }
            
            if (!confirm(`确定要删除 ${analysisResult.duplicates.length} 个重复图层吗？\n\n此操作无法撤销。`)) {
                return;
            }
            
            // 显示进度
            progressContainer.style.display = 'block';
            progressBar.style.width = '0%';
            
            setTimeout(() => {
                try {
                    const duplicates = analysisResult.duplicates;
                    const allLayers = analysisResult.allLayers;
                    const includeGroups = analysisResult.includeGroups;
                    
                    // 从后往前删除，避免索引变化
                    const layersToDelete = new Set();
                    
                    // 标记需要删除的图层（每组重复的第二个图层）
                    duplicates.forEach(dup => {
                        layersToDelete.add(dup.layer2);
                    });
                    
                    progressBar.style.width = '30%';
                    
                    // 获取所有项目以便删除
                    const allItems = app.layerManager.getAllItems();
                    
                    // 删除标记的图层
                    let deletedCount = 0;
                    
                    layersToDelete.forEach(layerToDelete => {
                        // 查找图层在原始结构中的位置
                        let found = false;
                        
                        function removeFromItems(items, target) {
                            for (let i = items.length - 1; i >= 0; i--) {
                                if (items[i] === target) {
                                    items.splice(i, 1);
                                    return true;
                                }
                                if (items[i].isGroup && items[i].children) {
                                    if (removeFromItems(items[i].children, target)) {
                                        return true;
                                    }
                                }
                            }
                            return false;
                        }
                        
                        if (removeFromItems(app.layerManager.layers, layerToDelete)) {
                            deletedCount++;
                        }
                    });
                    
                    progressBar.style.width = '100%';
                    
                    // 更新UI
                    app.renderLayerList();
                    app.render();
                    app.saveHistory();
                    
                    // 显示结果
                    resultArea.innerHTML = `<p style="color: #4CAF50;">✅ 已成功删除 ${deletedCount} 个重复图层！</p>`;
                    
                    // 重置分析结果
                    analysisResult = null;
                    deduplicateBtn.disabled = true;
                    
                    // 隐藏进度条
                    setTimeout(() => {
                        progressContainer.style.display = 'none';
                    }, 500);
                    
                } catch (error) {
                    console.error('去重时出错:', error);
                    resultArea.innerHTML = `<p style="color: #ff6b6b;">去重失败: ${error.message}</p>`;
                    resultArea.style.display = 'block';
                    progressContainer.style.display = 'none';
                }
            }, 50);
        };

        // 取消按钮
        cancelBtn.onclick = () => document.body.removeChild(overlay);

        dialog.appendChild(title);
        dialog.appendChild(content);
        dialog.appendChild(buttons);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // 自动聚焦到误差范围滑块
        setTimeout(() => {
            toleranceSlider.focus();
        }, 10);
    }

    // 工具函数：获取图层中的实际像素差异
    function getLayerDifference(layer1, layer2) {
        if (layer1.canvas.width !== layer2.canvas.width || layer1.canvas.height !== layer2.canvas.height) {
            return 100; // 尺寸不同，返回最大差异
        }

        const width = layer1.canvas.width;
        const height = layer1.canvas.height;
        const totalPixels = width * height;

        if (totalPixels === 0) return 0;

        const data1 = layer1.ctx.getImageData(0, 0, width, height).data;
        const data2 = layer2.ctx.getImageData(0, 0, width, height).data;

        let diffCount = 0;

        for (let i = 0; i < data1.length; i += 4) {
            if (data1[i] !== data2[i] ||
                data1[i + 1] !== data2[i + 1] ||
                data1[i + 2] !== data2[i + 2] ||
                data1[i + 3] !== data2[i + 3]) {
                diffCount++;
            }
        }

        return (diffCount / totalPixels) * 100;
    }
})();
