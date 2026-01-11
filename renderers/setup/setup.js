try {
  let devMode

  const location = 'setup'
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


  ipcRenderer.on('from_brain-detection-ready', async package => {
    const thisDeviceEl = document.getElementById('thisDevice')
        if (thisDeviceEl) {
          thisDeviceEl.innerText = "Running Log..."
        }
  })
  ipcRenderer.on('from_brain-detection', package => {
  try {
    const el = document.getElementById('log')
    if (!el) return

    // Detect the real scroller: if el doesn't scroll, fall back to the page
    const scroller =
      (el.scrollHeight > el.clientHeight ? el : document.scrollingElement || document.documentElement)

    // Only autoscroll if user is already near the bottom
    const nearBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 40

    delete package.keybindArticulation
    ipcRenderer.send('renderer-response-showSetupLog', package)

    let msg = package?.message
    if (msg == null) msg = package
    if (typeof msg !== 'string') msg = JSON.stringify(msg, null, 2)

    if (el.textContent && !el.textContent.endsWith('\n')) el.textContent += '\n'
    el.textContent += msg + '\n'

    if (nearBottom) {
      // Do it twice: once immediately, once after layout
      scroller.scrollTop = scroller.scrollHeight
      requestAnimationFrame(() => {
        scroller.scrollTop = scroller.scrollHeight
      })
    }
  } catch (err) {
    ipcRenderer.send(
      'renderer-response-unhandled-error',
      serializeError(err),
      location
    )
  }
})



} 
catch (err) {
  console.log('ipcMAIN', err)
  if (window.ipcRenderer) window.ipcRenderer.send('renderer-response-unhandled-error', serializeError(err), location)
}
