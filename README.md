jsqoi - TypeScript port of QOI
==============================

QOI is an extremely simple file format with O(n) encoding/decoding performance.

See the [original QOI implementation in C](https://github.com/phoboslab/qoi) for more information.

Reference
---------

### QOIFile

```TypeScript
interface QOIFile {
    channels: number;
    colorSpace: number;
    imageData: ImageData;
}
```

* `channels`: Either `3` for RGB or `4` for RGBA. Note that the `imageData` is
  always RGBA. This field just reports how many channels the decoded QOI file
  had (for decoding) or if the alpha channel shall be encoded (for encoded).
* `colorSpace`: A bitmap 0000rgba where
  * a zero bit indicates sRGBA,
  * a one bit indicates linear (user interpreted)
  
  colorspace for each channel. Note that this library doesn't do any color
  space conversion.
* `imageData`: RGBA image data that can be used with a HTML canvas element.

### decodeQOI()

```TypeScript
function decodeQOI(input: ArrayBuffer): QOIFile
```

Decode QOI file provided as an `ArrayBuffer`.

### encoeQOI()

```TypeScript
function encodeQOI(file: QOIFile): Uint8Array
```

Encode `ImageData` as a QOI file.

TODO
----

* npm release
