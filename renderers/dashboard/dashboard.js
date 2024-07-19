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

//resource variables
const journalEvent = "Dashboard"

//FUNCTIONS FROM CLICKING
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
      drop(clickedEvent[0],journalEvent) //review function for HTML class requirements.
    }
}



function findMatObject(obj, key, value, parentKey = null) {
  if (typeof obj === 'object' && obj !== null) {
    if (obj[key] === value) {
      return { ...obj, type: parentKey };
    }
    for (const prop in obj) {
      const foundObject = findMatObject(obj[prop], key, value, prop);
      if (foundObject) {
        if (parentKey !== null) {
          foundObject.type = parentKey;
        }
        return foundObject;
      }
    }
  }
  return null;
}

ipcRenderer.on('from_brain-detection', (package) => {
  console.log("device:",package.deviceInfo.position,package.data.detection)
  console.log("data:",package.data)
  document.getElementById(`${package.deviceInfo.position}_${package.data.ind}_assignment`).innerText = package.data.detection
})
ipcRenderer.on('from_brain-detection-initialize', (package) => {
  console.log("device:",package.deviceInfo.position)
  console.log("device:",package.data)
  document.getElementById(`${package.deviceInfo.position}_position`).innerText = package.deviceInfo.product
  const container = document.getElementById(`${package.deviceInfo.position}bar_container`)
  let dynamicDom = document.getElementsByClassName(`${package.deviceInfo.position}_DynamicDom`)
  dynamicDom = Array.from(dynamicDom)
  dynamicDom.forEach(dom => { dom.remove(); })

  
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


// ipcRenderer.on('updateMaterialsStore', (response) => { window.electronStoreMaterials.set('Materials','data',response) })
// ipcRenderer.on('buildMatHistoryDom', (response) => { buildMatHistoryDom(response) })

// function buildMatHistoryDom(response) {
//   const container = document.getElementById('histbar_container')
//   let matHistDynamicDom = document.getElementsByClassName('matHistDynamicDom')
//   matHistDynamicDom = Array.from(matHistDynamicDom)
//   matHistDynamicDom.forEach(dom => { dom.remove(); })
  
//   response[0].data.forEach((mat,index) => {
    
//     let materialName = mat.Name;
//     // let materialObject = findMatObject(response[0].data, "Name",materialName)
//     let materialGradeInfos = gradeInfos(mat.Grade,mat.Total)
    
//     if (materialGradeInfos) {
//         const newTR = document.createElement('tr')
//         container.appendChild(newTR)

//         newTR.setAttribute('class','matHistDynamicDom matHistDynamicDomTR')
        
//         const TH1 = document.createElement('th')
//         newTR.appendChild(TH1)
//         TH1.setAttribute('class','matHistDynamicDom  font-BLOCKY w3-text-orange')
//         TH1.setAttribute('id',`timeStamp_matHist_${mat.Name}`)
//         TH1.innerText = timeConvert(mat.timeStamp).toUpperCase();
        
//         const TH2 = document.createElement('th')
//         newTR.appendChild(TH2);
//         TH2.setAttribute('id',`${index}_pic_mat`)
//         TH2.setAttribute('class','matHistDynamicDom font-BLOCKY w3-text-orange')

//         const img1 = document.createElement('img')
//         TH2.appendChild(img1);
//         img1.setAttribute('class','matHistDynamicDom gradePics2 imgNameSpan')
//         img1.setAttribute('src',`../../public/images/grade${mat.Grade}.png`)
//         img1.style.top = `${parseInt(img1.style.top || 0) - 2}px`;
        
//         const span1 = document.createElement('span')
//         TH2.appendChild(span1)
//         if (!mat.Name_Localised) { materialName = mat.Name; }
//         else { materialName = mat.Name_Localised }
//         span1.innerText = materialName.toUpperCase()
//         span1.setAttribute('class','matHistDynamicDom')

//         const TH3 = document.createElement('th')
//         newTR.appendChild(TH3)
//         if (mat.Operator == "+") {
//           TH3.setAttribute('class','matHistDynamicDom font-BLOCKY font-BLOCKY-green w3-right-align')
//         }
//         if (mat.Operator == "-") {
//           TH3.setAttribute('class','matHistDynamicDom font-BLOCKY font-BLOCKY-red w3-right-align')
//         }

//         const span2 = document.createElement('span')
//         TH3.appendChild(span2)
//         span2.setAttribute('id',`${index}_count_mat`)
//         span2.innerText = `${mat.Operator}${mat.Count} ${mat.Operator_Sign} `
//         span2.setAttribute('class','matHistDynamicDom')

//         const span3 = document.createElement('span')
//         TH3.appendChild(span3)
//         // console.log(materialGradeInfos)
//         span3.setAttribute('style',`color: ${materialGradeInfos[1]}`)
//         span3.innerText = `${mat.Total}`
//         // console.log(materialObject.Total)
//         span3.setAttribute('class','matHistDynamicDom')

//         const span4 = document.createElement('span')
//         TH3.appendChild(span4)
//         span4.setAttribute('class','matHistDynamicDom w3-text-white')
//         span4.innerText = `/`
        
//         const span5 = document.createElement('span')
//         TH3.appendChild(span5)
//         if (mat.Total >= parseInt(materialGradeInfos[0])) {
//           span5.setAttribute('class',`matHistDynamicDom ${mat.Name}_count_tot`)
//         }
//         else {
//           span5.setAttribute('class',`matHistDynamicDom w3-text-orange ${mat.Name}_count_tot`)
//         }
//         span5.innerText = `${materialGradeInfos[0]}`
//         span5.setAttribute('style',`color: ${materialGradeInfos[1]}`)
        
//         const TH4 = document.createElement('th')
//         newTR.appendChild(TH4)
//         TH4.setAttribute('class','mainbarcontainer')
      
//         let distance = materialGradeInfos[2]
//         if (distance === 1) {
//           distance = 100;
//         } else if (distance < 1) {
//           distance *= 100;
//         }
//         const progDivContainer = document.createElement('div')
//         TH4.appendChild(progDivContainer);
//         progDivContainer.setAttribute("class","barcontainer")

//         const progDiv = document.createElement('div')
//         progDivContainer.appendChild(progDiv);
//         progDiv.setAttribute("class",`bar `)
//         progDiv.setAttribute("id",`${materialName}_progress_${distance}`)
//         progDiv.setAttribute("style",`background-color: ${materialGradeInfos[1]};height: ${distance}%; `)
        
//      }
//   })
// }

// //! SYNTHESIS DATA
// async function SynthesisDataF(SynthesisData) {
//   try {
//     //Type
//     // console.log(SynthesisData)
//     let synthTypeS = SynthesisData.Name.split(" ")
//     let synthType = synthTypeS[synthTypeS.length - 1] + "Synth"
//     //Name
//     let synthName = synthTypeS.slice(0,synthTypeS.length -1);
//     synthName = synthName.join(" ")
//     document.getElementById('timeStamp_synth').innerText = timeConvert(SynthesisData.timestamp).toUpperCase();
//     document.getElementById('synthName').innerText = synthName.toUpperCase();
//     document.getElementById('synthType').setAttribute('src',`../../public/images/${synthType}.png`);
//     let materialData = await getEventFromStore(journalEvent);
//     if (materialData) {
//       const container = document.getElementById('synthbar_container')
//       let synthDynamicDom = document.getElementsByClassName('synthDynamicDom')
//       synthDynamicDom = Array.from(synthDynamicDom)
//       synthDynamicDom.forEach(dom => { dom.remove(); })
      
//       SynthesisData.Materials.forEach((mat,index) => {
//         let materialName = null
//         if (!mat.Name_Localised) { materialName = mat.Name; }
//         else { materialName = mat.Name_Localised }
//         let materialObject = findMatObject(materialData, "Name",mat.Name)
//         let materialGradeInfos = gradeInfos(materialObject.Grade,materialObject.Count)
//         if (materialGradeInfos) {
//           const calcValues = {
//             ...mat,
//             ...materialObject,
//             ...{ "timestamp":SynthesisData.timestamp},
//             ...{ "ReduceBy": mat.Count },
//             ...{ "materialData": materialData }
//           }
//           // materialReductions(calcValues)
//           const newTR = document.createElement('tr')
//           container.appendChild(newTR)
//           newTR.setAttribute('class','synthDynamicDom')
          
//           const TH1 = document.createElement('th')
//           newTR.appendChild(TH1)
//           TH1.setAttribute('class','synthDynamicDom')
          
//           const TH2 = document.createElement('th')
//           newTR.appendChild(TH2);
//           TH2.setAttribute('id',`${index}_pic_mat`)
//           TH2.setAttribute('class','synthDynamicDom font-BLOCKY w3-text-orange')
  
//           const img1 = document.createElement('img')
//           TH2.appendChild(img1);
//           img1.setAttribute('class','synthDynamicDom gradePics2 imgNameSpan')
//           img1.setAttribute('src',`../../public/images/grade${materialObject.Grade}.png`)
//           img1.style.top = `${parseInt(img1.style.top || 0) - 2}px`;
          
//           const span1 = document.createElement('span')
//           TH2.appendChild(span1)
//           span1.innerText = materialName.toUpperCase()
//           span1.setAttribute('class','synthDynamicDom')
          
  
//           const TH3 = document.createElement('th')
//           newTR.appendChild(TH3)
//           TH3.setAttribute('class','synthDynamicDom font-BLOCKY font-BLOCKY-red w3-right-align')
  
//           const span2 = document.createElement('span')
//           TH3.appendChild(span2)
//           span2.setAttribute('id',`${index}_count_mat`)
//           span2.innerText = `-${mat.Count} « `
//           span2.setAttribute('class','synthDynamicDom')
  
//           const span3 = document.createElement('span')
//           TH3.appendChild(span3)
//           span3.setAttribute('style',`color: ${materialGradeInfos[1]}`)
//           span3.innerText = `${materialObject.Count}`
//           span3.setAttribute('class','synthDynamicDom')
  
//           const span4 = document.createElement('span')
//           TH3.appendChild(span4)
//           span4.setAttribute('class','synthDynamicDom w3-text-white')
//           span4.innerText = `/`
          
//           const span5 = document.createElement('span')
//           TH3.appendChild(span5)
//           span5.setAttribute('class','synthDynamicDom w3-text-orange')
//           span5.innerText = `${materialGradeInfos[0]}`
//         }
//         else { console.log(materialGradeInfos) }
//       })
//     }
//     else { console.log("No materialData. Nothing came back from getEventStore(journalEvent);")}
//   }
//   catch(e) { console.log(e)}
// }
// //build common mats dom
// function buildCommonMatsDom(mat) {
//   const container = document.getElementById('commonMatBar_container')
//   // let matCommonMatsDynamicDom = document.getElementsByClassName('matCommonMatsDom')
//   // matCommonMatsDynamicDom = Array.from(matCommonMatsDynamicDom)
//   // matCommonMatsDynamicDom.forEach(dom => { dom.remove(); })

//   let materialName = mat.Name;
// // let materialObject = findMatObject(response[0].data, "Name",materialName)
// let materialGradeInfos = gradeInfos(mat.Grade,mat.Count)

// if (materialGradeInfos) {
//     const newTR = document.createElement('tr')
//     container.appendChild(newTR)

//     newTR.setAttribute('class','matCommonMatsDom matCommonMatsDomTR')
//     newTR.setAttribute('id',`${mat.Name}_QRM`)
    
//     // const TH1 = document.createElement('th')
//     // newTR.appendChild(TH1)
//     // TH1.setAttribute('class','matCommonMatsDom  font-BLOCKY w3-text-orange')
//     // TH1.setAttribute('id',`timeStamp_matHist_${mat.Name}`)
//     // // TH1.innerText = timeConvert(mat.timeStamp).toUpperCase();
    
//     const TH2 = document.createElement('th')
//     newTR.appendChild(TH2);
//     TH2.setAttribute('id',`${mat.Name}_pic_mat`)
//     TH2.setAttribute('class','matCommonMatsDom font-BLOCKY w3-text-orange')

//     const img1 = document.createElement('img')
//     TH2.appendChild(img1);
//     img1.setAttribute('class','matCommonMatsDom gradePics2 imgNameSpan')
//     img1.setAttribute('src',`../../public/images/grade${mat.Grade}.png`)
//     img1.style.top = `${parseInt(img1.style.top || 0) - 2}px`;
    
//     const span1 = document.createElement('span')
//     TH2.appendChild(span1)
//     if (!mat.Name_Localised) { materialName = mat.Name; }
//     else { materialName = mat.Name_Localised }
//     span1.innerText = materialName.toUpperCase()
//     span1.setAttribute('class','matCommonMatsDom')

//     const TH3 = document.createElement('th')
//     newTR.appendChild(TH3)
//     TH3.setAttribute('class','matCommonMatsDom font-BLOCKY w3-right-align')
//     // if (mat.Operator == "+") {
//     //   TH3.setAttribute('class','matCommonMatsDom font-BLOCKY font-BLOCKY-green w3-right-align')
//     // }
//     // if (mat.Operator == "-") {
//     //   TH3.setAttribute('class','matCommonMatsDom font-BLOCKY font-BLOCKY-red w3-right-align')
//     // }
    
//     // const span2 = document.createElement('span')
//     // TH3.appendChild(span2)
//     // span2.setAttribute('id',`${mat.Name}_count_mat`)
//     // // span2.innerText = `${mat.Operator}${mat.Count} ${mat.Operator_Sign} `
//     // span2.setAttribute('class','matCommonMatsDom')
    
//     const span3 = document.createElement('span')
//     TH3.appendChild(span3)
//     // console.log(materialGradeInfos)
//     // span3.setAttribute('id',`${mat.Name}_count`)
//     span3.setAttribute('style',`color: ${materialGradeInfos[1]}`)
//     span3.innerText = `${mat.Count}`
//     // console.log(materialObject.Total)
//     span3.setAttribute('class',`matCommonMatsDom ${mat.Name}_count`)

//     const span4 = document.createElement('span')
//     TH3.appendChild(span4)
//     span4.setAttribute('class','matCommonMatsDom w3-text-white')
//     span4.innerText = `/`
    
//     const span5 = document.createElement('span')
//     TH3.appendChild(span5)
//     if (mat.Count >= parseInt(materialGradeInfos[0])) {
//       span5.setAttribute('class',`matCommonMatsDom ${mat.Name}_count_tot`)
//     }
//     else {
//       span5.setAttribute('class',`matCommonMatsDom w3-text-orange ${mat.Name}_count_tot`)
//     }
//     span5.innerText = `${materialGradeInfos[0]}`
//     span5.setAttribute('style',`color: ${materialGradeInfos[1]}`)
    
//     const TH4 = document.createElement('th')
//     newTR.appendChild(TH4)
//     TH4.setAttribute('class','mainbarcontainer')
  
//     let distance = materialGradeInfos[2]
//     if (distance === 1) {
//       distance = 100;
//     } else if (distance < 1) {
//       distance *= 100;
//     }
//     const progDivContainer = document.createElement('div')
//     TH4.appendChild(progDivContainer);
//     progDivContainer.setAttribute("class","barcontainer")

//     const progDiv = document.createElement('div')
//     progDivContainer.appendChild(progDiv);
//     progDiv.setAttribute("class",`bar `)
//     progDiv.setAttribute("id",`${materialName}_progress_${distance}`)
//     progDiv.setAttribute("style",`background-color: ${materialGradeInfos[1]};height: ${distance}%; `)
//   }
// }