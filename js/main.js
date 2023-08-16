var vfield = null;
var controls = null;

window.addEventListener('load', function() {
    var canvas = document.querySelector('#vfield');
    vfield = Vfield.run(canvas, rigidRotation);
    controls = new Controls(vfield);

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

    // var preset = document.querySelector('#preset');
    // preset.addEventListener('change', function() {
    //     if (preset.value === 'chaos') {
    //         controls.clear();
    //         controls.add();
    //         for (var i = 0; i < 31; i++)
    //             controls.clone();
    //     } else if (preset.value === 'gentle') {
    //         while (vfield.solutions.length < 32)
    //             controls.add();
    //         vfield.display.rotationd[0] = 0;
    //         vfield.display.rotationd[1] = 0;
    //         vfield.display.rotationd[2] = 0.007;
    //         vfield.display.damping = false;
    //     } else if (preset.value === 'bendy') {
    //         while (vfield.solutions.length < 32)
    //             controls.add();
    //         controls.set_sigma(17.24);
    //         controls.set_beta(1.1);
    //         controls.set_rho(217);
    //         vfield.display.scale = 1 / 65;
    //     }
    // });
});
