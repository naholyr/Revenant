/**
 * Created by JiaHao on 19/8/15.
 */

var async = require('async');
var Q = require('q');

var base = require('./base');

/**
 * A headless browser based on PhantomJS
 *
 * @param {Object} [options]
 * @constructor
 */
function Revenant(options) {
    this.options = options;
    this.initQueue();
}

Revenant.prototype = {
    constructor: Revenant,

    initQueue: function () {
        var self = this;
        const QUEUE_CONCURRENCY = 1;

        self.taskQueue = async.queue(function(parameters, callback) {

            var task = parameters.task;
            var arguments = parameters.argument;

            if (task === base.openPage) {

                task(
                    arguments,
                    function (error, page, ph) {
                        if (error) {
                            return callback(error);
                        }

                        self.phantom = ph;
                        self.page = page;

                        page.get('url', function (url) {
                            self.__url = url;

                            if (error) {
                                callback(error);
                                return;
                            }

                            callback();

                        });

                    },
                    self.options
                );
            } else {

                if (!self.page) {
                    callback('Page is not open');
                    return;
                }

                var taskArguments = [self.page, self.phantom, arguments, function (error, page, ph, result) {
                    page.get('url', function (url) {
                        self.__url = url;
                        callback(error, result);
                    });
                }];

                // removes any null elements from the list
                taskArguments = taskArguments.filter(function (element) {
                    return !!element;
                });

                task.apply(this, taskArguments);

            }

        }, QUEUE_CONCURRENCY);
    },

    getUrl: function (callback) {
        var self = this;

        var deferred = Q.defer();
        // if page is available (meaning that the page has been opened or .done() has not been called),
        // get the current url
        if (self.page) {
            self.page.get('url', function (url) {
                self.__url = url;
                deferred.resolve(url);

            });
        } else {
            // just get the cached url at the end of every method call
            deferred.resolve(self.__url);
        }
        return deferred.promise.nodeify(callback);
    },

    /**
     * Private helper function to push a task
     * @param task
     * @param argument
     * @param callback
     * @returns {Promise}
     * @private
     */
    __pushTask: function (task, argument, callback) {
        var self = this;

        var deferred = Q.defer();

        var queueArgument = {
            task: task,
            argument: argument
        };

        self.taskQueue.push(queueArgument, function (error, result) {
            if (error) {
                deferred.reject(error);
            } else {
                deferred.resolve(result);
            }
        });

        return deferred.promise.nodeify(callback);

    },

    openPage: function (url, callback) {
        return this.__pushTask(base.openPage, url, callback);
    },

    navigateToUrl: function (url, callback) {
        return this.__pushTask(base.navigateToUrl, url, callback);
    },

    takeSnapshot: function(callback) {
        return this.__pushTask(base.takeSnapshot, null, callback);
    },

    waitForElement: function (selector, callback) {
        return this.__pushTask(base.elementExists, selector, callback);
    },

    waitForDomString: function (stringQuery, callback) {
        return this.__pushTask(base.waitForString, stringQuery, callback);
    },

    getInnerHTML: function (selector, callback) {
        return this.__pushTask(base.getInnerHtmlFromElement, selector, callback);
    },

    changeDropdownIndex: function (selector, value, callback) {
        return this.__pushTask(base.changeDropdownIndex, [selector, value], callback);
    },

    /**
     *
     * @param {string} selector
     * @param {int} options 0 – callback immediately
     *                      1 – expect ajax, callback when the dom changes
     *                      2 – expect page navigation, callback when the url changes and document is ready
     * @param callback
     */
    clickElement: function (selector, options, callback) {
        return this.__pushTask(base.clickElement, [selector, options], callback);
    },

    /**
     * Sets the state of a checkbox
     * @param {string} selector
     * @param {boolean} state
     * @param callback
     * @returns {Promise}
     */
    setCheckboxState: function (selector, state, callback) {
        return this.__pushTask(base.setCheckboxState, [selector, state], callback);
    },

    fillForm: function (selector, value, callback) {
        return this.__pushTask(base.fillForm, [selector, value], callback);
    },

    getSelectorValue: function (selector, callback) {
        return this.__pushTask(base.getSelectorValue, selector, callback);
    },

    submitForm: function (callback) {
        return this.__pushTask(base.submitForm, null, callback);
    },

    /**
     * Kills the phantom process. Does nothing if it has not been started initially
     */
    done: function () {
        // Guard to prevent duplicate call of .exit();
        if (this.phantom) {
            this.phantom.exit();
            this.page = null;
            this.phantom = null;
        }
    }
};

module.exports = Revenant;
