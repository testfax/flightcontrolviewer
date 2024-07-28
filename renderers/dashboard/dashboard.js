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
  console.log(package.keybindArray)
  console.log(package)
  try {
    const changeButton = document.getElementById(`${package.deviceInfo.position}_${package.data.ind}_assignment`)
    const changeButton2 = document.getElementById(`${package.deviceInfo.position}_displayedBind_assignment`)
    const title = document.getElementById(`${package.deviceInfo.position}_displayedBind_position`)
    let bindStack = []
    if (package.keybindArray != 0) { 
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
      title.innerText = package.deviceInfo.product + ` «» ` + package.data.detection.toUpperCase()
    }
    else {
      changeButton.innerText = package.data.detection
      changeButton2.innerText = package.data.detection
      title.innerText = package.deviceInfo.product + ` «» ` + package.data.detection.toUpperCase()
    }
    let allColors = document.getElementsByClassName(`currentButton_${package.deviceInfo.position}`)
    if (allColors.length > 0) {
      Array.from(allColors).forEach(item => {
        if (item.classList.contains(`currentButton_${package.deviceInfo.position}`)) {
          item.classList.remove(`currentButton_${package.deviceInfo.position}`)
          item.classList.remove('font-BLOCKY-green')
          item.classList.add('w3-text-orange')
        }
      })
    }
    changeButton.classList.remove(`w3-text-orange`)
    changeButton.classList.add('font-BLOCKY-green')
    changeButton.classList.add(`currentButton_${package.deviceInfo.position}`)
  }
  catch (e) {
    console.log(e)
  }

})
ipcRenderer.on('from_brain-detection-initialize', (package) => {
  document.getElementById(`${package.deviceInfo.position}_position`).innerText = package.deviceInfo.product
  document.getElementById(`${package.deviceInfo.position}_displayedBind_position`).innerText = package.deviceInfo.product
  const container = document.getElementById(`${package.deviceInfo.position}bar_container`)
  let dynamicDom = document.getElementsByClassName(`${package.deviceInfo.position}_DynamicDom`)
  dynamicDom = Array.from(dynamicDom)
  dynamicDom.forEach(dom => { dom.remove() })
  try {
    Object.keys(package.data).forEach((slot,index) => {
      const newTR = document.createElement('tr')
      container.appendChild(newTR)
      newTR.setAttribute('class',`${package.deviceInfo.position}_DynamicDom ${package.deviceInfo.position}_DynamicDomTR`)
  
      const TH1 = document.createElement('th')
      newTR.appendChild(TH1)
      TH1.setAttribute('class',`${package.deviceInfo.position}_DynamicDom font-BLOCKY w3-text-orange`)
      TH1.setAttribute('id',`${package.deviceInfo.position}_${index}_assignment`)
      TH1.innerText = ""
  
      const TH2 = document.createElement('th')
      newTR.appendChild(TH2)
      TH2.setAttribute('class',`${package.deviceInfo.position}_DynamicDom font-BLOCKY w3-text-orange`)
      TH2.setAttribute('id',`${package.deviceInfo.position}_${index}_slot`)
      TH2.innerText = slot
  
      const TH3 = document.createElement('th')
      newTR.appendChild(TH3)
      TH3.setAttribute('class',`${package.deviceInfo.position}_DynamicDom font-BLOCKY w3-text-orange`)
      TH3.setAttribute('id',`${package.deviceInfo.position}_${index}_index`)
      TH3.innerText = index
    })
    ipcRenderer.send('initializer-response',package.deviceInfo.position);
  }
  catch (e) {
    console.log(e)
  }
})