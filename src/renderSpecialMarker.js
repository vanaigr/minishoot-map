import { loadShader, checkProg } from './render_util.js'

const vsSource = `#version 300 es
precision highp float;

layout(std140) uniform Camera {
    vec2 add;
    vec2 multiply;
} cam;

uniform float markerSize;
uniform int drawType;

in vec2 coord;

out vec2 uv;
flat out int type;

const vec2 coords[4] = vec2[4](vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0), vec2(1.0, 1.0));

void main(void) {
    vec2 offset = coords[gl_VertexID] * markerSize;
    if(drawType == 1) offset *= 1.4;

    vec2 pos = (coord + offset) * cam.multiply + cam.add;
    gl_Position = vec4(pos, 1.0, 1.0);
    uv = coords[gl_VertexID];

    type = drawType;
}
`
const fsSource = `#version 300 es
precision mediump float;

uniform sampler2D tex;
in vec2 uv;
flat in int type;

out vec4 color;

void main(void) {
    float sd = dot(uv, uv);
    float edgeWidth = fwidth(sd); ${''/* I hope square length is fine */}
    float alpha = smoothstep(1.0 - edgeWidth, 1.0 + edgeWidth, sd);

    vec4 col = vec4(0.5, 0.5, 0.9, 0);
    col.a = 1.0 - alpha;

    if(type == 3) {
        col.rgb = vec3(0.5, 0.9, 0.5);
    }

    if(type == 1) {
        col.rgb = vec3(1, 0, 0);
    }
    else  {
        col.rgb = mix(col.rgb, col.rgb * 0.7, sd * sd);
        if(type == 2) {
            col.rgb = mix(col.rgb, vec3(1.0), 0.2);
        }
    }

    color = col;
}
`

function checkOk(context) {
    const rd = context.specialMarker
    if(rd && rd.setupOk && rd.markersOk) {
        rd.selectedOk = true
        if(rd.indicesOk) {
            rd.visibleOk = true
        }
        context.requestRender(1)
    }
}

export function setup(context, markersP) {
    const renderData = {}
    context.specialMarker = renderData
    const { gl } = context

    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource, 'special marker v')
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource, 'special marker f')

    const prog = gl.createProgram()
    renderData.prog = prog
    gl.attachShader(prog, vertexShader)
    gl.attachShader(prog, fragmentShader)
    gl.linkProgram(prog)

    if(!checkProg(gl, prog)) return

    gl.useProgram(prog)

    gl.uniformBlockBinding(prog, gl.getUniformBlockIndex(prog, "Camera"), 0)

    const markerSize = gl.getUniformLocation(prog, 'markerSize')
    const drawType = gl.getUniformLocation(prog, 'drawType')
    renderData.u = { markerSize, drawType }

    const coordIn = gl.getAttribLocation(prog, 'coord')

    {
        const params = {}
        renderData.selected = params
        params.dataB = gl.createBuffer()
        params.data = new ArrayBuffer(8)
        params.dataView = new DataView(params.data)

        const vao = gl.createVertexArray()
        params.vao = vao
        gl.bindVertexArray(vao)
        gl.bindBuffer(gl.ARRAY_BUFFER, params.dataB)
        gl.bufferData(gl.ARRAY_BUFFER, 8, gl.DYNAMIC_DRAW)
        if(coordIn != -1) {
            gl.vertexAttribPointer(coordIn, 2, gl.FLOAT, false, 8, 0)
            gl.enableVertexAttribArray(coordIn)
            gl.vertexAttribDivisor(coordIn, 1)
        }
        gl.bindVertexArray(null)
    }

    {
        const params = {}
        renderData.visible = params
        params.dataB = gl.createBuffer()

        const vao = gl.createVertexArray()
        params.vao = vao

        gl.bindVertexArray(vao)
        gl.bindBuffer(gl.ARRAY_BUFFER, params.dataB)
        if(coordIn != -1) {
            gl.vertexAttribPointer(coordIn, 2, gl.FLOAT, false, 8, 0)
            gl.enableVertexAttribArray(coordIn)
            gl.vertexAttribDivisor(coordIn, 1)
        }
        gl.bindVertexArray(null)
    }

    {
        const params = {}
        renderData.rest = params
        params.dataB = gl.createBuffer()

        const vao = gl.createVertexArray()
        params.vao = vao

        gl.bindVertexArray(vao)
        gl.bindBuffer(gl.ARRAY_BUFFER, params.dataB)
        if(coordIn != -1) {
            gl.vertexAttribPointer(coordIn, 2, gl.FLOAT, false, 8, 0)
            gl.enableVertexAttribArray(coordIn)
            gl.vertexAttribDivisor(coordIn, 1)
        }
        gl.bindVertexArray(null)
    }

    renderData.setupOk = true

    markersP.then(data => {
        gl.bindBuffer(gl.ARRAY_BUFFER, renderData.rest.dataB)
        gl.bufferData(gl.ARRAY_BUFFER, data.restMarkers, gl.DYNAMIC_DRAW)
        renderData.restOk = true
        renderData.rest.count = data.restMarkers.byteLength / markerByteC

        gl.bindBuffer(gl.ARRAY_BUFFER, renderData.visible.dataB)
        gl.bufferData(gl.ARRAY_BUFFER, data.specialMarkers.byteLength, gl.DYNAMIC_DRAW)

        renderData.markersArray = new Uint8Array(data.specialMarkers)
        renderData.tempMarkersArray = new Uint8Array(new ArrayBuffer(data.specialMarkers.byteLength))
        renderData.regularC = data.regularCount
        renderData.markersOk = true
        renderData.currentInvalid = true

        checkOk(context)
        recalcCurrentMarkers(context)
    })

    renderData.selectedI = null
}

export function renderRest(context) {
    const rd = context.specialMarker
    if(rd?.restOk !== true) return
    const { gl, camera } = context

    const curSelectedI = context.sideMenu?.currentObject?.first?.markerI
    if(curSelectedI != rd.selectedI) {
        rd.selectedI = curSelectedI
        rd.currentInvalid = true
    }

    recalcCurrentMarkers(context)
    if(rd.currentInvalid) return

    gl.useProgram(rd.prog)
    gl.uniform1f(rd.u.markerSize, Math.min(camera.scale, 200) * 0.03)

    gl.bindVertexArray(rd.rest.vao)
    gl.uniform1i(rd.u.drawType, 3)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, rd.rest.count)
    gl.bindVertexArray(null)
}

export function renderVisible(context) {
    const rd = context.specialMarker
    if(rd?.visibleOk !== true) return
    const { gl, camera } = context

    gl.useProgram(rd.prog)
    gl.uniform1f(rd.u.markerSize, Math.min(camera.scale, 200) * 0.03)

    gl.bindVertexArray(rd.visible.vao)
    gl.uniform1i(rd.u.drawType, 0)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, rd.visible.count)
    gl.bindVertexArray(null)
}

export function setFiltered(context, { markersIndices }) {
    const renderData = context?.specialMarker
    if(!renderData) return console.error('renderData where?')

    renderData.markersIndices = markersIndices
    renderData.indicesOk = true
    renderData.currentInvalid = true

    checkOk(context)
    recalcCurrentMarkers(context)
}


export function renderSelected(context) {
    const rd = context.specialMarker
    if(rd?.selectedOk !== true) return
    const { gl, camera } = context

    const first = context.sideMenu?.currentObject?.first
    if(first && (first.markerType != 0 || !context.markers?.ok)) {
        rd.selected.dataView.setFloat32(0, first.pos[0], true)
        rd.selected.dataView.setFloat32(4, first.pos[1], true)
        gl.bindBuffer(gl.ARRAY_BUFFER, rd.selected.dataB)
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, rd.selected.data)

        gl.useProgram(rd.prog)
        gl.uniform1f(rd.u.markerSize, Math.min(camera.scale, 200) * 0.03)

        gl.bindVertexArray(rd.selected.vao)
        gl.uniform1i(rd.u.drawType, 1)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        gl.uniform1i(rd.u.drawType, 2)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
}

const markerByteC = 8

function recalcCurrentMarkers(context) {
    const renderData = context?.specialMarker
    if(!renderData || !renderData.visibleOk) return
    if(!renderData.currentInvalid) return
    const { gl } = context

    const selectedI = renderData.selectedI
    const indices = renderData.markersIndices
    const srcB = renderData.markersArray
    const resB = renderData.tempMarkersArray
    const count = srcB.byteLength / markerByteC

    let resI = 0
    for(let i = 0; i < indices.length; i++) {
        const index = indices[i] - renderData.regularC
        if(index === selectedI || index < 0 || index >= count) continue
        for(let j = 0; j < markerByteC; j++) {
            resB[resI*markerByteC + j] = srcB[index*markerByteC + j]
        }
        resI++
    }

    const currentO = renderData.visible
    gl.bindBuffer(gl.ARRAY_BUFFER, currentO.dataB)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, resB, 0, resI * markerByteC)
    currentO.count = resI

    renderData.currentInvalid = false
}
