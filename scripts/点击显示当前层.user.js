// ==UserScript==
// @name         PhotoShop - 点击显示当前层
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @description  在工具选项栏添加复选框，点击图层/文件夹时可以只显示当前项
// @author       风的影子
// @match        file://*/PhotoShop/index.html
// @match        http://127.0.0.1:5500/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    console.log('[点击显示当前层] 脚本开始执行...');

    // 初始化函数
    function initPlugin() {
        const app = window.photoShopApp;
        if (!app) {
            console.log('[点击显示当前层] PhotoShop应用未加载，等待中...');
            return false;
        }

        console.log('[点击显示当前层] 插件已加载');

        // 在工具选项栏中添加复选框
        const toolOptionsBar = document.getElementById('toolOptionsBar');
        if (!toolOptionsBar) {
            console.error('[点击显示当前层] 工具选项栏未找到');
            return false;
        }

        // 创建选项容器
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'tool-options';
        optionsDiv.id = 'showCurrentLayerOptions';
        optionsDiv.style.display = 'flex';
        optionsDiv.style.alignItems = 'center';
        optionsDiv.style.gap = '5px';
        optionsDiv.style.marginLeft = 'auto'; // 推到右侧

        // 创建复选框
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'showCurrentLayerOnly';
        checkbox.style.cursor = 'pointer';

        // 创建标签
        const label = document.createElement('label');
        label.htmlFor = 'showCurrentLayerOnly';
        label.textContent = '点击显示当前层';
        label.style.cursor = 'pointer';
        label.style.userSelect = 'none';

        // 创建"显示所有图层"按钮
        const showAllButton = document.createElement("button");
        showAllButton.id = "showAllLayersButton";
        showAllButton.textContent = "显示所有图层";

        optionsDiv.appendChild(checkbox);
        optionsDiv.appendChild(label);
        optionsDiv.appendChild(showAllButton);
        toolOptionsBar.appendChild(optionsDiv);

        // 检查初始状态并设置按钮文本
        function updateShowAllButtonText() {
            let allVisible = true;
            
            function checkAllVisible(items) {
                for (const item of items) {
                    if (!item.visible) {
                        allVisible = false;
                        return;
                    }
                    if (item.isGroup && item.children) {
                        checkAllVisible(item.children);
                    }
                    if (!allVisible) return;
                }
            }
            
            checkAllVisible(app.layerManager.layers);
            showAllButton.textContent = allVisible ? "隐藏所有图层" : "显示所有图层";
        }
        
        // 初始设置按钮文本
        updateShowAllButtonText();

        // 存储原始可见性状态
        let originalVisibilityState = null;

        // 保存所有图层的可见性状态
        function saveVisibilityState() {
            const state = new Map();

            function traverse(items) {
                for (const item of items) {
                    state.set(item, item.visible);
                    if (item.isGroup && item.children) {
                        traverse(item.children);
                    }
                }
            }

            traverse(app.layerManager.layers);
            return state;
        }

        // 恢复所有图层的可见性状态
        function restoreVisibilityState(state) {
            if (!state) return;

            function traverse(items) {
                for (const item of items) {
                    if (state.has(item)) {
                        item.visible = state.get(item);
                    }
                    if (item.isGroup && item.children) {
                        traverse(item.children);
                    }
                }
            }

            traverse(app.layerManager.layers);
        }

        // 隐藏所有图层
        function hideAllLayers() {
            function traverse(items) {
                for (const item of items) {
                    item.visible = false;
                    if (item.isGroup && item.children) {
                        traverse(item.children);
                    }
                }
            }

            traverse(app.layerManager.layers);
        }

        // 显示指定项及其父级
        function showItemAndParents(item) {
            if (!item) return;

            // 显示当前项
            item.visible = true;

            // 如果是文件夹，显示其所有子项
            if (item.isGroup && item.children) {
                function showChildren(group) {
                    for (const child of group.children) {
                        child.visible = true;
                        if (child.isGroup && child.children) {
                            showChildren(child);
                        }
                    }
                }
                showChildren(item);
            }

            // 显示所有父级
            let parent = item.parent;
            while (parent) {
                parent.visible = true;
                parent = parent.parent;
            }
        }

        // 处理图层点击事件
        function handleLayerClick(item) {
            console.log('[点击显示当前层] handleLayerClick 被调用, checkbox.checked:', checkbox.checked, 'item:', item?.name);

            if (!checkbox.checked) {
                console.log('[点击显示当前层] 复选框未勾选，跳过处理');
                return;
            }

            // 如果是第一次点击，保存原始状态
            if (!originalVisibilityState) {
                console.log('[点击显示当前层] 保存原始可见性状态');
                originalVisibilityState = saveVisibilityState();
            }

            console.log('[点击显示当前层] 隐藏所有图层');
            // 隐藏所有图层
            hideAllLayers();

            console.log('[点击显示当前层] 显示当前项及其父级/子级');
            // 只显示当前项及其父级
            showItemAndParents(item);

            console.log('[点击显示当前层] 重新渲染');
            // 重新渲染
            app.renderLayerList();
            app.render();

            console.log('[点击显示当前层] 处理完成');
        }

        // 复选框状态改变时的处理
        checkbox.addEventListener('change', (e) => {
            console.log('[点击显示当前层] 复选框状态改变:', e.target.checked);

            if (!e.target.checked) {
                // 取消勾选时，恢复原始可见性状态
                console.log('[点击显示当前层] 取消勾选，恢复原始状态');
                if (originalVisibilityState) {
                    restoreVisibilityState(originalVisibilityState);
                    originalVisibilityState = null;
                    app.renderLayerList();
                    app.render();
                }
            } else {
                // 勾选时，立即应用到当前活动项
                console.log('[点击显示当前层] 勾选，应用到当前活动项');
                const activeItem = app.layerManager.activeItem;
                console.log('[点击显示当前层] 当前活动项:', activeItem?.name);
                if (activeItem) {
                    handleLayerClick(activeItem);
                }
            }
            
            // 更新按钮文本
            updateShowAllButtonText();
        });

        // "显示所有图层"按钮点击处理 - 现在支持切换功能
        showAllButton.addEventListener("click", () => {
            console.log("[点击显示当前层] 显示所有图层按钮被点击");
            
            // 取消勾选"点击显示当前层"复选框
            checkbox.checked = false;
            
            // 检查当前是否所有图层都可见
            let allVisible = true;
            
            function checkAllVisible(items) {
                for (const item of items) {
                    if (!item.visible) {
                        allVisible = false;
                        // 不需要继续检查了
                        return;
                    }
                    if (item.isGroup && item.children) {
                        checkAllVisible(item.children);
                    }
                    if (!allVisible) return;
                }
            }
            
            checkAllVisible(app.layerManager.layers);
            
            if (allVisible) {
                // 如果所有图层都可见，则隐藏所有图层
                console.log("[点击显示当前层] 当前所有图层可见，切换为隐藏所有图层");
                
                // 保存当前状态（全部隐藏状态）
                originalVisibilityState = saveVisibilityState();
                
                function hideAllLayersNow(items) {
                    for (const item of items) {
                        item.visible = false;
                        if (item.isGroup && item.children) {
                            hideAllLayersNow(item.children);
                        }
                    }
                }
                
                hideAllLayersNow(app.layerManager.layers);
                showAllButton.textContent = "显示所有图层";
            } else {
                // 如果有图层不可见，则显示所有图层
                console.log("[点击显示当前层] 有图层不可见，显示所有图层");
                
                // 恢复所有图层的原始可见性状态
                if (originalVisibilityState) {
                    console.log("[点击显示当前层] 恢复原始可见性状态");
                    restoreVisibilityState(originalVisibilityState);
                    originalVisibilityState = null;
                } else {
                    // 如果没有保存过原始状态，则显示所有图层
                    console.log("[点击显示当前层] 显示所有图层");
                    function showAllLayers(items) {
                        for (const item of items) {
                            item.visible = true;
                            if (item.isGroup && item.children) {
                                showAllLayers(item.children);
                            }
                        }
                    }
                    showAllLayers(app.layerManager.layers);
                }
                showAllButton.textContent = "隐藏所有图层";
            }
            
            // 重新渲染
            app.renderLayerList();
            app.render();
            console.log("[点击显示当前层] 处理完成");
            
            // 更新按钮文本
            updateShowAllButtonText();
        });

        // 拦截图层点击事件
        const originalRenderLayerList = app.renderLayerList.bind(app);
        app.renderLayerList = function() {
            console.log('[点击显示当前层] renderLayerList 被调用');

            // 调用原始方法
            originalRenderLayerList();

            // 为所有图层项添加点击监听器
            const layerItems = document.querySelectorAll('.layer-item');
            console.log('[点击显示当前层] 找到图层项数量:', layerItems.length);

            layerItems.forEach(layerItem => {
                // 移除旧的监听器（如果有）
                const oldOnClick = layerItem.onclick;

                layerItem.onclick = function(e) {
                    console.log('[点击显示当前层] 图层项被点击');

                    // 调用原始点击处理
                    if (oldOnClick) {
                        oldOnClick.call(this, e);
                    }

                    // 如果启用了"点击显示当前层"，处理可见性
                    if (checkbox.checked) {
                        console.log('[点击显示当前层] 复选框已勾选，处理可见性');
                        const itemId = layerItem.dataset.itemId;
                        console.log('[点击显示当前层] itemId:', itemId);

                        if (itemId) {
                            // 查找对应的图层/文件夹对象
                            function findItemById(items, id) {
                                for (const item of items) {
                                    if (app.getItemId(item) === id) {
                                        return item;
                                    }
                                    if (item.isGroup && item.children) {
                                        const found = findItemById(item.children, id);
                                        if (found) return found;
                                    }
                                }
                                return null;
                            }

                            const item = findItemById(app.layerManager.layers, itemId);
                            console.log('[点击显示当前层] 找到的项:', item?.name);

                            if (item) {
                                handleLayerClick(item);
                            }
                        }
                    } else {
                        console.log('[点击显示当前层] 复选框未勾选，跳过可见性处理');
                    }
                };

                // 为文件夹图标和缩略图添加特殊处理
                const folderIcon = layerItem.querySelector('.layer-folder-icon');
                const thumb = layerItem.querySelector('.layer-thumb');

                if (folderIcon) {
                    const oldFolderClick = folderIcon.onclick;
                    folderIcon.onclick = function(e) {
                        // 不阻止事件冒泡，让父元素的点击事件也能触发
                        if (oldFolderClick) {
                            oldFolderClick.call(this, e);
                        }
                    };
                }

                if (thumb) {
                    const oldThumbClick = thumb.onclick;
                    thumb.onclick = function(e) {
                        // 如果按住Ctrl，执行原始的选区功能
                        if (e.ctrlKey) {
                            if (oldThumbClick) {
                                oldThumbClick.call(this, e);
                            }
                            e.stopPropagation();
                            return;
                        }

                        // 否则不阻止事件冒泡，让父元素的点击事件触发
                    };
                }
            });
        };

        // 初始渲染
        app.renderLayerList();

        console.log('[点击显示当前层] 插件初始化完成');
        return true;
    }

    // 尝试初始化，如果失败则轮询等待
    function tryInit() {
        if (!initPlugin()) {
            // 每100ms检查一次，最多等待10秒
            let attempts = 0;
            const maxAttempts = 100;
            const interval = setInterval(() => {
                attempts++;
                if (initPlugin()) {
                    clearInterval(interval);
                } else if (attempts >= maxAttempts) {
                    clearInterval(interval);
                    console.error('[点击显示当前层] PhotoShop应用加载超时');
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
})();
