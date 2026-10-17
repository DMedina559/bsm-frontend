export const MAX_LOG_BYTES = 256 * 1024;
/** Retain a UTF-8 window; byte offsets still address the backend's full file. */
export function logWindow(page, older = false) {
  const bytes = new TextEncoder().encode(page.data);
  if (bytes.length <= MAX_LOG_BYTES) return page;
  let start = 0;
  let end = bytes.length;
  if (older) {
    end = MAX_LOG_BYTES;
    while (end > 0 && (bytes[end] & 0xc0) === 0x80) end--;
  } else {
    start = end - MAX_LOG_BYTES;
    while ((bytes[start] & 0xc0) === 0x80) start++;
  }
  return {
    ...page,
    data: new TextDecoder().decode(bytes.subarray(start, end)),
    start: page.start + start,
    end: page.end - (bytes.length - end),
    has_more: page.has_more || (start > 0 && Boolean(page.file_id)),
    tailOmitted: page.tailOmitted || older,
  };
}
