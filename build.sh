#!/bin/bash

BROWSERS=("chrome" "firefox" "edge")

# Function to build the extension for a specific browser
build_for_browser() {
    local browser=$1
    local output_dir="dist/${browser}"

    echo -n "Building for ${browser}..."

    mkdir -p "${output_dir}"
 
    # Copy common files to the output directory
    cp -r _locales franc icons "${output_dir}/"
    cp src/common/popup.html "${output_dir}/"
    cp src/common/style.css "${output_dir}/"
    cp src/config.js "${output_dir}/"
    cp src/common/content.js "${output_dir}/"

    # Combine browser-specific and common background scripts
    cat src/browser-specific/${browser}/background.js >"${output_dir}/background.js"
    cat src/common/background_common.js >>"${output_dir}/background.js"
    
    # Combine browser-specific and common popup scripts
    cat src/browser-specific/${browser}/popup.js src/common/popup_common.js >"${output_dir}/popup.js"
    
    # Merge common and browser-specific manifest files
    jq -s '.[0] * .[1]' src/common/manifest_common.json src/browser-specific/${browser}/manifest.json >"${output_dir}/manifest.json"

    echo "Build for ${browser} completed!"
}

# Check if jq is installed, which is necessary for merging JSON files
if ! command -v jq &>/dev/null; then
    echo "jq could not be found. Please install it to continue."
    exit 1
fi

# Clean the distribution directory to ensure a fresh build
rm -rf dist

for browser in "${BROWSERS[@]}"; do
    build_for_browser $browser
done

echo "Build process completed for all browsers!"
