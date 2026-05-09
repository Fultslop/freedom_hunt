export function getExtension(filePath: string): string {
  const lastDotIndex = filePath.lastIndexOf('.');
  const lastSlashIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));

  // Ensure the dot is part of the filename, not a directory name
  if (lastDotIndex > lastSlashIndex) {
    return filePath.slice(lastDotIndex + 1);
  }

  return '';
}
