import { promises as fs } from 'node:fs'
import { createWriteStream } from 'node:fs'
import { join } from 'node:path'

const srcDir = join(import.meta.dirname, '../data-processed/backgrounds')
const dstFilename = join(import.meta.dirname, '../data-processed/backgrounds.pak')
const dstDataFilename = join(import.meta.dirname, '../data-processed/backgrounds.json')

const srcData = JSON.parse(await fs.readFile(join(srcDir, 'data.json')))
const coords = srcData.backgrounds

const filesP = []
for(let i = 0; i < coords.length; i++) {
    const c = coords[i]
    filesP.push(fs.readFile(join(srcDir, c[0] + '_' + c[1] + '.png')))
}

const header = []

function writeUint(v) {
    var it = v
    do {
        var div = it >> 7;
        var rem = it & ((1 << 7) - 1)
        header.push(rem | (div == 0 ? 1 << 7 : 0))
        it = div;
    } while(it != 0)
}

writeUint(coords.length)

const files = await Promise.all(filesP)

for(let i = 0; i < coords.length; i++) {
    writeUint(files[i].length)
    const c = coords[i]
    writeUint(c[1] * srcData.tileCounts[0] + c[0])
    console.log(c[1] * srcData.tileCounts[0] + c[0])
}

const dst = createWriteStream(dstFilename)
const hLen = Buffer.alloc(4)
hLen.writeUint32LE(header.length)
dst.write(hLen)
dst.write(Buffer.from(header))

for(let i = 0; i < files.length; i++) {
    dst.write(files[i])
}

const dstData = {
    voidColor: srcData.voidColor,
    imageRes: srcData.imageRes,
    startCoord: srcData.startCoord,
    tileSize: srcData.tileSize,
    tilesInX: srcData.tileCounts[0],
    tileCount: coords.length,
}
await fs.writeFile(dstDataFilename, JSON.stringify(dstData))

dst.end(async() => {
    console.log('Done!')
})
