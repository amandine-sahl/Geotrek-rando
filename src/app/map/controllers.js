'use strict';

function MapController($q, $scope, globalSettings, $translate, $rootScope, $state, resultsService, filtersService, mapService, centerService, $stateParams) {

    $scope.currentState = $state.current.name;
    function centerMapOnLastView(fitBounds) {
        var center = centerService.getCenter($scope.currentState);

        if ($scope.shouldSetView && center) {
            fitBounds = false;
            setTimeout(function () {
                $rootScope.map.setView(center.LatLng, center.zoom, {animate:false});
                $scope.shouldSetView = false;
            }, 1000);
        }
    }

    function updateMapWithResults(fitBounds, forceRefresh) {
        var deferred = $q.defer();
        centerMapOnLastView(fitBounds);

        $rootScope.elementsLoading ++;
        deferred.resolve(
            filtersService.getFilteredResults()
                .then(
                    function (data) {
                        $scope.results = data;
                        if (data.length > 0) {
                            mapService.displayResults(data, fitBounds, forceRefresh);
                            $rootScope.elementsLoading --;
                        } else {
                            mapService.clearAllLayers();
                            $rootScope.elementsLoading --;
                        }
                    }
                )
        );
        return deferred.promise;
    }

    function updateMapWithDetails(forceRefresh) {
        var deferred = $q.defer();
        var fitBounds = true;
        // centerMapOnLastView(fitBounds);

        $rootScope.elementsLoading ++;
        var promise;
        if (!forceRefresh) {
            promise = resultsService.getAResultBySlug($stateParams.slug, $stateParams.catSlug, forceRefresh);
        } else {
            promise = resultsService.getAResultByID($scope.result.id, $scope.result.properties.category.id, forceRefresh);
        }

        deferred.resolve(
            promise
                .then(
                    function (data) {
                        $scope.result = data;
                        mapService.displayDetail($scope.result, fitBounds, forceRefresh);
                        $rootScope.elementsLoading --;
                    }, function () {
                        $rootScope.elementsLoading --;
                    }
                )
        );

        return deferred.promise;
    }

    function initCtrlsTranslation() {
        var deferred = $q.defer();

        var controllersListe = [
            {
                selector: '.leaflet-control-zoom-in',
                isTitle: true,
                translationID: 'ZOOM_IN'
            },
            {
                selector: '.leaflet-control-zoom-out',
                isTitle: true,
                translationID: 'ZOOM_OUT'
            },
            {
                selector: '.leaflet-control-zoom-fullscreen',
                isTitle: true,
                translationID: 'FULL_SCREEN'
            },
            {
                selector: '.leaflet-control-resetview-button',
                isTitle: true,
                translationID: 'RECENTER_VIEW'
            },
            {
                selector: '.simple-layer-switcher .toggle-layer',
                isTitle: true,
                translationID: 'TILES_SWITCH'
            },
            {
                selector: '.simple-services-toggle .toggle-layer',
                isTitle: true,
                translationID: 'SERVICES_TOGGLE'
            },
            {
                selector: '.leaflet-control-viewportfilter-caption',
                isTitle: false,
                translationID: 'VIEWPORT_FILTERING'
            }
        ];

        var promises = [];
        _.forEach(controllersListe, function (currentController) {
            var domElement = document.querySelector(currentController.selector);

            if (domElement) {
                promises.push(
                    $translate(currentController.translationID)
                        .then(
                            function (translation) {
                                if (currentController.isTitle) {
                                    domElement.setAttribute('title', translation);
                                } else {
                                    domElement.innerHTML = translation;
                                }
                            }
                        )
                );
            }
        });

        $q.all(promises).finally(function () {
            deferred.resolve(true);
        });

        return deferred.promise;
    }

    function mapInit(selector) {
        var deferred = $q.defer();

        var mapSelector = selector || 'map';
        $rootScope.map = mapService.initMap(mapSelector);

        initCtrlsTranslation().finally(function () {
            deferred.resolve(true);
        });

        $scope.shouldSetView = true;

        if ($state.current.name === 'layout.detail') {
            $rootScope.showFiltersOnMap = false;
        }

        if ($state.current.name === 'layout.root') {
            $rootScope.showFiltersOnMap = !!globalSettings.SHOW_FILTERS_ON_MAP;
        }

        $rootScope.isFullscreen = false;

        return deferred.promise;
    }

    mapInit('map');


    $rootScope.map.on('zoomend', function () {
        if ($state.current.name === 'layout.root') {
            if ((mapService.treksIconified && $rootScope.map.getZoom() >= globalSettings.TREKS_TO_GEOJSON_ZOOM_LEVEL) ||
                (!mapService.treksIconified && $rootScope.map.getZoom() < globalSettings.TREKS_TO_GEOJSON_ZOOM_LEVEL)) {
                mapService.displayResults($scope.results, false);
            }
        }

    });

    $rootScope.map.on('enterFullscreen', function () {
        $rootScope.isFullscreen = true;
        $rootScope.$digest();
        setTimeout(function() {
            $rootScope.map.invalidateSize(true);
        }, 1000);
    });

    $rootScope.map.on('exitFullscreen', function () {
        $rootScope.isFullscreen = false;
        $rootScope.$digest();
        setTimeout(function() {
            $rootScope.map.invalidateSize(false);
        }, 1000);
    });

    var rootScopeEvents = [
        $rootScope.$on('$stateChangeStart',
            function () {
                var map = $rootScope.map;
                centerService.setCenter(map.getCenter(), map.getZoom(), $scope.currentState);

                if (map && typeof map.remove === 'function') {
                    map.remove();
                }
            }
        ),
        $rootScope.$on('$stateChangeSuccess',
            function () {
                if ($state.current.name === 'layout.detail') {
                    $rootScope.showFiltersOnMap = false;
                }

                if ($state.current.name === 'layout.root') {
                    $rootScope.showFiltersOnMap = !!globalSettings.SHOW_FILTERS_ON_MAP;
                }
            }
        ),
        $rootScope.$on('resultsUpdated', function (name, forceRefresh) {
            if ($state.current.name === 'layout.root') {
                updateMapWithResults(globalSettings.UPDATE_MAP_ON_FILTER, forceRefresh);
            }
        }),
        $rootScope.$on('detailUpdated', function (name, forceRefresh) {
            if ($state.current.name === 'layout.detail' && !forceRefresh) {
                updateMapWithDetails(forceRefresh);
            }
        }),
        $rootScope.$on('switchGlobalLang', function () {
            initCtrlsTranslation();
        })
    ];

    $scope.$on('$destroy', function () { rootScopeEvents.forEach(function (dereg) { dereg(); }); });
}

module.exports = {
    MapController : MapController
};
