console.log('Content script loaded.')

var observer = new MutationObserver(function(mutations) {
    var buttonClicked = false // Flag to check if listener is already added

    mutations.forEach(function(mutation) {
        if (!mutation.addedNodes || buttonClicked) return

        var button = document.querySelector('button.cc-8fhpv4')
        if (button) {
            console.log('Button found. Clicking it.')
            button.click()
            buttonClicked = true // Set the flag to true after adding listener
            observer.disconnect() // Stop observing after finding the button
        }
    })
})

observer.observe(document.body, {
    childList: true,
    subtree: true
})
