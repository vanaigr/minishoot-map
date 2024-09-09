import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

import json5 from 'json5'

import { join, normalize } from 'node:path'
import * as fs from 'node:fs'

function srcPath(...paths: string[]) {
    return normalize(join(import.meta.dirname, 'src', ...paths))
}

const configPath = './config.json'

var userDefsS: string | undefined
try {
    userDefsS = fs.readFileSync(configPath)
}
catch(e) {
    console.warn('Config is not defined. Defaults will be used')
    userDefs = {}
}

var userDefs = {}
try {
    if(userDefsS) userDefs = json5.parse(userDefsS)
}
catch(e) {
    console.warn('Could not parse config. Defaults will be used')
    console.warn(e)
}

var defaultDefs = {
    __use_default_in_builds: true,

    worker: true,

    worker_backgrounds: true,
    worker_markers: true,
    worker_colliders: true,

    setup_markers: true,
    setup_colliders: true,
    setup_circular: true,

    render_markers: true,
    render_colliders: true,
    render_circular: true,

    backgrounds_mipmap_levels: 10,

    markers_mipmap_levels: 6,
}

var defines: any = {}
for(const k in defaultDefs) {
    const v = userDefs[k] ?? defaultDefs[k]
    defines[k] = v
}

export default defineConfig(({ command, mode, isSsrBuild, isPreview }) => {
    const useDefault = defines.__use_default_in_builds
    if(command === 'build' && useDefault) {
        console.warn('Using default config for build')
        defines = { ...defaultDefs }
    }
    for(const k in defines) defines['__' + k] = JSON.stringify(defines[k])
    delete defines.__use_default_in_builds

    return {
        root: './src',
        build: { outDir: '../dist', emptyOutDir: true },
        define: defines,
        resolve: {
            alias: {
                '$/objects.bp' : srcPath('./data-raw/objects/objects.bp'),
                '$/polygons.bp': srcPath('./data-processed/polygons.bp'),
                '$/markers.png': srcPath('./data-raw/markers/markers.png'),
                '$/backgrounds.pak': srcPath('./data-processed/backgrounds.pak'),

                '$/backgrounds.json': srcPath('./data-processed/backgrounds.json'),
                '$/markers-meta.json': srcPath('./data-processed/markers-meta.json'),
                '$/markers.json': srcPath('./data-processed/markers.json'),
                '$/meta.json': srcPath('./data-processed/meta.json'),
            },
        },
        assetsInclude: ['**/*.bp', '**/*.pak'],
        plugins: [
            viteStaticCopy({
                targets: [{ src: 'data-processed/backgrounds/*.png', dest: 'data/backgrounds/' }],
            }),
        ],
    }
})
