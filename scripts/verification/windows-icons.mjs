import { readFile } from 'node:fs/promises';

const [executable, icon, releaseExecutable] = process.argv.slice(2);
if (!executable || !icon)
  throw Error('Expected executable and source ICO paths.');
const binary = await readFile(executable);
const source = await readFile(icon);
const pe = binary.readUInt32LE(0x3c);
if (binary.toString('ascii', pe, pe + 4) !== 'PE\0\0')
  throw Error('Invalid Windows executable.');
const optional = pe + 24;
const directories =
  optional + (binary.readUInt16LE(optional) === 0x20b ? 112 : 96);
const resourceRva = binary.readUInt32LE(directories + 16);
const sections = optional + binary.readUInt16LE(pe + 20);
function offset(rva) {
  for (let i = 0; i < binary.readUInt16LE(pe + 6); i++) {
    const section = sections + i * 40;
    const start = binary.readUInt32LE(section + 12);
    const size = Math.max(
      binary.readUInt32LE(section + 8),
      binary.readUInt32LE(section + 16),
    );
    if (rva >= start && rva < start + size)
      return binary.readUInt32LE(section + 20) + rva - start;
  }
  throw Error('Invalid resource address.');
}
const resource = offset(resourceRva);
const images = [];
function visit(directory, path = []) {
  const table = resource + directory;
  const count =
    binary.readUInt16LE(table + 12) + binary.readUInt16LE(table + 14);
  for (let i = 0; i < count; i++) {
    const entry = table + 16 + i * 8;
    const name = binary.readUInt32LE(entry);
    const target = binary.readUInt32LE(entry + 4);
    const next = [...path, name];
    if (target & 0x80000000) visit(target & 0x7fffffff, next);
    else if (next[0] === 3) {
      const data = resource + target;
      const start = offset(binary.readUInt32LE(data));
      images.push(
        binary.subarray(start, start + binary.readUInt32LE(data + 4)),
      );
    }
  }
}
visit(0);
const expected = source.readUInt16LE(4);
for (let i = 0; i < expected; i++) {
  const entry = 6 + i * 16;
  const start = source.readUInt32LE(entry + 12);
  const image = source.subarray(start, start + source.readUInt32LE(entry + 8));
  if (!images.some((actual) => actual.equals(image)))
    throw Error('Executable is missing a canonical phoenix icon image.');
}
if (releaseExecutable) {
  const release = await readFile(releaseExecutable);
  const normalize = (bytes) => {
    const copy = Buffer.from(bytes);
    const marker = Buffer.from('__TAURI_BUNDLE_TYPE_VAR_');
    const start = copy.indexOf(marker);
    if (start < 0) throw Error('Tauri bundle marker missing.');
    const type = copy.toString(
      'ascii',
      start + marker.length,
      start + marker.length + 3,
    );
    if (!['NSS', 'UNK'].includes(type))
      throw Error('Unexpected bundle type marker.');
    copy.write('UNK', start + marker.length, 'ascii');
    return copy;
  };
  if (!normalize(binary).equals(normalize(release)))
    throw Error(
      'Installed EXE differs from the release build beyond the Tauri NSIS marker.',
    );
}
console.log(
  `Verified ${expected} canonical phoenix images${releaseExecutable ? ' and release EXE payload' : ''}.`,
);
