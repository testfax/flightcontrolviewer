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
      drop(clickedEvent[0],'dashboard') //review function for HTML class requirements.
    }
}


ipcRenderer.on('from_brain-detection', (package) => {
  // console.log(package)
  try {
    const changeButton = document.getElementById(`${package.joyInput}_assignment`)
    const changeButton2 = document.getElementById(`${package.prefix}displayedBind_assignment`)
    const title = document.getElementById(`${package.prefix}displayedBind_position`)
    let bindStack = []
    if (package.keybindArray != 0) { //!0 just means that hte keybind wasn't set yet
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
            else { screenReady += `- ACTION: ${action}\n` }
          })
        }
      }
      // console.log(screenReady)
      changeButton.innerText = screenReady
      changeButton2.innerText = screenReady
      title.innerText = package.product + ` «» ` + package.joyInput.toUpperCase()
    }
    else {
      changeButton.innerText = package.joyInput
      changeButton2.innerText = package.joyInput
      title.innerText = package.product + ` «» ` + package.joyInput.toUpperCase()
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
  catch (e) {
    console.log(e)
  }
})
ipcRenderer.on('from_brain-detection-initialize', (package) => {
  for (const device in package) { 
    // console.log(package[device])
    document.getElementById(`${package[device].prefix}position`).innerText = package[device].product
    document.getElementById(`${package[device].prefix}displayedBind_position`).innerText = package[device].product
    const container = document.getElementById(`${package[device].prefix}bar_container`)
    let dynamicDom = document.getElementsByClassName(`${package[device].prefix}DynamicDom`)
    dynamicDom = Array.from(dynamicDom)
    dynamicDom.forEach(dom => { dom.remove() })
    try {
      if (package[device].buttons != 0) { 
        for (let btn = 1; btn <= package[device].buttons; btn++) {
          // console.log(`button${btn}`)

          const newTR = document.createElement('tr')
          container.appendChild(newTR)
          newTR.setAttribute('class',`${package[device].prefix}DynamicDom ${package[device].prefix}DynamicDomTR`)

          const TH1 = document.createElement('th')
          newTR.appendChild(TH1)
          TH1.setAttribute('class',`${package[device].prefix}DynamicDom font-BLOCKY w3-text-orange`)
          TH1.setAttribute('id',`${package[device].prefix}button${btn}_assignment`)
          TH1.innerText = ""

          const TH2 = document.createElement('th')
          newTR.appendChild(TH2)
          TH2.setAttribute('class',`${package[device].prefix}DynamicDom font-BLOCKY w3-text-orange`)
          TH2.setAttribute('id',`${package[device].prefix}button${btn}_slot`)
          TH2.innerText = btn
    
          const TH3 = document.createElement('th')
          newTR.appendChild(TH3)
          TH3.setAttribute('class',`${package[device].prefix}DynamicDom font-BLOCKY w3-text-orange`)
          TH3.setAttribute('id',`${package[device].prefix}button${btn}_index`)
          TH3.innerText = btn
        }
      }
      if (package[device].axes != 0) {
        for (let axis of package[device].axes) {
          const newTR = document.createElement('tr')
          container.appendChild(newTR)
          newTR.setAttribute('class',`${package[device].prefix}DynamicDom ${package[device].prefix}DynamicDomTR`)

          const TH1 = document.createElement('th')
          newTR.appendChild(TH1)
          TH1.setAttribute('class',`${package[device].prefix}DynamicDom font-BLOCKY w3-text-orange`)
          TH1.setAttribute('id',`${package[device].prefix + "axis_" + axis}_assignment`)
          TH1.innerText = ""

          const TH2 = document.createElement('th')
          newTR.appendChild(TH2)
          TH2.setAttribute('class',`${package[device].prefix}DynamicDom font-BLOCKY w3-text-orange`)
          TH2.setAttribute('id',`${package[device].prefix + "axis_" + axis}_slot`)
          TH2.innerText = package[device].prefix + "axis_" + axis
    
          const TH3 = document.createElement('th')
          newTR.appendChild(TH3)
          TH3.setAttribute('class',`${package[device].prefix}DynamicDom font-BLOCKY w3-text-orange`)
          TH3.setAttribute('id',`${package[device].prefix + "axis_" + axis}_index`)
          TH3.innerText = package[device].prefix + "axis_" + axis
        }
      }
    }
    catch (e) {
      console.log(e)
    }
    ipcRenderer.send('initializer-response',package[device].prefix + "dashboard initialized...")
  }
})