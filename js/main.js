var vfield = null;
var controls = null;

window.addEventListener('load', function() {
    var canvas = document.querySelector('#vfield');
    this.vfield = Vfield.run(canvas, rigidRotation);  // Initialize the vfield with the rigidRotation function
    // vfield = Vfield.run(canvas, gibbsRotation1);
    this.controls = new Controls(this.vfield);

    window.addEventListener('keypress', function(e) {
        if (e.which === '?'.charCodeAt(0)) {
            var h = document.querySelector('#help');
            h.style.display = h.style.display == 'none' ? 'block' : 'none';
        }
    });
    // window.addEventListener('touchstart', function self(e) {
    //     var h = document.querySelector('#help');
    //     h.style.display = 'none';
    // });

    var stats = document.querySelector('#stats');
    function update_stats() {
        var fps = vfield.fps;
        var count = vfield.solutions.length.toLocaleString();
        stats.textContent = count + ' @ ' + fps + ' FPS';
    }
    window.setInterval(update_stats, 1000);
    controls.listeners.push(update_stats);

    var channel = document.querySelector('#channel');
    channel.addEventListener('change', function() {
        if (channel.value === 'rigid') {
            this.vfield = Vfield.run(canvas, rigidRotation);
        } else if (channel.value === 'gibbs1') {
            console.log("gibbs1");
            this.vfield = Vfield.run(canvas, gibbsRotation1);
        }
        this.controls = new Controls(this.vfield);
    });
});
