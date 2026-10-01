#!/bin/sh
#
# Assemble the publishable site.
#
# There is no bundler and nothing to compile: site/ is the site, served exactly
# as written. The only build step is copying Mapbox's distributed files in
# beside it, so that what ships always matches the version in package.json.

set -eu

rm -rf build
mkdir -p build/vendor

cp -R site/. build/
cp node_modules/mapbox-gl/dist/mapbox-gl.js build/vendor/mapbox-gl.js
cp node_modules/mapbox-gl/dist/mapbox-gl.css build/vendor/mapbox-gl.css

echo "Built build/ ($(find build -type f | wc -l) files)"
