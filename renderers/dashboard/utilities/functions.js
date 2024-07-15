ipcRenderer.on('fetcherMatHistory', (data) => { addMaterialHistory(data) })


class Tooltip {
  constructor(element) {
    this.element = element;
    this.tooltipKey = element.id;
    // this.tooltipKey = element.id.split("_").pop();
    console.log(this.tooltipKey)
    this.tooltipText = tooltipObject[this.tooltipKey];
    this.tooltip = document.createElement("div");
    this.tooltip.classList.add("tooltip");
    this.tooltip.innerText = this.tooltipText;
    

    this.element.addEventListener("mouseover", this.showTooltip.bind(this));
    this.element.addEventListener("mouseout", this.hideTooltip.bind(this));
    this.element.addEventListener("mousemove", this.positionTooltip.bind(this));

    document.body.appendChild(this.tooltip);
  }

  showTooltip() {
    this.tooltip.style.display = "block";
  }

  hideTooltip() {
    this.tooltip.style.display = "none";
  }

  positionTooltip(event) {
    const x = event.clientX + 10;
    const y = event.clientY + 10;
    this.tooltip.style.left = x + "px";
    this.tooltip.style.top = y + "px";
  }
}
async function getEventFromStore(event) {
  try {
    let data = await window.eliteEvent.multiStores
    data = data.find(i=> i.multiStore.store.data.event === event)
    
    if (!data) { 
      return 0
    }
    let info = data.multiStore.get('data')
    if (info) { return info }
    else { return 0 }

  }
  catch(e) { console.log("getEventFromStore ERROR:",e)}
}
function arraySearch(searchArray,flags) {
  if (flags != null) {
    let found = []
    let notFound = []
    searchArray.forEach((event) => {
      const result = flags.find((element) => element === event);
      if (result) { found.push(result); }
      if (!result) { notFound.push(event) }
    });
    if (found.length == 0) { return { found, notFound } }
    return { found, notFound }
  }
  else {
    let found = []
    let notFound = ['null']
    return { found, notFound }
  }
}
async function drop(clickedEvent,other) {
  try {
    let state = null
    if (clickedEvent != null && clickedEvent.length) {
      const box = document.getElementById(clickedEvent)
      if (box.classList.contains('pointer') && clickedEvent[0] != null) { //CLASS POINTER MUST BE PRESENT ON "NAMED ATTRIBUTE"
        let container = document.getElementById(`${clickedEvent}_container`)
        let identify = clickedEvent.split("_")
        let arrow = null;
        // let ModclickedEvent = null
        let fromStore = null; 
        if (other && identify[1] == 'em') { 
          // ModclickedEvent = clickedEvent.split("_")
          // clickedEvent = ModclickedEvent[0]
          fromStore = await getEventFromStore(other);
        }
        
        arrow = document.getElementById(`${clickedEvent}_arrow`)
        
        if (container.classList.contains("w3-hide")) {
          container.classList.remove('w3-hide');
          arrow.innerText = "arrow_drop_down";
          state = 1
        }
        else {
          container.classList.add("w3-hide");
          arrow.innerText = "arrow_drop_up";
          state = 0
        }
        if (identify[1] == 'em') {
            Object.values(fromStore).forEach((value) => {
              if (Array.isArray(value)) {
                value.forEach((material) => {
                  if (material.Group === identify[0]) {
                    material.State = state;
                    
                  }
                });
              }
            });
            window.electronStoreMaterials.set('Materials','data',fromStore)
            const FET = {
              type: 'Materials',
              method: "POST",
              filePath: ["./events/Appendix/materials.json"],
              category: identify[0],
              state: state
            }
            
            fetcher(FET);
        }
      }
      if (box.classList.contains('descriptorText') && clickedEvent[0] != null) { 
        // let ModclickedEvent = null
        let fromStore = null; 
        if (other) {
          fromStore = getEventFromStore(other);
          Object.values(fromStore).forEach((value) => {
            if (Array.isArray(value)) {
              value.forEach((material) => {
                if (material.Name === clickedEvent) {
                  // console.log(material.description)
                  document.getElementById('descriptionText').innerText = material.description
                }
              });
            }
          });
          
        }
        else {
          console.log("NOHTING FROM STORE")
        }
      }
    }
    return state
  }
  catch(e) { console.log(e); }
}
async function fetcher(FET,callback) {
  const d = { FET, "option": FET.type };
  let options = { 
    method: FET.method, 
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'mode': 'same-origin' }, 
  };
  let fetched = [];
  let response = []
  if (FET.method == "POST") { 
    options['body'] = JSON.stringify(d)
    ipcRenderer.send('fetcherMain',FET);
    
  }
  else {
    for (let a in FET.filePath) {
      fetched = await fetch(FET.filePath[a],options)
      response[a] = await fetched.json();
    }
    if (typeof callback === 'function') {
      callback(response);
    }
    return response
  }
}
function timeConvert(inputDateTime,addTo) {
  // 2023-11-04T04:29:13.000Z+4594
  // console.log(inputDateTime)
  if (inputDateTime.includes("+")) { 
    inputDateTime = inputDateTime.split("+")[[0]]
  }
  if (!addTo) { addTo = 0 }  
  const date = new Date(inputDateTime);
  date.setUTCHours(date.getUTCHours() - addTo)

  // Define the month names
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  // Extract the components
  const day = date.getUTCDate().toString().padStart(2, "0");
  const month = monthNames[date.getUTCMonth()];
  const year = date.getUTCFullYear().toString().slice(-2);
  const hours = date.getUTCHours().toString().padStart(2, "0") 
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const timezone = "Z";

  // Create the formatted string
  const formattedDateTime = `${day}${month}${year} ${hours}:${minutes}${timezone}`;
  return formattedDateTime
}
function parentElementTraverse(childElement,numElementsToTraverse) {
  const parentElement = Array.from({ length: numElementsToTraverse }).reduce(
    (element) => element && element.parentNode,
    childElement
  );
  return parentElement
}
//Must be an array of classNames
function sizeDivs(className,tallestElement,numParents) {
  className.forEach(individualClassName => {
    let dashboardElements = Array.from(document.getElementsByClassName(individualClassName))
    // console.log("INDIVDIUAL CLASSNAME:",individualClassName)
    dashboardElements.forEach((element,index) => {
      if (element.offsetParent !== null) {
        const myDiv = parentElementTraverse(element,numParents)
        const divHeight = myDiv.offsetHeight;
        tallestElement.push({ parentElement: myDiv, size: divHeight, childElement: element})
      }
    })
    const elementList = tallestElement
    if (elementList.length >= 1) { 
      const elementWithMaxSize = elementList.reduce((maxElement, currentElement) => {
        if (currentElement.size > maxElement.size) {
            return currentElement;
        }
        return maxElement;
      });
      // console.log("INDIVIDUAL CLASSNAME: Max Size,",elementWithMaxSize)
      tallestElement.forEach(i=> {
        const ele = document.getElementById(i.childElement.id)
        if (!hasHeightStyleSet(ele)) {
          ele.setAttribute('style',`height: ${elementWithMaxSize.size}px;`)
        }
        else { console.log("already set")}
      })
    }
  })
}
function hasHeightStyleSet(elementId) {
  var element = document.getElementById(elementId);
  
  if (element) {
    var inlineStyle = element.getAttribute('style');
    
    if (inlineStyle && inlineStyle.includes('height')) {
      return true;
    }
  }
  
  return false;
}