// 事件管理器 - 处理历史记录和撤销/重做
export class EventManager {
    constructor() {
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;
    }

    saveState(state) {
        // 移除当前索引之后的所有状态
        this.history = this.history.slice(0, this.historyIndex + 1);

        // 添加新状态
        this.history.push(state);

        // 限制历史记录大小
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
    }

    canUndo() {
        return this.historyIndex > 0;
    }

    canRedo() {
        return this.historyIndex < this.history.length - 1;
    }

    undo() {
        if (this.canUndo()) {
            this.historyIndex--;
            return this.history[this.historyIndex];
        }
        return null;
    }

    redo() {
        if (this.canRedo()) {
            this.historyIndex++;
            return this.history[this.historyIndex];
        }
        return null;
    }

    clear() {
        this.history = [];
        this.historyIndex = -1;
    }
}
