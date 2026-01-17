// ==UserScript==
// @name         纹理生成器
// @namespace    http://tampermonkey.net/
// @version      1.0
// @author       风的影子
// @description  程序化纹理生成工具，支持多种材质类型和无缝平铺
// @match        file://*/PhotoShop/index.html
// @match        file://*/PhotoShop/PhotoShop.html
// @match        http://127.0.0.1:5500/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function init() {
        const app = window.photoShopApp;
        if (!app) {
            setTimeout(init, 100);
            return;
        }

        // 简化的噪声生成器
        class NoiseGenerator {
            constructor(seed = 0) {
                this.seed = seed;
            }

            random(x, y) {
                const n = Math.sin(x * 12.9898 + y * 78.233 + this.seed) * 43758.5453;
                return n - Math.floor(n);
            }

            noise(x, y) {
                const xi = Math.floor(x);
                const yi = Math.floor(y);
                const xf = x - xi;
                const yf = y - yi;

                const a = this.random(xi, yi);
                const b = this.random(xi + 1, yi);
                const c = this.random(xi, yi + 1);
                const d = this.random(xi + 1, yi + 1);

                const u = xf * xf * (3 - 2 * xf);
                const v = yf * yf * (3 - 2 * yf);

                return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
            }

            fbm(x, y, octaves = 4) {
                let value = 0;
                let amplitude = 1;
                let frequency = 1;
                let maxValue = 0;

                for (let i = 0; i < octaves; i++) {
                    value += this.noise(x * frequency, y * frequency) * amplitude;
                    maxValue += amplitude;
                    amplitude *= 0.5;
                    frequency *= 2;
                }

                return value / maxValue;
            }
        }

        // 纹理生成器
        const textureGenerators = {
            // 金属纹理
            metal: (width, height, params) => {
                const noise = new NoiseGenerator(params.seed);
                const imageData = new ImageData(width, height);
                const data = imageData.data;

                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const nx = x / width * params.scale;
                        const ny = y / height * params.scale;

                        const n = noise.fbm(nx, ny, 3);
                        const brushed = Math.abs(Math.sin(nx * 50)) * 0.3;
                        const value = Math.floor((n * 0.7 + brushed) * 255);

                        const idx = (y * width + x) * 4;
                        data[idx] = value;
                        data[idx + 1] = value;
                        data[idx + 2] = value + 20;
                        data[idx + 3] = 255;
                    }
                }
                return imageData;
            },

            // 岩石纹理
            rock: (width, height, params) => {
                const noise = new NoiseGenerator(params.seed);
                const imageData = new ImageData(width, height);
                const data = imageData.data;

                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const nx = x / width * params.scale;
                        const ny = y / height * params.scale;

                        const n1 = noise.fbm(nx, ny, 5);
                        const n2 = noise.fbm(nx * 2, ny * 2, 3);
                        const value = Math.floor((n1 * 0.7 + n2 * 0.3) * 180 + 40);

                        const idx = (y * width + x) * 4;
                        data[idx] = value - 20;
                        data[idx + 1] = value - 10;
                        data[idx + 2] = value;
                        data[idx + 3] = 255;
                    }
                }
                return imageData;
            },

            // 织物纹理
            fabric: (width, height, params) => {
                const noise = new NoiseGenerator(params.seed);
                const imageData = new ImageData(width, height);
                const data = imageData.data;

                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const nx = x / width * params.scale;
                        const ny = y / height * params.scale;

                        const weave = Math.sin(nx * 40) * Math.sin(ny * 40);
                        const n = noise.fbm(nx, ny, 2);
                        const value = Math.floor((n * 0.5 + weave * 0.3 + 0.5) * 200 + 30);

                        const idx = (y * width + x) * 4;
                        data[idx] = value;
                        data[idx + 1] = value - 10;
                        data[idx + 2] = value - 20;
                        data[idx + 3] = 255;
                    }
                }
                return imageData;
            },

            // 木纹纹理
            wood: (width, height, params) => {
                const noise = new NoiseGenerator(params.seed);
                const imageData = new ImageData(width, height);
                const data = imageData.data;

                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const nx = x / width * params.scale;
                        const ny = y / height * params.scale;

                        const dist = Math.sqrt(nx * nx + ny * ny);
                        const ring = Math.sin(dist * 20 + noise.fbm(nx, ny, 2) * 5);
                        const value = Math.floor((ring * 0.5 + 0.5) * 100 + 80);

                        const idx = (y * width + x) * 4;
                        data[idx] = value + 40;
                        data[idx + 1] = value + 20;
                        data[idx + 2] = value;
                        data[idx + 3] = 255;
                    }
                }
                return imageData;
            },

            // 云纹理
            clouds: (width, height, params) => {
                const noise = new NoiseGenerator(params.seed);
                const imageData = new ImageData(width, height);
                const data = imageData.data;

                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const nx = x / width * params.scale;
                        const ny = y / height * params.scale;

                        const n = noise.fbm(nx, ny, 6);
                        const value = Math.floor(n * 255);

                        const idx = (y * width + x) * 4;
                        data[idx] = value;
                        data[idx + 1] = value;
                        data[idx + 2] = value;
                        data[idx + 3] = 255;
                    }
                }
                return imageData;
            },

            // 大理石纹理
            marble: (width, height, params) => {
                const noise = new NoiseGenerator(params.seed);
                const imageData = new ImageData(width, height);
                const data = imageData.data;

                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const nx = x / width * params.scale;
                        const ny = y / height * params.scale;

                        const n = noise.fbm(nx, ny, 4);
                        const marble = Math.sin((nx + n * 2) * 10);
                        const value = Math.floor((marble * 0.5 + 0.5) * 200 + 50);

                        const idx = (y * width + x) * 4;
                        data[idx] = value;
                        data[idx + 1] = value - 10;
                        data[idx + 2] = value - 5;
                        data[idx + 3] = 255;
                    }
                }
                return imageData;
            }
        };

        // 显示纹理生成对话框
        function showTextureDialog() {
            const layer = app.layerManager.getActiveLayer();
            if (!layer) {
                Toast.show('请先选择一个图层', 'warning');
                return;
            }

            const dialog = document.createElement('div');
            dialog.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #2a2a2a;
                border: 1px solid #555;
                padding: 20px;
                border-radius: 8px;
                z-index: 10000;
                color: #fff;
                min-width: 300px;
            `;

            dialog.innerHTML = `
                <h3 style="margin-top: 0;">纹理生成器</h3>
                <div style="margin-bottom: 15px;">
                    <label>纹理类型：</label>
                    <select id="textureType" style="width: 100%; padding: 5px; margin-top: 5px;">
                        <option value="metal">金属</option>
                        <option value="rock">岩石</option>
                        <option value="fabric">织物</option>
                        <option value="wood">木纹</option>
                        <option value="clouds">云</option>
                        <option value="marble">大理石</option>
                    </select>
                </div>
                <div style="margin-bottom: 15px;">
                    <label>缩放：</label>
                    <input type="range" id="textureScale" min="1" max="20" value="5" style="width: 100%;">
                    <span id="scaleValue">5</span>
                </div>
                <div style="margin-bottom: 15px;">
                    <label>随机种子：</label>
                    <input type="number" id="textureSeed" value="0" style="width: 100%; padding: 5px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label>
                        <input type="checkbox" id="seamless" checked>
                        无缝平铺
                    </label>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button id="generateBtn" style="flex: 1; padding: 8px;">生成</button>
                    <button id="cancelBtn" style="flex: 1; padding: 8px;">取消</button>
                </div>
            `;

            document.body.appendChild(dialog);

            const scaleInput = dialog.querySelector('#textureScale');
            const scaleValue = dialog.querySelector('#scaleValue');
            scaleInput.addEventListener('input', () => {
                scaleValue.textContent = scaleInput.value;
            });

            dialog.querySelector('#generateBtn').addEventListener('click', () => {
                const type = dialog.querySelector('#textureType').value;
                const scale = parseFloat(scaleInput.value);
                const seed = parseFloat(dialog.querySelector('#textureSeed').value);
                const seamless = dialog.querySelector('#seamless').checked;

                generateTexture(layer, type, { scale, seed, seamless });
                document.body.removeChild(dialog);
            });

            dialog.querySelector('#cancelBtn').addEventListener('click', () => {
                document.body.removeChild(dialog);
            });
        }

        // 生成纹理
        function generateTexture(layer, type, params) {
            const width = layer.canvas.width;
            const height = layer.canvas.height;

            const generator = textureGenerators[type];
            if (!generator) {
                Toast.show('未知的纹理类型', 'error');
                return;
            }

            Toast.show('正在生成纹理...', 'info');

            setTimeout(() => {
                const imageData = generator(width, height, params);

                // 如果启用无缝平铺，混合边缘
                if (params.seamless) {
                    makeSeamless(imageData, width, height);
                }

                layer.ctx.putImageData(imageData, 0, 0);
                app.render();
                app.saveHistory();
                Toast.show('纹理生成完成', 'success');
            }, 10);
        }

        // 使纹理无缝平铺
        function makeSeamless(imageData, width, height) {
            const data = imageData.data;
            const blendSize = Math.min(width, height) / 8;

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;

                    // 水平混合
                    if (x < blendSize) {
                        const t = x / blendSize;
                        const mirrorX = width - blendSize + x;
                        const mirrorIdx = (y * width + mirrorX) * 4;

                        for (let c = 0; c < 3; c++) {
                            data[idx + c] = data[idx + c] * t + data[mirrorIdx + c] * (1 - t);
                        }
                    }

                    // 垂直混合
                    if (y < blendSize) {
                        const t = y / blendSize;
                        const mirrorY = height - blendSize + y;
                        const mirrorIdx = (mirrorY * width + x) * 4;

                        for (let c = 0; c < 3; c++) {
                            data[idx + c] = data[idx + c] * t + data[mirrorIdx + c] * (1 - t);
                        }
                    }
                }
            }
        }

        // 添加到滤镜菜单
        app.menuManager.addMenuItem('滤镜', {
            label: '纹理生成器...',
            action: 'texture-generator',
            handler: () => {
                showTextureDialog();
            },
            position: 'bottom',
            divider: false
        });

        console.log('纹理生成器插件已加载');
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
