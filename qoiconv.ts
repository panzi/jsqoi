import '@rgba-image/create-image';
import { toPng, fromPng } from '@rgba-image/png';
import { decodeQOI, encodeQOI } from "./index.js";
import { readFileSync, writeFileSync } from 'fs';

if (process.argv.length !== 4) {
    console.log('usage: node dist/qoiconv.js image.png image.qoi');
    console.log('       node dist/qoiconv.js image.qoi image.png');
    process.exit(1);
}

const infile  = process.argv[2];
const outfile = process.argv[3];

let imageData: ImageData;

if (/\.png$/i.test(infile)) {
    imageData = fromPng(readFileSync(infile));
} else if (/\.qoi$/i.test(infile)) {
    imageData = decodeQOI(readFileSync(infile)).imageData;
} else {
    throw new Error('Input image has unknown file name extension.');
}

if (/\.png$/i.test(outfile)) {
    writeFileSync(outfile, toPng(imageData));
} else if (/\.qoi$/i.test(outfile)) {
    let channels = 3;
    const pixels = imageData.data;
    for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] != 0xFF) {
            channels = 4;
            break;
        }
    }

    writeFileSync(outfile, encodeQOI({
        channels,
        colorSpace: 0,
        imageData,
    }));
} else {
    throw new Error('Output image has unknown file name extension.');
}

