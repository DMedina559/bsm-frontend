/** Save directly when supported, avoiding the browser's blob-download manager. */
export async function saveTextFile(filename, content, signal) {
  if (typeof window.showSaveFilePicker !== "function") return false;
  let handle;
  try {
    // Open before the first await to preserve the click's user activation.
    handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: "Text file", accept: { "text/plain": [".txt"] } }],
    });
  } catch (error) {
    if (error.name === "SecurityError") return false; // Unsupported in cross-origin frames.
    throw error;
  }
  let stream;
  try {
    signal?.throwIfAborted();
    stream = await handle.createWritable();
    signal?.throwIfAborted();
    await stream.write(content);
    signal?.throwIfAborted();
    await stream.close();
    return true;
  } catch (error) {
    try {
      await stream?.abort();
    } catch {
      /* Preserve the original save failure. */
    }
    throw error;
  }
}
