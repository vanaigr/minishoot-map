import * as R from 'react'
import reactDom from 'react-dom/client'
import * as Z from 'zustand'
import { meta, getAsSchema, parsedSchema } from '/schema.js'

const useCurrentObject = Z.create(() => {})

// TODO: transfer object id and use it as key so that values from previous objects do not affect it

var gotoOther = () => { console.log('state?') }
var context
var renderData = { currentObject: null }

export function setup(_context) {
    context = _context
    context.sideMenu = renderData
    gotoOther = context.viewObject

    const root = reactDom.createRoot(window['side-menu'])
    root.render(<R.StrictMode><SideMenu /></R.StrictMode>)
}

export function setCurrentObject(obj) {
    renderData.currentObject = obj
    if(context) context.requestRender(1)

    // console.log(JSON.parse(JSON.stringify(obj)))
    useCurrentObject.setState(obj)
}

function SideMenu() {
    const obj = useCurrentObject()
    return <>
        <Object first={obj?.first} />
    </>
}

function vec2s(v) {
    return v[0] + ', ' + v[1]
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

    return <>
        <Props>
            <Prop>Name:{first.name}</Prop>
            <Prop>Position:{vec2s(first.pos)}</Prop>
        </Props>
        <div className="space"></div>
        <Parent obj={first}/>
        <Children obj={first}/>
        <div className="space"></div>
        <div>Components:</div>
        <div>{components}</div>
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

function componentInfoToComponent(thisEmpty, childC) {
    return <details className="component" open={thisEmpty}>
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
        inner = componentInfoToComponent(true, baseInfo)
        isEmpty = baseInfo.empty
    }

    const res = <Props>{inner}</Props>
    return { empty: isEmpty, name: cname, component: res }
}

function shouldDisplay(comp) {
    if(comp == null) return false
    if(comp._schema === ti.Component) return false
    if(comp._schema === ti.MonoBehaviour) return false
    if(comp._schema === ti.MiniBehaviour) return false
    return true
}

function Component({ comp, obj }) {
    if(!shouldDisplay(comp)) return
    return componentInfoToComponent(false, componentInfo(comp, obj))
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

ac(ti.crystalDestroyable, (c, o) => {
    return <Props>
        <Prop>Drops XP:{c.dropXp ? 'yes' : 'no'}</Prop>
        <Prop>Size:{c.size}</Prop>
        <Component comp={c._base} obj={o}/>
    </Props>
})

ac(ti.Destroyable, (c, o) => {
    return <Props>
        <Prop>Is permanent:{c.permanent ? 'yes' : 'no'}</Prop>
        <Component comp={c._base} obj={o}/>
    </Props>
})

ac(ti.Collider2D, (c, o) => {
    return <Props>
        <Prop>Is trigger:{c.isTrigger ? 'yes' : 'no'}</Prop>
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

    // index < 0 is scenes, we can't display info about them yet
    if(index != null && index >= 0) {
        function onClick() { gotoOther(index) }
        return <a href="javascript:void('sorry')" onClick={onClick}>{displayName}</a>
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
        <Prop>Hp:{c.hp}</Prop>
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

const object = {
  "type": "click",
  "first": {
    "name": "Overworld 255 JunkerT3 S2",
    "pos": [
      -48,
      177
    ],
    "components": [
      {
        "position": [
          -6,
          -6
        ],
        "scale": [
          1,
          1
        ],
        "rotation": 90,
        "_base": {
          "_base": {
            "_base": {
              "_schema": 30
            },
            "_schema": 28
          },
          "_schema": 29
        },
        "_schema": 21
      },
      {
        "spriteI": 39,
        "size": 2,
        "tier": 3,
        "hp": 2668,
        "_base": {
          "_base": {
            "_base": {
              "_base": {
                "_base": {
                  "_base": {
                    "_base": {
                      "_schema": 30
                    },
                    "_schema": 28
                  },
                  "_schema": 29
                },
                "_schema": 33
              },
              "_schema": 32
            },
            "_schema": 60
          },
          "_schema": 78
        },
        "_schema": 10
      },
      {
        "_base": {
          "_base": {
            "_base": {
              "_base": {
                "_base": {
                  "_base": {
                    "_schema": 30
                  },
                  "_schema": 28
                },
                "_schema": 29
              },
              "_schema": 33
            },
            "_schema": 32
          },
          "_schema": 60
        },
        "_schema": 297
      },
      {
        "_base": {
          "_base": {
            "_base": {
              "_base": {
                "_base": {
                  "_base": {
                    "_schema": 30
                  },
                  "_schema": 28
                },
                "_schema": 29
              },
              "_schema": 33
            },
            "_schema": 32
          },
          "_schema": 60
        },
        "_schema": 299
      },
      {
        "_base": {
          "_base": {
            "_base": {
              "_base": {
                "_base": {
                  "_base": {
                    "_schema": 30
                  },
                  "_schema": 28
                },
                "_schema": 29
              },
              "_schema": 33
            },
            "_schema": 32
          },
          "_schema": 60
        },
        "_schema": 311
      },
      {
        "_base": {
          "_base": {
            "_base": {
              "_base": {
                "_base": {
                  "_base": {
                    "_schema": 30
                  },
                  "_schema": 28
                },
                "_schema": 29
              },
              "_schema": 33
            },
            "_schema": 32
          },
          "_schema": 60
        },
        "_schema": 305
      },
      {
        "_base": {
          "_base": {
            "_base": {
              "_base": {
                "_base": {
                  "_schema": 30
                },
                "_schema": 28
              },
              "_schema": 29
            },
            "_schema": 33
          },
          "_schema": 32
        },
        "_schema": 298
      },
      {
        "_base": {
          "_base": {
            "_base": {
              "_base": {
                "_base": {
                  "_base": {
                    "_schema": 30
                  },
                  "_schema": 28
                },
                "_schema": 29
              },
              "_schema": 33
            },
            "_schema": 32
          },
          "_schema": 90
        },
        "_schema": 300
      },
      {
        "_base": {
          "_base": {
            "_base": {
              "_base": {
                "_base": {
                  "_schema": 30
                },
                "_schema": 28
              },
              "_schema": 29
            },
            "_schema": 33
          },
          "_schema": 32
        },
        "_schema": 89
      },
      {
        "permanent": false,
        "_base": {
          "_base": {
            "_base": {
              "_base": {
                "_base": {
                  "_base": {
                    "_base": {
                      "_schema": 30
                    },
                    "_schema": 28
                  },
                  "_schema": 29
                },
                "_schema": 33
              },
              "_schema": 32
            },
            "_schema": 60
          },
          "_schema": 91
        },
        "_schema": 20
      },
      {
        "_base": {
          "_base": {
            "_base": {
              "_schema": 30
            },
            "_schema": 28
          },
          "_schema": 29
        },
        "_schema": 92
      },
      {
        "_base": {
          "_base": {
            "_base": {
              "_base": {
                "_base": {
                  "_base": {
                    "_schema": 30
                  },
                  "_schema": 28
                },
                "_schema": 29
              },
              "_schema": 33
            },
            "_schema": 32
          },
          "_schema": 60
        },
        "_schema": 94
      },
      {
        "_base": {
          "_base": {
            "_base": {
              "_base": {
                "_base": {
                  "_base": {
                    "_schema": 30
                  },
                  "_schema": 28
                },
                "_schema": 29
              },
              "_schema": 33
            },
            "_schema": 32
          },
          "_schema": 60
        },
        "_schema": 301
      }
    ],
    "referenceNames": {
      "90765": "EncounterOpen67",
      "90824": "ColliderHit",
      "90825": "Tweenable",
      "90839": "ShieldStatic",
      "90841": "Shadow",
      "90842": "Emitters",
      "90875": "ShakePos",
      "90876": "ShakeRota",
      "90877": "JunkerMoveDust",
      "90878": "ParticleStun(Clone)"
    },
    "children": [
      90824,
      90825,
      90839,
      90841,
      90842,
      90875,
      90876,
      90877,
      90878
    ],
    "parent": 90765
  },
  "nearby": [
    [
      365.88765839082066,
      661
    ],
    [
      401.58997672348903,
      667
    ],
    [
      567.3158290625489,
      666
    ],
    [
      671.6515229516536,
      1030
    ],
    [
      861.8946036766947,
      1028
    ]
  ]
}

setCurrentObject(object)