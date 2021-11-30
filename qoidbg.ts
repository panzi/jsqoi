import { debugQOI } from "./index.js";
import { readFileSync } from 'fs';

if (process.argv.length !== 3) {
    console.log('usage: node dist/cli.js image.qoi');
    process.exit(1);
}

const qoifile = process.argv[2];

debugQOI(readFileSync(qoifile));
