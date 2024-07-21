const windowLoaded =  new Promise(resolve => { window.onload = resolve; });
windowLoaded.then(() => { 

});
let displayMessage = document.getElementById('displayMessage')


ipcRenderer.on('displayMessage', (data) => {
    let classes = Array.from(displayMessage.classList)
    classes.forEach(i=>{ displayMessage.classList.remove(i) })
    const messageIdent = Object.values(data)[0]
    if (data.class) {
        const items = data.class.split(" ")
        items.forEach(i=>{
            displayMessage.classList.add(i)
        })
    }
    displayMessage.textContent = messageIdent
})


ipcRenderer.on('handleFailure', (data) => {
    document.getElementById('awaitingEventStart').classList.add('w3-hide')

    const container = document.getElementById('failedEvents')
    const newDiv = document.createElement('div')
    container.appendChild(newDiv)
    newDiv.setAttribute('class','w3-vivid-red')
    newDiv.textContent = data
})