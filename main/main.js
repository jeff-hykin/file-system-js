// because Parcel.js 2 is jank-AF (normally eval wouldn't be needed, and normally I wouldn't have to use globalThis to get it)
const isNode = globalThis["eval"]("typeof module === 'object' && module instanceof Object && module.exports instanceof Object")
// ^ this can be deleted if you don't need to know Node vs browser/deno

// also need to use RequireJS format because of a seperate reason Parcel.js 2 is jank-AF
module.exports = {
    stuff: null
}