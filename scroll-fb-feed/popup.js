console.log('Content script loaded.')

var observer = new MutationObserver(function(mutations) {

    mutations.forEach(function(mutation) {
        const element = document.querySelector('div[aria-label="Actions for this post"]');

        if (element) {
            console.log('Button found, scrolling.')
            startScrolling();
        }
    })
})

observer.observe(document.body, {
    childList: true,
    subtree: true
})

// Function to start scrolling
function startScrolling() {
    setInterval(() => {
        window.scrollBy(0, 100); // Scrolls down 100 pixels every interval
    }, 5000); // Adjust the interval as needed
}
