/**
 * hybrid
 */
;
(function(win) {
    'use strict';

    function Hybrid() {
        var self = this;
        if ('WebViewJavascriptBridge' in win) {
            if (!self.device) {
                getDeviceInfo();
            } else {
                self.bridge = win['WebViewJavascriptBridge'];
            }
        } else {
            document.addEventListener('WebViewJavascriptBridgeReady', function() {
                var bridge = win['WebViewJavascriptBridge'];
                bridge.init(function(message, responseCallback) {
                    var data = {
                        'Javascript Responds': 'Wee!'
                    };
                    responseCallback(data)
                });
                getDeviceInfo(bridge);
            }, false)
        }

        function getDeviceInfo(bridge) {
            bridge.send({
                handlerName: 'Action',
                data: {
                    action: 'Core',
                    method: 'getDeviceInfo',
                    params: null
                }
            }, function(result) {
                self.bridge = bridge;
                self.device = result["data"];
                self.dispatchEvent('hybridReady');
            });
        }
    }

    Hybrid.prototype = {
        /**
         * @var {WebViewJavascriptBridge}
         */
        bridge: null,
        plugin: {},
        device: {},
        /**
         * 是否已准备就绪
         * @param {Function} callback
         */
        ready: function(callback) {
            var self = this;
            if (self.bridge && self.device) {
                typeof callback === 'function' && callback.call(self, self.bridge);
            } else {
                self.addEventListener('hybridReady', function() {
                    typeof callback === 'function' && callback.call(self, self.bridge);
                });
            }
        },

        /**
         * 添加事件监听
         * @param eventName
         * @param handler
         */
        addEventListener: function(eventName, handler) {
            document.addEventListener('hybrid:' + eventName, handler);
        },

        /**
         * 取消事件监听
         * @param eventName
         * @param handler
         */
        removeEventListener: function(eventName, handler) {
            document.removeEventListener('hybrid:' + eventName, handler)
        },

        /**
         * 触发实际
         * @param {String} eventName
         * @param {*} [data]
         * @param {HTMLDocument} [dom]
         */
        dispatchEvent: function(eventName, data, dom) {
            var readyEvent = document.createEvent('Events');
            readyEvent.initEvent('hybrid:' + eventName, false, true);
            readyEvent.bridge = this.bridge;
            if (data) readyEvent.data = data;
            if (dom && 'dispatchEvent' in dom) {
                dom.dispatchEvent(readyEvent);
            } else {
                document.dispatchEvent(readyEvent);
            }
        },

        /**
         * 注册一个函数供 Native 调用
         * @param {String} name 名称
         * @param {Function} handler
         */
        registerHandler: function(name, handler) {
            this.ready(function(bridge) {
                bridge.registerHandler(name, handler);
            });
        },

        /**
         * 调用 Native 提供的函数
         * @param {String} name 名称
         * @param {*} params 参数
         * @param {Function} callback
         */
        callHandler: function(name, params, callback) {
            this.ready(function(bridge) {
                bridge.send({
                    handlerName: name,
                    data: params
                }, callback);
            });
        },

        /**
         * 调用 Native addHandlerListener 提供的函数
         * @param {String} name 名称
         * @param {*} params 参数
         * @param {Function} callback
         */
        callEventHandler: function(name, params, callback) {
            this.ready(function(bridge) {
                bridge.callHandler(name, params, callback);
            });
        },

        callAction: function(action, params, callback) {
            if (!action || action.indexOf('/') === -1) return;
            action = action.split('/');
            hybrid.callHandler('Action', {
                action: action[0],
                method: action[1],
                params: params
            }, callback);
        },

        /**
         * 获取设备信息
         * @param {Function} [callback]
         */
        getDeviceInfo: function(callback) {
            hybrid.callAction('Core/getDeviceInfo', null, function(result) {
                typeof callback === 'function' && callback(result.status, result.data);
            });
        },
        /**
         * 获取网络状态
         * @param callback
         */
        getNetworkStatus: function(callback) {
            hybrid.callAction('Core/getNetworkStatus', null, function(result) {
                typeof callback === 'function' && callback(result.status, result.data);
            });
        }
    };

    if (typeof win.hybrid === 'undefined') {
        var hybrid = new Hybrid();

        hybrid.registerHandler('dispatchEvent', function(result) {
            if (result && result.event) {
                hybrid.dispatchEvent(result.event, result.data);
            }
        });

        hybrid.addEventListener('PlatformsInfoUpdate', function(e) {
            alert('PlatformsInfoUpdate : \n' + JSON.stringify(arguments))
        });

        hybrid.addEventListener('networkChanged', function(e) {
            if (e.data.status && typeof hybrid.device === 'object') {
                if (!'networkState' in hybrid.device) {
                    hybrid.device['networkState'] = e.data.status;
                } else {
                    hybrid.device.networkState = e.data.status;
                }
            }
        });

        hybrid.isNative = !!navigator.userAgent.match(/MSNative/);

        win.Hybrid = hybrid;
    }

})(window);

/**
 * Created by wdj on 15/11/12.
 */

// 核心功能
(function(hybrid) {

    /**
     * 设置 隐藏/显示 系统导航栏
     * @param {Boolean} hide 是否隐藏
     * @param {Function} [callback]
     */
    hybrid.setNavigationBarHide = function(hide, callback) {
        hybrid.callAction('Core/setNavigationBarHide', {
            hide: hide
        }, function(result) {
            typeof callback === 'function' && callback(result.status, result.data);
        });
    };

    /**
     * 设置主题颜色
     * @param {String} color 前景色
     * @param {String} primaryColor 背景色
     * @param {Boolean} [lightStatusBar] 是否高亮状态栏
     * @param {Function} [callback] 设置完成后回调函数
     */
    hybrid.setTheme = function(color, primaryColor, lightStatusBar, callback) {
        hybrid.callAction('Core/setTheme', {
            color: color,
            primaryColor: primaryColor,
            lightStatusBar: !!lightStatusBar
        }, function(result) {
            typeof callback === 'function' && callback(result.status, result.data);
        });
    };

    /**
     * 新窗口打开一个网页
     * @param {*} options
     * @param {Function} [callback]
     */
    hybrid.openWindow = function(options, callback) {
        var url;
        if (typeof options === 'string') {
            url = options;
            options = {};
        }
        options = hybrid.utils.extend({
            url: url,
            isFullScreen: false,
            showMenu: true
        }, options);
        hybrid.callAction('Core/openWindow', options, function(result) {
            typeof callback === 'function' && callback(result.status, result.data);
        });
    };

    /**
     * 关闭窗口
     */
    hybrid.closeWindow = function() {

        hybrid.callAction('Core/closeWindow', {}, function(result) {
            typeof callback === 'function' && callback(result.status, result.data);
        });
    };

    /**
     * 关闭窗口
     */
    hybrid.finish = function() {

        hybrid.callAction('Core/finish', {}, function(result) {
            typeof callback === 'function' && callback(result.status, result.data);
        });
    };

    /**
     * 设置内置web浏览器显示那些菜单
     * @param {*} options
     * @param {Function} [callback]
     */
    hybrid.setWebDropMenu = function(options, callback) {
        options = hybrid.utils.extend({
            scan: false,
            share: false,
            copy: false,
            reload: true
        }, options || {});
        hybrid.callEventHandler("changeWebMenu", options, function(result) {
            typeof callback === 'function' && callback(result.status, result.data);
        });
    };

    /**
     * 设置内置web浏览器分享内容
     * @param {*} options
     * @param {Function} [callback]
     */
    hybrid.setWebShare = function(options, callback) {
        options = hybrid.utils.extend({
            title: '',
            text: '',
            url: '',
            image: ''
        }, options || {});
        hybrid.callEventHandler("setWebShareInfo", options, function(result) {
            typeof callback === 'function' && callback(result.status, result.data);
        });
    };

    /**
     * 使用 IOS UIApplication openURL 打开一个URL
     * @param options
     * @param callback
     */
    hybrid.openURL = function(options, callback) {
        var url;
        if (typeof options === 'string') {
            url = options;
            options = {};
        }
        options = hybrid.utils.extend({
            url: url,
            action: "android.intent.action.VIEW"
        }, options || {});
        console.log(options);
        hybrid.callAction('Core/openURL', options, function(result) {
            typeof callback === 'function' && callback(result.status, result.data);
        });
    };

    /**
     * 调用震动
     * @param {Function} [callback]
     */
    hybrid.playVibrate = function(callback) {
        hybrid.callAction('Core/playVibrate', {}, function(result) {
            typeof callback === 'function' && callback(result.status, result.data);
        });
    };

    /**
     * 播放声音
     * @param {String} url
     * @param {Function} [callback]
     */
    hybrid.playSound = function(url, callback) {
        hybrid.callAction('Core/playSound', {
            url: url
        }, function(result) {
            typeof callback === 'function' && callback(result.status, result.data);
        });
    };

    /**
     * 设置 Icon Badge 数字
     * 仅IOS有效
     * @param {Integer} badge
     * @param {Function} [callback]
     */
    hybrid.setIconBadge = function(badge, callback) {
        hybrid.callAction('Core/setIconBadge', {
            badge: badge
        }, function(result) {
            typeof callback === 'function' && callback(result.status, result.data);
        });
    };


    /**
     * getGeTuiClientId
     * @param {Integer} badge
     * @param {Function} [callback]
     */
    hybrid.getGeTuiClientId = function(callback) {
        hybrid.callAction('Core/getGeTuiClientId', {}, function(result) {
            typeof callback === 'function' && callback(result.status, result.data);
        });
    };

    hybrid.ajax = {
        handlers: {},
        isInit: false,
        create: function(options, callback) {

            var self = this;
            if (!self.isInit) {
                self.isInit = true;

                hybrid.addEventListener('ajax:beforeSend', function(e) {
                    var tag = e.data;
                    if (!tag) return;
                    self.trigger(tag, 'beforeSend', null);
                });

                hybrid.addEventListener('ajax:success', function(e) {
                    var tag = e.data.tag;
                    if (!tag) return;
                    self.trigger(tag, 'success', e.data.data);
                });

                hybrid.addEventListener('ajax:error', function(e) {
                    var tag = e.data.tag;
                    if (!tag) return;
                    self.trigger(tag, 'error', e.data.error);
                });

                hybrid.addEventListener('ajax:complete', function(e) {
                    var tag = e.data;
                    if (!tag) return;
                    self.trigger(tag, 'complete', null);
                });
            }

            hybrid.callAction('Core/ajax', options, function(result) {
                if (result && result.status) {
                    callback(result.data);
                } else {
                    callback(null);
                }
            });

        },

        request: function(options) {
            var self = this;

            options = hybrid.utils.extend({
                url: '',
                data: {},
                type: 'get',
                dataType: 'json',
                beforeSend: function() {},
                success: function() {},
                error: function() {},
                complete: function() {}
            }, options);

            self.create({
                url: options.url,
                data: options.data,
                type: options.type,
                dataType: options.dataType
            }, function(tag) {
                if (tag) {
                    self.addHandler(tag, 'beforeSend', options.beforeSend);
                    self.addHandler(tag, 'success', options.success);
                    self.addHandler(tag, 'error', options.error);
                    self.addHandler(tag, 'complete', options.complete);
                }
            });
        },

        addHandler: function(tag, evt, fn) {
            if (typeof fn !== 'function') return;
            var handlers = this.handlers[tag] || {};

            if (typeof handlers[evt] !== 'undefined') {
                handlers[evt].push(fn);
            } else {
                handlers[evt] = [fn];
            }
            this.handlers[tag] = handlers;
        },

        trigger: function(tag, evt, data) {
            var handlers = this.handlers[tag] || {};
            if (handlers && typeof handlers[evt] !== 'undefined') {
                var evts = handlers[evt];
                for (var i = 0; i < evts.length; i++) {
                    typeof evts[i] === 'function' && evts[i](data);
                }
                handlers[evt] = [];
            }
        }
    };


    hybrid.store = {
        setValue: function(name, value, callback) {
            if (typeof value !== 'string') {
                value = JSON.stringify(value);
            }
            hybrid.callAction('Core/setKVStoreValue', {
                name: name,
                value: value
            }, function(result) {
                typeof callback === 'function' && callback(result.status, result.data);
            });
        },
        getValue: function(name, callback) {
            hybrid.callAction('Core/getKVStoreValue', {
                name: name
            }, function(result) {
                var data = result.data;
                if (typeof data === 'string' && (data.charAt(0) === '{' || data.charAt(0) === '[')) {
                    data = JSON.parse(data);
                }
                typeof callback === 'function' && callback(result.status, data);
            });
        }
    };

})(Hybrid);

/**
 * 核心UI
 */
(function(hybrid) {

    /**
     * 显示 toast
     * @param {*} options
     * @param {Function} [callback]
     */
    hybrid.showToast = function(options, callback) {
        var msg = "";
        if (typeof msg === 'string') {
            msg = options;
        }
        options = hybrid.utils.extend({
            message: msg,
            duration: 1.5,
            delay: 0.0,
            radius: 0.1
                //,color: '#FFFFFF'
                //,bgColor: '#000000'
                //,maxWidth: 100
                //,maxLine: 100
                //,marginBottom: 0
        }, options);

        if (options.radius && options.radius === 0) {
            options.radius = 0.001;
        }
        hybrid.callAction('CoreUI/showToast', options, function(result) {
            typeof callback === 'function' && callback(result.status, result.data);
        });
    };
    /**
     * 显示 toast
     * @param {String} message 消息内容
     * @param {Number} [duration] 显示时间
     */
    hybrid.makeToast = function(message, duration) {
        hybrid.showToast({
            duration: duration || 1.5,
            message: message,
            radius: 0.000001
        });
    };

    /**
     * @param {*} options 消息内容
     * @param {Function} [callback] 回调函数
     */
    hybrid.showIndicator = function(options, callback) {
        var message = "";
        if (typeof options === "string") {
            message = options;
        }
        options = hybrid.utils.extend({
            text: message
        }, options);

        hybrid.callAction("CoreUI/showIndicator", options, function(result) {
            typeof callback === 'function' && callback(result.status, result.data);
        });
    };

    /**
     * hideIndicator
     * @param {Function} [callback]
     */
    hybrid.hideIndicator = function(callback) {
        hybrid.callAction("CoreUI/hideIndicator", {}, function(result) {
            typeof callback === 'function' && callback(result.status, result.data);
        });
    };

    /**
     * showAlert
     * @param {*} options 消息内容
     * @param {Function} [callback] 回调函数
     */
    hybrid.showAlert = function(options) {
        var message = "";
        if (typeof options === "string") {
            message = options;
        }
        options = hybrid.utils.extend({
            message: message
                //,title: ""
        }, options);

        hybrid.callAction("CoreUI/showAlert", options, function(result) {

        });
    };



    /**
     * showConfirm
     * @param {*} options 消息内容
     * @param {Function} [callback] 回调函数
     */
    hybrid.showConfirm = function(options, callback) {
        var message = "";
        if (typeof options === "string") {
            message = options;
        }
        options = hybrid.utils.extend({
            message: message
                //,title: ""
        }, options);

        hybrid.callAction("CoreUI/showConfirm", options, function(result) {
            typeof callback === 'function' && callback(result.status, result.data);
        });
    };

    /**
     * 显示本地通知
     * @param options
     * @param callback
     */
    hybrid.showNotify = function(options, callback) {
        options = hybrid.utils.extend({
            title: '',
            message: '',
            //iconBadge: 1,
            //data: {},
            //sound: 'test.caf',
            //delay: 0
        }, options);
        hybrid.callAction('CoreUI/showNotify', options, function(result) {
            typeof callback === 'function' && callback(result.status, result.data);
        });
    };


    /**
     * 显示通知
     * @param options
     * @param callback
     */
    hybrid.showNotification = function(options, callback) {
        options = hybrid.utils.extend({
            message: "...",
            title: ""
        }, options);
        hybrid.callAction("CoreUI/showNotification", options, function(result) {
            if (typeof result.data === 'string') {
                var data = result.data;
                var s = data[0];
                var e = data[data.length - 1];
                if ((s === '[' || s === '{') && (e === ']' || e === '}')) {
                    try {
                        result.data = JSON.parse(data);
                    } catch (e) {}
                }
            }
            typeof callback === 'function' && callback(result.status, result.data);
        });
    };

    /**
     * 取消通知
     * @param notifyId
     * @param callback
     */
    hybrid.cancelNotification = function(notifyId, callback) {
        hybrid.callAction("CoreUI/cancelNotification", {
            notifyId: notifyId
        }, function(result) {
            typeof callback === 'function' && callback(result.status, result.data);
        });
    };

})(Hybrid || {});
/**
 * Created by wdj on 15/11/13.
 */
;
(function(hybrid) {

    hybrid.utils = {
        extend: function(destination, source) {
            for (var property in source) {
                destination[property] = source[property];
            }
            return destination;
        },
        isArray: function(arr) {
            return Object.prototype.toString.apply(arr) === '[object Array]';
        },
        forEach: function(obj, callback) {
            if (typeof obj !== 'object') return;
            if (!callback) return;
            var i, prop;
            if (this.isArray(obj) || obj instanceof Dom7) {
                // Array
                for (i = 0; i < obj.length; i++) {
                    callback(i, obj[i]);
                }
            } else {
                // Object
                for (prop in obj) {
                    if (obj.hasOwnProperty(prop)) {
                        callback(prop, obj[prop]);
                    }
                }
            }
        },
        unique: function(arr) {
            var unique = [];
            for (var i = 0; i < arr.length; i++) {
                if (unique.indexOf(arr[i]) === -1) unique.push(arr[i]);
            }
            return unique;
        },
        parseUrlQuery: function(url) {
            var query = {},
                i, params, param;
            if (url.indexOf('?') >= 0) url = url.split('?')[1];
            else return query;
            params = url.split('&');
            for (i = 0; i < params.length; i++) {
                param = params[i].split('=');
                query[param[0]] = param[1];
            }
            return query;
        }
    };

})(Hybrid || {});


/**
 * 日志处理
 */
(function(hybrid) {

    function arguments2Array(args, append) {
        var arr = [];
        for (var i = 0; i < args.length; i++) {
            arr.push(args[i]);
        }
        if (append) arr.push(append);
        return arr;
    }

    hybrid.logger = {
        DEBUG: 'DEBUG',
        ERROR: 'ERROR',
        WARNING: 'WARNING',
        INFO: 'INFO',
        write: function() {
            var args = [];
            var level = this.INFO;
            for (var i = 0; i < arguments.length; i++) {
                var p = arguments[i];
                if (typeof p === 'object') {
                    p = JSON.stringify(p);
                }
                args.push(p);
            }
            if (args.length > 1 && typeof args[args.length - 1] === 'string') {
                level = args.pop();
            }
            hybrid.callAction('Core/logger', {
                level: level,
                args: args.join(' ')
            });
        },
        debug: function() {
            this.write.apply(this, arguments2Array(arguments, this.DEBUG));
        },
        error: function() {
            this.write.apply(this, arguments2Array(arguments, this.ERROR));
        },
        warning: function() {
            this.write.apply(this, arguments2Array(arguments, this.WARNING));
        },
        info: function() {
            this.write.apply(this, arguments2Array(arguments, this.INFO));
        }
    };

    hybrid.ready(function() {
        //hybrid.logger.info('add logger to window');
        window.logger = hybrid.logger;
        window.logger.log = hybrid.logger.info;
    });
})(Hybrid || {});

/**
 * 支付宝
 */
(function(hybrid) {

    hybrid.plugin.AliPay = {

        /**
         * 订单支付
         * @param {*} options 参数
         * @param {Function} callback
         */
        payOrder: function(options, callback) {
            options = hybrid.utils.extend({
                order: "", // 支持字符串或 {}
                schemeStr: "" // App 的 URL协议
            }, options);
            hybrid.callAction('Alipay/payOrder', options, function(result) {
                typeof callback === 'function' && callback(result.status, result.data);
            });
        }
    }

})(Hybrid || {});

/**
 * 文件
 */
(function(hybrid) {

    hybrid.file = {

        /**
         * 文件上传
         * @param {String} options
         * @param {Function} callback
         */
        upload: function(options, callback) {
            options = hybrid.utils.extend({
                file: ""
                    //,uploadUrl: ""
            }, options);
            hybrid.callAction('File/upload', options, function(result) {
                typeof callback === 'function' && callback(result.status, result.data);
            });
        },

        /**
         * 文件下载
         * @param {String} options
         * @param {Function} callback
         */
        download: function(options, callback) {
            options = hybrid.utils.extend({
                url: '', //文件地址
                open: false, //下载完成后是否打开,如果为true会显示下载进度条
                showProgress: false, //是否显示进度条
                showCancel: true, //是否显示取消按钮
            }, options);
            hybrid.callAction('File/download', options, function(result) {
                typeof callback === 'function' && callback(result.status, result.data);
            })
        },

        /**
         * 打开文件
         * @param {String} file 文件路径
         * @param {Function} [callback]
         */
        open: function(file, callback) {
            hybrid.callAction('File/openFile', {
                file: file
            }, function(result) {
                typeof callback === 'function' && callback(result.status, result.data);
            })
        }
    }

})(Hybrid || {});

/**
 * Created by wdj on 15/11/24.
 */
;
(function(hybrid) {

    hybrid.geolocation = {

        listens: {},

        /**
         * 获取当前位置
         * @param {Function} [callback]
         */
        getCurrentLocation: function(callback) {

            hybrid.callAction("LocationManager/getCurrentLocation", {}, function(result) {
                typeof callback === 'function' && callback(result.status, result.data);
            });
        },

        /**
         * 监听位置
         * @param {*} options
         * @param {Function} callback
         * @return {String} 监听函数id
         */
        watchPosition: function(options, callback) {
            var self = this;
            var id = new Date().getTime().toString(32);
            if (typeof options === 'function') {
                if (!callback) {
                    callback = options;
                    options = {};
                } else {
                    options = options.call(self);
                }
            }
            self.listens[id] = function(e) {
                typeof callback === 'function' && callback(e.data);
            };
            options = hybrid.utils.extend({
                distanceFilter: 1.0 //定位频率,每隔多少米定位一次
            }, options);
            hybrid.callAction("LocationManager/watchPosition", options, function(result) {
                if (result.status) {
                    hybrid.addEventListener('watchPositionChanged', self.listens[id]);
                }
            });
            return id;
        },

        /**
         * 停止
         * @param {Number} id watchPosition返回的ID
         * @param {Function} callback
         */
        stopWatch: function(id, callback) {
            var self = this;
            if (self.listens[id]) {
                hybrid.removeEventListener('watchPositionChanged', self.listens[id]);
                delete self.listens[id];
            }
            hybrid.callAction("LocationManager/stopWatch", {}, function(result) {
                typeof callback === 'function' && callback(result.status, result.data);
            });
        }
    };

})(Hybrid || {});
/**
 * Created by wdj on 15/11/13.
 */
;
(function(hybrid) {

    hybrid.plugin.imagePicker = {

        /**
         * 图片选择类型
         */
        SourceType: {
            PhotoLibrary: 0,
            Camera: 1,
            PhotosAlbum: 2,
            Other: -1
        },

        /**
         * 打开图片选择器
         * @param {Object} options
         * @param {Function} callback
         */
        open: function(options, callback) {
            if (!callback) return;
            var self = this;
            options = hybrid.utils.extend({
                title: "选择图片",
                message: "",
                //quality: 100,
                //width: 0,
                editing: false, // 是否启用图片编辑
                sourceType: self.SourceType.Other, // 图片选择类型
                upload: false, // 是否上传到服务器
                uploadFormAction: '', // 上传地址
                uploadFormName: '' //上传表单字段名
            }, options);
            hybrid.callAction('ImagePicker/selectImages', options, function(result) {
                typeof callback === 'function' && callback(result.status, result.data);
            });
        }
    };

})(Hybrid || {});


/**
 * 二维码
 */
(function(hybrid) {

    /**
     * @param {*} options 参数
     * @param {Function} callback
     */
    hybrid.plugin.QRCode = {
        scan: function(options, callback) {
            options = hybrid.utils.extend({
                //title: "扫码",
                //label: "请将二维码对准框内容"
            }, options);
            hybrid.callAction('QRCode/Scan', options, function(result) {
                typeof callback === 'function' && callback(result.status, result.data);
            });
        },
        /**
         *
         * @param params
         * @param callback
         */
        generator: function(params, callback) {
            params = hybrid.utils.extend({
                margin: 3,
                text: "",
                size: 100
            }, params);
            hybrid.callAction('QRCode/Generator', params, function(result) {
                typeof callback === 'function' && callback(result.status, result.data);
            });
        },
        /**
         *
         * @param url
         * @param callback
         */
        parse: function(url, callback) {
            hybrid.callAction('QRCode/ParserImage', {
                url: url
            }, function(result) {
                typeof callback === 'function' && callback(result.status, result.data);
            });
        }
    };

})(Hybrid || {});


/**
 * 分享插件
 */
(function(hybrid) {

    var platformType = {
        /**
         *  未知
         */
        Unknown: 0,
        /**
         *  新浪微博
         */
        SinaWeibo: 1,
        /**
         *  腾讯微博
         */
        TencentWeibo: 2,
        /**
         *  豆瓣
         */
        DouBan: 5,
        /**
         *  QQ空间
         */
        QZone: 6,
        /**
         *  人人网
         */
        Renren: 7,
        /**
         *  开心网
         */
        Kaixin: 8,
        /**
         *  Facebook
         */
        Facebook: 10,
        /**
         *  Twitter
         */
        Twitter: 11,
        /**
         *  印象笔记
         */
        YinXiang: 12,
        /**
         *  Google+
         */
        GooglePlus: 14,
        /**
         *  Instagram
         */
        Instagram: 15,
        /**
         *  LinkedIn
         */
        LinkedIn: 16,
        /**
         *  Tumblr
         */
        Tumblr: 17,
        /**
         *  邮件
         */
        Mail: 18,
        /**
         *  短信
         */
        SMS: 19,
        /**
         *  拷贝
         */
        Copy: 21,
        /**
         *  微信好友
         */
        WechatSession: 22,
        /**
         *  微信朋友圈
         */
        WechatTimeline: 23,
        /**
         *  QQ好友
         */
        QQFriend: 24,
        /**
         *  Pocket
         */
        Pocket: 26,
        /**
         *  有道云笔记
         */
        YouDaoNote: 27,
        /**
         *  Pinterest
         */
        Pinterest: 30,
        /**
         *  Flickr
         */
        Flickr: 34,
        /**
         *  微信收藏
         */
        WechatFav: 37,
        /**
         *  Line
         */
        Line: 42,
        /**
         *  WhatsApp
         */
        WhatsApp: 43,
        /**
         *  KaKao Talk
         */
        KakaoTalk: 44,
        /**
         *  KaKao Story
         */
        KakaoStory: 45,
        /**
         *  支付宝好友
         */
        AliPaySocial: 50,
        /**
         *  KaKao
         */
        Kakao: 995,
        /**
         *  印象笔记国际版
         */
        Evernote: 996,
        /**
         *  微信平台,
         */
        Wechat: 997,
        /**
         *  QQ平台
         */
        QQ: 998,
        /**
         *  任意平台
         */
        Any: 999
    };

    var contentType = {
        /**
         *  自动适配类型，视传入的参数来决定
         */
        Auto: 0,

        /**
         *  文本
         */
        Text: 1,

        /**
         *  图片
         */
        Image: 2,

        /**
         *  网页
         */
        WebPage: 3,

        /**
         *  应用
         */
        App: 4,

        /**
         *  音频
         */
        Audio: 5,

        /**
         *  视频
         */
        Video: 6
    };

    hybrid.Social = {

        /**
         * 分享平台
         */
        platformType: platformType,

        /**
         * 内容类型
         */
        contentType: contentType,

        /**
         * @param {*} options 参数
         * @param {Function} callback
         */
        showShareActionSheet: function(options, callback) {
            options = hybrid.utils.extend({
                contentType: contentType.Auto,
                images: ['https://www.wendaojiang.com/logo.png'],
                url: 'https://www.wendaojiang.com',
                platforms: [
                    platformType.SinaWeibo,
                    platformType.Wechat,
                    platformType.WechatTimeline,
                    platformType.WechatSession,
                    platformType.QQ,
                    platformType.QZone
                ]
            }, options);
            hybrid.callAction('Social/showShareActionSheet', options, function(result) {
                typeof callback === 'function' && callback(result.status, result.data);
            });
        },

        /**
         * 直接分享内容
         * @param {*} options 参数
         * @param {Function} callback
         */
        share: function(options, callback) {
            options = hybrid.utils.extend({
                contentType: contentType.Auto,
                image: 'https://www.wendaojiang.com/logo.png',
                url: 'https://www.wendaojiang.com',
                platform: platformType.SinaWeibo
            }, options);
            hybrid.callAction('Social/share', options, function(result) {
                typeof callback === 'function' && callback(result.status, result.data);
            });
        },

        /**
         * 获取授权
         * @param {platformType} platform
         * @param {Function} callback
         */
        authorize: function(platform, callback) {
            hybrid.callAction('Social/authorize', {
                platform: platform
            }, function(result) {
                typeof callback === 'function' && callback(result.status, result.data);
            });
        },

        /**
         * 判断分享平台是否授权
         * @param {platformType} platform
         * @param {Function} callback
         */
        hasAuthorized: function(platform, callback) {
            hybrid.callAction('Social/hasAuthorized', {
                platform: platform
            }, function(result) {
                typeof callback === 'function' && callback(result.status, result.data);
            });
        },

        /**
         * 取消分享平台授权
         * @param {platformType} platform
         * @param {Function} callback
         */
        cancelAuthorize: function(platform, callback) {
            hybrid.callAction('Social/cancelAuthorize', {
                platform: platform
            }, function(result) {
                typeof callback === 'function' && callback(result.status, result.data);
            });
        },

        /**
         * 获取好友列表
         * @param options
         * @param callback
         */
        getFriends: function(options, callback) {
            options = hybrid.utils.extend({
                platform: platformType.SinaWeibo,
                page: 1,
                pageSize: 10
            }, options);
            hybrid.callAction('Social/getFriends', options, function(result) {
                typeof callback === 'function' && callback(result.status, result.data);
            });
        },

        /**
         * 获取用户信息
         * @param options
         * @param callback
         */
        getUserInfo: function(options, callback) {
            options = hybrid.utils.extend({
                platform: platformType.SinaWeibo,
                uid: "",
                userName: "" // uid, userName 二选一
            }, options);
            hybrid.callAction('Social/getUserInfo', options, function(result) {
                typeof callback === 'function' && callback(result.status, result.data);
            });
        }
    };

})(Hybrid || {});

/**
 * 文件
 */
(function(hybrid) {

    hybrid.plugin.video = {

        /**
         * 文件上传
         * @param options
         * @param callback
         */
        record: function(options, callback) {

            options = hybrid.utils.extend({
                minTime: 2,
                maxTime: 30
            }, options);
            hybrid.callAction("VideoCapture/record", options, function(result) {
                typeof callback === 'function' && callback(result.status, result.data);
            });
        },

        playVideo: function(options, callback) {
            var url = '';
            if (typeof options === 'string') {
                url = options;
                options = null;
            }
            options = hybrid.utils.extend({
                url: url
            }, options || {});

            hybrid.callAction("VideoCapture/play", options, function(result) {
                typeof callback === 'function' && callback(result.status, result.data);
            });
        }
    }

})(Hybrid || {});

module.exports = window.Hybrid;