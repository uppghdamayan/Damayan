"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const notes_utils_1 = require("./notes-utils");
function test() {
    const previous = ['Metformin 500mg', 'Lisinopril 10mg', 'Atorvastatin 20mg'];
    const current = ['Metformin 500mg', 'Atorvastatin 40mg', 'Amlodipine 5mg'];
    const results = (0, notes_utils_1.diffListItems)(current, previous);
    console.log(JSON.stringify(results, null, 2));
}
test();
