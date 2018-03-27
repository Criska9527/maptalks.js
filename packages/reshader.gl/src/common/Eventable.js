const Eventable = Base =>

    class extends Base {
        on(type, handler) {
            if (!this._events) {
                this._events = {
                    type : [handler]
                };
            }
            this._events[type] = this._events[type] || [];
            this._events[type].push(handler);
            return this;
        }
        once(type, handler) {
            return this.on(type, this._wrapOnce(type, handler));
        }
        off(type, handler) {
            if (!this._events || !this._events[type]) {
                return this;
            }
            this._events[type].splice(this._events[type].indexOf(handler), 1);
            return this;
        }
        fire(type) {
            if (!this._events || !this._events[type]) {
                return this;
            }
            const queue = this._events[type].slice(0);
            for (const p of queue) {
                p();
            }
            return this;
        }
        _wrapOnce(type, handler) {
            const self = this;
            let called = false;
            const fn = function onceHandler() {
                if (called) {
                    return;
                }
                called = true;
                handler();
                self.off(type, onceHandler);
            };
            return fn;
        }
    };

export default Eventable;
