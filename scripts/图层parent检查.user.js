// ==UserScript==
// @name         PhotoShop - 图层parent检查
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  检查所有图层和文件夹的parent关系是否正确设置，识别和修复不一致
// @author       风的影子
// @match        file://*/PhotoShop/index.html
// @match        file://*/PhotoShop/PhotoShop.html
// @match        http://127.0.0.1:5500/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    console.log('图层parent检查脚本开始执行...');

    // 初始化函数
    function initPlugin() {
        const app = window.photoShopApp;
        if (!app) {
            console.log('PhotoShop应用未加载，等待中...');
            return false;
        }

        console.log('图层parent检查插件已加载');

        // 添加图层parent检查菜单项
        app.menuManager.addMenuItem('帮助', {
            label: '图层parent检查...',
            action: 'check-parent-integrity',
            handler: (app) => {
                showParentCheckDialog(app);
            },
            position: 'bottom',
            divider: false
        });

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
     * 显示parent检查对话框
     * @param {Object} app - PhotoShop应用实例
     */
    function showParentCheckDialog(app) {
        // 创建对话框
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'dialog-box';
        dialog.style.width = '600px';

        const title = document.createElement('div');
        title.className = 'dialog-title';
        title.textContent = '图层parent关系检查';

        const content = document.createElement('div');
        content.style.padding = '15px';
        content.style.maxHeight = '400px';
        content.style.overflowY = 'auto';

        // 状态信息
        const statusInfo = document.createElement('div');
        statusInfo.style.marginBottom = '15px';
        statusInfo.style.padding = '10px';
        statusInfo.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        statusInfo.style.borderRadius = '4px';

        // 检查按钮
        const checkButton = document.createElement('button');
        checkButton.textContent = '开始检查';
        checkButton.className = 'dialog-btn';
        checkButton.style.marginBottom = '15px';
        checkButton.onclick = () => {
            const results = checkParentIntegrity(app);
            displayResults(statusInfo, results, app);
        };

        // 修复按钮
        const fixButton = document.createElement('button');
        fixButton.textContent = '自动修复问题';
        fixButton.className = 'dialog-btn dialog-btn-ok';
        fixButton.style.marginLeft = '10px';
        fixButton.style.marginBottom = '15px';
        fixButton.onclick = () => {
            const results = checkParentIntegrity(app);
            const fixed = fixParentIssues(app, results);
            if (fixed) {
                checkButton.click(); // 重新检查
            }
        };

        // 按钮容器
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.marginBottom = '15px';
        buttonContainer.appendChild(checkButton);
        buttonContainer.appendChild(fixButton);

        content.appendChild(buttonContainer);
        content.appendChild(statusInfo);

        // 按钮
        const buttons = document.createElement('div');
        buttons.className = 'dialog-buttons';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '关闭';
        closeBtn.className = 'dialog-btn dialog-btn-cancel';
        closeBtn.onclick = () => {
            document.body.removeChild(overlay);
        };

        buttons.appendChild(closeBtn);

        dialog.appendChild(title);
        dialog.appendChild(content);
        dialog.appendChild(buttons);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // 初始状态
        statusInfo.innerHTML = '<div style="color: #aaa">点击"开始检查"按钮开始检查图层parent关系</div>';

        // ESC键关闭
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                closeBtn.click();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    }

    /**
     * 检查所有图层和文件夹的parent关系
     * @param {Object} app - PhotoShop应用实例
     * @returns {Array} 问题列表
     */
    function checkParentIntegrity(app) {
        const issues = [];
        const checkedItems = new Set();
        const layerManager = app.layerManager;

        // 递归遍历所有项目
        const traverseItems = (items, parentPath = '') => {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const itemPath = parentPath ? `${parentPath}/${item.name}` : item.name;

                // 检查1: 避免循环引用
                if (checkedItems.has(item)) {
                    issues.push({
                        type: 'circular_reference',
                        item: item,
                        path: itemPath,
                        message: '检测到循环引用 - 项目被多次引用'
                    });
                    continue;
                }
                checkedItems.add(item);

                // 检查2: 父节点一致性
                if (item.parent) {
                    // 检查父节点是否有children数组
                    if (!item.parent.children || !Array.isArray(item.parent.children)) {
                        issues.push({
                            type: 'invalid_parent',
                            item: item,
                            path: itemPath,
                            message: '父节点的children属性无效或不存在'
                        });
                    } else {
                        // 检查当前项是否在其父节点的children数组中
                        const parentIndex = item.parent.children.indexOf(item);
                        if (parentIndex === -1) {
                            issues.push({
                                type: 'orphaned_child',
                                item: item,
                                path: itemPath,
                                message: '项目在其父节点的children数组中不存在'
                            });
                        }
                    }

                    // 检查3: 父节点是否有removeChild方法
                    if (!item.parent.removeChild || typeof item.parent.removeChild !== 'function') {
                        issues.push({
                            type: 'missing_removechild',
                            item: item,
                            path: itemPath,
                            message: '父节点缺少removeChild方法'
                        });
                        console.log("父节点缺少removeChild方法", item);
                    }

                    // 检查4: 父节点是否有addChild方法
                    if (!item.parent.addChild || typeof item.parent.addChild !== 'function') {
                        issues.push({
                            type: 'missing_addchild',
                            item: item,
                            path: itemPath,
                            message: '父节点缺少addChild方法'
                        });
                    }

                    // 检查5: parent属性是否正确指向
                    if (item.parent === item) {
                        issues.push({
                            type: 'self_parent',
                            item: item,
                            path: itemPath,
                            message: '项目的parent指向自身'
                        });
                    }
                } else {
                    // 根级项目检查
                    const rootIndex = layerManager.layers.indexOf(item);
                    if (rootIndex === -1) {
                        issues.push({
                            type: 'floating_item',
                            item: item,
                            path: itemPath,
                            message: '项目没有parent但也不在根级列表中'
                        });
                    }
                }

                // 递归检查子项（如果是组）
                if (item.isGroup && item.children) {
                    traverseItems(item.children, itemPath);
                }
            }
        };

        // 从根级开始遍历
        traverseItems(layerManager.layers);

        // 检查孤立的项目（在checkedItems中但不在遍历树中）
        const allItems = getAllItemsRecursive(layerManager.layers);
        allItems.forEach(item => {
            if (!checkedItems.has(item) && !issues.some(issue => issue.item === item)) {
                issues.push({
                    type: 'unreachable_item',
                    item: item,
                    path: getItemPath(item),
                    message: '项目不可达（可能存在于循环引用中）'
                });
            }
        });

        return issues;
    }

    /**
     * 递归获取所有项目
     * @param {Array} items - 项目数组
     * @returns {Array} 所有项目
     */
    function getAllItemsRecursive(items) {
        const allItems = [];
        
        const traverse = (itemList) => {
            for (const item of itemList) {
                allItems.push(item);
                if (item.isGroup && item.children) {
                    traverse(item.children);
                }
            }
        };
        
        traverse(items);
        return allItems;
    }

    /**
     * 获取项目的完整路径
     * @param {Object} item - 项目
     * @returns {string} 路径
     */
    function getItemPath(item) {
        const pathSegments = [];
        let current = item;
        
        while (current) {
            pathSegments.unshift(current.name);
            current = current.parent;
        }
        
        return pathSegments.join('/');
    }

    /**
     * 显示检查结果
     * @param {HTMLElement} container - 结果容器
     * @param {Array} results - 检查结果
     * @param {Object} app - PhotoShop应用实例
     */
    function displayResults(container, results, app) {
        if (results.length === 0) {
            container.innerHTML = `
                <div style="color: #4CAF50; font-weight: bold; margin-bottom: 10px;">
                    ✓ 检查完成，未发现parent关系问题
                </div>
                <div style="color: #aaa; font-size: 12px;">
                    共检查了 ${getTotalItemCount(app.layerManager)} 个项目
                </div>
            `;
            return;
        }

        let html = `
            <div style="color: #ff9800; font-weight: bold; margin-bottom: 10px;">
                ⚠ 发现 ${results.length} 个parent关系问题
            </div>
            <div style="color: #aaa; font-size: 12px; margin-bottom: 15px;">
                共检查了 ${getTotalItemCount(app.layerManager)} 个项目
            </div>
        `;

        // 按问题类型分组
        const issuesByType = {};
        results.forEach(issue => {
            if (!issuesByType[issue.type]) {
                issuesByType[issue.type] = [];
            }
            issuesByType[issue.type].push(issue);
        });

        // 显示每种类型的问题
        Object.entries(issuesByType).forEach(([type, typeIssues]) => {
            const typeName = getIssueTypeName(type);
            html += `
                <div style="margin-bottom: 10px;">
                    <div style="color: #ff5722; font-weight: bold; margin-bottom: 5px;">
                        ${typeName} (${typeIssues.length}个)
                    </div>
            `;

            typeIssues.forEach(issue => {
                const itemType = issue.item.isGroup ? '文件夹' : '图层';
                html += `
                    <div style="font-size: 12px; margin-left: 10px; margin-bottom: 3px;">
                        <span style="color: #aaa">${itemType}:</span> 
                        <span style="color: #ddd">${issue.path}</span>
                        <br>
                        <span style="color: #ff9800; font-size: 11px;">${issue.message}</span>
                    </div>
                `;
            });

            html += `</div>`;
        });

        container.innerHTML = html;
    }

    /**
     * 获取问题类型的中文名称
     * @param {string} type - 问题类型
     * @returns {string} 中文名称
     */
    function getIssueTypeName(type) {
        const typeNames = {
            'circular_reference': '循环引用',
            'invalid_parent': '无效的父节点',
            'orphaned_child': '孤立的子项',
            'missing_removechild': '缺少removeChild方法',
            'missing_addchild': '缺少addChild方法',
            'self_parent': '自身作为父节点',
            'floating_item': '悬浮的项目',
            'unreachable_item': '不可达的项目'
        };
        return typeNames[type] || type;
    }

    /**
     * 自动修复parent问题
     * @param {Object} app - PhotoShop应用实例
     * @param {Array} issues - 问题列表
     * @returns {boolean} 是否修复成功
     */
    function fixParentIssues(app, issues) {
        const layerManager = app.layerManager;
        let fixedCount = 0;

        issues.forEach(issue => {
            try {
                switch (issue.type) {
                    case 'orphaned_child':
                        // 对于孤立的子项，重新添加到父节点的children数组
                        if (issue.item.parent && issue.item.parent.children) {
                            if (issue.item.parent.children.indexOf(issue.item) === -1) {
                                issue.item.parent.children.push(issue.item);
                                fixedCount++;
                            }
                        }
                        break;

                    case 'invalid_parent':
                        // 对于无效的父节点，尝试修复父节点的children数组
                        if (issue.item.parent && !issue.item.parent.children) {
                            issue.item.parent.children = [];
                            if (issue.item.parent.children.indexOf(issue.item) === -1) {
                                issue.item.parent.children.push(issue.item);
                                fixedCount++;
                            }
                        }
                        break;

                    case 'floating_item':
                        // 对于悬浮的项目，添加到根级
                        if (!issue.item.parent && layerManager.layers.indexOf(issue.item) === -1) {
                            layerManager.layers.push(issue.item);
                            fixedCount++;
                        }
                        break;

                    case 'circular_reference':
                    case 'self_parent':
                        // 对于循环引用或自身作为父节点，清除parent
                        if (issue.item.parent === issue.item) {
                            issue.item.parent = null;
                            fixedCount++;
                        }
                        break;
                }
            } catch (error) {
                console.error(`修复问题时出错: ${error.message}`, issue);
            }
        });

        if (fixedCount > 0) {
            // 更新UI
            app.renderLayerList();
            app.saveHistory();
            
            alert(`成功修复了 ${fixedCount} 个问题`);
            return true;
        }

        alert('没有需要修复的问题或自动修复失败');
        return false;
    }

    /**
     * 获取总项目数
     * @param {Object} layerManager - 图层管理器
     * @returns {number} 项目总数
     */
    function getTotalItemCount(layerManager) {
        const traverse = (items) => {
            let count = items.length;
            for (const item of items) {
                if (item.isGroup && item.children) {
                    count += traverse(item.children);
                }
            }
            return count;
        };
        
        return traverse(layerManager.layers);
    }

})();