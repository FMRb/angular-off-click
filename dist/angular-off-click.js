'use strict';

angular.module('offClick', []);
angular.module('offClick').directive('offClick', ["$rootScope", "$parse", "OffClickFilterCache", function ($rootScope, $parse, OffClickFilterCache) {
    var id = 0;
    var listeners = {};
    // add variable to detect touch users moving..
    var touchMove = false;

    var targetInFilter = function targetInFilter(target, elms) {
        if (!target || !elms) return false;
        var elmsLen = elms.length;
        for (var i = 0; i < elmsLen; ++i) {
            var currentElem = elms[i];
            var containsTarget = false;
            try {
                containsTarget = currentElem.contains(target);
            } catch (e) {
                // If the node is not an Element (e.g., an SVGElement) node.contains() throws Exception in IE,
                // see https://connect.microsoft.com/IE/feedback/details/780874/node-contains-is-incorrect
                // In this case we use compareDocumentPosition() instead.
                if (typeof currentElem.compareDocumentPosition !== 'undefined') {
                    containsTarget = currentElem === target || Boolean(currentElem.compareDocumentPosition(target) & 16);
                }
            }

            if (containsTarget) {
                return true;
            }
        }
        return false;
    };

    var offClickEventHandler = function offClickEventHandler(event) {
        // If event is a touchmove adjust touchMove state
        if (event.type === 'touchmove') {
            touchMove = true;
            // And end function
            return false;
        }
        // This will always fire on the touchend after the touchmove runs...
        if (touchMove) {
            // Reset touchmove to false
            touchMove = false;
            // And end function
            return false;
        }
        var target = event.target || event.srcElement;
        angular.forEach(listeners, function (listener, i) {
            var filters = OffClickFilterCache['*'] || [];
            if (listener.elm.id && listener.elm.id !== '') {
                if (OffClickFilterCache['#' + listener.elm.id]) filters = filters.concat(OffClickFilterCache['#' + listener.elm.id]);
            }
            // classList is an object in IE10 and 11 iirc, using angular.forEach to iterate both over an array or object values
            angular.forEach(listener.elm.classList, function (className) {
                if (OffClickFilterCache['.' + className]) filters = filters.concat(OffClickFilterCache['.' + className]);
            });
            if (!(listener.elm.contains(target) || targetInFilter(target, filters))) {
                $rootScope.$evalAsync(function () {
                    listener.cb(listener.scope, {
                        $event: event
                    });
                });
            }
        });
    };

    // Add event listeners to handle various events. Destop will ignore touch events
    document.addEventListener("touchmove", offClickEventHandler, true);
    document.addEventListener("touchend", offClickEventHandler, true);
    document.addEventListener('click', offClickEventHandler, true);

    return {
        restrict: 'A',
        compile: function compile(elem, attrs) {
            var fn = $parse(attrs.offClick);

            return function (scope, element) {
                var elmId = id++;
                var removeWatcher = void 0;

                var on = function on() {
                    listeners[elmId] = {
                        elm: element[0],
                        cb: fn,
                        scope: scope
                    };
                };

                var off = function off() {
                    listeners[elmId] = null;
                    delete listeners[elmId];
                };

                if (attrs.offClickIf) {
                    removeWatcher = $rootScope.$watch(function () {
                        return $parse(attrs.offClickIf)(scope);
                    }, function (newVal) {
                        newVal && on() || !newVal && off();
                    });
                } else on();

                scope.$on('$destroy', function () {
                    off();
                    document.removeEventListener('touchmove', offClickEventHandler, true);
                    document.removeEventListener("touchend", offClickEventHandler, true);
                    document.removeEventListener('click', offClickEventHandler, true);
                    if (removeWatcher) {
                        removeWatcher();
                    }
                    element = null;
                });
            };
        }
    };
}]);

angular.module('offClick').directive('offClickFilter', ["OffClickFilterCache", "$parse", function (OffClickFilterCache, $parse) {
    var filters = void 0;

    return {
        restrict: 'A',
        compile: function compile(elem, attrs) {
            return function (scope, element) {
                filters = $parse(attrs.offClickFilter)(scope).split(',').map(function (x) {
                    return x.trim();
                });

                filters.forEach(function (filter) {
                    OffClickFilterCache[filter] ? OffClickFilterCache[filter].push(element[0]) : OffClickFilterCache[filter] = [element[0]];
                });

                scope.$on('$destroy', function () {
                    filters.forEach(function (filter) {
                        if (angular.isArray(OffClickFilterCache[filter]) && OffClickFilterCache[filter].length > 1) {
                            OffClickFilterCache[filter].splice(OffClickFilterCache[filter].indexOf(element[0]), 1);
                        } else {
                            OffClickFilterCache[filter] = null;
                            delete OffClickFilterCache[filter];
                        }
                    });
                    element = null;
                });
            };
        }
    };
}]);

angular.module('offClick').factory('OffClickFilterCache', function () {
    var filterCache = {};
    return filterCache;
});