try {
  const location = 'joyview'
  const ipcRenderer = window.ipcRenderer
  const windowLoaded = new Promise(resolve => {
    window.onload = resolve
  })
  windowLoaded.then(() => {
    // FUNCTIONS FROM MOUSEOVER
    const pointer = document.getElementsByClassName('pointer')
    Array.from(pointer).forEach(point => {
      point.addEventListener('mouseover', function (event) {
        const target = event.target
        if (target.classList.contains('pointer')) {
          target.classList.remove('w3-black')
          target.classList.add('w3-idontexist')
        }
      })

      point.addEventListener('mouseout', function (event) {
        const target = event.target
        if (target.classList.contains('pointer')) {
          target.classList.remove('w3-idontexist')
          target.classList.add('w3-black')
        }
      })
    })
  })
  window.addEventListener('click', clickedEvent)
  async function clickedEvent(evt) {
    const clickedEventArr = [evt.target.getAttribute('id')] // id="guardian_moduleblueprint_checkbox"
    let clickedEventMod = clickedEventArr[0]
    let clickedNameEvent = null

    try {
      clickedEventMod = clickedEventMod.split('_')
      clickedNameEvent = [clickedEventMod.pop()]
      if (clickedEventMod.length >= 2) {
        clickedEventMod = [clickedEventMod.join('_')]
      }
    } catch (e) {
      // ignore
    }

    let final = clickedNameEvent
    if (clickedEventMod && clickedEventMod.length) final = clickedEventMod

    const nonUiEvents = ['expandall', 'collapseall', 'checkbox']
    const events = arraySearch(nonUiEvents, clickedNameEvent)

    if (events.found.length) {
      /*
      // EXPAND / COLLAPSE code (kept disabled)
      if (evt.target.hasAttribute('expandall')) {
        const allExpansion = document.getElementsByClassName('expansion')
        document.getElementById('collapseall').innerText = 'radio_button_unchecked'
        document.getElementById('expandall').innerText = 'radio_button_checked'
        Array.from(allExpansion).forEach(item => {
          if (item.classList.contains('w3-hide')) {
            item.classList.remove('w3-hide')
          }
        })
      }

      if (evt.target.hasAttribute('collapseall')) {
        const allExpansion = document.getElementsByClassName('expansion')
        document.getElementById('collapseall').innerText = 'radio_button_checked'
        document.getElementById('expandall').innerText = 'radio_button_unchecked'
        Array.from(allExpansion).forEach(item => {
          if (!item.classList.contains('w3-hide')) {
            item.classList.add('w3-hide')
          }
        })
      }

      // CHECKBOX code (kept disabled — your snippet had half-commented lines that broke parsing)
      if (events.found.find(i => i === 'checkbox') === 'checkbox') {
        const iname = document.getElementById(clickedEventArr[0])
        let boxStatus = null
        if (iname.innerText === 'check_box') {
          iname.innerText = 'check_box_outline_blank'
          boxStatus = 0
        } else {
          iname.innerText = 'check_box'
          boxStatus = 1
        }
      }
      */
    } else {
      drop(clickedEventArr[0], 'joyview') // review function for HTML class requirements.
    }
  }
  const unplacedState = {
    byPrefix: {} // js2 -> Map(joyInput -> { count, lastSeen })
  }
  function getUnplacedMap(prefix) {
    if (!unplacedState.byPrefix[prefix]) {
      unplacedState.byPrefix[prefix] = new Map()
    }
    return unplacedState.byPrefix[prefix]
  }
  function recordUnplaced(package) {
    const prefix = package.prefix || 'unknown'
    const joyInput = package.joyInput || 'unknown'

    const map = getUnplacedMap(prefix)
    const prev = map.get(joyInput) || { count: 0, lastSeen: 0 }

    prev.count += 1
    prev.lastSeen = Date.now()
    map.set(joyInput, prev)

    renderUnplaced()
  }
  function renderUnplaced() {
    const box = document.getElementById('joyview_unplaced')
    if (!box) return

    const lines = []

    for (const prefix in unplacedState.byPrefix) {
      const map = unplacedState.byPrefix[prefix]
      const entries = Array.from(map.entries())

      // most recently seen first
      entries.sort((a, b) => b[1].lastSeen - a[1].lastSeen)

      lines.push(`${prefix.toUpperCase()} unplaced:`)

      // limit to 30 per device so it doesn’t explode
      entries.slice(0, 30).forEach(([joyInput, meta]) => {
        lines.push(`- ${joyInput} (x${meta.count})`)
      })

      lines.push('') // blank line between devices
    }

    box.innerText = lines.join('\n').trim()
  }
  function serializeError(e) {
    if (!e) return { name: 'Error', message: 'Unknown error', stack: '' }

    if (typeof e === 'string') {
      return { name: 'Error', message: e, stack: '' }
    }

    return {
      name: e.name || 'Error',
      message: e.message || String(e),
      stack: e.stack || '',
      cause: e.cause ? serializeError(e.cause) : undefined
    }
  }
  const layoutState = {
    // prefix -> {
    //   layout,
    //   spotEls: Map(joyInput -> SVGElement),
    //   groupBoxEls: Map(groupId -> HTMLElement),
    //   inputToGroup: Map(joyInput -> groupId),
    //   activeGroupId: string|null,
    //   activeSpotJoyInputId: string|null
    // }
    byPrefix: new Map()
  }
  function vidPidKeyFromNums(vendorId, productId) {
    // your layout index uses uppercase hex like 3344:43F4
    const vid = Number(vendorId).toString(16).toUpperCase().padStart(4, '0')
    const pid = Number(productId).toString(16).toUpperCase().padStart(4, '0')
    return `${vid}:${pid}`
  }
  function normalizeJoyInput(prefix, joyInput) {
    // package.joyInput is already like ${prefix}_button1 or ${prefix}_axis_rx
    return joyInput
  }
  async function requestLayoutForDevice(vidPidKey) {
    const res = await ipcRenderer.invoke('joyview:get-layout', { vidPidKey })
    if (!res || res.ok !== 1) throw new Error((res && res.error) ? res.error : `No layout for ${vidPidKey}`)
    return res
  }
  async function getLayoutForKey(vidPidKey) {
    const res = await ipcRenderer.invoke('joyview:get-layout', { vidPidKey })
    if (!res || res.ok !== 1) throw new Error((res && res.error) ? res.error : `No layout for ${vidPidKey}`)
    return res
  }
  function buildDeviceView(prefix, product, layoutJson, imageUrl) {
    const canvasHost = document.getElementById(`${prefix}_device_canvas`)
    const groupHost = document.getElementById(`${prefix}_group_overlays`)
    if (!canvasHost || !groupHost) return

    canvasHost.innerHTML = ''
    groupHost.innerHTML = ''

    const spotEls = new Map()
    const groupBoxEls = new Map()
    const inputToGroup = new Map()

    // schema:2 ONLY
    const ov = (layoutJson && layoutJson.overlays) ? layoutJson.overlays.main : null
    if (!ov) {
      throw new Error(`Layout missing overlays.main for ${prefix}`)
    }

    const sheetW = (ov.sheet && ov.sheet.w != null) ? ov.sheet.w : 1000
    const sheetH = (ov.sheet && ov.sheet.h != null) ? ov.sheet.h : 1000
    const viewBox = ov.viewBox || `0 0 ${sheetW} ${sheetH}`

    // collect spots (buttons + axes)
    const allSpots = {}
    if (layoutJson && layoutJson.buttons && layoutJson.buttons.spots) {
      for (const k in layoutJson.buttons.spots) allSpots[k] = layoutJson.buttons.spots[k]
    }
    if (layoutJson && layoutJson.axes && layoutJson.axes.spots) {
      for (const k in layoutJson.axes.spots) allSpots[k] = layoutJson.axes.spots[k]
    }

    // groups (ONE overlay box per group)
    const groups = (layoutJson && layoutJson.groups) ? layoutJson.groups : {}

    const spotToGroup = new Map()
    for (const gid in groups) {
      const inputs = Array.isArray(groups[gid].inputs) ? groups[gid].inputs : []
      inputs.forEach(id => spotToGroup.set(id, gid))
    }

    // if a spot isn't in any group, it becomes its own group (keeps your "1 overlay per group" rule)
    for (const spotId in allSpots) {
      if (!spotToGroup.has(spotId)) {
        const gid = `solo_${spotId}`
        spotToGroup.set(spotId, gid)
        groups[gid] = { label: spotId, inputs: [spotId] }
      }
    }

    // build group boxes once
    for (const gid in groups) {
      const box = document.createElement('div')
      box.setAttribute('class', 'joy_group_box w3-text-orange font-BLOCKY')
      box.setAttribute('id', `${prefix}_group_${gid}`)
      box.innerText = `${groups[gid].label || gid}`
      groupHost.appendChild(box)
      groupBoxEls.set(gid, box)
    }

    // map schema spot id -> your runtime DOM id
    function spotIdToJoyInputId(spotId) {
      if (spotId.startsWith('button_')) return `${prefix}_button${spotId.split('_')[1]}`
      if (spotId.startsWith('axis_')) return `${prefix}_axis_${spotId.slice('axis_'.length)}`
      return `${prefix}_${spotId}`
    }

    function makeSpotEl(spotId, spot) {
      const ns = 'http://www.w3.org/2000/svg'
      let el = null

      if (spot.shape === 'rect') {
        el = document.createElementNS(ns, 'rect')
        el.setAttribute('x', String(spot.x))
        el.setAttribute('y', String(spot.y))
        el.setAttribute('width', String(spot.w))
        el.setAttribute('height', String(spot.h))
        if (spot.rx != null) el.setAttribute('rx', String(spot.rx))
      } else if (spot.shape === 'circle') {
        el = document.createElementNS(ns, 'circle')
        el.setAttribute('cx', String(spot.cx))
        el.setAttribute('cy', String(spot.cy))
        el.setAttribute('r', String(spot.r))
      } else {
        return null
      }

      el.setAttribute('class', 'joy_spot')
      el.setAttribute('data-spotid', spotId)
      return el
    }

    // SVG root
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', viewBox)
    svg.setAttribute('class', 'joy_svg')

    // device image
    const img = document.createElementNS('http://www.w3.org/2000/svg', 'image')
    // TEST: log the real PNG dimensions
    img.addEventListener('load', () => console.log(prefix, 'PNG natural size:', img.width.baseVal.value, img.height.baseVal.value))
    img.setAttribute('href', imageUrl)
    img.setAttribute('x', '0')
    img.setAttribute('y', '0')
    img.setAttribute('width', String(sheetW))
    img.setAttribute('height', String(sheetH))
    svg.appendChild(img)

    // create spots + hover highlight
    for (const spotId in allSpots) {
      const spot = allSpots[spotId]
      const el = makeSpotEl(spotId, spot)
      if (!el) continue

      const joyInputId = spotIdToJoyInputId(spotId)
      const gid = spotToGroup.get(spotId)

      spotEls.set(joyInputId, el)
      inputToGroup.set(joyInputId, gid)

      el.addEventListener('mouseenter', () => {
        el.classList.add('hover')
        const box = groupBoxEls.get(gid)
        if (box) box.classList.add('hover')
      })

      el.addEventListener('mouseleave', () => {
        el.classList.remove('hover')
        const box = groupBoxEls.get(gid)
        if (box) box.classList.remove('hover')
      })

      svg.appendChild(el)
    }

    canvasHost.appendChild(svg)

    // store for highlight updates
    layoutState.byPrefix.set(prefix, {
      layout: layoutJson,
      spotEls,
      groupBoxEls,
      inputToGroup,
      activeGroupId: null,
      activeSpotJoyInputId: null
    })
  }


ipcRenderer.on('from_brain-detection', async package => {
  try {
    const st = layoutState.byPrefix.get(package.prefix)

    // Prefer SVG overlay spot if layout is loaded
    if (st) {

      // STATE: per device-layout, per input
      if (!st.inputEventState) st.inputEventState = new Map()

      function decryptInputs() {
        const input = package.joyInput.split('_')
        if (input[1] == 'axis') {
          return "Axis" + input[2].toUpperCase()
        } else {
          return input[1].toUpperCase()
        }
      }

      let binds = articulation()
      function articulation() {
        const bindStack = []

        if (package.keybindArray != 0) {
          package.keybindArray.forEach(item => {
            item.actions.forEach(act => {
              bindStack.push({ [item.categoryName]: { action: act } })
            })
          })

          let screenReady = ''
          const groupedActions = {}

          bindStack.forEach(item => {
            for (const category in item) {
              if (!groupedActions[category]) groupedActions[category] = []
              groupedActions[category].push(item[category].action)
            }
          })

          for (const category in groupedActions) {
            if (package.keybindArticulation) {
              const cat = package.keybindArticulation.categories[category]
              if (cat) screenReady += `${cat}\n`
              else screenReady += `${package.detection} CAT: ${category}\n`

              groupedActions[category].forEach(action => {
                const act = package.keybindArticulation.actions[action]
                if (act) screenReady += `-> ${act}\n`
                else screenReady += `- ! ! ! ACTION ! ! !: ${action}\n`
              })
            }
          }
          return screenReady
        } else {
          return package.joyInput
        }
      }

      const decrypt = decryptInputs()

      function inputKindFromJoyInput(joyInput) {
        const parts = String(joyInput || '').split('_')
        return parts[1] || ''
      }

      function buttonNumberFromJoyInput(joyInput) {
        const parts = String(joyInput || '').split('_')
        for (let i = parts.length - 1; i >= 0; i--) {
          const n = Number(parts[i])
          if (Number.isFinite(n)) return n
        }
        return null
      }

      function readNumericValue(pkg) {
        if (typeof pkg.value === 'number') return pkg.value
        if (typeof pkg.axisValue === 'number') return pkg.axisValue
        if (typeof pkg.val === 'number') return pkg.val
        if (typeof pkg.raw === 'number') return pkg.raw
        if (typeof pkg.rawValue === 'number') return pkg.rawValue
        return null
      }

      function readPressed(pkg) {
        if (typeof pkg.pressed === 'boolean') return pkg.pressed
        if (typeof pkg.isPressed === 'boolean') return pkg.isPressed
        if (typeof pkg.down === 'boolean') return pkg.down
        if (typeof pkg.isDown === 'boolean') return pkg.isDown
        if (typeof pkg.state === 'string') {
          if (pkg.state.toLowerCase() === 'down') return true
          if (pkg.state.toLowerCase() === 'up') return false
        }
        if (typeof pkg.value === 'number') {
          if (pkg.value === 1) return true
          if (pkg.value === 0) return false
        }
        return null
      }

      function shouldLogAxisEvent(prevState, currentVal, pkg) {
        let min = 0
        let max = 60000
        let center = 30000

        if (typeof pkg.logicalMin === 'number') min = pkg.logicalMin
        if (typeof pkg.logicalMax === 'number') max = pkg.logicalMax
        if (typeof pkg.min === 'number') min = pkg.min
        if (typeof pkg.max === 'number') max = pkg.max
        if (typeof pkg.center === 'number') center = pkg.center

        const range = max - min
        if (!range) return false

        const deadzonePct = 0.10
        const stepPct = 0.04

        const deadzone = range * deadzonePct
        const step = range * stepPct

        const distFromCenter = Math.abs(currentVal - center)
        const activeNow = distFromCenter > deadzone

        let dirNow = 0
        if (currentVal > center + deadzone) dirNow = 1
        if (currentVal < center - deadzone) dirNow = -1

        if (!prevState) {
          if (activeNow) return true
          return false
        }

        if (!prevState.axisActive && activeNow) return true
        if (prevState.axisActive && !activeNow) return true

        if (activeNow) {
          if (prevState.axisDir !== dirNow) return true
          if (typeof prevState.lastLoggedVal === 'number') {
            const delta = Math.abs(currentVal - prevState.lastLoggedVal)
            if (delta >= step) return true
          } else {
            return true
          }
        }

        return false
      }

      function ensureBindLog(boxEl) {
        let logEl = boxEl.querySelector('.bind_log')
        if (!logEl) {
          logEl = document.createElement('div')
          logEl.className = 'bind_log'
          boxEl.appendChild(logEl)
        }
        return logEl
      }

      function spanIdFromJoyInput(joyInput) {
        const raw = String(joyInput || '')
        const safe = raw.replace(/[^a-zA-Z0-9\-_:.]/g, '_')
        return `bind_${safe}`
      }

      // Guarantee a span exists for this joyInput so highlight can always find it
      function ensureSpanForJoyInput(logEl, joyInputId, btnNum) {
        const spanId = spanIdFromJoyInput(joyInputId)
        let span = document.getElementById(spanId)

        if (!span) {
          span = document.createElement('span')
          span.id = spanId
          span.className = 'bind_entry w3-text-orange'
          span.dataset.joyinput = joyInputId
          if (btnNum != null) span.dataset.btn = String(btnNum)
          logEl.appendChild(span)
        } else {
          span.classList.add('bind_entry')
          span.classList.add('w3-text-orange')
          span.classList.remove('bind_active')
          span.dataset.joyinput = joyInputId
          if (btnNum != null) span.dataset.btn = String(btnNum)
        }

        return span
      }

      function resortButtons(logEl) {
        const kids = Array.from(logEl.children)

        kids.sort((a, b) => {
          const av = (a.dataset && a.dataset.btn != null) ? Number(a.dataset.btn) : Number.POSITIVE_INFINITY
          const bv = (b.dataset && b.dataset.btn != null) ? Number(b.dataset.btn) : Number.POSITIVE_INFINITY

          if (av !== bv) return av - bv

          const aid = (a.dataset && a.dataset.joyinput) ? a.dataset.joyinput : ''
          const bid = (b.dataset && b.dataset.joyinput) ? b.dataset.joyinput : ''
          if (aid < bid) return -1
          if (aid > bid) return 1
          return 0
        })

        kids.forEach(el => logEl.appendChild(el))
      }

      // Toggle correctly EVERY event:
      // - all orange
      // - current green (found by id from joyInput)
      function highlightActiveInGroup(boxEl, joyInputId) {
        const logEl = boxEl.querySelector('.bind_log')
        if (!logEl) return

        const all = logEl.querySelectorAll('.bind_entry')
        all.forEach(el => {
          el.classList.remove('bind_active')
          el.classList.add('w3-text-orange')
        })

        const activeId = spanIdFromJoyInput(joyInputId)
        const activeEl = document.getElementById(activeId)
        if (activeEl) {
          activeEl.classList.remove('w3-text-orange')
          activeEl.classList.add('bind_active')
        }
      }

      //!##### start
      const joyInputId = package.joyInput
      const spotEl = st.spotEls.get(joyInputId)

      if (spotEl) {
        const gid = st.inputToGroup.get(joyInputId) || null
        const boxEl = gid ? st.groupBoxEls.get(gid) : null

        // LATCHED GROUP/SPOT HIGHLIGHT
        if (st.activeGroupId !== gid) {
          if (st.activeGroupId) {
            const oldBox = st.groupBoxEls.get(st.activeGroupId)
            if (oldBox) oldBox.classList.remove('active')
          }
          if (st.activeSpotJoyInputId) {
            const oldSpot = st.spotEls.get(st.activeSpotJoyInputId)
            if (oldSpot) oldSpot.classList.remove('active')
          }
          st.activeGroupId = gid
          st.activeSpotJoyInputId = null
        } else {
          if (st.activeSpotJoyInputId && st.activeSpotJoyInputId !== joyInputId) {
            const oldSpot = st.spotEls.get(st.activeSpotJoyInputId)
            if (oldSpot) oldSpot.classList.remove('active')
          }
        }

        if (boxEl) boxEl.classList.add('active')
        spotEl.classList.add('active')
        st.activeSpotJoyInputId = joyInputId

        if (boxEl) {
          const logEl = ensureBindLog(boxEl)

          const kind = inputKindFromJoyInput(joyInputId)
          const prev = st.inputEventState.get(joyInputId)

          // Ensure span exists for current input BEFORE highlight (so toggle always works)
          const btnNumForId = (kind === 'button') ? buttonNumberFromJoyInput(joyInputId) : null
          ensureSpanForJoyInput(logEl, joyInputId, btnNumForId)

          // Now toggle colors EVERY event
          highlightActiveInGroup(boxEl, joyInputId)

          if (kind === 'button') {
            const pressed = readPressed(package)
            let shouldUpdateText = false

            if (pressed !== null) {
              if (!prev) {
                if (pressed) shouldUpdateText = true
              } else {
                if (!prev.pressed && pressed) shouldUpdateText = true
              }

              const next = prev || {}
              next.pressed = pressed
              st.inputEventState.set(joyInputId, next)
            } else {
              const entryText = `${decrypt}\n${binds}`
              if (!prev || prev.lastText !== entryText) shouldUpdateText = true

              const next = prev || {}
              next.lastText = entryText
              st.inputEventState.set(joyInputId, next)
            }

            if (shouldUpdateText) {
              const spanId = spanIdFromJoyInput(joyInputId)
              const span = document.getElementById(spanId)
              if (span) {
                span.textContent = `${decrypt}\n${binds}`
              }

              // keep sorted when button text changes / new entry appears
              resortButtons(logEl)

              // re-toggle after resort just to be bulletproof
              highlightActiveInGroup(boxEl, joyInputId)
            }
          } else if (kind === 'axis') {
            const val = readNumericValue(package)
            let shouldUpdateText = false

            if (val !== null) {
              shouldUpdateText = shouldLogAxisEvent(prev, val, package)

              const next = prev || {}

              let min = 0
              let max = 60000
              let center = 30000

              if (typeof package.logicalMin === 'number') min = package.logicalMin
              if (typeof package.logicalMax === 'number') max = package.logicalMax
              if (typeof package.min === 'number') min = package.min
              if (typeof package.max === 'number') max = package.max
              if (typeof package.center === 'number') center = package.center

              const range = max - min
              const deadzone = range * 0.10

              const distFromCenter = Math.abs(val - center)
              const activeNow = distFromCenter > deadzone

              let dirNow = 0
              if (val > center + deadzone) dirNow = 1
              if (val < center - deadzone) dirNow = -1

              next.axisActive = activeNow
              next.axisDir = dirNow

              if (shouldUpdateText) next.lastLoggedVal = val

              st.inputEventState.set(joyInputId, next)
            } else {
              const entryText = `${decrypt}\n${binds}`
              if (!prev || prev.lastText !== entryText) shouldUpdateText = true

              const next = prev || {}
              next.lastText = entryText
              st.inputEventState.set(joyInputId, next)
            }

            if (shouldUpdateText) {
              const spanId = spanIdFromJoyInput(joyInputId)
              const span = document.getElementById(spanId)
              if (span) {
                span.textContent = `${decrypt}\n${binds}`
              }

              // cap list size (still applies)
              const MAX = 10
              while (logEl.children.length > MAX) {
                logEl.removeChild(logEl.lastChild)
              }

              highlightActiveInGroup(boxEl, joyInputId)
            }
          } else {
            const entryText = `${decrypt}\n${binds}`
            if (!prev || prev.lastText !== entryText) {
              const next = prev || {}
              next.lastText = entryText
              st.inputEventState.set(joyInputId, next)

              const spanId = spanIdFromJoyInput(joyInputId)
              const span = document.getElementById(spanId)
              if (span) {
                span.textContent = entryText
              }

              const MAX = 10
              while (logEl.children.length > MAX) {
                logEl.removeChild(logEl.lastChild)
              }

              highlightActiveInGroup(boxEl, joyInputId)
            }
          }
        }

        return
      }
    }

    // Fallback: old DOM highlight
    const node = document.getElementById(package.joyInput)
    if (!node) {
      recordUnplaced(package)
    } else {
      if (package.prefix) {
        const prevKey = `__joyview_prev_dom_${package.prefix}`
        const prevId = window[prevKey]
        if (prevId && prevId !== package.joyInput) {
          const prevNode = document.getElementById(prevId)
          if (prevNode) prevNode.classList.remove('active')
        }
        window[prevKey] = package.joyInput
      }
      node.classList.add('active')
    }

  } catch (err) {
    console.log(err)
    ipcRenderer.send('renderer-response-error', serializeError(err), location)
  }
})






  ipcRenderer.on('from_brain-detection-initialize', async package => {
    try {
      for (const device in package) {
        const d = package[device]
        if (!d || !d.prefix) continue

        const prefix = d.prefix
        const product = d.product || ''
      try {
          const res = await requestLayoutForDevice(d.key) // "3344:43F4"
          buildDeviceView(prefix, product, res.layoutJson, res.imageUrl)
        } catch (err) {
          recordUnplaced({ prefix, joyInput: `layout_missing_${prefix}` })
          ipcRenderer.send('renderer-response-error', serializeError(err), location)
        }
        ipcRenderer.send('initializer-response', `${prefix} joyview initialized...`)
      }
    } catch (err) {
      ipcRenderer.send('renderer-response-unhandled-error', serializeError(err), location)
    }
  })
  // ipcRenderer.on('from_brain-detection-initialize', async package => {
  //   try {
  //     for (const device in package) {
  //       const d = package[device]
  //       if (!d || !d.prefix) continue

  //       const prefix = d.prefix
  //       const product = d.product || ''

  //       // // headers
  //       // const posEl = document.getElementById(`${prefix}_position`)
  //       // if (posEl) posEl.innerText = product

  //       // const header = document.getElementById(`${prefix}displayedBind`)
  //       // if (header) header.insertAdjacentText('beforeend', product)

  //       // overlays (ONE time per device)
  //       try {
  //         const res = await requestLayoutForDevice(d.key) // "3344:43F4"
  //         buildDeviceView(prefix, product, res.layoutJson, res.imageUrl)
  //       } catch (err) {
  //         recordUnplaced({ prefix, joyInput: `layout_missing_${prefix}` })
  //         ipcRenderer.send('renderer-response-error', serializeError(err), location)
  //       }

  //       // // rebuild table rows
  //       // const container = document.getElementById(`${prefix}bar_container`)
  //       // if (!container) continue

  //       // let dynamicDom = document.getElementsByClassName(`${prefix}_DynamicDom`)
  //       // dynamicDom = Array.from(dynamicDom)
  //       // dynamicDom.forEach(dom => dom.remove())

  //       // if (d.buttons != 0) {
  //       //   for (let btn = 1; btn <= d.buttons; btn++) {
  //       //     const newTR = document.createElement('tr')
  //       //     container.appendChild(newTR)

  //       //     newTR.setAttribute('class', `${prefix}_DynamicDom ${prefix}_DynamicDomTR`)

  //       //     const TH1 = document.createElement('th')
  //       //     newTR.appendChild(TH1)
  //       //     TH1.setAttribute('class', `${prefix}_DynamicDom font-BLOCKY w3-text-orange`)
  //       //     TH1.setAttribute('id', `${prefix}_button${btn}_assignment`)
  //       //     TH1.innerText = ''

  //       //     const TH2 = document.createElement('th')
  //       //     newTR.appendChild(TH2)
  //       //     TH2.setAttribute('class', `${prefix}_DynamicDom font-BLOCKY w3-text-orange`)
  //       //     TH2.setAttribute('id', `${prefix}_button${btn}_slot`)
  //       //     TH2.innerText = String(btn)

  //       //     const TH3 = document.createElement('th')
  //       //     newTR.appendChild(TH3)
  //       //     TH3.setAttribute('class', `${prefix}_DynamicDom font-BLOCKY w3-text-orange`)
  //       //     TH3.setAttribute('id', `${prefix}_button${btn}_index`)
  //       //     TH3.innerText = String(btn)
  //       //   }
  //       // }

  //       // if (d.axes != 0) {
  //       //   for (const axis of d.axes) {
  //       //     const newTR = document.createElement('tr')
  //       //     container.appendChild(newTR)

  //       //     newTR.setAttribute('class', `${prefix}_DynamicDom ${prefix}_DynamicDomTR`)

  //       //     const TH1 = document.createElement('th')
  //       //     newTR.appendChild(TH1)
  //       //     TH1.setAttribute('class', `${prefix}_DynamicDom font-BLOCKY w3-text-orange`)
  //       //     TH1.setAttribute('id', `${prefix}_axis_${axis}_assignment`)
  //       //     TH1.innerText = ''

  //       //     const TH2 = document.createElement('th')
  //       //     newTR.appendChild(TH2)
  //       //     TH2.setAttribute('class', `${prefix}_DynamicDom font-BLOCKY w3-text-orange`)
  //       //     TH2.setAttribute('id', `${prefix}_axis_${axis}_slot`)
  //       //     TH2.innerText = `${prefix}_axis_${axis}`

  //       //     const TH3 = document.createElement('th')
  //       //     newTR.appendChild(TH3)
  //       //     TH3.setAttribute('class', `${prefix}_DynamicDom font-BLOCKY w3-text-orange`)
  //       //     TH3.setAttribute('id', `${prefix}_axis_${axis}_index`)
  //       //     TH3.innerText = `${prefix}_axis_${axis}`
  //       //   }
  //       // }

  //       ipcRenderer.send('initializer-response', `${prefix} joyview initialized...`)
  //     }
  //   } catch (err) {
  //     ipcRenderer.send('renderer-response-unhandled-error', serializeError(err), location)
  //   }
  // })
} catch (err) {
  console.log('MAIN', err)
  if (window.ipcRenderer) window.ipcRenderer.send('renderer-response-unhandled-error', serializeError(err), location)
}
