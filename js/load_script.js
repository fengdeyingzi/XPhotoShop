
// ==================== GM API 模拟器 ====================
// 创建全局GM对象以模拟油猴API
window.GM = {
    // 模拟 GM_xmlhttpRequest
    xmlhttpRequest: function (details) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.open(details.method || 'GET', details.url, true);

            // 设置请求头
            if (details.headers) {
                Object.keys(details.headers).forEach(key => {
                    xhr.setRequestHeader(key, details.headers[key]);
                });
            }

            // 设置响应类型
            if (details.responseType) {
                xhr.responseType = details.responseType;
            }

            // 事件处理
            xhr.onload = function () {
                resolve({
                    status: xhr.status,
                    statusText: xhr.statusText,
                    responseText: xhr.responseText,
                    response: xhr.response,
                    readyState: xhr.readyState,
                    finalUrl: xhr.responseURL
                });
            };

            xhr.onerror = function () {
                reject(new Error('GM_xmlhttpRequest failed'));
            };

            xhr.ontimeout = function () {
                reject(new Error('GM_xmlhttpRequest timeout'));
            };

            // 超时设置
            if (details.timeout) {
                xhr.timeout = details.timeout;
            }

            // 发送请求
            xhr.send(details.data || null);
        });
    },

    // 模拟 GM_addStyle
    addStyle: function (css) {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
        return style;
    },

    // 其他GM API可以在这里添加
    getValue: function (key, defaultValue) {
        const value = localStorage.getItem(`GM_${key}`);
        return value !== null ? JSON.parse(value) : defaultValue;
    },

    setValue: function (key, value) {
        localStorage.setItem(`GM_${key}`, JSON.stringify(value));
    },

    // 日志函数
    log: function (...args) {
        console.log('[GM Script]', ...args);
    }
};

// 为兼容性，也直接暴露在全局作用域
window.GM_xmlhttpRequest = window.GM.xmlhttpRequest;
window.GM_addStyle = window.GM.addStyle;

// ==================== 脚本加载器 ====================
class UserscriptLoader {
    constructor() {
        this.loadedScripts = new Set();
        this.requireCache = new Map();
        this.loaderElement = document.getElementById('script-loader');
    }

    // 解析油猴脚本头部
    parseMetadata(scriptContent) {
        const metadata = {
            name: '未命名脚本',
            namespace: '',
            version: '1.0',
            description: '',
            author: '',
            match: [],
            grant: [],
            require: [],
            icon: '',
            rawContent: scriptContent
        };

        const metaStart = scriptContent.indexOf('==UserScript==');
        const metaEnd = scriptContent.indexOf('==/UserScript==');

        if (metaStart !== -1 && metaEnd !== -1) {
            const metaBlock = scriptContent.substring(metaStart + 14, metaEnd);
            const lines = metaBlock.split('\n');

            lines.forEach(line => {
                line = line.trim();
                if (line.startsWith('// @')) {
                    const parts = line.substring(4).split(/\s+/);
                    const key = parts[0];
                    const value = parts.slice(1).join(' ').trim();

                    switch (key) {
                        case 'name':
                            metadata.name = value;
                            break;
                        case 'namespace':
                            metadata.namespace = value;
                            break;
                        case 'version':
                            metadata.version = value;
                            break;
                        case 'description':
                            metadata.description = value;
                            break;
                        case 'author':
                            metadata.author = value;
                            break;
                        case 'match':
                        case 'include':
                            metadata.match.push(value);
                            break;
                        case 'grant':
                            metadata.grant.push(value);
                            break;
                        case 'require':
                            metadata.require.push(value);
                            break;
                        case 'icon':
                        case 'iconURL':
                            metadata.icon = value;
                            break;
                    }
                }
            });

            // 提取实际代码（去掉元数据部分）
            const codeStart = scriptContent.indexOf('\n', metaEnd + 15) + 1;
            metadata.code = scriptContent.substring(codeStart);
        } else {
            // 没有元数据块，整个内容都是代码
            metadata.code = scriptContent;
        }

        return metadata;
    }

    // 加载外部依赖（@require）
    async loadRequire(url) {
        // 检查缓存
        if (this.requireCache.has(url)) {
            return this.requireCache.get(url);
        }

        try {
            console.log(`加载依赖: ${url}`);

            if (url.startsWith('http://') || url.startsWith('https://')) {
                // 远程资源
                const response = await fetch(url, {
                    mode: 'cors',
                    headers: {
                        'Accept': 'application/javascript, text/javascript, */*'
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const scriptContent = await response.text();
                this.requireCache.set(url, scriptContent);
                return scriptContent;
            } else {
                // 本地资源
                const response = await fetch(url);
                const scriptContent = await response.text();
                this.requireCache.set(url, scriptContent);
                return scriptContent;
            }
        } catch (error) {
            console.error(`加载依赖失败: ${url}`, error);
            throw error;
        }
    }

    // 执行JavaScript代码
    executeScript(code, scriptName) {
        try {
            // 使用 Function 构造函数创建独立作用域，并添加 sourceURL 以便调试
            const wrappedCode = `
${code}
//# sourceURL=${scriptName}`;

            const func = new Function('GM', 'GM_xmlhttpRequest', 'GM_addStyle', wrappedCode);
            func(window.GM, window.GM_xmlhttpRequest, window.GM_addStyle);

            return { success: true };
        } catch (error) {
            console.error(`执行插件 ${scriptName} 时出错:`, error);
            return { success: false, error: error.message };
        }
    }

    // 加载并执行一个油猴脚本文件
    async loadUserscript(filename) {

        try {
            // 1. 加载脚本文件
            const response = await fetch(`${filename}`);
            if (!response.ok) {
                throw new Error(`文件不存在: ${filename}`);
            }

            const scriptContent = await response.text();

            // 2. 解析元数据
            const metadata = this.parseMetadata(scriptContent);
            console.log(`解析脚本: ${metadata.name} v${metadata.version}`);

            

            // 3. 加载所有依赖
            for (const requireUrl of metadata.require) {
                console.log(`加载依赖: ${requireUrl}`);
                const requireCode = await this.loadRequire(requireUrl);
                this.executeScript(requireCode, `require: ${requireUrl}`);
            }

            // 4. 检查GM权限并设置
            for (const grant of metadata.grant) {
                if (grant === 'GM_xmlhttpRequest' && !window.GM_xmlhttpRequest) {
                    console.warn(`脚本 ${metadata.name} 需要 GM_xmlhttpRequest，但该API未完全实现`);
                } else if (grant === 'GM_addStyle' && !window.GM_addStyle) {
                    console.warn(`脚本 ${metadata.name} 需要 GM_addStyle，但该API未完全实现`);
                } else if (grant === 'none') {
                    // 无特殊权限要求
                } else if (grant.startsWith('GM_')) {
                    console.log(`脚本需要权限: ${grant}`);
                }
            }

            // 5. 执行主脚本代码
            const result = this.executeScript(metadata.code, metadata.name);

            if (result.success) {
                this.loadedScripts.add(filename);
                console.log(`✓ 脚本加载成功:  ${metadata.name} v${metadata.version}`);
                return true;
            } else {
                throw new Error(`执行失败: ${result.error}`);
            }

        } catch (error) {
            console.error(`脚本加载失败: ${filename}`, error);
            Toast.show(`插件加载失败: ${filename} 错误: ${error.message}`, 'error', 5000);
            return false;
        }
    }

    // 批量加载scripts文件夹下的所有js文件
    async loadAllScripts() {
        try {
            // 获取scripts文件夹下的文件列表
            // 注意：这需要服务器支持目录列表，或者你有预定义的文件列表
            const scriptFiles = await this.getScriptFileList();

            let successCount = 0;
            let failCount = 0;

            for (const filename of scriptFiles) {
                if (filename.endsWith('.user.js') || filename.endsWith('.js')) {
                    const result = await this.loadUserscript(filename);
                    if (result) {
                        successCount++;
                    } else {
                        failCount++;
                    }
                }
            }

            // 更新状态 xldebug
            const statusElement = document.getElementById('loader-status');
            statusElement.innerHTML = `加载完成 成功: ${successCount} 失败: ${failCount}`;
            // 隐藏statusElement
            statusElement.style.display = 'none';
            Toast.show(`插件加载完成: 成功 ${successCount}, 失败 ${failCount}`, failCount > 0 ? 'error' : 'success', 3000);


        } catch (error) {
            console.error('加载插件失败:', error);
        }
    }

    // 获取插件文件列表
    async getScriptFileList() {
        // 方法1: 如果你有预定义的文件列表
        var predefinedList = [
            // 'scripts/图层裁剪.user.js'
            // 添加你的脚本文件名
        ];

        // 方法2: 尝试从服务器获取文件列表（需要服务器支持）
        try {
            const response = await fetch('scripts/filelist.json');
            if (response.ok) {
                const fileList = await response.json();
                //添加到预定义列表中
                predefinedList = predefinedList.concat(fileList);
            }
        } catch (error) {
            console.log('使用预定义插件列表');
        }

        // 方法3: 如果你使用特定命名规则，可以动态生成
        // 例如: plugin-*.user.js

        return predefinedList;
    }
}

// ==================== 初始化加载器 ====================
document.addEventListener('DOMContentLoaded', async () => {
    // 给页面一点时间加载
    await new Promise(resolve => setTimeout(resolve, 500));

    const loader = new UserscriptLoader();
    await loader.loadAllScripts();
});
