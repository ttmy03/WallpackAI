export type ImageDimensions = {
  width: number;
  height: number;
};

export function readImageDimensions(bytes: Uint8Array): ImageDimensions | null {
  return (
    readPngDimensions(bytes) ??
    readJpegDimensions(bytes) ??
    readWebpDimensions(bytes)
  );
}

function readPngDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return null;
  }

  return {
    width: readUint32Be(bytes, 16),
    height: readUint32Be(bytes, 20)
  };
}

function readJpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }

  let offset = 2;

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];

    if (marker === 0xd9 || marker === 0xda) {
      return null;
    }

    if (marker >= 0xd0 && marker <= 0xd7) {
      offset += 2;
      continue;
    }

    const segmentLength = readUint16Be(bytes, offset + 2);

    if (segmentLength < 2 || offset + 2 + segmentLength > bytes.length) {
      return null;
    }

    if (isJpegStartOfFrameMarker(marker)) {
      return {
        height: readUint16Be(bytes, offset + 5),
        width: readUint16Be(bytes, offset + 7)
      };
    }

    offset += 2 + segmentLength;
  }

  return null;
}

function isJpegStartOfFrameMarker(marker: number) {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

function readWebpDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (
    bytes.length < 30 ||
    bytes[0] !== 0x52 ||
    bytes[1] !== 0x49 ||
    bytes[2] !== 0x46 ||
    bytes[3] !== 0x46 ||
    bytes[8] !== 0x57 ||
    bytes[9] !== 0x45 ||
    bytes[10] !== 0x42 ||
    bytes[11] !== 0x50
  ) {
    return null;
  }

  const chunkType = stringFromAscii(bytes, 12, 16);

  if (chunkType === "VP8X") {
    return {
      width: readUint24Le(bytes, 24) + 1,
      height: readUint24Le(bytes, 27) + 1
    };
  }

  if (chunkType === "VP8L" && bytes[20] === 0x2f) {
    const bits =
      bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);

    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1
    };
  }

  if (
    chunkType === "VP8 " &&
    bytes[23] === 0x9d &&
    bytes[24] === 0x01 &&
    bytes[25] === 0x2a
  ) {
    return {
      width: readUint16Le(bytes, 26) & 0x3fff,
      height: readUint16Le(bytes, 28) & 0x3fff
    };
  }

  return null;
}

function readUint16Be(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint16Le(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint24Le(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32Be(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] * 0x1000000 +
    ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
  );
}

function stringFromAscii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end));
}
