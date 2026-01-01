try {
  const location = 'dashboard'
  const windowLoaded =  new Promise(resolve => { window.onload = resolve; });
  windowLoaded.then(() => { 
    //FUNCTIONS FROM MOUSEOVER
    const pointer = document.getElementsByClassName("pointer")
    Array.from(pointer).forEach((point)=>{
      point.addEventListener("mouseover", function(event) {
        let target = event.target
        if (target.classList.contains("pointer")) {
          target.classList.remove('w3-black')
          target.classList.add('w3-idontexist')
        }
      })
      point.addEventListener("mouseout", function(event) {
        let target = event.target
        if (target.classList.contains("pointer")) {
          target.classList.remove('w3-idontexist')
          target.classList.add('w3-black')
        }
      });
    })
  });
  window.addEventListener("click", clickedEvent);
  async function clickedEvent(evt) {
    //Use arraySearch(f) to parse through something your looking for in an array or if you are comparing multiple arrays. 
    //    Combines forEach and find loop methods.
    //    In this parent function, we are only selecting one item to look for, which we will put in an array anyways for the 
    //        arraySearch() function to properly work.
      const clickedEvent = [evt.target.getAttribute('id')] //id="guardian_moduleblueprint_checkbox"
      let clickedEventMod = clickedEvent[0]
      let clickedNameEvent = null;
      try {
        clickedEventMod = clickedEventMod.split("_")
        clickedNameEvent = [clickedEventMod.pop()]
        if (clickedEventMod.length >= 2) { clickedEventMod = [clickedEventMod.join("_")]; }
  
      }
      catch (e) {
      }
      const final = clickedEventMod.length == 0 ? clickedNameEvent : clickedEventMod
      const nonUiEvents = ['expandall','collapseall','checkbox']
      const events = arraySearch(nonUiEvents,clickedNameEvent)
  
      if (events.found.length) {
        // if (evt.target.hasAttribute('expandall')) {
        //   const allExpansion = document.getElementsByClassName('expansion')
        //   document.getElementById('collapseall').innerText = "radio_button_unchecked"
        //   document.getElementById('expandall').innerText = "radio_button_checked"
        //   Array.from(allExpansion).forEach(item => {
        //     if (item.classList.contains('w3-hide')) {
        //       item.classList.remove('w3-hide')
        //     }
        //   })
        // }
        // if (evt.target.hasAttribute('collapseall')) { 
        //   const allExpansion = document.getElementsByClassName('expansion')
        //   document.getElementById('collapseall').innerText = "radio_button_checked"
        //   document.getElementById('expandall').innerText = "radio_button_unchecked"
        //   Array.from(allExpansion).forEach(item => {
        //     if (!item.classList.contains('w3-hide')) {
        //       item.classList.add('w3-hide')
        //     }
        //   })
        // }
        // if (events.found.find(i => i ==='checkbox') == 'checkbox') {
        //   const iname = document.getElementById(clickedEvent[0]); 
        //   let boxStatus = null;
        //   if (iname.innerText == 'check_box') { iname.innerText = 'check_box_outline_blank'; boxStatus = 0 }
        //   else { iname.innerText = 'check_box'; boxStatus = 1 }
        //   // let mats = await retrieveMaterialStore(clickedEventMod,boxStatus)
        //   // QuickMaterialReference(mats,boxStatus)
        //   async function retrieveMaterialStore(name,boxStatus) {
        //     const materialStoreData = await getEventFromStore('Materials');
        //     let returnMe = null;
        //     Object.values(materialStoreData).forEach((value) => {
        //       if (Array.isArray(value)) {
        //           value.forEach((material) => {
        //               if (material.Name === name[0]) {
        //                 material.StateQRM = boxStatus
        //                 returnMe = material
        //           }
        //       });
        //       }
        //     });
        //     // window.electronStoreMaterials.set('Materials','data',materialStoreData)
        //     return returnMe
        //   }
        //   async function QuickMaterialReference(mats,StateQRM) {
           
        //     mats = await mats
        //     const FET = {
        //       type: "QRM",
        //       method: "POST",
        //       selectedMat: mats,
        //       StateQRM: StateQRM,
        //       filePath: ["./events/Appendix/materials.json"]
        //     }
  
        //     fetcher(FET);
        //     if (StateQRM == 0) {
        //       const QRMname = document.getElementById(`${mats.Name}_QRM`)
        //       QRMname.remove()
        //     }
        //     else {
        //       buildCommonMatsDom(mats)
        //     }
        //   }
        // }
      }
      else {
        drop(clickedEvent[0],'joyview') //review function for HTML class requirements.
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
  
    let lines = []
  
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

  ipcRenderer.on('from_brain-detection', (package) => {
    // console.log(package)
    try {
      const node = document.getElementById(package.joyInput)
  
      // fallback: input exists but layout spot doesn't
      if (!node) {
        recordUnplaced(package)
      } else {
        node.classList.add('active')
        clearTimeout(node._offTimer)
        node._offTimer = setTimeout(() => node.classList.remove('active'), 120)
      }
    }
    catch (err) {
      console.log(err)
      ipcRenderer.send('renderer-response-error', serializeError(err),location)
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
      const textNode = document.createTextNode(`${package.product}` + ` «» ` + package.joyInput.toUpperCase())
  
      let bindStack = []
      if (package.keybindArray != 0) { //!0 just means that hte keybind wasn't set in game yet
        package.keybindArray.forEach(item => {
          item.actions.forEach(act => {
            bindStack.push({ [item.categoryName] : { "action": act } })
          })
        })
        let screenReady = ''
        const groupedActions = {}
        bindStack.forEach(item => {
          for (let category in item) {
            if (!groupedActions[category]) {
              groupedActions[category] = []
            }
            groupedActions[category].push(item[category].action)
          }
        })
        for (let category in groupedActions) {
          if (package.keybindArticulation) {
            let cat = package.keybindArticulation.categories[category]
            if (cat) { screenReady += `${cat}\n` } 
            else { screenReady += `${package.detection} CAT: ${category}\n` }
            groupedActions[category].forEach(action => {
              let act = package.keybindArticulation.actions[action]
              if (act) { screenReady += `-> ${act}\n` } 
              else { screenReady += `- ! ! ! ACTION ! ! !: ${action}\n` }
            })
          }
        }
        // console.log(screenReady)
        changeButton.innerText = screenReady
        changeButton2.innerText = screenReady
        title.insertBefore(textNode, title.children[0].nextSibling)
      }
      else {
        changeButton.innerText = package.joyInput
        changeButton2.innerText = package.joyInput
        title.insertBefore(textNode, title.children[0].nextSibling)
      }
      let allColors = document.getElementsByClassName(`currentButton_${package.prefix}`)
      if (allColors.length > 0) {
        Array.from(allColors).forEach(item => {
          if (item.classList.contains(`currentButton_${package.prefix}`)) {
            item.classList.remove(`currentButton_${package.prefix}`)
            item.classList.remove('font-BLOCKY-green')
            item.classList.add('w3-text-orange')
          }
        })
      }
      changeButton.classList.remove(`w3-text-orange`)
      changeButton.classList.add('font-BLOCKY-green')
      changeButton.classList.add(`currentButton_${package.prefix}`)
    }
    catch (err) {
      console.log(err)
      ipcRenderer.send('renderer-response-error',serializeError(err),location)
    }
  })
  ipcRenderer.on('from_brain-detection-initialize', (package) => {
    for (const device in package) { 
      // console.log(package[device])
      document.getElementById(`${package[device].prefix}_position`).innerText = package[device].product
      const header = document.getElementById(`${package[device].prefix}displayedBind`)
        header.insertAdjacentText('beforeend',`${package[device].product}`)
      const container = document.getElementById(`${package[device].prefix}bar_container`)
      let dynamicDom = document.getElementsByClassName(`${package[device].prefix}_DynamicDom`)
      dynamicDom = Array.from(dynamicDom)
      dynamicDom.forEach(dom => { dom.remove() })
      try {
        if (package[device].buttons != 0) { 
          for (let btn = 1; btn <= package[device].buttons; btn++) {
            // console.log(`button${btn}`)
  
            const newTR = document.createElement('tr')
            container.appendChild(newTR)
            newTR.setAttribute('class',`${package[device].prefix}_DynamicDom ${package[device].prefix}_DynamicDomTR`)
  
            const TH1 = document.createElement('th')
            newTR.appendChild(TH1)
            TH1.setAttribute('class',`${package[device].prefix}_DynamicDom font-BLOCKY w3-text-orange`)
            TH1.setAttribute('id',`${package[device].prefix}_button${btn}_assignment`)
            TH1.innerText = ""
  
            const TH2 = document.createElement('th')
            newTR.appendChild(TH2)
            TH2.setAttribute('class',`${package[device].prefix}_DynamicDom font-BLOCKY w3-text-orange`)
            TH2.setAttribute('id',`${package[device].prefix}_button${btn}_slot`)
            TH2.innerText = btn
      
            const TH3 = document.createElement('th')
            newTR.appendChild(TH3)
            TH3.setAttribute('class',`${package[device].prefix}_DynamicDom font-BLOCKY w3-text-orange`)
            TH3.setAttribute('id',`${package[device].prefix}_button${btn}_index`)
            TH3.innerText = btn
          }
        }
        if (package[device].axes != 0) {
          for (let axis of package[device].axes) {
            const newTR = document.createElement('tr')
            container.appendChild(newTR)
            newTR.setAttribute('class',`${package[device].prefix}_DynamicDom ${package[device].prefix}_DynamicDomTR`)
  
            const TH1 = document.createElement('th')
            newTR.appendChild(TH1)
            TH1.setAttribute('class',`${package[device].prefix}_DynamicDom font-BLOCKY w3-text-orange`)
            TH1.setAttribute('id',`${package[device].prefix + "_axis_" + axis}_assignment`)
            TH1.innerText = ""
  
            const TH2 = document.createElement('th')
            newTR.appendChild(TH2)
            TH2.setAttribute('class',`${package[device].prefix}_DynamicDom font-BLOCKY w3-text-orange`)
            TH2.setAttribute('id',`${package[device].prefix + "_axis_" + axis}_slot`)
            TH2.innerText = package[device].prefix + "_axis_" + axis
      
            const TH3 = document.createElement('th')
            newTR.appendChild(TH3)
            TH3.setAttribute('class',`${package[device].prefix}_DynamicDom font-BLOCKY w3-text-orange`)
            TH3.setAttribute('id',`${package[device].prefix + "_axis_" + axis}_index`)
            TH3.innerText = package[device].prefix + "_axis_" + axis
          }
        }
      }
      catch (e) {
        console.log(e)
        ipcRenderer.send('renderer-response-error',serializeError(err))
      }
      ipcRenderer.send('initializer-response',package[device].prefix + "joyview initialized...")
    }
  })
}
catch (err) {
  console.log("MAIN",err)
  ipcRenderer.send('renderer-response-unhandled-error',serializeError(err),location)
}