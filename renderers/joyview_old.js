try {
  const location = 'joyview'

  // normalize ipcRenderer handle (you were mixing ipc / ipcRenderer)
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
    // Use arraySearch(f) to parse through something your looking for in an array or if you are comparing multiple arrays.
    // Combines forEach and find loop methods.
    // In this parent function, we are only selecting one item to look for, which we will put in an array anyways for the
    // arraySearch() function to properly work.

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
    // prefix -> { layout, spotEls: Map(joyInput -> SVGElement), groupBoxEls: Map(groupId -> HTMLElement), inputToGroup: Map(joyInput -> groupId) }
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
      box.innerText = `${product}\n${groups[gid].label || gid}`
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
    layoutState.byPrefix.set(prefix, { layout: layoutJson, spotEls, groupBoxEls, inputToGroup })
  }

  ipcRenderer.on('from_brain-detection', async package => {
    try {
      const st = layoutState.byPrefix.get(package.prefix)

      // Prefer SVG overlay spot if layout is loaded
      if (st) {
        const joyInputId = package.joyInput
        const spotEl = st.spotEls.get(joyInputId)
        if (spotEl) {
          // force re-flash every event
          spotEl.classList.remove('active')
          spotEl.getBoundingClientRect()
          spotEl.classList.add('active')

          clearTimeout(spotEl._offTimer)
          spotEl._offTimer = setTimeout(() => {
            spotEl.classList.remove('active')
          }, 120)

          const gid = st.inputToGroup.get(joyInputId)
          const boxEl = gid ? st.groupBoxEls.get(gid) : null

          if (boxEl) {
            boxEl.classList.remove('active')
            boxEl.getBoundingClientRect()
            boxEl.classList.add('active')

            clearTimeout(boxEl._offTimer)
            boxEl._offTimer = setTimeout(() => {
              boxEl.classList.remove('active')
            }, 220)
          }

          // done (don’t also try old DOM highlight)
          return
        }
      }

      // Fallback: old DOM highlight
      const node = document.getElementById(package.joyInput)
      if (!node) {
        recordUnplaced(package)
      } else {
        node.classList.remove('active')
        node.getBoundingClientRect()
        node.classList.add('active')

        clearTimeout(node._offTimer)
        node._offTimer = setTimeout(() => {
          node.classList.remove('active')
        }, 120)
      }
    } catch (err) {
      console.log(err)
      ipcRenderer.send('renderer-response-error', serializeError(err), location)
    }

    try {
      const changeButton = document.getElementById(`${package.joyInput}_assignment`)
      const changeButton2 = document.getElementById(`${package.prefix}displayedBind_assignment`)
      const title = document.getElementById(`${package.prefix}displayedBind`)

      for (const n of [...title.childNodes]) {
        if (n.nodeType === Node.TEXT_NODE) {
          title.removeChild(n)
        }
      }

      const textNode = document.createTextNode(`${package.product} «» ${package.joyInput.toUpperCase()}`)
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

        changeButton.innerText = screenReady
        changeButton2.innerText = screenReady
        title.insertBefore(textNode, title.children[0].nextSibling)
      } else {
        changeButton.innerText = package.joyInput
        changeButton2.innerText = package.joyInput
        title.insertBefore(textNode, title.children[0].nextSibling)
      }

      const allColors = document.getElementsByClassName(`currentButton_${package.prefix}`)
      if (allColors.length > 0) {
        Array.from(allColors).forEach(item => {
          if (item.classList.contains(`currentButton_${package.prefix}`)) {
            item.classList.remove(`currentButton_${package.prefix}`)
            item.classList.remove('font-BLOCKY-green')
            item.classList.add('w3-text-orange')
          }
        })
      }

      changeButton.classList.remove('w3-text-orange')
      changeButton.classList.add('font-BLOCKY-green')
      changeButton.classList.add(`currentButton_${package.prefix}`)
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

        // headers
        const posEl = document.getElementById(`${prefix}_position`)
        if (posEl) posEl.innerText = product

        const header = document.getElementById(`${prefix}displayedBind`)
        if (header) header.insertAdjacentText('beforeend', product)

        // overlays (ONE time per device)
        try {
          const res = await requestLayoutForDevice(d.key) // "3344:43F4"
          buildDeviceView(prefix, product, res.layoutJson, res.imageUrl)
        } catch (err) {
          recordUnplaced({ prefix, joyInput: `layout_missing_${prefix}` })
          ipcRenderer.send('renderer-response-error', serializeError(err), location)
        }

        // rebuild table rows
        const container = document.getElementById(`${prefix}bar_container`)
        if (!container) continue

        let dynamicDom = document.getElementsByClassName(`${prefix}_DynamicDom`)
        dynamicDom = Array.from(dynamicDom)
        dynamicDom.forEach(dom => dom.remove())

        if (d.buttons != 0) {
          for (let btn = 1; btn <= d.buttons; btn++) {
            const newTR = document.createElement('tr')
            container.appendChild(newTR)

            newTR.setAttribute('class', `${prefix}_DynamicDom ${prefix}_DynamicDomTR`)

            const TH1 = document.createElement('th')
            newTR.appendChild(TH1)
            TH1.setAttribute('class', `${prefix}_DynamicDom font-BLOCKY w3-text-orange`)
            TH1.setAttribute('id', `${prefix}_button${btn}_assignment`)
            TH1.innerText = ''

            const TH2 = document.createElement('th')
            newTR.appendChild(TH2)
            TH2.setAttribute('class', `${prefix}_DynamicDom font-BLOCKY w3-text-orange`)
            TH2.setAttribute('id', `${prefix}_button${btn}_slot`)
            TH2.innerText = String(btn)

            const TH3 = document.createElement('th')
            newTR.appendChild(TH3)
            TH3.setAttribute('class', `${prefix}_DynamicDom font-BLOCKY w3-text-orange`)
            TH3.setAttribute('id', `${prefix}_button${btn}_index`)
            TH3.innerText = String(btn)
          }
        }

        if (d.axes != 0) {
          for (const axis of d.axes) {
            const newTR = document.createElement('tr')
            container.appendChild(newTR)

            newTR.setAttribute('class', `${prefix}_DynamicDom ${prefix}_DynamicDomTR`)

            const TH1 = document.createElement('th')
            newTR.appendChild(TH1)
            TH1.setAttribute('class', `${prefix}_DynamicDom font-BLOCKY w3-text-orange`)
            TH1.setAttribute('id', `${prefix}_axis_${axis}_assignment`)
            TH1.innerText = ''

            const TH2 = document.createElement('th')
            newTR.appendChild(TH2)
            TH2.setAttribute('class', `${prefix}_DynamicDom font-BLOCKY w3-text-orange`)
            TH2.setAttribute('id', `${prefix}_axis_${axis}_slot`)
            TH2.innerText = `${prefix}_axis_${axis}`

            const TH3 = document.createElement('th')
            newTR.appendChild(TH3)
            TH3.setAttribute('class', `${prefix}_DynamicDom font-BLOCKY w3-text-orange`)
            TH3.setAttribute('id', `${prefix}_axis_${axis}_index`)
            TH3.innerText = `${prefix}_axis_${axis}`
          }
        }

        ipcRenderer.send('initializer-response', `${prefix} joyview initialized...`)
      }
    } catch (err) {
      ipcRenderer.send('renderer-response-unhandled-error', serializeError(err), location)
    }
  })
} catch (err) {
  console.log('MAIN', err)
  if (window.ipcRenderer) window.ipcRenderer.send('renderer-response-unhandled-error', serializeError(err), 'joyview')
}
