import sharp from 'sharp'
import * as fs from 'node:fs'
import { join } from 'node:path'
import random from 'random'
import * as bkgs from '../data-raw/backgrounds/backgrounds.js'
const bgr = parseInt(bkgs.backgroundColor.slice(0, 2), 16)
const bgg = parseInt(bkgs.backgroundColor.slice(2, 4), 16)
const bgb = parseInt(bkgs.backgroundColor.slice(4, 6), 16)
const bgInt = bgr | (bgg << 8) | (bgb << 16)

const srcPath = join(import.meta.dirname, '../data-raw/backgrounds')
const dstPath = join(import.meta.dirname, '../data-processed/backgrounds')
const dstInfo = join(import.meta.dirname, '../data-processed/backgrounds/data.json')

const bgInfo = {
    voidColor: bgInt,
    imageRes: 512,
    startCoord: bkgs.backgroundStart,
    tileSize: bkgs.backgroundSize,
    tileCounts: bkgs.backgroundCount,
    backgrounds: bkgs.backgrounds,
}
fs.writeFileSync(dstInfo, JSON.stringify(bgInfo))

fs.mkdirSync(dstPath, { recursive: true })

const start = performance.now()

const filenames = fs.readdirSync(srcPath)
let imagesCount = 0
for(let i = 0; i < filenames.length; i++) {
    const fn = filenames[i]
    if(!fn.endsWith('.png')) {
        console.log('skipping', fn)
        continue
    }
    imagesCount++
    processImage(fn)
}

console.log('Total:', imagesCount)

let finishedCount = 0
function updateCount() {
    console.log('writing', finishedCount)
    finishedCount++
    if(finishedCount == imagesCount) {
        let end = performance.now()
        console.log('done in', end - start)
    }
}

const centroidC = 256

function genCentroids(uniqueColors) {
    const len = uniqueColors.length
    random.use(52)

    const centroids = new Uint32Array(centroidC)
    centroids[0] = bgInt

    const taken = new Set([bgInt])
    for (let i = 1; i < centroidC; i++) {
        do {
            var ri = uniqueColors[random.int(0, len - 1)]
        } while(taken.has(ri))
        taken.add(ri)
        centroids[i] = ri
    }

    return centroids
}

const totalDifferences = new Float32Array(centroidC * 3)
const totalCounts = new Uint32Array(centroidC)

function iterate(centroids, countsA) {
    const countsC = countsA.length

    for(let i = 0; i < countsC; i += 2) {
        const count = countsA[i*2 + 1]

        const col = countsA[i*2]
        const r = (col      ) & 0xff
        const g = (col >>  8) & 0xff
        const b = (col >> 16) & 0xff

        let minDist = 1 / 0
        let minJ = -1

        for(let j = 0; j < centroidC; j++) {
            const ccol = centroids[j]
            const dr = r - ((ccol      ) & 0xff)
            const dg = g - ((ccol >>  8) & 0xff)
            const db = b - ((ccol >> 16) & 0xff)
            const dist = dr*dr + dg*dg + db*db
            if(dist < minDist) {
                minJ = j
                minDist = dist
            }
        }

        const ccol = centroids[minJ]
        const dr = r - ((ccol      ) & 0xff)
        const dg = g - ((ccol >>  8) & 0xff)
        const db = b - ((ccol >> 16) & 0xff)

        totalDifferences[minJ*3    ] += dr * count
        totalDifferences[minJ*3 + 1] += dg * count
        totalDifferences[minJ*3 + 2] += db * count
        totalCounts[minJ] += count
    }

    // skip first centroid (void color - pinned to be the same)
    for(let i = 1; i < centroidC; i++) {
        const ccol = centroids[i]
        const cr = (ccol      ) & 0xff
        const cg = (ccol >>  8) & 0xff
        const cb = (ccol >> 16) & 0xff

        // console.log(totalDifferences[i*3], totalDifferences[i*3 + 1], totalDifferences[i*3 + 2], totalCounts[i])

        if(totalCounts[i] == 0) continue
        const tic = 1 / totalCounts[i]
        const r = Math.min(Math.max(0, cr + Math.round(totalDifferences[i*3    ] * tic)), 255)
        const g = Math.min(Math.max(0, cg + Math.round(totalDifferences[i*3 + 1] * tic)), 255)
        const b = Math.min(Math.max(0, cb + Math.round(totalDifferences[i*3 + 2] * tic)), 255)

        centroids[i] = r | (g << 8) | (b << 16)
    }

    totalDifferences.fill(0)
    totalCounts.fill(0)
}

const resizedLength = 512 * 512 * 3

async function processImage(fn) {
    const img = sharp(join(srcPath, fn))

    const resized = img.resize(512, 512, { kernel: 'lanczos2' })
    const resizedB = await resized.raw().toBuffer()
    if(resizedB.length !== resizedLength) throw 'Size?' + fn + ' ' + resizedB.length

    const counts = { [bgInt]: 1 }
    for(let i = 0; i < resizedLength; i += 3) {
        const v = resizedB[i] | (resizedB[i + 1] << 8) | (resizedB[i + 2] << 16)
        counts[v] = (counts[v] ?? 0) + 1
    }

    const uniqueColors = Object.keys(counts)
    const colorsC = uniqueColors.length

    if(colorsC < centroidC) {
        updateCount()
        sharp(resizedB, { raw: { width: 512, height: 512, channels: 3 } })
            .png({ compressionLevel: 9, palette: true })
            .toFile(join(dstPath, fn))
        return
    }

    const centroids = genCentroids(uniqueColors)

    const countsA = new Uint32Array(colorsC * 2)
    for(let i = 0; i < colorsC; i++) {
        const c = uniqueColors[i]
        countsA[i*2    ] = c
        countsA[i*2 + 1] = counts[c]
    }


    for(let iter = 0; iter < 3; iter++) {
        iterate(centroids, countsA)
    }

    const palette = {}
    for(let i = 0; i < uniqueColors.length; i++) {
        const col = uniqueColors[i]
        const r = (col      ) & 0xff
        const g = (col >>  8) & 0xff
        const b = (col >> 16) & 0xff

        let minDist = 1 / 0
        let minJ = -1

        for(let j = 0; j < centroidC; j++) {
            const ccol = centroids[j]
            const dr = r - ((ccol      ) & 0xff)
            const dg = g - ((ccol >>  8) & 0xff)
            const db = b - ((ccol >> 16) & 0xff)
            const dist = dr*dr + dg*dg + db*db
            if(dist < minDist) {
                minJ = j
                minDist = dist
            }
        }

        palette[col] = centroids[minJ]
    }

    const resultB = Buffer.alloc(resizedLength)
    for(let j = 0; j < resizedLength; j += 3) {
        const col = resizedB[j] | (resizedB[j + 1] << 8) | (resizedB[j + 2] << 16)
        const pcol = palette[col]
        resultB.writeUint8((pcol      ) & 0xff, j    )
        resultB.writeUint8((pcol >>  8) & 0xff, j + 1)
        resultB.writeUint8((pcol >> 16) & 0xff, j + 2)
    }

    updateCount()
    sharp(resultB, { raw: { width: 512, height: 512, channels: 3 } })
        .png({ compressionLevel: 9, palette: true }) // just hope it uses the same colors as us I guess
        .toFile(join(dstPath, fn))
}
