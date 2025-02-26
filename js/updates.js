
// Update functions

/**
 * Update s to the next Vfield state using RK4.
 * Performs no allocations and hopefully JITs very effectively.
 * @param {!number[3]} state
 * @param {!number}    dt
 * @returns {!number[3]} newState
 */
function rigidRotation(state, dt) {
  /**
  * Corresponding to v-field induced from the stream function Psi(x, y, z) = z on the unit sphere
  */
  function radious(z) { return (1 - z**2)**0.5}
  function dx(x, y, z) { return -y/(x**2 + y**2)**0.5*radious(z); }  // equal to -y on the unit sphere
  function dy(x, y, z) { return x/(x**2 + y**2)**0.5*radious(z); }  // equal to x on the unit sphere
  function dz(x, y, z) { return 0; }


  return rk4(state, dx, dy, dz, dt);
};

function gibbsRotation1(state, dt) {
  function poly(z) { return 0.0696 + 3*0.0104*z**2 + 5*0.1*z**4}
  function dx(x, y, z) { return -y * 10 * poly(z); }  // equal to -y on the unit sphere
  function dy(x, y, z) { return x * 10 * poly(z); }  // equal to x on the unit sphere
  function dz(x, y, z) { return 0; }


  return rk4(state, dx, dy, dz, dt)
}

function rk4(state, dx, dy, dz, dt) {
  var x = state[0];
  var y = state[1];
  var z = state[2];

  // RK4
  var k1dx = dx(x, y, z);
  var k1dy = dy(x, y, z);
  var k1dz = dz(x, y, z);

  var k2x = x + k1dx * dt / 2;
  var k2y = y + k1dy * dt / 2;
  var k2z = z + k1dz * dt / 2;

  var k2dx = dx(k2x, k2y, k2z);
  var k2dy = dy(k2x, k2y, k2z);
  var k2dz = dz(k2x, k2y, k2z);

  var k3x = x + k2dx * dt / 2;
  var k3y = y + k2dy * dt / 2;
  var k3z = z + k2dz * dt / 2;

  var k3dx = dx(k3x, k3y, k3z);
  var k3dy = dy(k3x, k3y, k3z);
  var k3dz = dz(k3x, k3y, k3z);

  var k4x = x + k3dx * dt;
  var k4y = y + k3dy * dt;
  var k4z = z + k3dz * dt;

  var k4dx = dx(k4x, k4y, k4z);
  var k4dy = dy(k4x, k4y, k4z);
  var k4dz = dz(k4x, k4y, k4z);

  newState = [0, 0, 0];
  newState[0] = x + (k1dx + 2*k2dx + 2*k3dx + k4dx) * dt / 6;
  newState[1] = y + (k1dy + 2*k2dy + 2*k3dy + k4dy) * dt / 6;
  newState[2] = z + (k1dz + 2*k2dz + 2*k3dz + k4dz) * dt / 6;

  return newState
}