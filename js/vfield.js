/**
 * @param {canvas} HTMLCanvasElement
 * @returns {Vfield}
 */
function Vfield(canvas, updateFunc) {
    var gl = canvas.getContext('webgl') ||
             canvas.getContext('experimental-webgl');
    if (gl == null)
        throw new Error('Could not create WebGL context.');
    this.gl = gl;
    gl.clearColor(0.1, 0.1, 0.1, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.updateFunc = updateFunc;

    this.params = {
        step_size: 0.005,
        steps_per_frame: 6,
        paused: false
    };
    this.display = {
        // scale: 1 / 25,
        scale: 1/2,
        // rotation: [1.65, 3.08, -0.93],
        rotation: [1.2, 0, 6.7],
        rotationd: [0, 0, 0],
        translation: [0, 0.075, 1.81],
        draw_heads: false,
        damping: true,
        _length: 1024 // change through length getter/setter
    };

    this.solutions = [];
    this.tail = new Float32Array(0);
    this.tail_buffer = gl.createBuffer();
    this.tail_index = 0;
    this.tail_colors = new Float32Array(0);
    this.tail_colors_buffer = gl.createBuffer();
    var length = this.display._length;
    this.tail_index_buffer = Vfield.create_index_array(gl, length);
    this.tail_element_buffer = Vfield.create_element_array(gl, length);
    this.head = new Float32Array(0);
    this.head_buffer = gl.createBuffer();
    this.tail_length = new Float32Array(0);

    this.programs = {};
    var shaders = [
        'glsl/project.vert',
        'glsl/tail.vert',
        'glsl/tail.frag',
        'glsl/head.vert',
        'glsl/head.frag'
    ];
    Vfield.fetch(shaders, function(project, tail_v, tail_f, head_v, head_f) {
        this.programs.tail = Vfield.compile(gl, project + tail_v, tail_f);
        this.programs.head = Vfield.compile(gl, project + head_v, head_f);
        /* Both use two attrib arrays, so just turn them on now. */
        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        this.ready = true;
    }.bind(this));

    this.frame = 0;
    this.fps = 0;
    this.accum = 0;
    this.second = Math.floor(Date.now() / 1000);
    this.ready = false;
}

/**
 * Fetch the content for each URL and invoke the callback with the results.
 * @param {String[]} urls
 * @param {Function} callback called with one argument per URL
 * @returns {Array} array that will contain the results
 */
Vfield.fetch = function(urls, callback) {
    var results = [];
    var countdown = urls.length;
    for (var i = 0; i < urls.length; i++) {
        results.push(null);
        (function(i) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', urls[i], true);
            xhr.onload = function() {
                results[i] = xhr.responseText;
                if (--countdown === 0)
                    callback.apply(results, results);
            };
            xhr.send();
        }(i));
    }
    return results;
};

/**
 * @param {WebGLRenderingContext} gl
 * @param {string} vert
 * @param {string} frag
 * @returns {Object}
 */
Vfield.compile = function(gl, vert, frag) {
    var v = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(v, vert);
    var f = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(f, frag);
    gl.compileShader(v);
    if (!gl.getShaderParameter(v, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(v));
    gl.compileShader(f);
    if (!gl.getShaderParameter(f, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(f));
    var p = gl.createProgram();
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(p));
    var result = {
        program: p,
        attrib: {},
        uniform: {}
    };
    var nattrib = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
    for (var a = 0; a < nattrib; a++) {
        var name = gl.getActiveAttrib(p, a).name;
        var location = gl.getAttribLocation(p, name);
        result.attrib[name] = location;
    }
    var nuniform = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var u = 0; u < nuniform; u++) {
        name = gl.getActiveUniform(p, u).name;
        location = gl.getUniformLocation(p, name);
        result.uniform[name] = location;
    }
    return result;
};

/**
 * @returns {WebGLBuffer}
 */
Vfield.create_element_array = function(gl, length) {
    var data = new Uint16Array(length * 2);
    for (var i = 0; i < data.length; i++)
        data[i] = (length * 2 - i - 1) % length;
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    return buffer;
};

/**
 * @returns {WebGLBuffer}
 */
Vfield.create_index_array = function(gl, length) {
    var data = new Float32Array(length * 2);
    for (var i = 0; i < data.length; i++)
        data[i] = (length * 2 - i - 1) % length;
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return buffer;
};

// u, v = np.random.default_rng(seed=seed).uniform(0, 1, size=(2, samplesize))
// z = -2 * u + 1
// x = np.sqrt(1 - z * z) * np.cos(2 * np.pi * v)
// y = np.sqrt(1 - z * z) * np.sin(2 * np.pi * v)
// return np.stack([x, y, z], axis=1)

/**
 * @returns {number[3]}
 */
Vfield.generate = function() {
    // sample from Uni(S^2).
    u = Math.random();
    v = Math.random();
    z = -2 * u + 1;
    return [
        (1 - z*z)**0.5*Math.cos(2*Math.PI*v),
        (1 - z*z)**0.5*Math.sin(2*Math.PI*v),
        z,
    ];
};
// TODO: Quasi Monte Carlo on S^2


// TODO: 速度の絶対値に応じて色を変える
/**
 * @returns {number[3]}
 */
Vfield.color = function(i) {
    var colors = [
        0x8d, 0xd3, 0xc7,
        0xff, 0xff, 0xb3,
        0xbe, 0xba, 0xda,
        0xfb, 0x80, 0x72,
        0x80, 0xb1, 0xd3,
        0xfd, 0xb4, 0x62,
        0xb3, 0xde, 0x69,
        0xfc, 0xcd, 0xe5,
        0xd9, 0xd9, 0xd9,
        0xbc, 0x80, 0xbd,
        0xcc, 0xeb, 0xc5,
        0xff, 0xed, 0x6f,
        0xff, 0xff, 0xff
    ];
    var base = (i * 3) % colors.length;
    return colors.slice(base, base + 3).map(function(x) { return x / 255; });
};




/**
 * Update the tail WebGL buffer between two indexes.
 * @param {number} a, with a <= b
 * @param {number} b
 */
Vfield.prototype._update = function(a, b) {
    var gl = this.gl;
    var length = this.display._length;
    var buffer = this.tail.buffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tail_buffer);
    if (a == 0 && b == length - 1) {
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.tail);
    } else {
        var sublength = b - a + 1;
        for (var s = 0; s < this.solutions.length; s++)  {
            var offset = s * 3 * length * 4 + 3 * a * 4;
            /* As far as I can tell, this buffer view is optimized out.
             * Therefore no allocation actually happens. Whew!
             */
            var view = new Float32Array(buffer, offset, sublength * 3);
            gl.bufferSubData(gl.ARRAY_BUFFER, offset, view);
        }
    }
};

/**
 * Advance the system state by one frame.
 * @returns {Vfield} this
 */
Vfield.prototype.step = function() {
    if (!this.ready)
        return this;
    if (!this.params.paused) {
        var dt = this.params.step_size;
        var length = this.display._length;
        var tail = this.tail;
        var start_index = this.tail_index;
        var stop_index = 0;
        for (var s = 0; s < this.params.steps_per_frame; s++) {
            var tail_index = this.tail_index;
            this.tail_index = (this.tail_index + 1) % length;
            for (var i = 0; i < this.solutions.length; i++)  {
                this.solutions[i] = this.updateFunc(this.solutions[i], dt);
                var base = i * length * 3 + tail_index * 3;
                tail[base + 0] = this.solutions[i][0];
                tail[base + 1] = this.solutions[i][1];
                tail[base + 2] = this.solutions[i][2];
                var next = this.tail_length[i] + 1;
                this.tail_length[i] = Math.min(next, length);
            }
            stop_index  = tail_index;
        }
        if (stop_index >= start_index) {
            this._update(start_index, stop_index);
        } else {
            this._update(start_index, length - 1);
            this._update(0, stop_index);
        }
    }
    // this.display.rotation[0] += this.display.rotationd[0];
    // this.display.rotation[1] += this.display.rotationd[1];
    // this.display.rotation[2] += this.display.rotationd[2];
    // if (this.display.damping) {
    //     var damping = 0.96;
    //     this.display.rotationd[0] *= damping;
    //     this.display.rotationd[1] *= damping;
    //     this.display.rotationd[2] *= damping;
    // }
    this.frame++;
    var second = Math.floor(Date.now() / 1000);
    if (second !== this.second) {
        this.fps = this.accum;
        this.accum = 1;
        this.second = second;
    } else {
        this.accum++;
    }
    return this;
};

/**
 * Renders the current state to the associated WebGL canvas.
 * @returns {Vfield} this
 */
Vfield.prototype.draw = function() {
    if (!this.ready)
        return this;

    var gl = this.gl;
    var width = gl.canvas.clientWidth;
    var height = gl.canvas.clientHeight;
    if (gl.canvas.width != width || gl.canvas.height != height) {
        gl.canvas.width = width*4;
        gl.canvas.height = height*4;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    }
    gl.clear(gl.COLOR_BUFFER_BIT);

    var count = this.solutions.length;
    if (count == 0)
        return this;

    var aspect = gl.canvas.width / gl.canvas.height;
    var length = this.display._length;
    var scale = this.display.scale;
    var rotation = this.display.rotation;
    var translation = this.display.translation;
    var start = (this.tail_index - 1 + length) % length;

    gl.useProgram(this.programs.tail.program);
    var attrib = this.programs.tail.attrib;
    var uniform = this.programs.tail.uniform;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tail_index_buffer);
    gl.vertexAttribPointer(attrib.index, 1, gl.FLOAT, false, 0,
                           (length - start - 1) * 4);
    gl.uniform1f(uniform.aspect, aspect);
    gl.uniform1f(uniform.scale, scale);
    gl.uniform3fv(uniform.rotation, rotation);
    gl.uniform3fv(uniform.translation, translation);
    gl.uniform1f(uniform.max_length, length);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tail_buffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.tail_element_buffer);
    for (var i = 0; i < count; i++) {
        var r = this.tail_colors[i * 3 + 0];
        var g = this.tail_colors[i * 3 + 1];
        var b = this.tail_colors[i * 3 + 2];
        var offset = i * length * 4 * 3;
        gl.uniform3f(uniform.color, r, g, b);
        gl.uniform1f(uniform.tail_length, this.tail_length[i]);
        gl.vertexAttribPointer(attrib.point, 3, gl.FLOAT, false, 0, offset);
        gl.drawElements(gl.LINE_STRIP, length, gl.UNSIGNED_SHORT,
                        (length - start - 1) * 2);
    }

    if (this.display.draw_heads) {
        gl.useProgram(this.programs.head.program);
        attrib = this.programs.head.attrib;
        uniform = this.programs.head.uniform;
        for (var s = 0; s < count; s++) {
            var base = s * length * 3 + start * 3;
            this.head[s * 3 + 0] = this.tail[base + 0];
            this.head[s * 3 + 1] = this.tail[base + 1];
            this.head[s * 3 + 2] = this.tail[base + 2];
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.head_buffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.head);
        gl.vertexAttribPointer(attrib.point, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.tail_colors_buffer);
        gl.vertexAttribPointer(attrib.color, 3, gl.FLOAT, false, 0, 0);
        gl.uniform1f(uniform.aspect, aspect);
        gl.uniform1f(uniform.scale, scale);
        gl.uniform3fv(uniform.rotation, rotation);
        gl.uniform3fv(uniform.translation, translation);
        gl.drawArrays(gl.POINTS, 0, count);
    }

    return this;
};

/**
 * Adjust all buffer sizes if needed.
 */
Vfield.prototype._grow_buffers = function() {
    function next2(x) {
        return Math.pow(2, Math.ceil(Math.log(x) * Math.LOG2E));
    }
    var gl = this.gl;
    var count = next2(this.solutions.length);
    var length = this.display._length;
    if (this.tail.length < count * length * 3) {
        var old_tail = this.tail;
        this.tail = new Float32Array(count * length * 3);
        this.tail.set(old_tail);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.tail_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, count * length * 4 * 3, gl.DYNAMIC_DRAW);
        this._update(0, length - 1);
    }
    if (this.tail_length.length < count) {
        var old_tail_length = this.tail_length;
        this.tail_length = new Float32Array(count);
        this.tail_length.set(old_tail_length);
    }
    if (this.tail_colors.length < count * 3) {
        this.tail_colors = new Float32Array(count * 3);
        for (var i = 0; i < this.tail_colors.length; i++) {
            var color = Vfield.color(i);
            this.tail_colors[i * 3 + 0] = color[0];
            this.tail_colors[i * 3 + 1] = color[1];
            this.tail_colors[i * 3 + 2] = color[2];
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.tail_colors_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, count * 4 * 3, gl.STATIC_DRAW);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.tail_colors);
    }
    if (this.head.length < count * 3) {
        // No copy needed since it's always set right before draw.
        this.head = new Float32Array(count * 3);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.head_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, count * 3 * 4, gl.DYNAMIC_DRAW);
    }
};

/**
 * Add a new solution to the system.
 * @param {number[3]} s
 * @returns {Vfield} this
 */
Vfield.prototype.add = function(s) {
    var gl = this.gl;
    var length = this.display._length;
    this.solutions.push(s.slice(0));
    this._grow_buffers();
    return this;
};

/**
 * Change the tail lengths.
 * @param {number} length
 * @returns {Vfield} this
 */
Vfield.prototype._trim = function(length) {
    function mod(x, y) { // properly handles negatives
        return x - y * Math.floor(x / y);
    }
    var count = this.solutions.length;
    var oldlength = this.display._length;
    this.display._length = length;
    var old_tail = new Float32Array(this.tail.length);
    old_tail.set(this.tail);
    this._grow_buffers();
    var actual = Math.min(length, oldlength);
    for (var s = 0; s < count; s++) {
        for (var n = 0; n < actual; n++) {
            var i = mod(this.tail_index - n - 1, oldlength);
            var o = actual - n - 1;
            var obase = s * length * 3 + o * 3;
            var ibase = s * oldlength * 3 + i * 3;
            this.tail[obase + 0] = old_tail[ibase + 0];
            this.tail[obase + 1] = old_tail[ibase + 1];
            this.tail[obase + 2] = old_tail[ibase + 2];
        }
        this.tail_length[s] = Math.min(this.tail_length[s], actual);
    }
    this.tail_index = actual % length;
    this.tail_index_buffer = Vfield.create_index_array(this.gl, length);
    this.tail_element_buffer = Vfield.create_element_array(this.gl, length);
    this._update(0, length - 1);
    return this;
};

/**
 * Remove all solutions.
 * @returns {Vfield} this
 */
Vfield.prototype.empty = function() {
    this.solutions = [];
    this.tail = new Float32Array(0);
    this.tail_index = 0;
    this.tail_colors = new Float32Array(0);
    this.head = new Float32Array(0);
    this.tail_length = new Float32Array(0);
    return this;
};

Object.defineProperty(Vfield.prototype, 'length', {
    get: function() {
        return this.display._length;
    },
    set: function(v) {
        this._trim(v);
        return this.display._length;
    }
});

/**
 * Initialize and start running a demo.
 * @returns {Vfield}
 */
Vfield.run = function(canvas, updateFunc) {
    var vfield = new Vfield(canvas, updateFunc);
    for (var i = 0; i < 50; i++)
        vfield.add(Vfield.generate());
    setInterval
    function go() {
        vfield.step();
        vfield.draw();
        requestAnimationFrame(go);
    }
    requestAnimationFrame(go);
    return vfield;
};
