try {
  let devMode

  const location = 'joyview'
  const ipcRenderer = window.ipcRenderer

  // ============================================================
  // ✅ GLOBAL: hide/show via CSS CLASS (prevents "janky" spacing)
  // ============================================================

  ;(() => {
    if (document.getElementById('joyview_hide_style')) return
    const style = document.createElement('style')
    style.id = 'joyview_hide_style'
    style.textContent = `
      .is-hidden { display: none !important; }
    `
    document.head.appendChild(style)
  })()

  function getCanvasHostForPrefix(prefix) {
    return document.getElementById(`${prefix}_device_canvas`)
  }
  function getGroupHostForPrefix(prefix) {
    return document.getElementById(`${prefix}_group_overlays`)
  }
  function hideEl(el) {
    if (!el) return
    el.classList.add('is-hidden')
  }
  function showEl(el) {
    if (!el) return
    el.classList.remove('is-hidden')
  }
  function hideDeviceUI(prefix) {
    hideEl(getCanvasHostForPrefix(prefix))
    hideEl(getGroupHostForPrefix(prefix))
  }
  function showDeviceUI(prefix) {
    showEl(getCanvasHostForPrefix(prefix))
    showEl(getGroupHostForPrefix(prefix))
  }
  function showOnlyDeviceUI(activePrefix) {
    // hide/show based on known states (most reliable)
    if (layoutState && layoutState.byPrefix && typeof layoutState.byPrefix.forEach === 'function') {
      layoutState.byPrefix.forEach((_, otherPrefix) => {
        if (otherPrefix === activePrefix) showDeviceUI(otherPrefix)
        else hideDeviceUI(otherPrefix)
      })
    }

    // hard fallback: any hosts in DOM
    document.querySelectorAll('[id$="_device_canvas"]').forEach(el => {
      if (el.id === `${activePrefix}_device_canvas`) showEl(el)
      else hideEl(el)
    })
    document.querySelectorAll('[id$="_group_overlays"]').forEach(el => {
      if (el.id === `${activePrefix}_group_overlays`) showEl(el)
      else hideEl(el)
    })
  }
  function hideAllGroupBoxesForState(state) {
    if (!state) return

    if (state.groupBoxEls && typeof state.groupBoxEls.forEach === 'function') {
      state.groupBoxEls.forEach(el => {
        if (el) el.classList.add('is-hidden')
      })
    }

    const gh = document.getElementById(`${state.prefix}_group_overlays`)
    if (gh) {
      gh.querySelectorAll('.joy_group_box').forEach(el => {
        el.classList.add('is-hidden')
      })
    }
  }
  // ============================================================
  // WINDOW LOADED / UI CLICK STUFF (unchanged)
  // ============================================================
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
  // ============================================================
  // UNPLACED TRACKING (unchanged)
  // ============================================================
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

  // ============================================================
  // LAYOUT STATE / LAYOUT FETCH (unchanged)
  // ============================================================
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
  // ============================================================
  // BUILD DEVICE VIEW (unchanged except: nothing about product title)
  // ============================================================
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
      box.setAttribute('class', 'joy_group_box w3-text-orange font-BLOCKY joygroupbox')
      box.setAttribute('id', `${prefix}_group_${gid}`)

      // group title in its own span (no product involved)
      const titleSpan = document.createElement('span')
      titleSpan.className = 'joygroupbox-title'
      titleSpan.textContent = `${groups[gid].label || gid}`
      box.appendChild(titleSpan)

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
      activeSpotJoyInputId: null,

      // critical: per-device DOM refs
      prefix,
      containerEl: canvasHost,
      svgRoot: svg
    })
  }
  // ============================================================
  // DETECTION HANDLER (CHANGES: hide/show canvases AND boxes correctly)
  // ============================================================
  ipcRenderer.on('from_brain-detection-ready', async package => {
    const thisDeviceEl = document.getElementById('thisDevice')
        if (thisDeviceEl) {
          thisDeviceEl.innerText = "Move a Device to Begin...."
        }
  })
  ipcRenderer.on('from_brain-detection', async package => {
    try {
      const st = layoutState.byPrefix.get(package.prefix)

      // Prefer SVG overlay spot if layout is loaded
      if (st) {
        // ensure prefix is stored on state
        if (!st.prefix) st.prefix = package.prefix
        const thisDeviceEl = document.getElementById('thisDevice')
        if (thisDeviceEl) {
          thisDeviceEl.innerText = package.product
        }
        // ✅ on any input: show only this device (canvas + group host), hide all others
        if (devMode != 1) showOnlyDeviceUI(package.prefix)

        // ✅ on any input: hide ALL group boxes for other devices (prevents leftovers)
        layoutState.byPrefix.forEach((otherSt, otherPrefix) => {
          if (otherPrefix !== package.prefix) hideAllGroupBoxesForState(otherSt)
        })

        // STATE: per device-layout, per input
        if (!st.inputEventState) st.inputEventState = new Map()

        // GLOBAL: only 1 active bind span per joystick/prefix
        if (!st.activeBindSpanId) st.activeBindSpanId = ''

        // SPOT LABEL STATE
        if (!st.spotTextEls) st.spotTextEls = new Map()
        if (!st.activeSpotLabelJoyInputId) st.activeSpotLabelJoyInputId = ''

        // NEW: hide/show tracking for spots
        if (!st.hiddenSpotsInitialized) st.hiddenSpotsInitialized = 0
        if (!st.visibleSpotId) st.visibleSpotId = '' // normalized spot id (ex: button_1)
        if (!st.groupVisibleSpotIds) st.groupVisibleSpotIds = new Map() // gid -> Set(spotId)

        // NEW: hide/show tracking for group boxes
        if (!st.hiddenGroupsInitialized) st.hiddenGroupsInitialized = 0
        if (!st.visibleGroupId) st.visibleGroupId = null

        // You MUST have the svg that contains your <rect class="joy_spot" data-spotid="...">
        const svgRoot =
          st.svgRoot ||
          (st.containerEl ? st.containerEl.querySelector('svg') : null) ||
          null

        function decryptInputs() {
          const input = package.joyInput.split('_')
          if (input[1] == 'axis') {
            return 'Axis' + input[2].toUpperCase()
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
                const translateIssues = {}
                if (cat) {screenReady += `${cat}\n`}
                else {
                  screenReady += `${package.detection} CAT: ${category}\n`
                }

                groupedActions[category].forEach(action => {
                  const act = package.keybindArticulation.actions[action]
                  if (act) {screenReady += `-> ${act}\n`}
                  else {
                    screenReady += `- ! ! ! ACTION ! ! !: ${action}\n`
                    translateIssues["category"] = category
                    translateIssues["action"] = action
                  }
                })
                if (Object.keys(translateIssues).length > 0) {
                  switch (translateIssues.action) {
                    case 'ui_hide_hint':
                    case 'flashui_backspace':
                    case 'flashui_kp_3':
                    case 'flashui_kp_4':
                    case 'retry':
                      // intentionally ignored
                      break

                    default:
                      ipcRenderer.send('renderer-response-report-translationIssues',translateIssues)
                  }

                }
              }
            }
            return screenReady
          } else {
            return '-> No Keybind Detected'
          }
        }

        const decrypt = decryptInputs()

        function normalizeSpotId(st, joyInputId) {
          const s = String(joyInputId || '')
          const p = String(st?.prefix || '')

          if (p && s.startsWith(p + '_')) return s.slice(p.length + 1)
          if (p && s.startsWith(p)) return s.slice(p.length)

          return s
        }

        function ensureSpotTextLayer(st, svgRoot) {
          if (!svgRoot) return null
          if (st.spotTextLayer) return st.spotTextLayer

          const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
          g.setAttribute('class', 'joy_spot_text_layer')
          svgRoot.appendChild(g)

          st.spotTextLayer = g
          return g
        }

        function ensureTextForSpot(st, svgRoot, joyInputId) {
          if (!svgRoot) return null

          let t = st.spotTextEls.get(joyInputId)
          if (t) return t

          const spotId = normalizeSpotId(st, joyInputId)
          t = st.spotTextEls.get(spotId)
          if (t) return t

          let spotEl = null
          if (st.spotEls) {
            spotEl = st.spotEls.get(joyInputId) || st.spotEls.get(spotId) || null
          }
          if (!spotEl) {
            spotEl = svgRoot.querySelector(`[data-spotid="${spotId}"]`)
          }
          if (!spotEl) return null

          const layer = ensureSpotTextLayer(st, svgRoot)
          if (!layer) return null

          const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
          bg.setAttribute('class', 'joy_spot_label_bg')
          bg.style.pointerEvents = 'none'
          layer.appendChild(bg)

          t = document.createElementNS('http://www.w3.org/2000/svg', 'text')
          t.setAttribute('class', 'joy_spot_label')
          t.setAttribute('text-anchor', 'start')
          t.setAttribute('dominant-baseline', 'middle')
          t.style.pointerEvents = 'none'
          layer.appendChild(t)

          t.__bg = bg

          const bb = spotEl.getBBox()

          // store the spot's upper-left as our anchor
          t.__spotX = bb.x
          t.__spotY = bb.y

          // initial position (will be finalized in setSpotLabel)
          t.setAttribute('x', String(bb.x))
          t.setAttribute('y', String(bb.y))

          st.spotTextEls.set(joyInputId, t)
          st.spotTextEls.set(spotId, t)

          return t
        }

        function setSpotLabel(st, svgRoot, joyInputId, decrypt, binds) {
          const t = ensureTextForSpot(st, svgRoot, joyInputId)
          if (!t) return

          const d = String(decrypt || '').replace(/\r\n/g, '\n').trimEnd()
          const b = String((binds && binds !== 0) ? binds : '').replace(/\r\n/g, '\n').trimEnd()

          let raw = d
          if (b && b !== String(joyInputId || '').trim()) {
            raw = d ? `${d}\n${b}` : b
          } else if (!raw) {
            raw = String(joyInputId || '')
          }

          while (t.firstChild) t.removeChild(t.firstChild)

          const lines = raw.split('\n')
          const lineHeightEm = 1.1
          const firstDy = -((lines.length - 1) * lineHeightEm) / 2

          for (let i = 0; i < lines.length; i++) {
            const span = document.createElementNS('http://www.w3.org/2000/svg', 'tspan')
            span.setAttribute('x', t.getAttribute('x') || '0')

            if (i === 0) span.setAttribute('dy', `${firstDy}em`)
            else span.setAttribute('dy', `${lineHeightEm}em`)

            span.textContent = (lines[i] === '') ? ' ' : lines[i]
            t.appendChild(span)
          }

          if (t.style.display === 'none') t.style.display = ''
          if (t.__bg && t.__bg.style.display === 'none') t.__bg.style.display = ''

          const textBox = t.getBBox()

          const padX = 8
          const padY = 5

          // anchor at the spot's upper-left
          const ax = (typeof t.__spotX === 'number') ? t.__spotX : textBox.x
          const ay = (typeof t.__spotY === 'number') ? t.__spotY : textBox.y

          const bgW = textBox.width + padX * 2
          const bgH = textBox.height + padY * 2

          // bg top-left = anchor
          const bgX = ax
          const bgY = ay

          const bg = t.__bg
          if (bg) {
            bg.setAttribute('x', String(bgX))
            bg.setAttribute('y', String(bgY))
            bg.setAttribute('width', String(bgW))
            bg.setAttribute('height', String(bgH))
          }

          // text sits inside bg with padding.
          // NOTE: y is the text baseline (dominant-baseline: middle), so use the textBox height.
          const textX = bgX + padX
          const textY = bgY + padY + (textBox.height / 2)

          t.setAttribute('x', String(textX))
          t.setAttribute('y', String(textY))

          const tspans = t.querySelectorAll('tspan')
          tspans.forEach(span => span.setAttribute('x', String(textX)))
        }

        function highlightSpotLabel(st, svgRoot, joyInputId) {
          const prevId = st.activeSpotLabelJoyInputId
          if (prevId && prevId !== joyInputId) {
            const prev = st.spotTextEls.get(prevId) || st.spotTextEls.get(normalizeSpotId(st, prevId))
            if (prev) {
              prev.classList.remove('active')
              if (prev.__bg) prev.__bg.classList.remove('active')
            }
          }

          const cur = st.spotTextEls.get(joyInputId) || st.spotTextEls.get(normalizeSpotId(st, joyInputId))
          if (cur) {
            cur.classList.add('active')
            if (cur.__bg) cur.__bg.classList.add('active')
          }

          st.activeSpotLabelJoyInputId = joyInputId
        }

        function setSpotVisible(spotEl, visible) {
          if (!spotEl) return

          if (visible) {
            spotEl.style.display = ''
            spotEl.style.visibility = 'visible'
            spotEl.style.pointerEvents = 'auto'
            spotEl.style.opacity = '0'
          } else {
            spotEl.style.display = 'none'
            spotEl.style.opacity = ''
          }
        }

        function setTextVisible(t, visible) {
          if (!t) return
          const bg = t.__bg || null

          if (visible) {
            t.style.display = ''
            t.style.visibility = 'visible'
            t.style.opacity = '1'

            if (bg) {
              bg.style.display = ''
              bg.style.visibility = 'visible'
              bg.style.opacity = '1'
            }
          } else {
            t.style.display = 'none'
            if (bg) bg.style.display = 'none'
          }
        }

        function hideAllSpotsOnce(st, svgRoot) {
          if (st.hiddenSpotsInitialized) return
          st.hiddenSpotsInitialized = 1

          if (st.spotEls && typeof st.spotEls.forEach === 'function') {
            st.spotEls.forEach(el => setSpotVisible(el, false))
          } else if (svgRoot) {
            svgRoot.querySelectorAll('.joy_spot').forEach(el => setSpotVisible(el, false))
          }

          if (st.spotTextEls && typeof st.spotTextEls.forEach === 'function') {
            st.spotTextEls.forEach(t => setTextVisible(t, false))
          }
        }

        function findSpotEl(st, svgRoot, anyId) {
          const spotId = normalizeSpotId(st, anyId)
          if (st.spotEls) {
            const el = st.spotEls.get(anyId) || st.spotEls.get(spotId)
            if (el) return el
          }
          if (svgRoot) {
            const el = svgRoot.querySelector(`[data-spotid="${spotId}"]`)
            if (el) return el
          }
          return null
        }

        function findSpotTextEl(st, anyId) {
          const spotId = normalizeSpotId(st, anyId)
          return st.spotTextEls.get(anyId) || st.spotTextEls.get(spotId) || null
        }

        function hideSpotById(st, svgRoot, anyId) {
          const spotId = normalizeSpotId(st, anyId)

          const el = findSpotEl(st, svgRoot, spotId)
          setSpotVisible(el, false)

          const t = findSpotTextEl(st, spotId)
          setTextVisible(t, false)
        }

        function hideAllSpotsForGroup(st, svgRoot, gid) {
          if (!gid) return
          const set = st.groupVisibleSpotIds.get(gid)
          if (!set) return

          set.forEach(spotId => hideSpotById(st, svgRoot, spotId))
          set.clear()
        }

        if (devMode != 1) hideAllSpotsOnce(st, svgRoot)

        function inputKindFromJoyInput(joyInput) {
          const s = String(joyInput || '')
          const parts = s.split('_')
          const k = (parts[1] || '').toLowerCase()

          if (k === 'axis') return 'axis'
          if (k === 'button' || k.startsWith('button') || k === 'btn' || k.startsWith('btn')) return 'button'
          if (/(^|[_-])button(\d+)?($|[_-])/i.test(s)) return 'button'
          if (/(^|[_-])btn(\d+)?($|[_-])/i.test(s)) return 'button'
          if (/(^|[_-])axis($|[_-])/i.test(s)) return 'axis'

          return parts[1] || ''
        }

        function buttonNumberFromJoyInput(joyInput) {
          const s = String(joyInput || '')

          let m = s.match(/(?:^|[_-])button(?:[_-])?(\d+)(?:$|[_-])/i)
          if (!m) m = s.match(/button(\d+)/i)
          if (!m) m = s.match(/(?:^|[_-])btn(?:[_-])?(\d+)(?:$|[_-])/i)
          if (!m) m = s.match(/btn(\d+)/i)

          if (m && m[1] != null) {
            const n = Number(m[1])
            if (Number.isFinite(n)) return n
          }

          const nums = s.match(/(\d+)/g)
          if (nums && nums.length) {
            const n = Number(nums[nums.length - 1])
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

          let btnEl = logEl.querySelector('.bind_log_buttons')
          if (!btnEl) {
            btnEl = document.createElement('div')
            btnEl.className = 'bind_log_buttons'
            logEl.appendChild(btnEl)
          }

          let axisEl = logEl.querySelector('.bind_log_axis')
          if (!axisEl) {
            axisEl = document.createElement('div')
            axisEl.className = 'bind_log_axis'
            logEl.appendChild(axisEl)
          }

          return { logEl, btnEl, axisEl }
        }

        function spanIdFromJoyInput(joyInput) {
          const raw = String(joyInput || '')
          const safe = raw.replace(/[^a-zA-Z0-9\-_:.]/g, '_')
          return `bind_${safe}`
        }

        function ensureSpanForJoyInput(btnEl, axisEl, joyInputId, kind, btnNum) {
          const spanId = spanIdFromJoyInput(joyInputId)
          let span = document.getElementById(spanId)

          if (!span) {
            span = document.createElement('span')
            span.id = spanId
            span.className = 'bind_entry w3-text-orange'
            span.dataset.joyinput = joyInputId
            span.style.display = 'block'

            if (kind === 'button') {
              if (btnNum != null) span.dataset.btn = String(btnNum)
              btnEl.appendChild(span)
            } else {
              axisEl.appendChild(span)
            }
          } else {
            span.classList.add('bind_entry')
            span.classList.add('w3-text-orange')
            span.classList.remove('bind_active')
            span.dataset.joyinput = joyInputId
            span.style.display = 'block'

            if (kind === 'button' && btnNum != null) span.dataset.btn = String(btnNum)
          }

          return span
        }

        function resortButtons(btnEl) {
          const kids = Array.from(btnEl.children)

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

          kids.forEach(el => btnEl.appendChild(el))
        }

        function highlightActiveGlobal(st, joyInputId) {
          const newId = spanIdFromJoyInput(joyInputId)

          if (st.activeBindSpanId && st.activeBindSpanId !== newId) {
            const prevEl = document.getElementById(st.activeBindSpanId)
            if (prevEl) {
              prevEl.classList.remove('bind_active')
              prevEl.classList.add('w3-text-orange')
            }
          }

          const curEl = document.getElementById(newId)
          if (curEl) {
            curEl.classList.remove('w3-text-orange')
            curEl.classList.add('bind_active')
          }

          st.activeBindSpanId = newId
        }

        // ===== start =====
        const joyInputId = package.joyInput
        const spotId = normalizeSpotId(st, joyInputId)
        const spotEl = findSpotEl(st, svgRoot, joyInputId)

        if (spotEl) {
          const gid = st.inputToGroup.get(joyInputId) || st.inputToGroup.get(spotId) || null
          const boxEl = gid ? st.groupBoxEls.get(gid) : null

          // If group changed, hide ALL spots that were shown for the previous group
          if (st.visibleGroupId && gid && st.visibleGroupId !== gid) {
            if (devMode != 1) hideAllSpotsForGroup(st, svgRoot, st.visibleGroupId)
          }

          // Hide previously visible single spot (spot + text + bg)
          if (st.visibleSpotId && st.visibleSpotId !== spotId) {
            if (devMode != 1) hideSpotById(st, svgRoot, st.visibleSpotId)
          }

          // Track this spot as visible for this group (so we can nuke the whole group's shown spots on switch)
          if (gid) {
            let set = st.groupVisibleSpotIds.get(gid)
            if (!set) {
              set = new Set()
              st.groupVisibleSpotIds.set(gid, set)
            }
            set.add(spotId)
          }

          // Show current spot
          if (devMode != 1) setSpotVisible(spotEl, true)

          // Ensure label exists, SHOW it (text+bg), then set label
          const t = ensureTextForSpot(st, svgRoot, joyInputId)
          if (devMode != 1) setTextVisible(t, true)

          if (devMode != 1) setSpotLabel(st, svgRoot, joyInputId, decrypt, binds)
          if (devMode != 1) highlightSpotLabel(st, svgRoot, joyInputId)

          st.visibleSpotId = spotId

          // ✅ HARD ENFORCE: hide ALL group boxes for this device, then show only the active one
          if (devMode != 1) hideAllGroupBoxesForState(st)

          if (gid && boxEl) {
            boxEl.classList.remove('is-hidden')
            st.visibleGroupId = gid
          } else {
            st.visibleGroupId = null
          }

          // LATCHED GROUP/SPOT HIGHLIGHT
          if (st.activeGroupId !== gid) {
            if (st.activeGroupId) {
              const oldBox = st.groupBoxEls.get(st.activeGroupId)
              if (oldBox) oldBox.classList.remove('active')
            }
            if (st.activeSpotJoyInputId) {
              const oldSpot =
                (st.spotEls && (st.spotEls.get(st.activeSpotJoyInputId) || st.spotEls.get(normalizeSpotId(st, st.activeSpotJoyInputId)))) ||
                null
              if (oldSpot) oldSpot.classList.remove('active')
            }
            st.activeGroupId = gid
            st.activeSpotJoyInputId = null
          } else {
            if (st.activeSpotJoyInputId && st.activeSpotJoyInputId !== joyInputId) {
              const oldSpot =
                (st.spotEls && (st.spotEls.get(st.activeSpotJoyInputId) || st.spotEls.get(normalizeSpotId(st, st.activeSpotJoyInputId)))) ||
                null
              if (oldSpot) oldSpot.classList.remove('active')
            }
          }

          if (boxEl) boxEl.classList.add('active')
          spotEl.classList.add('active')
          st.activeSpotJoyInputId = joyInputId

          if (boxEl) {
            const parts = ensureBindLog(boxEl)
            const btnEl = parts.btnEl
            const axisEl = parts.axisEl

            const kind = inputKindFromJoyInput(joyInputId)
            const prev = st.inputEventState.get(joyInputId)

            const btnNumForId = (kind === 'button') ? buttonNumberFromJoyInput(joyInputId) : null

            if (devMode != 1) ensureSpanForJoyInput(btnEl, axisEl, joyInputId, kind, btnNumForId)

            if (kind === 'button') resortButtons(btnEl)

            if (devMode != 1) highlightActiveGlobal(st, joyInputId)

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
                if (span) span.textContent = `${decrypt}\n${binds}`

                if (devMode != 1) resortButtons(btnEl)
                if (devMode != 1) highlightActiveGlobal(st, joyInputId)

                if (devMode != 1) setSpotLabel(st, svgRoot, joyInputId, decrypt, binds)
                if (devMode != 1) highlightSpotLabel(st, svgRoot, joyInputId)
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
                if (span) span.textContent = `${decrypt}\n${binds}`

                const MAX = 10
                while (axisEl.children.length > MAX) axisEl.removeChild(axisEl.lastChild)

                if (devMode != 1) highlightActiveGlobal(st, joyInputId)

                if (devMode != 1) setSpotLabel(st, svgRoot, joyInputId, decrypt, binds)
                if (devMode != 1) highlightSpotLabel(st, svgRoot, joyInputId)
              }
            } else {
              const entryText = `${decrypt}\n${binds}`
              if (!prev || prev.lastText !== entryText) {
                const next = prev || {}
                next.lastText = entryText
                st.inputEventState.set(joyInputId, next)

                const spanId = spanIdFromJoyInput(joyInputId)
                const span = document.getElementById(spanId)
                if (span) span.textContent = entryText

                const MAX = 10
                while (axisEl.children.length > MAX) axisEl.removeChild(axisEl.lastChild)

                if (devMode != 1) highlightActiveGlobal(st, joyInputId)

                if (devMode != 1) setSpotLabel(st, svgRoot, joyInputId, decrypt, binds)
                highlightSpotLabel(st, svgRoot, joyInputId)
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
    devMode = package.devMode
    console.log("MODE:", devMode)
    try {
      for (const device in package) {
        const d = package[device]
        if (!d || !d.prefix) continue

        const prefix = d.prefix
        const product = d.product || ''

        try {
          const before = new Set(document.querySelectorAll('.joy_group_box'))

          const res = await requestLayoutForDevice(d.key)
          buildDeviceView(prefix, product, res.layoutJson, res.imageUrl)

          const after = document.querySelectorAll('.joy_group_box')

          after.forEach(el => {
            if (!before.has(el)) {
              el.classList.add('joygroupbox')
            }
          })

          // ✅ hide the entire device UI (canvas + overlays) so it doesn't reserve space
          if (devMode != 1) hideDeviceUI(prefix) 

          // HIDE JOYSPOTS AFTER INIT (for this device/prefix)
          const st = layoutState.byPrefix.get(prefix)
          
          if (st) {
            if (!st.prefix) st.prefix = prefix

            if (st.spotEls && typeof st.spotEls.forEach === 'function') {
              st.spotEls.forEach(el => {
                if (devMode != 1) if (el) el.style.display = 'none'
              })
            } else {
              const root =
                st.svgRoot ||
                st.svgEl ||
                st.overlaySvg ||
                (st.containerEl ? st.containerEl.querySelector('svg') : null)

              if (root) {
                root.querySelectorAll('.joy_spot').forEach(el => {
                  if (devMode != 1) el.style.display = 'none'
                })
              }
            }
          }

          // HIDE ALL GROUP BOXES AFTER INIT (for this device/prefix)
          if (st && st.groupBoxEls && typeof st.groupBoxEls.forEach === 'function') {
            st.groupBoxEls.forEach(el => {
              if (el) el.classList.add('is-hidden')
            })
          } else {
            after.forEach(el => {
              if (!before.has(el)) {
                el.classList.add('is-hidden')
              }
            })
          }

          // track active group for this prefix
          if (st && !st.activeGroupId) {
            st.activeGroupId = null
          }
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
} catch (err) {
  console.log('MAIN', err)
  if (window.ipcRenderer) window.ipcRenderer.send('renderer-response-unhandled-error', serializeError(err), location)
}
