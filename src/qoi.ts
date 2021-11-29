export interface QOIFile {
    width: number;
    height: number;
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

const QOI_INDEX_INIT = new Uint8Array(4 * 64);
QOI_INDEX_INIT.fill(255);

export function loadQOI(input: ArrayBuffer): QOIFile {
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

    const index = new Uint8Array(QOI_INDEX_INIT);

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
        width,
        height,
        channels,
        colorSpace,
        imageData,
    };
}
