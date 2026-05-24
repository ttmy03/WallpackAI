type ZipFileInput = {
  path: string;
  bytes: Buffer | Uint8Array;
};

const ZIP_VERSION_NEEDED = 20;
const ZIP_STORE_METHOD = 0;

export function createZipArchive(files: ZipFileInput[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(normalizeZipPath(file.path), "utf8");
    const data = Buffer.from(file.bytes);
    const crc = crc32(data);
    const localHeader = createLocalFileHeader({
      name,
      crc,
      size: data.byteLength
    });
    const centralHeader = createCentralDirectoryHeader({
      name,
      crc,
      size: data.byteLength,
      localHeaderOffset: offset
    });

    localParts.push(localHeader, data);
    centralParts.push(centralHeader);
    offset += localHeader.byteLength + data.byteLength;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = createEndOfCentralDirectory({
    fileCount: files.length,
    centralDirectorySize: centralDirectory.byteLength,
    centralDirectoryOffset: offset
  });

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function createLocalFileHeader(input: {
  name: Buffer;
  crc: number;
  size: number;
}) {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(ZIP_VERSION_NEEDED, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(ZIP_STORE_METHOD, 8);
  writeDosTimestamp(header, 10);
  header.writeUInt32LE(input.crc, 14);
  header.writeUInt32LE(input.size, 18);
  header.writeUInt32LE(input.size, 22);
  header.writeUInt16LE(input.name.byteLength, 26);
  header.writeUInt16LE(0, 28);

  return Buffer.concat([header, input.name]);
}

function createCentralDirectoryHeader(input: {
  name: Buffer;
  crc: number;
  size: number;
  localHeaderOffset: number;
}) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(0x031e, 4);
  header.writeUInt16LE(ZIP_VERSION_NEEDED, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(ZIP_STORE_METHOD, 10);
  writeDosTimestamp(header, 12);
  header.writeUInt32LE(input.crc, 16);
  header.writeUInt32LE(input.size, 20);
  header.writeUInt32LE(input.size, 24);
  header.writeUInt16LE(input.name.byteLength, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(input.localHeaderOffset, 42);

  return Buffer.concat([header, input.name]);
}

function createEndOfCentralDirectory(input: {
  fileCount: number;
  centralDirectorySize: number;
  centralDirectoryOffset: number;
}) {
  const header = Buffer.alloc(22);
  header.writeUInt32LE(0x06054b50, 0);
  header.writeUInt16LE(0, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(input.fileCount, 8);
  header.writeUInt16LE(input.fileCount, 10);
  header.writeUInt32LE(input.centralDirectorySize, 12);
  header.writeUInt32LE(input.centralDirectoryOffset, 16);
  header.writeUInt16LE(0, 20);

  return header;
}

function normalizeZipPath(path: string) {
  return path.replaceAll("\\", "/").replace(/^\/+/, "");
}

function writeDosTimestamp(buffer: Buffer, offset: number) {
  const now = new Date();
  const dosTime =
    (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate =
    ((now.getFullYear() - 1980) << 9) |
    ((now.getMonth() + 1) << 5) |
    now.getDate();

  buffer.writeUInt16LE(dosTime, offset);
  buffer.writeUInt16LE(dosDate, offset + 2);
}

const crcTable = new Uint32Array(256);

for (let index = 0; index < crcTable.length; index += 1) {
  let crc = index;

  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }

  crcTable[index] = crc >>> 0;
}

function crc32(bytes: Buffer) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}
