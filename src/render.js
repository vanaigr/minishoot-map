import * as canvasDisplay from './canvas.js'
import * as backgroundsDisplay from './renderBackground.js'
import * as collidersDisplay from './renderColliders.js'
import * as circularDisplay from './renderCircularColliders.js'
import * as markersDisplay from './renderMarkers.js'
import * as specMarkerDisplay from './renderSpecialMarker.js'
import * as sideMenu from './sideMenu.jsx'
import { xpForCrystalSize } from '$/meta.json'

var resolveCollidersP
const collidersP = new Promise((s, j) => {
    resolveCollidersP = s
})

var resolveMarkersDataP
const markersP = new Promise((s, j) => {
    resolveMarkersDataP = s
})

var worker
if(__worker) {
    worker = window.worker
    worker.onmessage = (e) => {
        const d = e.data
        console.log('received from worker', d.type)

        if(d.type === 'click') {
            sideMenu.setCurrentObject({ first: d.first, nearby: d.nearby })
            updUrl(d.first)
        }
        else if(d.type === 'getInfo') {
            sideMenu.setCurrentObject({ first: d.object })
            updUrl(d.object)
        }
        else if(d.type === 'getSceneInfo') {
            sideMenu.setCurrentObject({ scene: d.scene })
        }
        else if(d.type === 'colliders-done') {
            const it = {
                verts: d.verts,
                indices: d.indices,
                polyDrawData: d.polyDrawData,
                circularData: d.circularData,
                circularDrawData: d.circularDrawData,
            }
            resolveCollidersP(it)
        }
        else if(d.type == 'markers-done') {
            resolveMarkersDataP({
                markersData: d.markersData,
                markers: d.markers,
                specialMarkers: d.specialMarkers,
                restMarkers: d.restMarkers,
            })
        }
        else if(d.type == 'marker-filters') {
            const it = { markersIndices: d.markersIndices }
            markersDisplay.setFiltered(context, it)
            specMarkerDisplay.setFiltered(context, it)
        }
    }
    worker.postMessage({ type: 'ready' })
}

const canvas = document.getElementById('glCanvas')
const gl = canvas.getContext('webgl2', { alpha: false })

if (!gl) { throw 'WebGL 2 is not supported.' }

// Note: this is not correct alpha blending, works only if background is already fully transparent!
// 1. Source alpha is multiplied by itself so overall transparency decreases when drawing transparent things
// 2. Disregards destination alpha (dst color should be multiplied by it).
// This all doesn't matter when background starts as fully opaque and alpha is disregarded at the end.
gl.enable(gl.BLEND)
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

function render(context) {
    if(window.__stop) return

    if(!canvasDisplay.resize(context)) return

    const b = context.cameraBuf
    const aspect = context.canvasSize[1] / context.canvasSize[0]
    const scale = 1 / context.camera.scale
    b[0] = -context.camera.posX * (scale * aspect)
    b[1] = -context.camera.posY * scale
    b[2] = scale * aspect
    b[3] = scale
    gl.bindBuffer(gl.UNIFORM_BUFFER, context.cameraUbo)
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, b)

    backgroundsDisplay.render(context)
    if(__render_colliders) collidersDisplay.render(context)
    if(__render_circular) circularDisplay.render(context)
    if(context.filters[1][2]) specMarkerDisplay.renderRest(context)
    specMarkerDisplay.renderVisible(context)
    if(__render_markers) markersDisplay.render(context)
    specMarkerDisplay.renderSelected(context)
}

function requestRender(priority/* 0 - immediate, 1 - animation, 2 - idle */) {
    const rr = this.renderRequest
    if(rr != null) {
        if(rr.priority <= priority) return
        rr.cancel()
    }

    if(priority == 0) {
        this.renderRequest = null
        render(this)
    }
    else if(priority == 1) {
        this.renderRequest = {
            priority: 1,
            cancel() { cancelAnimationFrame(this.id) },
            id: requestAnimationFrame(() => {
                this.renderRequest = null
                render(this)
            })
        }
    }
    else {
        this.renderRequest = {
            priority: 2,
            cancel() { cancelIdleCallback(this.id) },
            id: requestIdleCallback(() => {
                this.renderRequest = null
                render(this)
            })
        }
    }
}

const filters = [
    [
        '$Object', 'Show markers', true, 'filters',
        [
            [
                'Enemy', 'Show enemies', true, 'filters',
                [
                    ['size', 'Filter by size', false, 'number', 3],
                    ['tier', 'Filter by tier', false, 'number', 1],
                ],
            ],
            [
                'Jar', 'Show jars', true, 'filters',
                [
                    ['size', 'Filter by size', false, 'number', 0],
                    [
                        'dropType', 'Filter by drop type', false, 'enum',
                        [
                            [0, 'nothing [0]', false],
                            [1, 'hp [1]', false],
                            [2, 'random [2]', false],
                            [3, 'big crystal [3]', true],
                            [4, 'energy [4]', false],
                            [5, 'full energy [5]', false],
                            [6, '65 big crystals [6]', true],
                        ],
                    ]
                ],
            ],
            [
                'CrystalDestroyable', 'Show crystals', true, 'filters',
                [
                    ['dropXp', 'Filter by xp drop', false, 'boolean', [true, true]],
                    [
                        'size', 'Filter by size', false, 'enum',
                        (() => {
                            const result = []
                            for(let i = 0; i < xpForCrystalSize.length; i++) {
                                result.push([i, '' + i + ' [' + xpForCrystalSize[i] + ' xp]', true])
                            }
                            return result
                        })(),
                    ],
                ],
            ],
            ['Pickup', 'Show pickups', true, 'filters', [
                ['CrystalKey', 'Show regular keys', true, 'filters', []],
                ['BossKey', 'Show boss keys', true, 'filters', []],
                ['CrystalBoss', 'Show boss drop keys', true, 'filters', []],
                ['KeyUnique', 'Show unique keys', true, 'filters', []],
                ['ModulePickup', 'Show module pickups', true, 'filters', []],
                ['SkillPickup', 'Show skill pickups', true, 'filters', []],
                ['StatsPickup', 'Show stats pickups', true, 'filters', []],
                ['ScarabPickup', 'Show scarabs', true, 'filters', []],
                ['LorePickup', 'Show lore tablets', true, 'filters', []],
                ['MapPickup', 'Show map pieces', true, 'filters', []],
            ]],
            ['Unlocker', 'Show unlockers', true, 'filters', []],
            ['UnlockerTrigger', 'Show unlockr triggers', true, 'filters', []],
            ['Torch', 'Show torches', true, 'filters', []],
            ['Transition', 'Show transitions', true, 'filters', []],
            ['Tunnel', 'Show tunnels', true, 'filters', []],
            ['Npc', 'Show NPCs', true, 'filters', []],
        ],
    ],
    [
        '$Rest', 'Show all other objects (slow!)', false, 'filters', [],
    ],
    [
        '$Collider', 'Show colliders', false, 'filters',
        [
            [
                'layer', 'Filter by layer', true, 'enum',
                [
                    // TODO: auto calculate which layers are absent from colliders
                    [0, '0', false],
                    // [1, '1', true],
                    // [2, '2', true],
                    [3, '3', false],
                    [4, 'water [4]', true],
                    [5, '5', false],
                    [6, 'deep water [6]', true],
                    // [7, '7', true],
                    // [8, '8', true],
                    // [9, '9', true],
                    // [10, '10', true],
                    [11, '11', false],
                    [12, 'destroyable [12]', true],
                    [13, 'destroyable [13]', true],
                    [14, 'wall [14]', true],
                    [15, '15', false],
                    [16, 'hole [16]', true],
                    [17, 'trigger? [17]', false],
                    [18, '18', false],
                    // [19, '19', true],
                    [20, '20', false],
                    [21, '21', false],
                    // [22, '22', true],
                    [23, 'static [23]', true],
                    // [24, '24', true],
                    [25, 'bridge [25]', true],
                    [26, 'destroyable [26]', true],
                    // [27, '27', true],
                    // [28, '28', true],
                    [29, '29', false],
                    // [30, '30', true],
                    [31, '31', false],
                ],
            ]
        ],
    ],
    [
        '$Background', 'Show backgrounds', true, 'filters',
        []
    ]
]

function prepFiltersFilter(filter, res) {
    const propFilters = []
    const fieldFilters = filter[4]
    for(let j = 0; j < fieldFilters.length; j++) {
        const fieldFilter = fieldFilters[j]
        if(!fieldFilter[2]) continue
        else if(fieldFilter[3] === 'filters') {
            prepFiltersFilter(fieldFilter, res)
            continue
        }

        let values = []
        if(fieldFilter[3] === 'enum') {
            const filterValues = fieldFilter[4]
            for(let k = 0; k < filterValues.length; k++) {
                const filterValue = filterValues[k]
                if(!filterValue[2]) continue
                values.push(filterValue[0])
            }
        }
        else if(fieldFilter[3] === 'boolean') {
            if(fieldFilter[4][0]) values.push(false)
            if(fieldFilter[4][1]) values.push(true)
        }
        else {
            values.push(fieldFilter[4])
        }

        propFilters.push([fieldFilter[0], values])
    }

    res.push([filter[0], propFilters])
}

function extractMarkerFilters(filters) {
    const res = []
    if(!filters[0][2]) return res

    const ff = filters[0][4]
    for(let i = 0; i < ff.length; i++) {
        const filter = ff[i]

        if(!filter[2]) continue
        if(filter[3] !== 'filters') {
            console.error('not filters?', filter)
            continue
        }

        prepFiltersFilter(filter, res)
    }
    console.log(res)
    return res
}

function checkEquality(a, b) {
    if(Array.isArray(a) && Array.isArray(b)) {
        if(a.length !== b.length) return false
        for(let i = 0; i < a.length; i++) {
            if(!checkEquality(a[i], b[i])) return false
        }
        return true
    }
    else return a === b
}

function extractColliderFilters(filters) {
    const res = []

    if(!filters[2][2]) {
    }
    else if(filters[2][4][0][2]) {
        const ff = filters[2][4][0][4]
        for(let i = 0; i < ff.length; i++) {
            const f = ff[i]
            if(f[2]) res.push(f[0])
        }
    }
    else {
        for(let i = 0; i < 32; i++) {
            res.push(i)
        }
    }

    return res
}

function sendFiltersUpdate(context) {
    const lastFilters = context.lastFilters

    const markers = extractMarkerFilters(context.filters)
    markers.includeRest = context.filters[1][2]
    if(!checkEquality(markers, lastFilters.markers)
        || markers.includeRest !== lastFilters.includeRest
    ) {
        lastFilters.markers = markers

        try { worker.postMessage({ type: 'filters', markers }) }
        catch(e) { console.error(e) }
    }

    const colliders = extractColliderFilters(context.filters)
    if(!checkEquality(colliders, lastFilters.colliders)) {
        lastFilters.colliders = colliders

        collidersDisplay.setFiltered(context, colliders)
        circularDisplay.setFiltered(context, colliders)
    }

    backgroundsDisplay.setFiltered(context, context.filters[3][2])
}

const context = {
    canvas, gl,
    renderRequest: null,
    requestRender,
    camera: { posX: 0, posY: 0, scale: 10 },
    canvasSize: [],
    filters,
    lastFilters: {},
    filtersUpdated() {
        try { sideMenu.filtersUpdated() }
        catch(e) { console.error(e) }

        sendFiltersUpdate(this)
    },
    onClick(x, y) {
        worker?.postMessage({ type: 'click', x, y })
    },
    viewObject(index) {
        if(index == null) return
        worker?.postMessage({ type: 'getInfo', index })
    }
}

try { sideMenu.setup(context) }
catch(e) { console.error(e) }

try { canvasDisplay.setup(context) }
catch(e) { console.error(e) }

try { backgroundsDisplay.setup(context) }
catch(e) { console.error(e) }

try { if(__setup_markers) markersDisplay.setup(gl, context, markersP) }
catch(e) { console.error(e) }

try { specMarkerDisplay.setup(context, markersP) }
catch(e) { console.error(e) }

try { collidersDisplay.setup(gl, context, collidersP) }
catch(e) { console.error(e) }

try { circularDisplay.setup(gl, context, collidersP) }
catch(e) { console.error(e) }


/* prep Camera UBO */ {
    /*
layout(std140) uniform Camera {
    vec2 add;
    vec2 multiply;
} cam;
    */

    const ubo = gl.createBuffer()
    gl.bindBuffer(gl.UNIFORM_BUFFER, ubo)
    gl.bufferData(gl.UNIFORM_BUFFER, 16, gl.STATIC_DRAW)
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, ubo)

    context.cameraUbo = ubo
    context.cameraBuf = new Float32Array(4)
}

try { sendFiltersUpdate(context) }
catch(e) { console.error(e) }

try {
    const url = new URL(window.location.href)
    const posx = parseFloat(url.searchParams.get('posx'))
    const posy = parseFloat(url.searchParams.get('posy'))
    if(isFinite(posx) && isFinite(posy)) {
        context.camera.posX = posx
        context.camera.posY = posy
        context.requestRender(1)
    }
}
catch(e) {
    console.error(e)
}

function updUrl(obj) {
    const posx = obj.pos[0]
    const posy = obj.pos[1]

    const url = new URL(window.location.href)
    const prevPosx = parseFloat(url.searchParams.get('posx'))
    const prevPosy = parseFloat(url.searchParams.get('posy'))
    if(isFinite(posx) && isFinite(posy) && (posx != prevPosx || posy != prevPosy)) {
        url.searchParams.set('posx', posx)
        url.searchParams.set('posy', posy)
        window.history.pushState({}, '', url)
    }
}
