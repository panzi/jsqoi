export interface QOIFile {
    channels: number;
    colorSpace: number;
    imageData: ImageData;
}

const QOI_MAGIC_STR = 'qoif';
const QOI_MAGIC = QOI_MAGIC_STR.charCodeAt(0) << 24 |
                  QOI_MAGIC_STR.charCodeAt(1) << 16 |
                  QOI_MAGIC_STR.charCodeAt(2) <<  8 |
                  QOI_MAGIC_STR.charCodeAt(3);

const QOI_INDEX   = 0x00; // 00xxxxxx
const QOI_RUN_8   = 0x40; // 010xxxxx
const QOI_RUN_16  = 0x60; // 011xxxxx
const QOI_DIFF_8  = 0x80; // 10xxxxxx
const QOI_DIFF_16 = 0xc0; // 110xxxxx
const QOI_DIFF_24 = 0xe0; // 1110xxxx
const QOI_COLOR   = 0xf0; // 1111xxxx

const QOI_MASK_2 = 0xc0; // 11000000
const QOI_MASK_3 = 0xe0; // 11100000
const QOI_MASK_4 = 0xf0; // 11110000

const QOI_HEADER_SIZE = 14;
const QOI_PADDING = 4;

export function decodeQOI(input: ArrayBuffer): QOIFile {
    const bytes = new Uint8Array(input);

    if (bytes.length < QOI_HEADER_SIZE + QOI_PADDING) {
        throw new Error('file too short');
    }

    const magic = bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3];

    if (magic !== QOI_MAGIC) {
        throw new Error(`illegal file magic: 0x${magic.toString(16)}`);
    }

    const width  = bytes[4] << 24 | bytes[5] << 16 | bytes[ 6] << 8 | bytes[ 7];
    const height = bytes[8] << 24 | bytes[9] << 16 | bytes[10] << 8 | bytes[11];

    const channels   = bytes[12];
    const colorSpace = bytes[13];

    if (width === 0) {
        throw new Error(`illegal width: ${width}`);
    }

    if (height === 0) {
        throw new Error(`illegal height: ${height}`);
    }

    if (channels !== 3 && channels !== 4) {
        throw new Error(`illegal number of channels: ${channels}`);
    }

    if (0xf0 & colorSpace) {
        throw new Error(`illegal color space: 0x${colorSpace.toString(16)}`);
    }

    const imageData = new ImageData(width, height);
    const pixels = imageData.data;

    const index = new Uint8Array(4 * 64);
    if (channels === 3) {
        for (let indexPos = 3; indexPos < index.length; indexPos += 4) {
            index[indexPos] = 255;
        }
    }

    let run = 0|0;
    let r   = 255|0;
    let g   = 255|0;
    let b   = 255|0;
    let a   = 255|0;
    let chunksLen = bytes.length - QOI_PADDING;
    let p = QOI_HEADER_SIZE;
    const pxLen = pixels.length;
    // ImageData is always RGBA -> hardcoded 4
    for (let pxPos = 0; pxPos < pxLen; pxPos += 4) {
        if (run > 0) {
            run --;
        }
        else if (p < chunksLen) {
            const b1 = bytes[p++];

            if ((b1 & QOI_MASK_2) === QOI_INDEX) {
                const indexPos = (b1 ^ QOI_INDEX) * 4;
                r = index[indexPos];
                g = index[indexPos + 1];
                b = index[indexPos + 2];
                a = index[indexPos + 3];
            }
            else if ((b1 & QOI_MASK_3) === QOI_RUN_8) {
                run = (b1 & 0x1f);
            }
            else if ((b1 & QOI_MASK_3) === QOI_RUN_16) {
                const b2 = bytes[p++];
                run = (((b1 & 0x1f) << 8) | (b2)) + 32;
            }
            else if ((b1 & QOI_MASK_2) === QOI_DIFF_8) {
                r += ((b1 >> 4) & 0x03) - 2;
                g += ((b1 >> 2) & 0x03) - 2;
                b += ( b1       & 0x03) - 2;
            }
            else if ((b1 & QOI_MASK_3) === QOI_DIFF_16) {
                const b2 = bytes[p++];
                r += (b1 & 0x1f) - 16;
                g += (b2 >> 4)   -  8;
                b += (b2 & 0x0f) -  8;
            }
            else if ((b1 & QOI_MASK_4) === QOI_DIFF_24) {
                const b2 = bytes[p++];
                const b3 = bytes[p++];
                r += (((b1 & 0x0f) << 1) | (b2 >> 7)) - 16;
                g +=  ((b2 & 0x7c) >> 2) - 16;
                b += (((b2 & 0x03) << 3) | ((b3 & 0xe0) >> 5)) - 16;
                a +=   (b3 & 0x1f) - 16;
            }
            else if ((b1 & QOI_MASK_4) === QOI_COLOR) {
                if (b1 & 8) { r = bytes[p++]; }
                if (b1 & 4) { g = bytes[p++]; }
                if (b1 & 2) { b = bytes[p++]; }
                if (b1 & 1) { a = bytes[p++]; }
            }

            const indexPos = ((r ^ g ^ b ^ a) % 64) * 4;
            index[indexPos    ] = r;
            index[indexPos + 1] = g;
            index[indexPos + 2] = b;
            index[indexPos + 3] = a;
        }

        pixels[pxPos    ] = r;
        pixels[pxPos + 1] = g;
        pixels[pxPos + 2] = b;
        pixels[pxPos + 3] = a;
    }

    return {
        channels,
        colorSpace,
        imageData,
    };
}

export function encodeQOI(file: QOIFile): Uint8Array {
    const { channels, colorSpace, imageData } = file;
    const { width, height } = imageData;
    const pixels = imageData.data;
    const bytes = new Uint8Array(QOI_HEADER_SIZE + QOI_PADDING + width * height * (channels + 1));

    if (width === 0 || width > 0xFFFF) {
        throw new Error(`illegal width: ${width}`);
    }

    if (height === 0 || height > 0xFFFF) {
        throw new Error(`illegal height: ${height}`);
    }

    if (channels !== 3 && channels !== 4) {
        throw new Error(`illegal number of channels: ${channels}`);
    }

    if (0xf0 & colorSpace) {
        throw new Error(`illegal color space: 0x${colorSpace.toString(16)}`);
    }

    bytes[0] = (QOI_MAGIC >> 24);
    bytes[1] = (QOI_MAGIC >> 16) & 0xFF;
    bytes[2] = (QOI_MAGIC >>  8) & 0xFF;
    bytes[3] =  QOI_MAGIC        & 0xFF;

    bytes[4] = (width >> 24);
    bytes[5] = (width >> 16) & 0xFF;
    bytes[6] = (width >> 8 ) & 0xFF;
    bytes[7] =  width        & 0xFF;

    bytes[ 8] = (height >> 24);
    bytes[ 9] = (height >> 16) & 0xFF;
    bytes[10] = (height >>  8) & 0xFF;
    bytes[11] =  height        & 0xFF;

    bytes[12] = channels;
    bytes[13] = colorSpace;

    const index = new Uint32Array(64);

    let run = 0|0;
    let rPrev = 0|0;
    let gPrev = 0|0;
    let bPrev = 0|0;
    let aPrev = 255|0;
    let vPrev = 255|0;
    let r = 0|0;
    let g = 0|0;
    let b = 0|0;
    let a = 255|0;
    let v = 255|0;
    let p = QOI_HEADER_SIZE;

    const pxLen = width * height * 4;
    const pxEnd = pxLen - 4;

    for (let pxPos = 0; pxPos < pxLen; pxPos += 4) {
        r = pixels[pxPos];
        g = pixels[pxPos + 1];
        b = pixels[pxPos + 2];

        if (channels === 4) {
            a = pixels[pxPos + 3];
        }

        v = (r << 24) | (g << 16) | (b << 8) | a;

        if (v === vPrev) {
            run++;
        }

        if (
            run > 0 &&
            (run === 0x2020 || v !== vPrev || pxPos === pxEnd)
        ) {
            if (run < 33) {
                run -= 1;
                bytes[p++] = QOI_RUN_8 | run;
            }
            else {
                run -= 33;
                bytes[p++] = QOI_RUN_16 | run >> 8;
                bytes[p++] = run;
            }
            run = 0;
        }

        if (v !== vPrev) {
            const indexPos = (r ^ g ^ b ^ a) % 64;

            if (index[indexPos] === v) {
                bytes[p++] = QOI_INDEX | indexPos;
            }
            else {
                index[indexPos] = v;

                const vr = r - rPrev;
                const vg = g - gPrev;
                const vb = b - bPrev;
                const va = a - aPrev;

                if (
                    vr > -17 && vr < 16 &&
                    vg > -17 && vg < 16 &&
                    vb > -17 && vb < 16 &&
                    va > -17 && va < 16
                ) {
                    if (
                        va === 0 &&
                        vr > -3 && vr < 2 &&
                        vg > -3 && vg < 2 &&
                        vb > -3 && vb < 2
                    ) {
                        bytes[p++] = QOI_DIFF_8 | ((vr + 2) << 4) | (vg + 2) << 2 | (vb + 2);
                    }
                    else if (
                        va === 0 &&
                        vr > -17 && vr < 16 &&
                        vg >  -9 && vg <  8 &&
                        vb >  -9 && vb <  8
                    ) {
                        bytes[p++] = QOI_DIFF_16   | (vr + 16);
                        bytes[p++] = (vg + 8) << 4 | (vb +  8);
                    }
                    else {
                        bytes[p++] = QOI_DIFF_24    | (vr + 16) >> 1;
                        bytes[p++] = (vr + 16) << 7 | (vg + 16) << 2 | (vb + 16) >> 3;
                        bytes[p++] = (vb + 16) << 5 | (va + 16);
                    }
                }
                else {
                    bytes[p++] = QOI_COLOR | (vr ? 8 : 0) | (vg ? 4 : 0) | (vb ? 2 : 0) | (va ? 1 : 0);
                    if (vr) { bytes[p++] = r; }
                    if (vg) { bytes[p++] = g; }
                    if (vb) { bytes[p++] = b; }
                    if (va) { bytes[p++] = a; }
                }
            }
        }
        rPrev = r;
        gPrev = g;
        bPrev = b;
        aPrev = a;
        vPrev = v;
    }

    p += QOI_PADDING;

    return bytes.slice(0, p);
}

export interface DebugHeader {
    type: 'HEADER';
    width: number;
    height: number;
    colorSpace: number;
    channels: number;
}

export interface DebugIndex {
    type: 'INDEX';
    index: number;
}

export interface DebugRun {
    type: 'RUN_8' | 'RUN_16';
    run: number;
}

export interface DebugDiff {
    type: 'DIFF_8' | 'DIFF_16';
    r: number;
    g: number;
    b: number;
}

export interface DebugDiff24 {
    type: 'DIFF_24';
    r: number;
    g: number;
    b: number;
    a: number;
}

export interface DebugColor {
    type: 'COLOR';
    r?: number;
    g?: number;
    b?: number;
    a?: number;
}

export type DebugItem = DebugHeader | DebugIndex | DebugRun | DebugDiff | DebugDiff24 | DebugColor;

function writeDebug(item: DebugItem): void {
    console.error(item);
}

export function debugQOI(input: ArrayBuffer, debug: (item: DebugItem) => void = writeDebug): void {
    const bytes = new Uint8Array(input);

    if (bytes.length < QOI_HEADER_SIZE + QOI_PADDING) {
        throw new Error('file too short');
    }

    const magic = bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3];

    if (magic !== QOI_MAGIC) {
        throw new Error(`illegal file magic: 0x${magic.toString(16)}`);
    }

    const width  = bytes[4] << 24 | bytes[5] << 16 | bytes[ 6] << 8 | bytes[ 7];
    const height = bytes[8] << 24 | bytes[9] << 16 | bytes[10] << 8 | bytes[11];

    const channels   = bytes[12];
    const colorSpace = bytes[13];

    if (width === 0) {
        throw new Error(`illegal width: ${width}`);
    }

    if (height === 0) {
        throw new Error(`illegal height: ${height}`);
    }

    if (channels !== 3 && channels !== 4) {
        throw new Error(`illegal number of channels: ${channels}`);
    }

    if (0xf0 & colorSpace) {
        throw new Error(`illegal color space: 0x${colorSpace.toString(16)}`);
    }

    const index = new Uint8Array(4 * 64);
    if (channels === 3) {
        for (let indexPos = 3; indexPos < index.length; indexPos += 4) {
            index[indexPos] = 255;
        }
    }

    writeDebug({
        type: 'HEADER',
        width,
        height,
        colorSpace,
        channels
    });

    let run = 0|0;
    let r   = 255|0;
    let g   = 255|0;
    let b   = 255|0;
    let a   = 255|0;
    let chunksLen = bytes.length - QOI_PADDING;
    let p = QOI_HEADER_SIZE;
    const pxLen = width * height * channels;
    // ImageData is always RGBA -> hardcoded 4
    for (let pxPos = 0; pxPos < pxLen; pxPos += 4) {
        if (run > 0) {
            run --;
        }
        else if (p < chunksLen) {
            const b1 = bytes[p++];

            if ((b1 & QOI_MASK_2) === QOI_INDEX) {
                const indexPos = (b1 ^ QOI_INDEX) * 4;
                writeDebug({
                    type: 'INDEX',
                    index: indexPos,
                });
                r = index[indexPos];
                g = index[indexPos + 1];
                b = index[indexPos + 2];
                a = index[indexPos + 3];
            }
            else if ((b1 & QOI_MASK_3) === QOI_RUN_8) {
                run = (b1 & 0x1f);
                writeDebug({
                    type: 'RUN_8',
                    run,
                });
            }
            else if ((b1 & QOI_MASK_3) === QOI_RUN_16) {
                const b2 = bytes[p++];
                run = (((b1 & 0x1f) << 8) | (b2)) + 32;
                writeDebug({
                    type: 'RUN_8',
                    run,
                });
            }
            else if ((b1 & QOI_MASK_2) === QOI_DIFF_8) {
                const dr = ((b1 >> 4) & 0x03) - 2;
                const dg = ((b1 >> 2) & 0x03) - 2;
                const db = ( b1       & 0x03) - 2;
                writeDebug({
                    type: 'DIFF_8',
                    r: dr,
                    g: dg,
                    b: db,
                });
                r += dr;
                g += dg;
                b += db;
            }
            else if ((b1 & QOI_MASK_3) === QOI_DIFF_16) {
                const b2 = bytes[p++];
                const dr = (b1 & 0x1f) - 16;
                const dg = (b2 >> 4)   -  8;
                const db = (b2 & 0x0f) -  8;
                writeDebug({
                    type: 'DIFF_16',
                    r: dr,
                    g: dg,
                    b: db,
                });
                r += dr;
                g += dg;
                b += db;
            }
            else if ((b1 & QOI_MASK_4) === QOI_DIFF_24) {
                const b2 = bytes[p++];
                const b3 = bytes[p++];
                const dr = (((b1 & 0x0f) << 1) | (b2 >> 7)) - 16;
                const dg =  ((b2 & 0x7c) >> 2) - 16;
                const db = (((b2 & 0x03) << 3) | ((b3 & 0xe0) >> 5)) - 16;
                const da =   (b3 & 0x1f) - 16;
                writeDebug({
                    type: 'DIFF_24',
                    r: dr,
                    g: dg,
                    b: db,
                    a: da,
                });
                r += dr;
                g += dg;
                b += db;
                a += da;
            }
            else if ((b1 & QOI_MASK_4) === QOI_COLOR) {
                const dbg: DebugColor = { type: 'COLOR' };
                if (b1 & 8) { dbg.r = r = bytes[p++]; }
                if (b1 & 4) { dbg.g = g = bytes[p++]; }
                if (b1 & 2) { dbg.b = b = bytes[p++]; }
                if (b1 & 1) { dbg.a = a = bytes[p++]; }
                writeDebug(dbg);
            }

            const indexPos = ((r ^ g ^ b ^ a) % 64) * 4;
            index[indexPos    ] = r;
            index[indexPos + 1] = g;
            index[indexPos + 2] = b;
            index[indexPos + 3] = a;
        }
    }
}
