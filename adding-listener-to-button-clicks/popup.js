console.log('Content script loaded.')

var observer = new MutationObserver(function(mutations) {
    var listenerAdded = false // Flag to check if listener is already added

    mutations.forEach(function(mutation) {
        if (!mutation.addedNodes || listenerAdded) return

        var button = document.querySelector('button.cc-8fhpv4')
        if (button) {
            console.log('Button found. Adding listener.')
            button.addEventListener('click', function() {
                console.log('Button clicked!')
            })
            listenerAdded = true // Set the flag to true after adding listener
            observer.disconnect() // Stop observing after finding the button
        }
    })
})

observer.observe(document.body, {
    childList: true,
    subtree: true
})
