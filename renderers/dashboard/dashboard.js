let myClassSave = null;
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
const journalEvent = "Materials"

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
      if (evt.target.hasAttribute('expandall')) {
        const allExpansion = document.getElementsByClassName('expansion')
        document.getElementById('collapseall').innerText = "radio_button_unchecked"
        document.getElementById('expandall').innerText = "radio_button_checked"
        Array.from(allExpansion).forEach(item => {
          if (item.classList.contains('w3-hide')) {
            item.classList.remove('w3-hide')
          }
        })
      }
      if (evt.target.hasAttribute('collapseall')) { 
        const allExpansion = document.getElementsByClassName('expansion')
        document.getElementById('collapseall').innerText = "radio_button_checked"
        document.getElementById('expandall').innerText = "radio_button_unchecked"
        Array.from(allExpansion).forEach(item => {
          if (!item.classList.contains('w3-hide')) {
            item.classList.add('w3-hide')
          }
        })
      }
      if (events.found.find(i => i ==='checkbox') == 'checkbox') {
        const iname = document.getElementById(clickedEvent[0]); 
        let boxStatus = null;
        if (iname.innerText == 'check_box') { iname.innerText = 'check_box_outline_blank'; boxStatus = 0 }
        else { iname.innerText = 'check_box'; boxStatus = 1 }
        let mats = await retrieveMaterialStore(clickedEventMod,boxStatus)
        QuickMaterialReference(mats,boxStatus)
        async function retrieveMaterialStore(name,boxStatus) {
          const materialStoreData = await getEventFromStore('Materials');
          let returnMe = null;
          Object.values(materialStoreData).forEach((value) => {
            if (Array.isArray(value)) {
                value.forEach((material) => {
                    if (material.Name === name[0]) {
                      material.StateQRM = boxStatus
                      returnMe = material
                }
            });
            }
          });
          window.electronStoreMaterials.set('Materials','data',materialStoreData)
          return returnMe
        }
        async function QuickMaterialReference(mats,StateQRM) {
         
          mats = await mats
          const FET = {
            type: "QRM",
            method: "POST",
            selectedMat: mats,
            StateQRM: StateQRM,
            filePath: ["./events/Appendix/materials.json"]
          }

          fetcher(FET);
          if (StateQRM == 0) {
            const QRMname = document.getElementById(`${mats.Name}_QRM`)
            QRMname.remove()
          }
          else {
            buildCommonMatsDom(mats)
          }
        }
      }
    }
    else {
      drop(clickedEvent[0],journalEvent) //review function for HTML class requirements.
    }
}
ipcRenderer.on('updateMaterialsStore', (response) => { window.electronStoreMaterials.set('Materials','data',response) })
//Grade Function to find grade max counts
function gradeInfos(x,y) {
  try {
    let findGrade = null;
    
    const gradeCountArray = [
      { grade: "101", count: 1 },
      { grade: "1", count: "300" },
      { grade: "2", count: "250" },
      { grade: "3", count: "200" },
      { grade: "4", count: "150" },
      { grade: "5", count: "100" }
    ]
    findGrade = gradeCountArray.find(i => i.grade == x)
    
    
    
    const calc = y / findGrade.count
    const percentColorArray = [
      { percent: "100", color: "#00FF00" },
      { percent: "70", color: "#9ACD32" },
      { percent: "50", color: "#FFFF00" },
      { percent: "30", color: "#ff4800" },
      { percent: "0", color: "#FF0000" }
    ]
    let findColor = null
    let closestDiff = Infinity;
    percentColorArray.forEach((color) => {
      const diff = Math.abs(Number(color.percent) / 100 - calc);
      if (diff < closestDiff) {
        findColor = color.color;
        closestDiff = diff;
        // console.log(closestDiff)
      }
    });
    // console.log(findColor,findGrade)
  
  // console.log(findGrade.count,findColor,calc)
  
    return [ findGrade.count, findColor, calc ];
  }
  catch(e) { 
    if (!x) { 
      console.log("Missing variable data: Material Grade",x)
    }
    if (!y) {
      console.log("Missing variable data: Material Count",y)
    }
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
//Get data from electron-store.
//! MATERIALS DATA (GOOD)
getMats()
function getMats() {
  let journalData = getEventFromStore(journalEvent);
  if (journalData) {
    (async () => {
      try {
        const FET = {
          method: "GET",
          filePath: ["../../events/Appendix/materials.json","../../events/Appendix/synthesis.json"]
        }
        const combinedFetch = await fetcher(FET);
        material = await arrayCombiner(combinedFetch, journalData)
        synthesisStructure = await synthesisJSON(combinedFetch,material)
        materialsDataF(material)
        synthesisComponentsBuilder(synthesisStructure,material)
        let SynthesisData = await getEventFromStore('Synthesis');
        if (SynthesisData) { SynthesisDataF(SynthesisData); }
        // else { console.log("getMats(), Synthesis, No event data.")}
      } catch (error) {
        console.log(error);
      }
    })();
    
    async function synthesisJSON(inputData,material) {
      let components = await inputData
      let items = {
        materials: material,
        synthItems: components[1].synthesis
      }
      return items
    }
    async function arrayCombiner(json_materials_array, journalData) {
      try {
        let mats_array = await json_materials_array
        mats_array = mats_array[0]
        let jData = await journalData
        // const currentDate = new Date();
        // jData['timestamp'] = currentDate.toISOString();
        const combinedData = {
          ...mats_array,
          Raw: mats_array.Raw.reduce((result, item) => {
            const matchingItem = jData.Raw.find(mat => mat.Name === item.Name);
            if (matchingItem) {
              result.push({ ...item, ...matchingItem });
            }
            else {
              const a = { "Count": 0 }
              result.push({ ...item, ...a })
            }
            return result;
          }, []),
          Encoded: mats_array.Encoded.reduce((result, item) => {
            const matchingItem = jData.Encoded.find(mat => mat.Name === item.Name);
           
            if (matchingItem) {
              result.push({ ...item, ...matchingItem });
            }
            else {
              const a = { "Count": 0 }
              result.push({ ...item, ...a })
            }
            return result;
          }, []),
          Manufactured: mats_array.Manufactured.reduce((result, item) => {
            const matchingItem = jData.Manufactured.find(mat => mat.Name === item.Name);
            if (matchingItem) {
              result.push({ ...item, ...matchingItem });
            }
            else {
              const a = { "Count": 0 }
              result.push({ ...item, ...a })
            }
            return result;
          }, [])
        };

        let manufactured = combinedData.Manufactured.reduce((result, item) => {
          const group = item.Group;
          const grade = parseInt(item.Grade);
          if (!result[group]) { result[group] = []; }
          result[group].push({ ...item, Grade: grade });
          return result;
        }, {});
        for (const group in manufactured) { manufactured[group].sort((a, b) => a.Grade - b.Grade); }

        let raw = combinedData.Raw.reduce((result, item) => {
          const group = item.Group;
          const grade = parseInt(item.Grade);
          if (!result[group]) { result[group] = []; }
          result[group].push({ ...item, Grade: grade });
          return result;
        }, {});
        for (const group in raw) { raw[group].sort((a, b) => a.Grade - b.Grade); }

        let encoded = combinedData.Encoded.reduce((result, item) => {
          const group = item.Group;
          const grade = parseInt(item.Grade);
        
          if (!result[group]) { result[group] = []; }
          result[group].push({ ...item, Grade: grade });
          return result;
        }, {});
        for (const group in encoded) { encoded[group].sort((a, b) => a.Grade - b.Grade); }
        const sortedEncoded = {};
        Object.keys(encoded).sort().forEach((key) => { sortedEncoded[key] = encoded[key]; });
        const sortedmanufactured = {};
        Object.keys(manufactured).sort().forEach((key) => { sortedmanufactured[key] = manufactured[key]; });
        const sortedraw = {};
        Object.keys(raw).sort().forEach((key) => { sortedraw[key] = raw[key]; });

        // const sortedData = {};
        // Object.keys(data)
        //   .sort()
        //   .forEach((key) => {
        //     sortedData[key] = data[key].sort((a, b) => a.Grade - b.Grade);
        // });

     
        let allMats = { 
          Manufactured: sortedmanufactured,
          Encoded: sortedEncoded,
          Raw: sortedraw
        }
        return allMats ;
      } 
      catch(e) { console.log(e); }
    }
  } else {
    console.log("Materials, No Event Data");
  }
}
function materialsDataF(material) {
  try {
    const container = document.getElementById("SpaceMatList_container")
    // const matsExist = document.getElementById("Mat-Existance")
    // if (matsExist) { matsExist.classList.remove("w3-hide") } 
    // else { 
    //   if (matsExist.classList.contains('w3-hide')) { return }
    //   else (matsExist.classList.add('w3-hide'))
    // }
    //ITERATE NEW DATA INTO EACH NEW DOM
    // if (container.classList.contains("Mat-Dom-Created")) {
    //   material.Manufactured.forEach(item => {
    //     if (document.getElementById(`${Object.keys(item)}`)) {
    //       console.log(item);
    //       document.getElementById(`${Object.keys(item)}`).innerText = Object.values(item)
    //     }
    //   });
    // }
   
    if (!container.classList.contains("Mat-Dom-Created")) {
      container.classList.add("Mat-Dom-Created")
      // console.log(material)
      
      Object.keys(material).forEach(mat=> {
        const div1 = document.createElement("div")
        container.appendChild(div1)
        // const br1 = document.createElement("br")
        // container.appendChild(br1)
        div1.setAttribute("class","w3-row w3-dark-gray w3-margin-left")

        const div2 = document.createElement("div");
        div1.appendChild(div2);
        div2.setAttribute('id',`${mat}_em`)
        div2.setAttribute('class',"w3-text-orange pointer w3-black w3-border w3-round font-BLOCKY")
        div2.setAttribute('data-attribute',`em_${mat}_em`)

        const matSpan = document.createElement('span')
        div2.appendChild(matSpan)
        // matSpan.innerHTML = "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"

        const i1 = document.createElement('i')
        div2.appendChild(i1);
        i1.setAttribute('id',`${mat}_em_arrow`)
        i1.setAttribute('class',"w3-text-brightgreen material-icons")
        i1.innerHTML = 'arrow_drop_up'
        div2.innerHTML = div2.innerHTML + mat
        
        const div3 = document.createElement('div')
        div1.appendChild(div3)
        div3.setAttribute('id',`${mat}_em_container`)
        div3.setAttribute('class',"w3-row expansion") 
        
        Object.keys(material[mat]).forEach(catItems => {
          const cat = document.createElement('div')
          div3.appendChild(cat)
          cat.setAttribute('id',`${catItems}_em`)
          cat.setAttribute('class',"w3-text-orange pointer w3-black w3-border w3-round font-BLOCKY w3-margin-left")
          cat.setAttribute('data-attribute',`${catItems}_em`)

          const catSpan = document.createElement('span')
          cat.appendChild(catSpan)
          // catSpan.innerHTML = "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"

          const i2 = document.createElement('i')
          cat.appendChild(i2);
          i2.setAttribute('id',`${catItems}_em_arrow`)
          i2.setAttribute('class',"w3-text-brightgreen material-icons")
          i2.innerHTML = 'arrow_drop_up'
          cat.innerHTML = cat.innerHTML + catItems.toUpperCase()

          const div4 = document.createElement('div')
          div3.appendChild(div4)
          div4.setAttribute('id',`${catItems}_em_container`)
          // console.log(material[mat][catItems][0].State);
          if (material[mat][catItems][0].State) {
            div4.setAttribute('class',"w3-row expansion w3-margin-left w3-margin-bottom")
          }
          else {
            div4.setAttribute('class',"w3-row w3-hide expansion w3-margin-left w3-margin-bottom")
          }
          
          Object.values(material[mat][catItems]).forEach(categoryItem => {
            if (categoryItem.StateQRM == 1) {
              buildCommonMatsDom(categoryItem)
            }
            
            // let materialObject = findMatObject(material[mat][catItems], "Name",categoryItem.Name)
            // console.log(materialObject.Grade,materialObject.Count);
            // console.log("Listz: ",categoryItem.Grade,categoryItem.Count,categoryItem.Name)
            
            let materialGradeInfos = gradeInfos(categoryItem.Grade,categoryItem.Count)
            // console.log(materialGradeInfos)

            
            const catItemDiv = document.createElement('div')
            div4.appendChild(catItemDiv)
            catItemDiv.setAttribute('class',"w3-margin-left w3-border w3-round-large w3-black pointer")
            
            const catItemQRMWord = document.createElement('span')
            catItemDiv.appendChild(catItemQRMWord)
            catItemQRMWord.setAttribute('class','w3-small font-BLOCKY w3-text-orange')
            catItemQRMWord.innerText = 'QRM'

            
            const catItemQRM = document.createElement('i')
            // catItemQRM.type = 'checkbox'
            catItemDiv.appendChild(catItemQRM)
            catItemQRM.setAttribute("id",`${categoryItem.Name}_checkbox`)
            catItemQRM.setAttribute("class",`checkboxPos w3-text-brightgreen material-icons`)
            if (categoryItem.StateQRM == 1) {
              catItemQRM.innerText = 'check_box'
            }
            else { 
              catItemQRM.innerText = 'check_box_outline_blank'
            }
            
            const catItemImgSpan = document.createElement('span')
            catItemDiv.appendChild(catItemImgSpan)
            catItemImgSpan.setAttribute("class","w3-medium w3-vivid-yellowfg2 font-BLOCKY ")
            
            

            let gradeImageUrl = `../../public/images/grade${categoryItem.Grade}.png`
            fetch(gradeImageUrl).then(response => {
            // fetch doesn't necessarily need to exist, however its just being used as a identifier if the .png exists.
            // due to this being the renderer, fs and path can not be utilized in the renderer process, only utilized in the main process.
                  const img = document.createElement('img')
                  catItemImgSpan.appendChild(img)
                  
                  img.setAttribute('id',`${categoryItem.Name}_grade${categoryItem.Grade}_picture`)
                  // img.setAttribute('class',`w3-margin-left gradePics`)
                  img.setAttribute('class',`gradePics`)
                  const img_pic = document.getElementById(`${categoryItem.Name}_grade${categoryItem.Grade}_picture`)
                  img_pic.setAttribute('src',gradeImageUrl)
                  img.innerHTML = "&nbsp;&nbsp;&nbsp;&nbsp;" + img_pic
                  
                }).catch(error => {
                    // let h51 = document.createElement('h5')
                    // console.log("*********** If errors above, its expected as picture is not available ***********")
                    // div5.appendChild(h51)
                    // h51.setAttribute('id',`engineer-${anEngineer.EngineerID}_portrait`)
                    // h51.setAttribute('class',`w3-vivid-yellowfg2 ${event} font-BLOCKY`)
                    // h51 = document.getElementById(`engineer-${anEngineer.EngineerID}_portrait`)
                    // h51.innerHTML = "Picture Not Available..."
            });

            
              
            const catItemCount = document.createElement('span')
            // catItemCount.appendChild(document.createTextNode(' '));
            catItemDiv.appendChild(catItemCount)
            // catItemCount.setAttribute("id",`${categoryItem.Name}_count`)
            catItemCount.setAttribute("class",`imgNameSpan count-right-align font-BLOCKY ${categoryItem.Name}_count`)
            catItemCount.setAttribute('style',`color: ${materialGradeInfos[1]}`)
            catItemCount.innerHTML = categoryItem.Count
            catItemCount.style.top = `${parseInt(catItemCount.style.top || 0) + 3}px`;

            const span4 = document.createElement('span')
            catItemDiv.appendChild(span4)
            span4.setAttribute('class','imgNameSpan w3-text-white')
            span4.innerText = `/`
            span4.style.top = `${parseInt(span4.style.top || 0) + 3}px`;
            
            const span5 = document.createElement('span')
            catItemDiv.appendChild(span5)
            // span5.setAttribute('id',`${categoryItem.Name}_count_tot`)
            span5.setAttribute('class',`imgNameSpan font-BLOCKY ${categoryItem.Name}_count_tot`)
            if (categoryItem.Count >= materialGradeInfos[0]) {
              span5.setAttribute('style',`color: ${materialGradeInfos[1]}`)
            }
            else {
              span5.classList.add('w3-text-orange')
              // span5.setAttribute('class',`color: ${materialGradeInfos[1]}`)
              // span5.setAttribute('class','w3-text-orange')
            }
            span5.innerText = `${materialGradeInfos[0]}`
            span5.style.top = `${parseInt(span5.style.top || 0) + 3}px`;
            
            catItemDiv.appendChild(document.createTextNode('  '));
            
            const catItemName = document.createElement('span')
            catItemDiv.appendChild(catItemName)
            catItemName.setAttribute("id",`${categoryItem.Name}`)

            if (categoryItem.Name_Localised) {
              // console.log(categoryItem.Name_Localised)
              catItemName.innerHTML = categoryItem.Name_Localised.toUpperCase()
            }
            else {
              catItemName.innerHTML = categoryItem.Name.toUpperCase()
            }
            catItemName.setAttribute("class","w3-medium w3-vivid-yellowfg2 font-BLOCKY descriptorText")



            // const TH4 = document.createElement('span')
            // catItemDiv.appendChild(TH4)
            // TH4.setAttribute('class','mainbarcontainer')
          
            // let distance = materialGradeInfos[2]
            // if (distance === 1) {
            //   distance = 100;
            // } else if (distance < 1) {
            //   distance *= 100;
            // }
            // const progDivContainer = document.createElement('span')
            // TH4.appendChild(progDivContainer);
            // progDivContainer.setAttribute("class","barcontainer")
    
            // const progDiv = document.createElement('span')
            // progDivContainer.appendChild(progDiv);
            // progDiv.setAttribute("class",`bar `)
            // progDiv.setAttribute("id",`${categoryItem.Name}_progress_${distance}`)
            // progDiv.setAttribute("style",`background-color: ${materialGradeInfos[1]};height: ${distance}%; `)

              
          })
        })
      })
    }
  }
  catch(e) {
    console.log(e);
  }
}
function synthesisComponentsBuilder(fetchedData) {
  try {
    const synthInfo = fetchedData.synthItems.sort((a,b) => a.name.localeCompare(b.name))
    const container = document.getElementById("compbarTable_container")
    if (!container.classList.contains("SynthItems-Dom-Created")) {
      container.classList.add("SynthItems-Dom-Created")
      
      synthInfo.forEach(synthItems => {
        function synthLowestInfo(synthItems,fetchedData) {
          try {
            const types = [synthItems.basic,synthItems.standard,synthItems.premium]
            let categoryDetails = []
            types.forEach((category,index) => {
              let details = []
              Object.keys(category).forEach((item,index) => {
                // //! item is the key name of each basic material.
                // //! category[item] will resolve to the value of the above key.
                if (item != 'visible' && item != 'bonus' && category.visible == "1") {
                  const itemData = findMatObject(fetchedData.materials,"Name",item)
                  let materialName = null;
                  if (itemData.Name_Localised) { materialName = itemData.Name_Localised } else { materialName = itemData.Name }
                  const remainderItems = { "Name": materialName, "Remain": Math.floor(itemData.Count / category[item]) }
                  details.push(remainderItems)
                }
              })
              if (details.length) { 
                const lowestValueObject = details.reduce((lowest, current) => {
                    if (current.Remain < lowest.Remain) { return current } 
                  else { return lowest}
                });
                if (index == 0) { categoryDetails['basic'] = lowestValueObject }
                if (index == 1) { categoryDetails['standard'] = lowestValueObject }
                if (index == 2) { categoryDetails['premium'] = lowestValueObject }
                // console.log(synthItems.name,lowestValueObject)

              }
            })
            return categoryDetails
          }
          catch(e) {
            console.log(e);
          }
        }
        const synthLowest = synthLowestInfo(synthItems,fetchedData)
        // console.log(synthItems.name,synthLowest);
        
        const TR1 = document.createElement("tr")
        container.appendChild(TR1)
        // const br1 = document.createElement("br")
        // container.appendChild(br1)

        const TH1 = document.createElement('th')
        TR1.appendChild(TH1)
        TH1.setAttribute('class','font-BLOCKY w3-text-orange')
        TH1.setAttribute('id',`synthItems_${synthItems.name}_QRM`)
        TH1.innerText = `QRM`;

        const TH2 = document.createElement('th')
        TR1.appendChild(TH2)
        TH2.setAttribute('class','font-BLOCKY w3-text-orange')
        TH2.setAttribute('id',`synthItems_${synthItems.name}_name`)
        TH2.innerText = `${synthItems.name}`

        const TH3 = document.createElement('th')
        TR1.appendChild(TH3)
        TH3.setAttribute('class','font-BLOCKY w3-text-orange')
        TH3.setAttribute('id',`synthItems_${synthItems.name}_basic`)
        TH3.innerText = `${synthLowest.basic.Remain}`

        const TH4 = document.createElement('th')
        TR1.appendChild(TH4)
        TH4.setAttribute('class','font-BLOCKY w3-text-orange')
        TH4.setAttribute('id',`synthItems_${synthItems.name}_standard`)
        
        if (synthLowest.standard?.Remain) { 
          TH4.innerText = `${synthLowest.standard.Remain}`
        }
        else {
          TH4.innerText = ``
        }

        const TH5 = document.createElement('th')
        TR1.appendChild(TH5)
        TH5.setAttribute('class','font-BLOCKY w3-text-orange')
        TH5.setAttribute('id',`synthItems_${synthItems.name}_premium`)
        if (synthLowest.premium?.Remain) { 
          TH5.innerText = `${synthLowest.premium?.Remain}`
        }
        else {
          TH5.innerText = ``
        }

        const TH6 = document.createElement('th')
        TR1.appendChild(TH6)
        TH6.setAttribute('class','font-BLOCKY w3-text-orange')
        TH6.setAttribute('id',`synthItems_${synthItems.name}_description`)
        // TH6.innerText = ``
      })
    }
  } 
  catch (error) {
    
  }
}
ipcRenderer.on('Materials', () => { getMats(); })
//! MATERIALS HISTORY
let method_type = null;
let method_data = null;
materialHistory(method_type,method_data);
async function materialHistory(method_type,method_data) {
  // console.log("MATERIAL HISTORY","\n[TYPE:",method_type,"] \n [DATA",method_data,"]")
  let history = null
  if (method_type && method_type == "ADD") {
    // const FET = {
    //   type: "materialHistory",
    //   method: "POST",
    //   filePath: ["./events/Appendix/materialHistory.json"],
    //   material: method_data 
    // };
    // history = await fetcher(FET);
    console.log("POST".yellow)
  }
  else { // (GOOD)
    const FET = {
      method: "GET",
      filePath: ["../../events/Appendix/materialHistory.json"]
    };
    history = await fetcher(FET, buildMatHistoryDom);
  }
  return { history, method_data };
}
//build the history dom.
ipcRenderer.on('buildMatHistoryDom', (response) => { buildMatHistoryDom(response) })
function buildMatHistoryDom(response) {
  const container = document.getElementById('histbar_container')
  let matHistDynamicDom = document.getElementsByClassName('matHistDynamicDom')
  matHistDynamicDom = Array.from(matHistDynamicDom)
  matHistDynamicDom.forEach(dom => { dom.remove(); })
  
  response[0].data.forEach((mat,index) => {
    
    let materialName = mat.Name;
    // let materialObject = findMatObject(response[0].data, "Name",materialName)
    let materialGradeInfos = gradeInfos(mat.Grade,mat.Total)
    
    if (materialGradeInfos) {
        const newTR = document.createElement('tr')
        container.appendChild(newTR)

        newTR.setAttribute('class','matHistDynamicDom matHistDynamicDomTR')
        
        const TH1 = document.createElement('th')
        newTR.appendChild(TH1)
        TH1.setAttribute('class','matHistDynamicDom  font-BLOCKY w3-text-orange')
        TH1.setAttribute('id',`timeStamp_matHist_${mat.Name}`)
        TH1.innerText = timeConvert(mat.timeStamp).toUpperCase();
        
        const TH2 = document.createElement('th')
        newTR.appendChild(TH2);
        TH2.setAttribute('id',`${index}_pic_mat`)
        TH2.setAttribute('class','matHistDynamicDom font-BLOCKY w3-text-orange')

        const img1 = document.createElement('img')
        TH2.appendChild(img1);
        img1.setAttribute('class','matHistDynamicDom gradePics2 imgNameSpan')
        img1.setAttribute('src',`../../public/images/grade${mat.Grade}.png`)
        img1.style.top = `${parseInt(img1.style.top || 0) - 2}px`;
        
        const span1 = document.createElement('span')
        TH2.appendChild(span1)
        if (!mat.Name_Localised) { materialName = mat.Name; }
        else { materialName = mat.Name_Localised }
        span1.innerText = materialName.toUpperCase()
        span1.setAttribute('class','matHistDynamicDom')

        const TH3 = document.createElement('th')
        newTR.appendChild(TH3)
        if (mat.Operator == "+") {
          TH3.setAttribute('class','matHistDynamicDom font-BLOCKY font-BLOCKY-green w3-right-align')
        }
        if (mat.Operator == "-") {
          TH3.setAttribute('class','matHistDynamicDom font-BLOCKY font-BLOCKY-red w3-right-align')
        }

        const span2 = document.createElement('span')
        TH3.appendChild(span2)
        span2.setAttribute('id',`${index}_count_mat`)
        span2.innerText = `${mat.Operator}${mat.Count} ${mat.Operator_Sign} `
        span2.setAttribute('class','matHistDynamicDom')

        const span3 = document.createElement('span')
        TH3.appendChild(span3)
        // console.log(materialGradeInfos)
        span3.setAttribute('style',`color: ${materialGradeInfos[1]}`)
        span3.innerText = `${mat.Total}`
        // console.log(materialObject.Total)
        span3.setAttribute('class','matHistDynamicDom')

        const span4 = document.createElement('span')
        TH3.appendChild(span4)
        span4.setAttribute('class','matHistDynamicDom w3-text-white')
        span4.innerText = `/`
        
        const span5 = document.createElement('span')
        TH3.appendChild(span5)
        if (mat.Total >= parseInt(materialGradeInfos[0])) {
          span5.setAttribute('class',`matHistDynamicDom ${mat.Name}_count_tot`)
        }
        else {
          span5.setAttribute('class',`matHistDynamicDom w3-text-orange ${mat.Name}_count_tot`)
        }
        span5.innerText = `${materialGradeInfos[0]}`
        span5.setAttribute('style',`color: ${materialGradeInfos[1]}`)
        
        const TH4 = document.createElement('th')
        newTR.appendChild(TH4)
        TH4.setAttribute('class','mainbarcontainer')
      
        let distance = materialGradeInfos[2]
        if (distance === 1) {
          distance = 100;
        } else if (distance < 1) {
          distance *= 100;
        }
        const progDivContainer = document.createElement('div')
        TH4.appendChild(progDivContainer);
        progDivContainer.setAttribute("class","barcontainer")

        const progDiv = document.createElement('div')
        progDivContainer.appendChild(progDiv);
        progDiv.setAttribute("class",`bar `)
        progDiv.setAttribute("id",`${materialName}_progress_${distance}`)
        progDiv.setAttribute("style",`background-color: ${materialGradeInfos[1]};height: ${distance}%; `)
        
     }
  })
}
function addMaterialHistory(historyArray) {
  // only gets sent 1 material at a time. Allows it to manipulate the dom.
  try {
    const container = document.getElementById('histbar_container')
    let elementArray = Array.from(document.getElementsByClassName('matHistDynamicDomTR'));
    if (elementArray.length >= 10) {
      const lastEle = elementArray[elementArray.length - 1]
      lastEle.remove()
    } 
    console.log(historyArray[0].Grade,historyArray[0].Total)
    const updateTot = gradeInfos(historyArray[0].Grade,historyArray[0].Total)
    let updateItem = document.getElementsByClassName(`${historyArray[0].Name}_count`)
    let updateItemTotal = document.getElementsByClassName(`${historyArray[0].Name}_count_tot`)
    
    if (historyArray[0].Total >= updateTot[0]) {
      Array.from(updateItem).forEach(ele => {
        if (ele.classList.contains('w3-text-orange')) { ele.classList.remove('w3-text-orange') }
        ele.innerText = `${updateTot[0]}`
        ele.style.color = updateTot[1]
        
      })
      Array.from(updateItemTotal).forEach(ele2 => {
        if (ele2.classList.contains('w3-text-orange')) { ele2.classList.remove('w3-text-orange') }
        ele2.style.color = updateTot[1]
      })
    }
    else {
      Array.from(updateItem).forEach(ele => {
        ele.innerText = `${historyArray[0].Total}`
        ele.style.color = updateTot[1]
      })
      Array.from(updateItemTotal).forEach(ele2 => {
        ele2.style.color= updateTot[1]
      })
    }
    
    historyArray.forEach((mat,index) => {
      let materialName = null;
      // let materialObject = findMatObject(historyArray, "Name",materialName)
      let materialGradeInfos = gradeInfos(mat.Grade,mat.Total)
      
      if (materialGradeInfos) {
          const secondChild = container.children[1];
          const newTR = document.createElement('tr')
          container.insertBefore(newTR,secondChild)
          newTR.setAttribute('class','matHistDynamicDom matHistDynamicDomTR')
          
          const TH1 = document.createElement('th')
          newTR.appendChild(TH1)
          TH1.setAttribute('class','matHistDynamicDom  font-BLOCKY w3-text-orange')
          TH1.setAttribute('id',`timeStamp_matHist_${mat.Name}`)
          TH1.innerText = timeConvert(mat.timeStamp).toUpperCase();
          
          const TH2 = document.createElement('th')
          newTR.appendChild(TH2);
          TH2.setAttribute('id',`${index}_pic_mat`)
          TH2.setAttribute('class','matHistDynamicDom font-BLOCKY w3-text-orange')
  
          const img1 = document.createElement('img')
          TH2.appendChild(img1);
          img1.setAttribute('class','matHistDynamicDom gradePics2 imgNameSpan')
          img1.setAttribute('src',`../../public/images/grade${mat.Grade}.png`)
          img1.style.top = `${parseInt(img1.style.top || 0) - 2}px`;
          
          if (!mat.Name_Localised) { materialName = mat.Name; }
          else { materialName = mat.Name_Localised }
  
          const span1 = document.createElement('span')
          TH2.appendChild(span1)
          span1.innerText = materialName.toUpperCase()
          span1.setAttribute('class','matHistDynamicDom')
  
          const TH3 = document.createElement('th')
          newTR.appendChild(TH3)
          if (mat.Operator == "+") {
            TH3.setAttribute('class','matHistDynamicDom font-BLOCKY font-BLOCKY-green w3-right-align')
          }
          if (mat.Operator == "-") {
            TH3.setAttribute('class','matHistDynamicDom font-BLOCKY font-BLOCKY-red w3-right-align')
          }
  
          const span2 = document.createElement('span')
          TH3.appendChild(span2)
          span2.setAttribute('id',`${index}_count_mat`)
          span2.innerText = `${mat.Operator}${mat.Count} ${mat.Operator_Sign} `
          span2.setAttribute('class','matHistDynamicDom')
  
          const span3 = document.createElement('span')
          TH3.appendChild(span3)
          span3.setAttribute('style',`color: ${materialGradeInfos[1]}`)
          span3.innerText = `${mat.Total}`
          // console.log(materialObject.Total)
          span3.setAttribute('class','matHistDynamicDom')
  
          const span4 = document.createElement('span')
          TH3.appendChild(span4)
          span4.setAttribute('class','matHistDynamicDom w3-text-white')
          span4.innerText = `/`
          
          const span5 = document.createElement('span')
          TH3.appendChild(span5)
          //  return [ findGrade.count, findColor, calc ];
          // console.log(mat.Total,materialGradeInfos[0])
          if (mat.Total >= materialGradeInfos[0]) {
            span5.setAttribute('class',`matHistDynamicDom `)
            // span5.setAttribute('class',`matHistDynamicDom ${mat.Name}_count_tot`)
          }
          else {
            // span5.setAttribute('class',`matHistDynamicDom w3-text-orange ${mat.Name}_count_tot`)
            span5.setAttribute('class',`matHistDynamicDom w3-text-orange `)
          }
          span5.setAttribute('style',`color: ${materialGradeInfos[1]}`)
          span5.innerText = `${materialGradeInfos[0]}`

          const TH4 = document.createElement('th')
          newTR.appendChild(TH4)
          TH4.setAttribute('class','mainbarcontainer')
        
          const span6 = document.createElement('span')
          TH4.appendChild(span6)
          // span6.setAttribute('class','w3-center')

          let distance = materialGradeInfos[2]
          if (distance === 1) {
            distance = 100;
          } else if (distance < 1) {
            distance *= 100;
          }
          const progDivContainer = document.createElement('div')
          span6.appendChild(progDivContainer);
          progDivContainer.setAttribute("class","barcontainer")

          const progDiv = document.createElement('div')
          progDivContainer.appendChild(progDiv);
          progDiv.setAttribute("class",`bar `)
          progDiv.setAttribute("id",`${materialName}_progress_${distance}`)
          progDiv.setAttribute("style",`background-color: ${materialGradeInfos[1]};height: ${distance}%; `)
          // const TH4 = document.createElement('th')
          // newTR.appendChild(TH4)
          // TH4.setAttribute('class','mainbarcontainer')
          
          // const span6 = document.createElement('span')
          // TH4.appendChild(span6)
          // // span6.setAttribute('class','w3-center')

          // let distance = materialGradeInfos[2]
          // if (distance === 1) {
          //   distance = 100;
          // } else if (distance < 1) {
          //   distance *= 100;
          // }
          // const progDivContainer = document.createElement('div')
          // span6.appendChild(progDivContainer);
          // progDivContainer.setAttribute("class","barcontainer")

          // const progDiv = document.createElement('div')
          // progDivContainer.appendChild(progDiv);
          // progDiv.setAttribute("class",`bar `)
          // progDiv.setAttribute("id",`${materialName}_progress_${distance}`)
          // progDiv.setAttribute("style",`background-color: ${materialGradeInfos[1]};height: ${distance}%;`)
      }
    })
  }
  catch(e) { 
    console.log(e);
  }
}
//! SYNTHESIS DATA
ipcRenderer.on('FromBrain-Materials-Synthesis', (SynthesisData) => { if (SynthesisData) { SynthesisDataF(SynthesisData); } else { console.log("Synthesis, No Event Data") } });
async function SynthesisDataF(SynthesisData) {
  try {
    //Type
    // console.log(SynthesisData)
    let synthTypeS = SynthesisData.Name.split(" ")
    let synthType = synthTypeS[synthTypeS.length - 1] + "Synth"
    //Name
    let synthName = synthTypeS.slice(0,synthTypeS.length -1);
    synthName = synthName.join(" ")
    document.getElementById('timeStamp_synth').innerText = timeConvert(SynthesisData.timestamp).toUpperCase();
    document.getElementById('synthName').innerText = synthName.toUpperCase();
    document.getElementById('synthType').setAttribute('src',`../../public/images/${synthType}.png`);
    let materialData = await getEventFromStore(journalEvent);
    if (materialData) {
      const container = document.getElementById('synthbar_container')
      let synthDynamicDom = document.getElementsByClassName('synthDynamicDom')
      synthDynamicDom = Array.from(synthDynamicDom)
      synthDynamicDom.forEach(dom => { dom.remove(); })
      
      SynthesisData.Materials.forEach((mat,index) => {
        let materialName = null
        if (!mat.Name_Localised) { materialName = mat.Name; }
        else { materialName = mat.Name_Localised }
        let materialObject = findMatObject(materialData, "Name",mat.Name)
        let materialGradeInfos = gradeInfos(materialObject.Grade,materialObject.Count)
        if (materialGradeInfos) {
          const calcValues = {
            ...mat,
            ...materialObject,
            ...{ "timestamp":SynthesisData.timestamp},
            ...{ "ReduceBy": mat.Count },
            ...{ "materialData": materialData }
          }
          // materialReductions(calcValues)
          const newTR = document.createElement('tr')
          container.appendChild(newTR)
          newTR.setAttribute('class','synthDynamicDom')
          
          const TH1 = document.createElement('th')
          newTR.appendChild(TH1)
          TH1.setAttribute('class','synthDynamicDom')
          
          const TH2 = document.createElement('th')
          newTR.appendChild(TH2);
          TH2.setAttribute('id',`${index}_pic_mat`)
          TH2.setAttribute('class','synthDynamicDom font-BLOCKY w3-text-orange')
  
          const img1 = document.createElement('img')
          TH2.appendChild(img1);
          img1.setAttribute('class','synthDynamicDom gradePics2 imgNameSpan')
          img1.setAttribute('src',`../../public/images/grade${materialObject.Grade}.png`)
          img1.style.top = `${parseInt(img1.style.top || 0) - 2}px`;
          
          const span1 = document.createElement('span')
          TH2.appendChild(span1)
          span1.innerText = materialName.toUpperCase()
          span1.setAttribute('class','synthDynamicDom')
          
  
          const TH3 = document.createElement('th')
          newTR.appendChild(TH3)
          TH3.setAttribute('class','synthDynamicDom font-BLOCKY font-BLOCKY-red w3-right-align')
  
          const span2 = document.createElement('span')
          TH3.appendChild(span2)
          span2.setAttribute('id',`${index}_count_mat`)
          span2.innerText = `-${mat.Count} « `
          span2.setAttribute('class','synthDynamicDom')
  
          const span3 = document.createElement('span')
          TH3.appendChild(span3)
          span3.setAttribute('style',`color: ${materialGradeInfos[1]}`)
          span3.innerText = `${materialObject.Count}`
          span3.setAttribute('class','synthDynamicDom')
  
          const span4 = document.createElement('span')
          TH3.appendChild(span4)
          span4.setAttribute('class','synthDynamicDom w3-text-white')
          span4.innerText = `/`
          
          const span5 = document.createElement('span')
          TH3.appendChild(span5)
          span5.setAttribute('class','synthDynamicDom w3-text-orange')
          span5.innerText = `${materialGradeInfos[0]}`
        }
        else { console.log(materialGradeInfos) }
      })
    }
    else { console.log("No materialData. Nothing came back from getEventStore(journalEvent);")}
  }
  catch(e) { console.log(e)}
}
//build common mats dom
function buildCommonMatsDom(mat) {
  const container = document.getElementById('commonMatBar_container')
  // let matCommonMatsDynamicDom = document.getElementsByClassName('matCommonMatsDom')
  // matCommonMatsDynamicDom = Array.from(matCommonMatsDynamicDom)
  // matCommonMatsDynamicDom.forEach(dom => { dom.remove(); })

  let materialName = mat.Name;
// let materialObject = findMatObject(response[0].data, "Name",materialName)
let materialGradeInfos = gradeInfos(mat.Grade,mat.Count)

if (materialGradeInfos) {
    const newTR = document.createElement('tr')
    container.appendChild(newTR)

    newTR.setAttribute('class','matCommonMatsDom matCommonMatsDomTR')
    newTR.setAttribute('id',`${mat.Name}_QRM`)
    
    // const TH1 = document.createElement('th')
    // newTR.appendChild(TH1)
    // TH1.setAttribute('class','matCommonMatsDom  font-BLOCKY w3-text-orange')
    // TH1.setAttribute('id',`timeStamp_matHist_${mat.Name}`)
    // // TH1.innerText = timeConvert(mat.timeStamp).toUpperCase();
    
    const TH2 = document.createElement('th')
    newTR.appendChild(TH2);
    TH2.setAttribute('id',`${mat.Name}_pic_mat`)
    TH2.setAttribute('class','matCommonMatsDom font-BLOCKY w3-text-orange')

    const img1 = document.createElement('img')
    TH2.appendChild(img1);
    img1.setAttribute('class','matCommonMatsDom gradePics2 imgNameSpan')
    img1.setAttribute('src',`../../public/images/grade${mat.Grade}.png`)
    img1.style.top = `${parseInt(img1.style.top || 0) - 2}px`;
    
    const span1 = document.createElement('span')
    TH2.appendChild(span1)
    if (!mat.Name_Localised) { materialName = mat.Name; }
    else { materialName = mat.Name_Localised }
    span1.innerText = materialName.toUpperCase()
    span1.setAttribute('class','matCommonMatsDom')

    const TH3 = document.createElement('th')
    newTR.appendChild(TH3)
    TH3.setAttribute('class','matCommonMatsDom font-BLOCKY w3-right-align')
    // if (mat.Operator == "+") {
    //   TH3.setAttribute('class','matCommonMatsDom font-BLOCKY font-BLOCKY-green w3-right-align')
    // }
    // if (mat.Operator == "-") {
    //   TH3.setAttribute('class','matCommonMatsDom font-BLOCKY font-BLOCKY-red w3-right-align')
    // }
    
    // const span2 = document.createElement('span')
    // TH3.appendChild(span2)
    // span2.setAttribute('id',`${mat.Name}_count_mat`)
    // // span2.innerText = `${mat.Operator}${mat.Count} ${mat.Operator_Sign} `
    // span2.setAttribute('class','matCommonMatsDom')
    
    const span3 = document.createElement('span')
    TH3.appendChild(span3)
    // console.log(materialGradeInfos)
    // span3.setAttribute('id',`${mat.Name}_count`)
    span3.setAttribute('style',`color: ${materialGradeInfos[1]}`)
    span3.innerText = `${mat.Count}`
    // console.log(materialObject.Total)
    span3.setAttribute('class',`matCommonMatsDom ${mat.Name}_count`)

    const span4 = document.createElement('span')
    TH3.appendChild(span4)
    span4.setAttribute('class','matCommonMatsDom w3-text-white')
    span4.innerText = `/`
    
    const span5 = document.createElement('span')
    TH3.appendChild(span5)
    if (mat.Count >= parseInt(materialGradeInfos[0])) {
      span5.setAttribute('class',`matCommonMatsDom ${mat.Name}_count_tot`)
    }
    else {
      span5.setAttribute('class',`matCommonMatsDom w3-text-orange ${mat.Name}_count_tot`)
    }
    span5.innerText = `${materialGradeInfos[0]}`
    span5.setAttribute('style',`color: ${materialGradeInfos[1]}`)
    
    const TH4 = document.createElement('th')
    newTR.appendChild(TH4)
    TH4.setAttribute('class','mainbarcontainer')
  
    let distance = materialGradeInfos[2]
    if (distance === 1) {
      distance = 100;
    } else if (distance < 1) {
      distance *= 100;
    }
    const progDivContainer = document.createElement('div')
    TH4.appendChild(progDivContainer);
    progDivContainer.setAttribute("class","barcontainer")

    const progDiv = document.createElement('div')
    progDivContainer.appendChild(progDiv);
    progDiv.setAttribute("class",`bar `)
    progDiv.setAttribute("id",`${materialName}_progress_${distance}`)
    progDiv.setAttribute("style",`background-color: ${materialGradeInfos[1]};height: ${distance}%; `)
  }
}