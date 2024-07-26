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
      drop(clickedEvent[0],'getbuffer') //review function for HTML class requirements.
    }
}

ipcRenderer.on('from_brain-detection-getbuffer', (package) => {
  try {
    package.data.forEach((ind,index) => {
      document.getElementById(`${package.deviceInfo.position}_${index}_assignment`).innerText = ind
    })
  }
  catch (e) {
    console.log(e)
  }
})
ipcRenderer.on('from_brain-detection-initialize-getbuffer', (package) => {
  document.getElementById(`${package.deviceInfo.position}_position`).innerText = package.deviceInfo.product
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