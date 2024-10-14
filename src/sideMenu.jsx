import * as R from 'react'
import { createPortal } from 'react-dom'
import reactDom from 'react-dom/client'
import * as Z from 'zustand'
import { meta, getAsSchema, parsedSchema } from '/schema.js'

const useCurrentObject = Z.create((set) => ({
    data: {},
    tick: 0,
    update(newData) {
        set((cur) => ({ data: newData, tick: cur.tick + 1 }))
    },
}))

var gotoOther = () => { console.log('state?') }
var context
var renderData = { currentObject: null }

var sideMenuElement, tabsElement

const filtersRev = Z.create(() => 0)
export function filtersUpdated() {
    filtersRev.setState((s) => s + 1)
}

export function setup(_context) {
    context = _context
    context.sideMenu = renderData
    gotoOther = context.viewObject

    sideMenuElement = window['side-menu']
    tabsElement = window['tabs']

    const root = reactDom.createRoot(sideMenuElement)
    root.render(<R.StrictMode><SideMenu /></R.StrictMode>)
}

export function setCurrentObject(obj) {
    renderData.currentObject = obj
    if(context) context.requestRender(1)

    // console.log(JSON.parse(JSON.stringify(obj)))
    useCurrentObject.getState().update(obj)
}

const useCurrentTab = Z.create(() => 0)

function SideMenu() {

    return <>
        <Tabs/>
        <div>
            <ObjectMenu/>
            <FilterMenu/>
        </div>
    </>
}

function Tabs() {
    const currentTab = useCurrentTab()

    function tab(e) {
        useCurrentTab.setState(parseInt(e.target.value))
    }
    function setTab(target) {
        if(!target) return
        if(target.value === '' + currentTab) {
            target.checked = true
        }
    }

    return createPortal(
        <div className='menu-type' data-map-selected>
            <label className="map-button">
                <input type='radio' name='menu' value='0'
                    ref={setTab} onChange={tab}/>Map
            </label>
            <label>
                <input type='radio' name='menu' value='1'
                    ref={setTab} onChange={tab}/>Object
            </label>
            <label>
                <input type='radio' name='menu' value='2'
                    ref={setTab} onChange={tab}/>Filters
            </label>
        </div>,
        tabsElement
    )
}

function Filter({ filter }) {
    const [name, displayName, enabled, type, param] = filter
    var inner, t = 'inline'
    if(type === 'filters') {
        t = 'newline'
        const filtersA = []
        for(let i = 0; i < param.length; i++) {
            filtersA.push(<Filter key={i} filter={param[i]}/>)
        }
        inner = <div>{filtersA}</div>
    }
    else if(type === 'number') {
        const changed = (e) => {
            filter[4] = e.target.value
            context.filtersUpdated()
        }
        inner = <input type='number' style={{width: '3rem'}} onChange={changed} value={param}/>
    }
    else if(type === 'name') {
        const changed = (e) => {
            filter[4] = e.target.value
            context.filtersUpdated()
        }
        inner = <input type='text' style={{width: '5rem'}} onChange={changed} value={param}/>
    }
    else if(type === 'boolean') {
        t = 'newline'
        const changed = (v) => (e) => {
            param[v] = e.target.checked
            context.filtersUpdated()
        }
        inner = <div className='filter-list'>
            <label><input type='checkbox' checked={param[0]} onChange={changed(0)}/>no</label>
            <label><input type='checkbox' checked={param[1]} onChange={changed(1)}/>yes</label>
        </div>
    }
    else if(type === 'enum') {
        t = 'newline'
        const innerA = Array(param.length)
        for(let i = 0; i < param.length; i++) {
            const p = param[i]
            const changed = (e) => {
                p[2] = e.target.checked
                context.filtersUpdated()
            }
            innerA[i] = <label key={i}>
                <input type='checkbox' checked={p[2]}
                    onChange={changed}/>{p[1]}
            </label>
        }
        inner = <div className='filter-list'>{innerA}</div>
    }

    const filterChanged = (e) => {
        filter[2] = e.target.checked
        context.filtersUpdated()
    }

    return <div key={name} className={'filter ' + t}>
        <label><input type='checkbox' checked={enabled}
            onChange={filterChanged}/>{displayName}</label>
        {inner}
    </div>
}

function FilterMenu() {
    filtersRev()
    const filtersA = []
    for(let i = 0; i < context.filters.length; i++) {
        filtersA.push(<Filter key={i} filter={context.filters[i]}/>)
    }
    return <div className='filter-menu'>
        {filtersA}
    </div>
}

function ObjectMenu() {
    const obj = useCurrentObject()
    if(obj.data?.scene != null) {
        return <div key={obj.tick} className='object-menu'>
            <Scene scene={obj.data.scene}/>
        </div>
    }
    else {
        return <div key={obj.tick} className='object-menu'>
            <Object first={obj.data?.first}/>
            <div className="space"></div>
            <Other nearby={obj.data?.nearby}/>
        </div>
    }
}

function vec2s(v) {
    return v[0] + ', ' + v[1]
}

function Scene({ scene }) {
    const children = Array(scene.children.length)
    for(let i = 0; i < scene.children.length; i++) {
        const ci = scene.children[i]
        children[i] = <Link key={i} index={ci} name={scene.referenceNames[ci]}/>
    }

    return <>
        <Props>
            <Prop>Name:{scene.name}</Prop>
        </Props>
        <div className="space"></div>
        <details className="component" open={true}>
            <summary>Children</summary>
            <Props>{children}</Props>
        </details>
    </>
}

function Object({ first }) {
    if(first == null) {
        return <div>
            No object selected
        </div>
    }

    const components = []
    for(let i = 0; i < first.components.length; i++) {
        components[i] = <Component key={i} comp={first.components[i]} obj={first} />
    }

    function focus() {
        context.camera.posX = first.pos[0]
        context.camera.posY = first.pos[1]
        context.requestRender(1)
    }

    return <>
        <button onClick={focus}>Focus</button>
        <Props>
            <Prop>Name:{first.name}</Prop>
            <Prop>Position:{vec2s(first.pos)}</Prop>
        </Props>
        <div className="space"></div>
        <Parent obj={first}/>
        <Children obj={first}/>
        <div className="space"></div>
        <div>Components:</div>
        <div className="components">{components}</div>
    </>
}

const ti = parsedSchema.typeSchemaI

function Parent({ obj }) {
    return <Props>
        <Prop>
            Parent:
            {<Link index={obj.parent} name={obj.referenceNames[obj.parent]}/>}
        </Prop>
    </Props>
}

function Children({ obj }) {
    const children = Array(obj.children.length)
    for(let i = 0; i < obj.children.length; i++) {
        const ci = obj.children[i]
        children[i] = <Link key={i} index={ci} name={obj.referenceNames[ci]}/>
    }

    return <details className="component">
        <summary>Children</summary>
        <Props>{children}</Props>
    </details>
}

function componentInfoToComponent(childC) {
    return <details className="component" open={!childC.empty}>
        <summary className={childC.empty ? 'empty-component' : null}>{childC.name}</summary>
        {childC.component}
    </details>
}

function componentInfo(comp, obj) {
    const cname = meta.schemas[comp._schema].shortName

    for(let i = 0; i < componentDecl.length; i++) {
        const schemaI = componentDecl[i][0]
        if(comp._schema !== schemaI) continue

        return { empty: false, name: cname, component: componentDecl[i][1](comp, obj) }
    }


    var inner = null
    var isEmpty = true
    var base = comp._base
    if(shouldDisplay(base)) {
        const baseInfo = componentInfo(base, obj)
        inner = componentInfoToComponent(baseInfo)
        isEmpty = baseInfo.empty
    }

    const res = <Props>{inner}</Props>
    return { empty: isEmpty, name: cname, component: res }
}

function shouldDisplay(comp) {
    return comp != null;
}

function Component({ comp, obj }) {
    if(!shouldDisplay(comp)) return
    return componentInfoToComponent(componentInfo(comp, obj))
}

const componentDecl = []
function ac(schema, componentC) {
    componentDecl.push([schema, componentC])
}

ac(ti.Transform, (c, o) => {
    return <Props>
        <Prop>Local position:{vec2s(c.position)}</Prop>
        <Prop>Local scale:{vec2s(c.scale)}</Prop>
        <Prop>Local rotation:{c.rotation}</Prop>
        <Component comp={c._base} obj={o}/>
    </Props>
})

function bs(v) { return v ? 'yes' : 'no' }

ac(ti.CrystalDestroyable, (c, o) => {
    const v = meta.xpForCrystalSize[c.size] ?? '<Unknown>'
    return <Props>
        <Prop>Drops XP:{bs(c.dropXp) + (c.dropXp ? ` (${v}xp)` : '')}</Prop>
        <Prop>Size:{c.size}</Prop>
        <Component comp={c._base} obj={o}/>
    </Props>
})

ac(ti.Destroyable, (c, o) => {
    return <Props>
        <Prop>Hp:{c.hp}</Prop>
        <Prop>Invincible:{bs(c.invincible)}</Prop>
        <Prop>Flat damage:{bs(c.flatDamage)}</Prop>
        <Prop>Permanent:{bs(c.permanent)}</Prop>
        <Component comp={c._base} obj={o}/>
    </Props>
})

ac(ti.Collider2D, (c, o) => {
    return <Props>
        <Prop>Is trigger:{bs(c.isTrigger)}</Prop>
        <Prop>Offset:{vec2s(c.offset)}</Prop>
        <Component comp={c._base} obj={o}/>
    </Props>
})

ac(ti.BoxCollider2D, (c, o) => {
    return <Props>
        <Prop>Size:{vec2s(c.size)}</Prop>
        <Component comp={c._base} obj={o}/>
    </Props>
})

ac(ti.CapsuleCollider2D, (c, o) => {
    return <Props>
        <Prop>Size:{vec2s(c.size)}</Prop>
        <Component comp={c._base} obj={o}/>
    </Props>
})

ac(ti.CircleCollider2D, (c, o) => {
    return <Props>
        <Prop>Radius:{c.radius}</Prop>
        <Component comp={c._base} obj={o}/>
    </Props>
})

function Link({ index, name }) {
    const displayName = name != null ? name || '<No name>' : '<Unknown>'

    if(index != null) {
        function onClick() { gotoOther(index) }
        function reactIsDumb(element) {
            // imagine saying that this is a security vulnerability
            if(element) element.href = "javascript:void(0)"
        }
        return <a ref={reactIsDumb} onClick={onClick}>{displayName}</a>
    }
    else {
        return <span>{displayName}</span>
    }
}

ac(ti.ScarabPickup, (c, o) => {
    return <Props>
        <Prop>
            Container:
            <Link index={c.container} name={o.referenceNames[c.container]}/>
        </Prop>
        <Component comp={c._base} obj={o}/>
    </Props>
})

ac(ti.Transition, (c, o) => {
    return <Props>
        <Prop>Destination:{<Link index={c.destI} name={o.referenceNames[c.destI]}/>}</Prop>
        <Component comp={c._base} obj={o}/>
    </Props>
})

const keyUses = ["None", "Normal", "Boss", "Scarab", "Darker", "FinalBoss"]

ac(ti.Unlocker, (c, o) => {
    const gc = Array(c.group.length)
    for(let i = 0; i < gc.length; i++) {
        const l = c.group[i]
        gc[i] = <Link key={i} index={l} name={o.referenceNames[l]}/>
    }

    return <Props>
        <Prop>KeyUse:{keyUses[c.keyUse] ?? '<Unknown>'}</Prop>
        <Prop>Target:<Link index={c.target} name={o.referenceNames[c.target]}/></Prop>
        <Prop>Target bis (?):<Link index={c.targetBis} name={o.referenceNames[c.targetBis]}/></Prop>
        <Prop>Group:<Props>{gc}</Props></Prop>
        <Component comp={c._base} obj={o}/>
    </Props>
})

ac(ti.UnlockerTorch, (c, o) => {
    const gc = Array(c.group.length)
    for(let i = 0; i < gc.length; i++) {
        const l = c.group[i]
        gc[i] = <Link key={i} index={l} name={o.referenceNames[l]}/>
    }

    return <Props>
        <Prop>Target:<Link index={c.target} name={o.referenceNames[c.target]}/></Prop>
        <Prop>Target bis (?):<Link index={c.targetBis} name={o.referenceNames[c.targetBis]}/></Prop>
        <Prop>Linked torch:<Link index={c.linkedTorch} name={o.referenceNames[c.linkedTorch]}/></Prop>
        <Prop>Group:<Props>{gc}</Props></Prop>
        <Component comp={c._base} obj={o}/>
    </Props>
})

const objectiveNames = [
	"None", "Dungeon1", "Dungeon2", "Dungeon3", "Dungeon4", "Dungeon5", "Temple1", "Temple2", "Temple3", "Tower1", "Tower2",
	"Tower3", "Tower4", "FreeAcademician", "OpenSanctuary", "AwakeTree", "TurtleArrived", "FreeMercantHub", "FreeScarabCollector",
	"FreeBlacksmith", "FreeBard", "FreeFamilly1", "FreeFamilly3", "FreeExplorer", "FreeHealer", "SkillBoost", "SkillDash",
	"SkillSupershot", "SkillHover", "ShopGarden", "ShopForest", "ShopSwamp", "Scarab", "FreeFamilly2", "GotAllCrystalBossKey",
	"TrueLastBoss", "CaveGreenBeach", "CaveGreenGarden", "CaveGreenZelda", "CaveAcademyRuin", "CaveForest", "CaveForestJunkyard",
	"CaveAbyss", "CaveAbyssDesert", "CaveAbyssHouse1", "CaveAbyssHouse2", "CaveDesertNpc", "CaveSewer", "CaveBeachRace",
	"CaveSwampRace", "CaveSunkenToDungeon", "CaveSunkenRace", "CaveDarker", "CaveGreenHoleUnderJar", "CaveJunkyardEast",
	"CaveJunkyardWest", "Lighthouse", "CaveSunkenHouse", "CaveSwampParkour", "CaveDesertRace", "CaveAbyssRace", "CavePrimordial",
	"_CaveTuto", "Town",
]

ac(ti.UnlockerTrigger, (c, o) => {
    return <Props>
        <Prop>Target:<Link index={c.target} name={o.referenceNames[c.target]}/></Prop>
        <Prop>Target bis (?):<Link index={c.targetBis} name={o.referenceNames[c.targetBis]}/></Prop>
        <Prop>Prereqisute:{objectiveNames[c.objectiveCleared]}</Prop>
        <Component comp={c._base} obj={o}/>
    </Props>
})

const moduleNames = [
	'IdolBomb',
	'IdolSlow',
	'IdolAlly',
	'BoostCost',
	'XpGain',
	'HpDrop',
	'PrimordialCrystal',
	'HearthCrystal',
	'SpiritDash',
	'BlueBullet',
	'Overcharge',
	'CollectableScan',
	'Rage',
	'Retaliation',
	'FreePower',
	'Compass',
	'Teleport'
]

const skillNames = ['Supershot', 'Dash', 'Hover', 'Boost']

const statsNames = [
	'PowerAllyLevel',
    '<None>',
	'BoostSpeed',
	'BulletNumber',
	'BulletSpeed',
	'_EmptyStatsSlot',
	'PowerBombLevel',
	'CriticChance',
	'Energy',
	'FireRange',
	'FireRate',
	'Hp',
	'MoveSpeed',
	'Supershot',
	'BulletDamage',
	'PowerSlowLevel',
]

ac(ti.ModulePickup, (c, o) => {
    return <Props>
        <Prop>Name:{moduleNames[c.moduleId] ?? '<Unknown>'}</Prop>
        <Component comp={c._base} obj={o}/>
    </Props>
});

ac(ti.SkillPickup, (c, o) => {
    return <Props>
        <Prop>Name:{skillNames[c.skillId] ?? '<Unknown>'}</Prop>
        <Component comp={c._base} obj={o}/>
    </Props>
});

ac(ti.StatsPickup, (c, o) => {
    return <Props>
        <Prop>Name:{statsNames[c.statsId] ?? '<Unknown>'}</Prop>
        <Prop>Level:{c.level}</Prop>
        <Component comp={c._base} obj={o}/>
    </Props>
});

ac(ti.Buyable, (c, o) => {
    return <Props>
        <Prop>Price:{c.price}</Prop>
        <Prop>For sale:{bs(c.isForSale)}</Prop>
        <Prop>Title:{c.title}</Prop>
        <Prop>Description:{c.description}</Prop>
        <Prop>Owner:<Link index={c.owner} name={o.referenceNames[c.owner]}/></Prop>
        <Component comp={c._base} obj={o}/>
    </Props>
});

ac(ti.KeyUnique, (c, o) => {
    return <Props>
        <Prop>Name:{keyUses[c.keyId] ?? '<Unknown>'}</Prop>
        <Component comp={c._base} obj={o}/>
    </Props>
});

const npcNames = [
	"Familly1",
	"Familly2",
	"Familly3",
	"Blacksmith",
	"Academician",
	"Explorer",
	"MercantHub",
	"UnchosenPurple",
	"UnchosenBlue",
	"UnchosenPurpleSnow",
	"MercantFrogger",
	"_Ermit",
	"PrimordialScarab",
	"Tiny",
	"Healer",
	"MercantBush",
	"MercantJar",
	"Turtle",
	"ScarabCollector",
	"Bard",
]

ac(ti.Npc, (c, o) => {
    return <Props>
        <Prop>Name:{npcNames[c.id]}</Prop>
        <Component comp={c._base} obj={o}/>
    </Props>
})

ac(ti.Tunnel, (c, o) => {
    return <Props>
        <Prop>Destination:<Link index={c.destination} name={o.referenceNames[c.destination]}/></Prop>
        <Component comp={c._base} obj={o}/>
    </Props>
})

const nbsp = '\u00A0'
const jarTypes = ["nothing", "hp", "random", "big crystal", "energy", "full energy", "big srystals (65)"]
function getExtra(e) {
    var extra
    if(e.dropType == 1) extra = e.size - 1
    if(e.dropType == 2) extra = "15% hp, 15% 1-9 xp, 15% 2-4 energy"
    if(e.dropType == 3) extra = (e.size - 1) * 2
    if(e.dropType == 4) extra = "3-5"
    return (extra !== undefined ? ' (' + extra + ')' : '') + ` [value${nbsp}${e.dropType}]`
}

ac(ti.Jar, (c, o) => {
    return <Props>
        <Prop>Drop type:{jarTypes[c.dropType] + getExtra(c)}</Prop>
        <Prop>Size:{c.size}</Prop>
        <Component comp={c._base} obj={o}/>
    </Props>
})

const usePlayerLevel = Z.create((set) => ({
    value: 0,
    set: (newValue) => {
        set({ value: newValue })
    }
}))

function XpCalculator({ enemy }) {
    const playerLevel = usePlayerLevel()
    function onBound(el) {
        if(el) el.value = playerLevel.value
    }
    const input = <input style={{width: '3rem'}} type="number" ref={onBound}
        onChange={(ev) => playerLevel.set(parseInt(ev.target.value))}/>

    return <Prop>
        <>Xp for level {input}:</>
        {calcXp(enemy.size, enemyLevel(enemy), playerLevel.value)}
    </Prop>
}

ac(ti.Enemy, (c, o) => {
    return <Props>
        <Prop>Size:{c.size}</Prop>
        <Prop>Tier:{c.tier}</Prop>
        <XpCalculator enemy={c} />
        <Component comp={c._base} obj={o}/>
    </Props>
})
// Copied from the game (TODO: where?)
var levelDiffMax = 35
var num2arr = [0, -0.0005760992, -0.001099514, -0.001562121, -0.001955796, -0.002272415, -0.002503856, -0.002641993, -0.002678705, -0.002605866, -0.002415353, -0.002099043, -0.001648813, -0.001056537, -0.0003140926, 0.000586643, 0.001653795, 0.002895486, 0.004319842, 0.005934983, 0.007749034, 0.009770121, 0.01200636, 0.01446589, 0.01715682, 0.02008727, 0.02326539, 0.02669927, 0.03039706, 0.03436686, 0.03861683, 0.04315505, 0.04798967, 0.05312951, 0.05867211, 0.06471878, 0.07132179, 0.07853336, 0.08640583, 0.09499138, 0.1043423, 0.1145109, 0.1255495, 0.1375101, 0.1504453, 0.1644071, 0.1794479, 0.1956198, 0.2129754, 0.2315666, 0.2514459, 0.2726654, 0.2952775, 0.3193344, 0.3448884, 0.3719916, 0.4006965, 0.4310553, 0.4631202, 0.4969434, 0.5325773, 0.5700741, 0.6094862, 0.6508656, 0.6942647, 0.7397357, 0.7873312, 0.8371028, 0.8891034, 0.9433848, 1] // calculated
var baseXpGain = 1
var gainCoeffMax = 10
var minimumGain = 1
function Round(num) {
    let rounded = Math.round(num);
    if (Math.abs(num % 1) === 0.5) {
        rounded = (rounded % 2 === 0) ? rounded : rounded - 1;
    }
    return rounded;
}
function calcXp(size, level, playerL) {
    var num = level * 10 - playerL
    var num2 = num2arr[Math.min(Math.max(0, num + levelDiffMax), num2arr.length-1)]
    var b = Round(Math.fround(Math.fround(baseXpGain * num2) * gainCoeffMax))
    var num3 = size > 1 ? (size * 0.75) : 1
    return Round(Math.fround(Math.max(minimumGain, b) * num3))
}
function enemyLevel(e) {
    return 3 * (e.tier - 1) + e.size
}

function Props({ children }) {
    return <div className="props">{children}</div>
}

function Prop({ children }) {
    if(children.length != 2) {
        console.error('Number of children is incorrect:', children.length, children)
        return
    }
    return <div className="prop0">
        <div className="prop">
            <div>{children[0]}</div>
            <div>{children[1]}</div>
        </div>
    </div>
}


function Other({ nearby }) {
    if(nearby == null) return

    const nearbyC = []
    for(let i = 0; i < nearby.length; i++) {
        const it = nearby[i]
        nearbyC.push(
            <div key={i} className="hanging">
                <Link index={it.index} name={it.name}/>
                <span> [away{nbsp}{it.distance.toFixed(2)}]</span>
            </div>
        )
    }

    return <div className="nearby">
        Objects nearby:
        {nearbyC}
    </div>
}
